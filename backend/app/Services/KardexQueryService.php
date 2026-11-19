<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\KardexMovement;
use Illuminate\Pagination\LengthAwarePaginator;

final class KardexQueryService
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $perPage = max(1, min(100, (int) ($filters['per_page'] ?? 25)));

        return KardexMovement::query()
            ->with(['product', 'warehouse', 'user'])
            ->when(
                isset($filters['product_uuid']) && $filters['product_uuid'] !== null,
                static fn ($query) => $query->whereHas(
                    'product',
                    static fn ($product) => $product->where('uuid', $filters['product_uuid']),
                ),
            )
            ->when(
                isset($filters['warehouse_uuid']) && $filters['warehouse_uuid'] !== null,
                static fn ($query) => $query->whereHas(
                    'warehouse',
                    static fn ($warehouse) => $warehouse->where('uuid', $filters['warehouse_uuid']),
                ),
            )
            ->when(
                isset($filters['date_from']) && $filters['date_from'] !== null,
                static fn ($query) => $query->whereDate('movement_date', '>=', $filters['date_from']),
            )
            ->when(
                isset($filters['date_to']) && $filters['date_to'] !== null,
                static fn ($query) => $query->whereDate('movement_date', '<=', $filters['date_to']),
            )
            ->when(
                isset($filters['movement_type']) && $filters['movement_type'] !== null,
                static fn ($query) => $query->where('movement_type', $filters['movement_type']),
            )
            ->orderByDesc('movement_date')
            ->orderByDesc('id')
            ->paginate($perPage);
    }
}
