<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\DTOs\CreateSaleDTO;
use App\Http\Controllers\Controller;
use App\Http\Requests\Pos\ListSalesRequest;
use App\Http\Requests\Pos\StoreSaleRequest;
use App\Http\Requests\Pos\VoidSaleRequest;
use App\Http\Resources\SaleResource;
use App\Http\Resources\SaleTicketResource;
use App\Models\Sale;
use App\Services\SaleQueryService;
use App\Services\SaleService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

final class SaleController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly SaleService $sales,
        private readonly SaleQueryService $queries,
    ) {}

    public function index(ListSalesRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Sale::class);

        $paginator = $this->queries->paginate($request->validated());

        return $this->paginatedResponse(
            $paginator,
            SaleResource::class,
            'Ventas consultadas.',
        );
    }

    public function store(StoreSaleRequest $request): JsonResponse
    {
        $this->authorize('create', Sale::class);

        $idempotencyKey = $request->validated('idempotency_key')
            ?? $request->header('X-Idempotency-Key')
            ?? $request->header('Idempotency-Key');

        $sale = $this->sales->createSale(
            CreateSaleDTO::fromRequest($request),
            $this->currentUser($request),
            is_string($idempotencyKey) && trim($idempotencyKey) !== '' ? trim($idempotencyKey) : null,
        );

        $sale = $this->loadSale($sale);

        return $this->successResponse(
            data: [
                'sale' => (new SaleResource($sale))->resolve(),
                'ticket' => (new SaleTicketResource($sale))->resolve(),
            ],
            message: 'Venta registrada y comprobante emitido.',
            status: 201,
        );
    }

    public function show(Sale $sale): JsonResponse
    {
        $this->authorize('view', $sale);

        $sale = $this->loadSale($sale);

        return $this->successResponse(
            data: [
                'sale' => (new SaleResource($sale))->resolve(),
                'ticket' => (new SaleTicketResource($sale))->resolve(),
            ],
            message: 'Comprobante consultado.',
        );
    }

    public function ticket(Sale $sale): JsonResponse
    {
        $this->authorize('view', $sale);

        $sale = $this->loadSale($sale);

        return $this->successResponse(
            data: (new SaleTicketResource($sale))->resolve(),
            message: 'Ticket de impresión consultado.',
        );
    }

    public function void(Sale $sale, VoidSaleRequest $request): JsonResponse
    {
        $this->authorize('void', $sale);

        $reason = (string) ($request->validated('reason') ?? 'Anulación de la operación');

        $voidedSale = $this->sales->voidSale(
            sale: $sale,
            user: $this->currentUser($request),
            reason: $reason,
        );

        $voidedSale = $this->loadSale($voidedSale);

        return $this->successResponse(
            data: [
                'sale' => (new SaleResource($voidedSale))->resolve(),
                'ticket' => (new SaleTicketResource($voidedSale))->resolve(),
            ],
            message: 'Comprobante anulado y existencias restituidas al inventario.',
        );
    }

    private function loadSale(Sale $sale): Sale
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
}
