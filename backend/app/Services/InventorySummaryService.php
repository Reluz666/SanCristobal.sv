<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Product;
use App\Models\User;
use App\Support\Money;
use Illuminate\Database\Query\JoinClause;

final class InventorySummaryService
{
    public function __construct(
        private readonly CatalogQueryService $catalog,
        private readonly TenantContext $tenantContext,
    ) {}

    /**
     * @return array{
     *     warehouse: array{uuid: string, name: string}|null,
     *     active_products_count: int,
     *     total_units: string,
     *     retail_value: string,
     *     low_stock_count: int
     * }
     */
    public function forUser(User $user): array
    {
        $warehouse = $this->catalog->resolveWarehouse(null, $user);

        if ($warehouse === null) {
            return [
                'warehouse' => null,
                'active_products_count' => 0,
                'total_units' => '0.0000',
                'retail_value' => '0.00',
                'low_stock_count' => 0,
            ];
        }

        $companyId = $this->tenantContext->companyId();
        $activeProductsCount = 0;
        $totalUnits = '0.0000';
        $retailValue = '0.00000000';
        $lowStockCount = 0;

        Product::query()
            ->select([
                'products.sale_price',
                'products.min_stock',
                'products.track_stock',
            ])
            ->selectRaw('products.id as product_cursor_id')
            ->leftJoin('product_warehouse as inventory_stock', static function (JoinClause $join) use ($companyId, $warehouse): void {
                $join->on('inventory_stock.product_id', '=', 'products.id')
                    ->where('inventory_stock.company_id', '=', $companyId)
                    ->where('inventory_stock.warehouse_id', '=', $warehouse->getKey());
            })
            ->where('products.is_active', true)
            ->selectRaw('COALESCE(inventory_stock.stock, 0) as current_stock')
            ->chunkById(500, function ($products) use (&$activeProductsCount, &$totalUnits, &$retailValue, &$lowStockCount): void {
                foreach ($products as $product) {
                    $stock = (string) $product->current_stock;
                    $activeProductsCount++;
                    $totalUnits = Money::add($totalUnits, $stock, 4);
                    $retailValue = Money::add(
                        $retailValue,
                        Money::mul($stock, (string) $product->sale_price, 8),
                        8,
                    );

                    if ($product->track_stock && Money::cmp($stock, (string) $product->min_stock, 4) <= 0) {
                        $lowStockCount++;
                    }
                }
            }, 'products.id', 'product_cursor_id');

        return [
            'warehouse' => [
                'uuid' => $warehouse->uuid,
                'name' => $warehouse->name,
            ],
            'active_products_count' => $activeProductsCount,
            'total_units' => $totalUnits,
            'retail_value' => Money::round($retailValue, 2),
            'low_stock_count' => $lowStockCount,
        ];
    }
}
