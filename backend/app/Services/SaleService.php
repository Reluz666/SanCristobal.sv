<?php

declare(strict_types=1);

namespace App\Services;

use App\DTOs\CreateSaleDTO;
use App\DTOs\CustomerDataDTO;
use App\DTOs\KardexMovementDTO;
use App\DTOs\SalePaymentDTO;
use App\Enums\DocumentType;
use App\Enums\IdentityDocumentType;
use App\Enums\KardexMovementType;
use App\Enums\SunatStatus;
use App\Exceptions\ApiException;
use App\Exceptions\BusinessRuleException;
use App\Models\CashRegisterSession;
use App\Models\Customer;
use App\Models\DocumentSeries;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\Money;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Orquestador atomico de la venta POS.
 *
 * Serie, venta, items, pagos y Kardex se confirman en una sola transaccion.
 * El envio a SUNAT se ejecuta despues del commit para que una caida del
 * servicio externo no pierda la venta ni el descuento de inventario.
 */
final class SaleService
{
    private const RECEIPT_IDENTIFICATION_THRESHOLD = '700.00';

    public function __construct(
        private readonly TenantContext $tenantContext,
        private readonly SaleCalculator $calculator,
        private readonly KardexService $kardex,
        private readonly SunatService $sunat,
    ) {}

    public function createSale(CreateSaleDTO $dto, User $cashier, ?string $idempotencyKey = null): Sale
    {
        $companyId = $this->tenantContext->companyId()
            ?? ($cashier->getAttribute('company_id') !== null ? (int) $cashier->getAttribute('company_id') : null);

        if ($companyId === null) {
            throw ApiException::conflict('No existe una empresa activa para emitir el comprobante.');
        }

        if ($idempotencyKey !== null && $idempotencyKey !== '') {
            $cacheKey = sprintf('idempotency:sale:%d:%s', $companyId, $idempotencyKey);
            $cachedSaleId = Cache::get($cacheKey);

            if ($cachedSaleId !== null) {
                $existingSale = Sale::query()->whereKey($cachedSaleId)->first();

                if ($existingSale instanceof Sale) {
                    return $this->loadSaleRelations($existingSale);
                }
            }

            $lock = Cache::lock(sprintf('lock:sale:%d:%s', $companyId, $idempotencyKey), 10);

            try {
                if (! $lock->block(3)) {
                    throw ApiException::conflict('La venta está siendo procesada concurrentemente. Por favor espere.');
                }

                $cachedSaleId = Cache::get($cacheKey);
                if ($cachedSaleId !== null) {
                    $existingSale = Sale::query()->whereKey($cachedSaleId)->first();

                    if ($existingSale instanceof Sale) {
                        return $this->loadSaleRelations($existingSale);
                    }
                }

                $sale = $this->executeSaleTransaction($dto, $cashier, $companyId);
                Cache::put($cacheKey, $sale->getKey(), now()->addHours(24));

                return $this->processSunatAndReturn($sale);
            } finally {
                $lock->release();
            }
        }

        $sale = $this->executeSaleTransaction($dto, $cashier, $companyId);

        return $this->processSunatAndReturn($sale);
    }

    private function executeSaleTransaction(CreateSaleDTO $dto, User $cashier, int $companyId): Sale
    {
        return DB::transaction(function () use ($dto, $cashier, $companyId): Sale {
            $cashSessionsEnabled = $this->tenantContext->company()?->cashSessionsEnabled() ?? false;
            $session = null;
            $warehouse = null;

            if ($cashSessionsEnabled) {
                $session = CashRegisterSession::query()
                    ->where('user_id', $cashier->getKey())
                    ->open()
                    ->lockForUpdate()
                    ->first();

                if (! $session instanceof CashRegisterSession) {
                    throw ApiException::conflict('Debe aperturar un turno de caja antes de emitir una venta.');
                }

                $session->load(['cashRegister.warehouse']);
                $warehouse = $session->cashRegister?->warehouse;

                if (! $warehouse instanceof Warehouse || ! $warehouse->is_active) {
                    throw ApiException::conflict('La caja no tiene un almacén activo asociado.');
                }

                if ($dto->warehouseUuid !== null && $dto->warehouseUuid !== $warehouse->uuid) {
                    throw ApiException::conflict('El almacén seleccionado no coincide con el almacén de la caja abierta.');
                }
            } else {
                $warehouseQuery = Warehouse::query()
                    ->where('is_active', true)
                    ->orderBy('code');

                if ($dto->warehouseUuid !== null) {
                    $warehouse = $warehouseQuery
                        ->where('uuid', $dto->warehouseUuid)
                        ->lockForUpdate()
                        ->first();

                    if (! $warehouse instanceof Warehouse) {
                        throw ApiException::notFound('El almacén seleccionado no existe o está inactivo.');
                    }
                } else {
                    $activeWarehouses = $warehouseQuery->lockForUpdate()->limit(2)->get();

                    if ($activeWarehouses->count() > 1) {
                        throw ApiException::conflict('Selecciona el almacén desde el que se registrará la venta.');
                    }

                    $warehouse = $activeWarehouses->first();
                }

                if (! $warehouse instanceof Warehouse) {
                    throw ApiException::conflict('No hay un almacén activo para registrar la venta.');
                }
            }

            $customer = $this->resolveCustomer($dto);
            $products = $this->loadProducts($dto);
            $lines = [];

            foreach ($dto->items as $item) {
                $lines[] = [
                    'product' => $products[$item->productUuid],
                    'quantity' => $item->quantity,
                ];
            }

            $calculation = $this->calculator->calculate($lines);
            $this->assertCustomerRules($dto->documentType, $customer, $calculation['total_amount']);
            $this->assertPayments($dto->payments, $calculation['total_amount']);

            $number = $this->nextNumber($dto->documentType, (int) $warehouse->getKey());

            $sale = Sale::query()->create([
                'company_id' => $companyId,
                'warehouse_id' => $warehouse->getKey(),
                'cash_register_session_id' => $session?->getKey(),
                'customer_id' => $customer->getKey(),
                'user_id' => $cashier->getKey(),
                'document_type' => $dto->documentType,
                'series' => $number['series'],
                'correlative' => $number['correlative'],
                'issue_date' => now(),
                'currency' => 'PEN',
                'exchange_rate' => '1.0000',
                'total_taxed' => $calculation['total_taxed'],
                'total_exonerated' => $calculation['total_exonerated'],
                'total_unaffected' => $calculation['total_unaffected'],
                'total_igv' => $calculation['total_igv'],
                'total_discount' => $calculation['total_discount'],
                'total_amount' => $calculation['total_amount'],
                'sunat_status' => $dto->documentType->isElectronic()
                    ? SunatStatus::Pending
                    : SunatStatus::Internal,
                'sunat_description' => $dto->documentType->isElectronic()
                    ? 'Pendiente de envío a SUNAT.'
                    : 'Nota de venta interna: no requiere envío a SUNAT.',
            ]);

            foreach ($calculation['lines'] as $line) {
                $sale->items()->create([
                    'product_id' => $line['product']->getKey(),
                    'description' => $line['product']->name,
                    'unit_code' => $line['product']->unit_code,
                    'tax_affectation_type' => $line['affectation'],
                    'quantity' => $line['quantity'],
                    'unit_value' => $line['unit_value'],
                    'unit_price' => $line['unit_price'],
                    'igv_percentage' => $line['affectation']->isTaxed() ? '18.00' : '0.00',
                    'total_igv' => $line['igv'],
                    'subtotal' => $line['subtotal'],
                    'total' => $line['total'],
                ]);
            }

            foreach ($dto->payments as $payment) {
                $sale->payments()->create([
                    'payment_method' => $payment->method,
                    'amount' => Money::round($payment->amount, 2),
                    'reference_number' => $payment->referenceNumber,
                ]);
            }

            $orderedLines = $calculation['lines'];
            usort(
                $orderedLines,
                static fn (array $left, array $right): int => $left['product']->getKey() <=> $right['product']->getKey(),
            );

            foreach ($orderedLines as $line) {
                $product = $line['product'];

                if (! $product->track_stock) {
                    continue;
                }

                $this->kardex->registerMovement(new KardexMovementDTO(
                    companyId: $companyId,
                    warehouseId: (int) $warehouse->getKey(),
                    productId: (int) $product->getKey(),
                    userId: (int) $cashier->getKey(),
                    movementType: KardexMovementType::OutSale,
                    movementDate: $sale->issue_date,
                    quantity: $line['quantity'],
                    unitCost: null,
                    documentType: $dto->documentType,
                    documentReference: $sale->number(),
                    reference: $sale,
                    notes: 'Salida automática por venta POS',
                ));
            }

            return $sale;
        });

        return $this->processSunatAndReturn($sale);
    }

    private function processSunatAndReturn(Sale $sale): Sale
    {
        try {
            $sale = $this->sunat->processSale($sale);
        } catch (Throwable $exception) {
            Log::error('El comprobante se emitió, pero falló el procesamiento SUNAT.', [
                'sale_uuid' => $sale->uuid,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            $sale->forceFill([
                'sunat_status' => SunatStatus::Pending,
                'sunat_description' => 'Venta confirmada. Pendiente de reintento con SUNAT.',
            ])->save();
        }

        return $this->loadSaleRelations($sale);
    }

    private function loadSaleRelations(Sale $sale): Sale
    {
        return $sale->load([
            'items.product',
            'payments',
            'customer',
            'user',
            'warehouse',
            'cashRegisterSession',
            'company',
        ]);
    }

    private function resolveCustomer(CreateSaleDTO $dto): Customer
    {
        if ($dto->customerUuid !== null) {
            $customer = Customer::query()
                ->where('uuid', $dto->customerUuid)
                ->where('is_active', true)
                ->first();

            if (! $customer instanceof Customer) {
                throw BusinessRuleException::fromMessages([
                    'customer_uuid' => ['El cliente seleccionado no existe o está inactivo.'],
                ]);
            }

            return $customer;
        }

        if ($dto->customer instanceof CustomerDataDTO) {
            $this->assertDocumentFormat($dto->customer);

            return Customer::query()->firstOrCreate(
                [
                    'identity_document_type' => $dto->customer->identityDocumentType->value,
                    'document_number' => $dto->customer->documentNumber,
                ],
                [
                    'legal_name' => $dto->customer->legalName,
                    'address' => $dto->customer->address,
                    'ubigeo' => $dto->customer->ubigeo,
                    'email' => $dto->customer->email,
                    'phone' => $dto->customer->phone,
                    'is_active' => true,
                ],
            );
        }

        $generic = Customer::query()
            ->where('identity_document_type', IdentityDocumentType::None->value)
            ->where('document_number', '00000000')
            ->first();

        if ($generic instanceof Customer) {
            return $generic;
        }

        return Customer::query()->create([
            'identity_document_type' => IdentityDocumentType::None,
            'document_number' => '00000000',
            'legal_name' => 'CLIENTES VARIOS',
            'is_active' => true,
        ]);
    }

    /**
     * @return array<string, Product>
     */
    private function loadProducts(CreateSaleDTO $dto): array
    {
        $uuids = array_values(array_unique(array_map(
            static fn ($item): string => $item->productUuid,
            $dto->items,
        )));

        if (count($uuids) !== count($dto->items)) {
            throw BusinessRuleException::fromMessages([
                'items' => ['No se permite repetir el mismo producto en el comprobante.'],
            ]);
        }

        /** @var array<string, Product> $products */
        $products = Product::query()
            ->whereIn('uuid', $uuids)
            ->where('is_active', true)
            ->get()
            ->keyBy('uuid')
            ->all();

        if (count($products) !== count($uuids)) {
            throw BusinessRuleException::fromMessages([
                'items' => ['Uno o más productos no existen o están inactivos.'],
            ]);
        }

        return $products;
    }

    private function assertCustomerRules(DocumentType $type, Customer $customer, string $total): void
    {
        if ($type === DocumentType::Invoice) {
            if ($customer->identity_document_type !== IdentityDocumentType::Ruc
                || preg_match('/^\d{11}$/', $customer->document_number) !== 1) {
                throw BusinessRuleException::fromMessages([
                    'customer_uuid' => ['La factura requiere un cliente identificado con RUC de 11 dígitos.'],
                ]);
            }

            return;
        }

        if ($type === DocumentType::Receipt
            && Money::cmp($total, self::RECEIPT_IDENTIFICATION_THRESHOLD, 2) > 0) {
            $identified = in_array(
                $customer->identity_document_type,
                [IdentityDocumentType::Dni, IdentityDocumentType::Ruc],
                true,
            ) && $customer->document_number !== '00000000';

            if (! $identified) {
                throw BusinessRuleException::fromMessages([
                    'customer_uuid' => ['Las boletas superiores a S/ 700.00 requieren DNI o RUC del cliente.'],
                ]);
            }
        }
    }

    private function assertDocumentFormat(CustomerDataDTO $customer): void
    {
        $type = $customer->identityDocumentType;
        $number = $customer->documentNumber;

        $valid = match ($type) {
            IdentityDocumentType::Dni => preg_match('/^\d{8}$/', $number) === 1,
            IdentityDocumentType::Ruc => preg_match('/^\d{11}$/', $number) === 1,
            IdentityDocumentType::ForeignCard, IdentityDocumentType::Passport => preg_match('/^[A-Za-z0-9]{1,12}$/', $number) === 1,
            IdentityDocumentType::None => $number === '00000000',
        };

        if (! $valid) {
            throw BusinessRuleException::fromMessages([
                'customer.document_number' => ['El número de documento no corresponde al tipo seleccionado.'],
            ]);
        }
    }

    /**
     * @param  list<SalePaymentDTO>  $payments
     */
    private function assertPayments(array $payments, string $total): void
    {
        if ($payments === []) {
            throw BusinessRuleException::fromMessages([
                'payments' => ['Debe registrar al menos un medio de pago.'],
            ]);
        }

        $paid = '0.00';

        foreach ($payments as $index => $payment) {
            $amount = Money::round($payment->amount, 2);

            if (! Money::isPositive($amount)) {
                throw BusinessRuleException::fromMessages([
                    'payments.'.$index.'.amount' => ['Cada pago debe ser mayor a cero.'],
                ]);
            }

            if ($payment->method->requiresReference()
                && ($payment->referenceNumber === null || $payment->referenceNumber === '')) {
                throw BusinessRuleException::fromMessages([
                    'payments.'.$index.'.reference_number' => ['El medio de pago seleccionado requiere número de operación.'],
                ]);
            }

            $paid = Money::add($paid, $amount, 2);
        }

        if (Money::cmp($paid, $total, 2) !== 0) {
            throw BusinessRuleException::fromMessages([
                'payments' => ['La suma de los pagos debe ser exactamente igual al total del comprobante.'],
            ]);
        }
    }

    /**
     * @return array{series: string, correlative: int}
     */
    private function nextNumber(DocumentType $type, int $warehouseId): array
    {
        $series = DocumentSeries::query()
            ->where('warehouse_id', $warehouseId)
            ->where('document_type', $type->value)
            ->where('is_active', true)
            ->orderBy('series')
            ->lockForUpdate()
            ->first();

        if (! $series instanceof DocumentSeries) {
            throw BusinessRuleException::fromMessages([
                'document_type' => ['No existe una serie activa para el tipo de comprobante en este almacén.'],
            ]);
        }

        $correlative = (int) $series->current_correlative + 1;
        $series->current_correlative = $correlative;
        $series->save();

        return ['series' => $series->series, 'correlative' => $correlative];
    }

    public function voidSale(Sale $sale, User $user, string $reason = 'Anulación de la operación'): Sale
    {
        $companyId = $this->tenantContext->companyId()
            ?? ($user->getAttribute('company_id') !== null ? (int) $user->getAttribute('company_id') : null);

        if ($companyId === null || (int) $sale->getAttribute('company_id') !== $companyId) {
            throw ApiException::forbidden('No tiene autorización para anular comprobantes de otra empresa.');
        }

        if ($sale->sunat_status === SunatStatus::Annulled) {
            throw BusinessRuleException::fromMessages([
                'sale' => ['El comprobante ya fue anulado previamente.'],
            ]);
        }

        if ($sale->sunat_status === SunatStatus::Rejected) {
            throw BusinessRuleException::fromMessages([
                'sale' => ['No se puede anular un comprobante rechazado por SUNAT.'],
            ]);
        }

        return DB::transaction(function () use ($sale, $user, $companyId, $reason): Sale {
            /** @var Sale $lockedSale */
            $lockedSale = Sale::query()
                ->whereKey($sale->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedSale->sunat_status === SunatStatus::Annulled) {
                throw BusinessRuleException::fromMessages([
                    'sale' => ['El comprobante ya fue anulado previamente.'],
                ]);
            }

            $creditNote = $this->nextCreditNoteNumber($lockedSale);
            $creditNoteNumber = sprintf('%s-%08d', $creditNote['series'], $creditNote['correlative']);

            $lockedSale->loadMissing(['items.product', 'warehouse', 'customer']);

            $orderedItems = $lockedSale->items->all();
            usort(
                $orderedItems,
                static fn ($left, $right): int => ($left->product_id ?? 0) <=> ($right->product_id ?? 0),
            );

            foreach ($orderedItems as $item) {
                $product = $item->product;

                if (! $product instanceof Product || ! $product->track_stock) {
                    continue;
                }

                $this->kardex->registerMovement(new KardexMovementDTO(
                    companyId: $companyId,
                    warehouseId: (int) $lockedSale->warehouse_id,
                    productId: (int) $product->getKey(),
                    userId: (int) $user->getKey(),
                    movementType: KardexMovementType::InReturn,
                    movementDate: now(),
                    quantity: (string) $item->quantity,
                    unitCost: (string) $item->unit_value,
                    documentType: DocumentType::CreditNote,
                    documentReference: $creditNoteNumber,
                    reference: $lockedSale,
                    notes: 'Retorno de stock por anulación de '.$lockedSale->number().': '.$reason,
                ));
            }

            $lockedSale->forceFill([
                'sunat_status' => SunatStatus::Annulled,
                'sunat_description' => sprintf(
                    'Comprobante anulado con Nota de Crédito %s. Motivo: %s',
                    $creditNoteNumber,
                    $reason,
                ),
            ])->save();

            activity('sales')
                ->causedBy($user)
                ->performedOn($lockedSale)
                ->withProperties([
                    'event' => 'sale.voided',
                    'credit_note_number' => $creditNoteNumber,
                    'reason' => $reason,
                ])
                ->log('Venta anulada mediante nota de crédito');

            return $lockedSale->fresh([
                'items.product',
                'payments',
                'customer',
                'user',
                'warehouse',
                'cashRegisterSession',
                'company',
            ]) ?? $lockedSale;
        });
    }

    /**
     * @return array{series: string, correlative: int}
     */
    private function nextCreditNoteNumber(Sale $sale): array
    {
        $warehouseId = (int) $sale->warehouse_id;
        $isFactura = $sale->series !== '' && $sale->series[0] === 'F';
        $prefix = $isFactura ? 'FC' : 'BC';

        $series = DocumentSeries::query()
            ->where('warehouse_id', $warehouseId)
            ->where('document_type', DocumentType::CreditNote->value)
            ->where('is_active', true)
            ->where('series', 'like', $prefix.'%')
            ->orderBy('series')
            ->lockForUpdate()
            ->first();

        if (! $series instanceof DocumentSeries) {
            $series = DocumentSeries::query()
                ->where('warehouse_id', $warehouseId)
                ->where('document_type', DocumentType::CreditNote->value)
                ->where('is_active', true)
                ->orderBy('series')
                ->lockForUpdate()
                ->first();
        }

        if (! $series instanceof DocumentSeries) {
            $seriesName = $prefix.'01';
            $series = DocumentSeries::query()->create([
                'company_id' => $sale->company_id,
                'warehouse_id' => $warehouseId,
                'document_type' => DocumentType::CreditNote,
                'series' => $seriesName,
                'current_correlative' => 0,
                'is_active' => true,
            ]);
        }

        $correlative = (int) $series->current_correlative + 1;
        $series->current_correlative = $correlative;
        $series->save();

        return ['series' => $series->series, 'correlative' => $correlative];
    }
}
