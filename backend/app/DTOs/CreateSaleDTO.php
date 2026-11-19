<?php

declare(strict_types=1);

namespace App\DTOs;

use App\Enums\DocumentType;
use App\Enums\PaymentMethod;
use App\Http\Requests\Pos\StoreSaleRequest;

/**
 * Contrato inmutable del caso de uso de venta POS.
 */
final readonly class CreateSaleDTO
{
    /**
     * @param  list<SaleItemDTO>  $items
     * @param  list<SalePaymentDTO>  $payments
     */
    public function __construct(
        public DocumentType $documentType,
        public ?string $warehouseUuid,
        public ?string $customerUuid,
        public ?CustomerDataDTO $customer,
        public array $items,
        public array $payments,
        public ?string $notes = null,
    ) {}

    public static function fromRequest(StoreSaleRequest $request): self
    {
        $validated = $request->validated();

        $items = array_map(
            static fn (array $item): SaleItemDTO => new SaleItemDTO(
                productUuid: (string) $item['product_uuid'],
                quantity: (string) $item['quantity'],
            ),
            array_values($validated['items']),
        );

        $payments = array_map(
            static fn (array $payment): SalePaymentDTO => new SalePaymentDTO(
                method: PaymentMethod::from((string) $payment['payment_method']),
                amount: (string) $payment['amount'],
                referenceNumber: isset($payment['reference_number'])
                    ? trim((string) $payment['reference_number'])
                    : null,
            ),
            array_values($validated['payments']),
        );

        $customerData = $validated['customer'] ?? null;

        return new self(
            documentType: DocumentType::from((string) $validated['document_type']),
            warehouseUuid: isset($validated['warehouse_uuid'])
                ? (string) $validated['warehouse_uuid']
                : null,
            customerUuid: isset($validated['customer_uuid'])
                ? (string) $validated['customer_uuid']
                : null,
            customer: is_array($customerData) ? CustomerDataDTO::fromArray($customerData) : null,
            items: $items,
            payments: $payments,
            notes: isset($validated['notes']) ? trim((string) $validated['notes']) : null,
        );
    }
}
