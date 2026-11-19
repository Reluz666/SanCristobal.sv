<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Pos\LookupCustomerRequest;
use App\Http\Requests\Pos\ProductSearchRequest;
use App\Http\Requests\Pos\SearchCustomerRequest;
use App\Http\Requests\Pos\StoreCustomerRequest;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\PosProductResource;
use App\Http\Resources\WarehouseResource;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Warehouse;
use App\Services\CatalogQueryService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

final class PosCatalogController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly CatalogQueryService $catalog,
    ) {}

    public function products(ProductSearchRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Product::class);

        $result = $this->catalog->products($request->validated(), $this->currentUser($request));

        return $this->successResponse(
            data: PosProductResource::collection($result['products'])->resolve(),
            message: 'Catálogo consultado.',
            meta: [
                'warehouse' => $result['warehouse'] === null
                    ? null
                    : (new WarehouseResource($result['warehouse']))->resolve(),
            ],
        );
    }

    public function warehouses(): JsonResponse
    {
        $this->authorize('viewAny', Product::class);

        $warehouses = Warehouse::query()
            ->where('is_active', true)
            ->orderBy('code')
            ->get();

        return $this->successResponse(
            data: WarehouseResource::collection($warehouses)->resolve(),
            message: 'Almacenes activos consultados para el punto de venta.',
        );
    }

    public function customers(SearchCustomerRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Customer::class);

        $validated = $request->validated();
        $customers = $this->catalog->customers(
            isset($validated['search']) ? (string) $validated['search'] : null,
            (int) ($validated['limit'] ?? 15),
        );

        return $this->successResponse(
            data: CustomerResource::collection($customers)->resolve(),
            message: 'Clientes consultados.',
        );
    }

    public function lookup(LookupCustomerRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Customer::class);

        $result = $this->catalog->lookup((string) $request->validated('document_number'));

        return $this->successResponse(
            data: [
                'customer' => $result['customer'] === null
                    ? null
                    : (new CustomerResource($result['customer']))->resolve(),
                'identity' => $result['identity'],
            ],
            message: $result['customer'] === null
                ? 'No existe un cliente registrado con ese documento.'
                : 'Cliente encontrado.',
        );
    }

    public function store(StoreCustomerRequest $request): JsonResponse
    {
        $this->authorize('create', Customer::class);

        $user = $this->currentUser($request);

        $customer = Customer::query()->create([
            ...$request->validated(),
            'is_active' => true,
        ]);

        activity('customers')
            ->causedBy($user)
            ->performedOn($customer)
            ->withProperties([
                'event' => 'customer.created',
                'document_number' => $customer->document_number,
            ])
            ->log('Cliente registrado desde el punto de venta');

        return $this->successResponse(
            data: (new CustomerResource($customer))->resolve(),
            message: 'Cliente registrado.',
            status: 201,
        );
    }
}
