<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Pos\ListKardexRequest;
use App\Http\Resources\KardexMovementResource;
use App\Http\Resources\WarehouseResource;
use App\Models\KardexMovement;
use App\Models\Warehouse;
use App\Services\KardexQueryService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

final class KardexController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly KardexQueryService $queries,
    ) {}

    public function index(ListKardexRequest $request): JsonResponse
    {
        $this->authorize('viewAny', KardexMovement::class);

        $paginator = $this->queries->paginate($request->validated());

        return $this->paginatedResponse(
            $paginator,
            KardexMovementResource::class,
            'Movimientos de Kardex consultados.',
        );
    }

    public function warehouses(): JsonResponse
    {
        $this->authorize('viewAny', KardexMovement::class);

        $warehouses = Warehouse::query()
            ->where('is_active', true)
            ->orderBy('code')
            ->get();

        return $this->successResponse(
            data: WarehouseResource::collection($warehouses)->resolve(),
            message: 'Almacenes consultados.',
        );
    }
}
