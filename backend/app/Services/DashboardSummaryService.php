<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\SunatStatus;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use App\Support\Money;
use DateTimeInterface;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Facades\DB;

final class DashboardSummaryService
{
    private const QUERY_CHUNK_SIZE = 500;

    private const HOURLY_RANGES = [
        ['00:00', '04:00'],
        ['04:00', '08:00'],
        ['08:00', '12:00'],
        ['12:00', '16:00'],
        ['16:00', '20:00'],
        ['20:00', '24:00'],
    ];

    public function __construct(
        private readonly TenantContext $tenantContext,
        private readonly CatalogQueryService $catalog,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function forUser(User $user, bool $canViewSales, bool $canViewProducts): array
    {
        $company = $this->tenantContext->company();
        $companyId = $this->tenantContext->companyId();

        if ($company === null || $companyId === null) {
            return [
                'business_date' => now()->toDateString(),
                'timezone' => (string) config('app.timezone', 'UTC'),
                'currency' => 'PEN',
                'generated_at' => now()->toIso8601String(),
                'warehouse' => null,
                'permissions' => ['sales' => $canViewSales, 'products' => $canViewProducts],
                'sales' => $canViewSales ? ['count' => 0, 'total' => '0.00', 'average_ticket' => '0.00'] : null,
                'hourly_sales' => $canViewSales ? $this->emptyHourlySales() : [],
                'active_products_count' => $canViewProducts ? 0 : null,
                'top_products' => [],
                'stock' => $canViewProducts ? ['tracked_products_count' => 0, 'low_stock_count' => 0, 'low_stock_products' => []] : null,
            ];
        }

        $timezone = (string) ($company->settings['timezone'] ?? config('app.timezone', 'UTC'));
        $localNow = now($timezone);
        $startOfBusinessDay = $localNow->copy()->startOfDay();
        $endOfBusinessDay = $localNow->copy()->endOfDay();
        $warehouse = $canViewProducts ? $this->catalog->resolveWarehouse(null, $user) : null;

        $total = '0.00';
        $hourlySales = $canViewSales ? $this->emptyHourlySales() : [];
        $salesCount = 0;

        if ($canViewSales) {
            Sale::query()
                ->whereBetween('issue_date', [$startOfBusinessDay, $endOfBusinessDay])
                ->where('sunat_status', '!=', SunatStatus::Annulled->value)
                ->select(['sales.id', 'sales.issue_date', 'sales.total_amount'])
                ->chunkById(self::QUERY_CHUNK_SIZE, function ($sales) use (&$hourlySales, &$salesCount, &$total, $timezone): void {
                    foreach ($sales as $sale) {
                        $amount = (string) $sale->total_amount;
                        $total = Money::add($total, $amount, 2);
                        $hour = $sale->issue_date->copy()->setTimezone($timezone)->hour;
                        $bucket = min(5, intdiv($hour, 4));
                        $hourlySales[$bucket]['count']++;
                        $hourlySales[$bucket]['total'] = Money::add(
                            $hourlySales[$bucket]['total'],
                            $amount,
                            2,
                        );
                        $salesCount++;
                    }
                }, 'sales.id', 'id');
        }

        $averageTicket = $salesCount > 0
            ? Money::div($total, (string) $salesCount, 2)
            : '0.00';

        $activeProductsCount = $canViewProducts ? Product::query()->where('is_active', true)->count() : null;
        $stockSummary = ! $canViewProducts || $warehouse === null
            ? ['tracked_products_count' => 0, 'low_stock_count' => 0, 'low_stock_products' => []]
            : $this->stockSummary($companyId, (int) $warehouse->getKey());

        return [
            'business_date' => $localNow->toDateString(),
            'timezone' => $timezone,
            'currency' => in_array($company->settings['currency'] ?? null, ['PEN', 'USD'], true)
                ? $company->settings['currency']
                : 'PEN',
            'generated_at' => now()->toIso8601String(),
            'permissions' => ['sales' => $canViewSales, 'products' => $canViewProducts],
            'warehouse' => $warehouse === null ? null : [
                'uuid' => $warehouse->uuid,
                'name' => $warehouse->name,
            ],
            'sales' => $canViewSales ? [
                'count' => $salesCount,
                'total' => $total,
                'average_ticket' => $averageTicket,
            ] : null,
            'hourly_sales' => $hourlySales,
            'active_products_count' => $activeProductsCount,
            'top_products' => $canViewSales && $canViewProducts
                ? $this->topProducts($companyId, $warehouse?->getKey(), $startOfBusinessDay, $endOfBusinessDay)
                : [],
            'stock' => $canViewProducts ? $stockSummary : null,
        ];
    }

    /**
     * @return list<array{range: string, count: int, total: string}>
     */
    private function emptyHourlySales(): array
    {
        return array_map(static fn (array $range): array => [
            'range' => $range[0].' - '.$range[1],
            'count' => 0,
            'total' => '0.00',
        ], self::HOURLY_RANGES);
    }

    /**
     * @return array{tracked_products_count: int, low_stock_count: int, low_stock_products: list<array{uuid: string, sku: string, name: string, unit_code: string, stock: string, min_stock: string}>}
     */
    private function stockSummary(int $companyId, int $warehouseId): array
    {
        $summary = [
            'tracked_products_count' => 0,
            'low_stock_count' => 0,
            'low_stock_products' => [],
        ];
        $lowestStock = [];

        Product::query()
            ->select(['products.id', 'products.uuid', 'products.sku', 'products.name', 'products.unit_code', 'products.min_stock'])
            ->selectRaw('COALESCE(product_warehouse.stock, 0) as current_stock')
            ->leftJoin('product_warehouse', static function (JoinClause $join) use ($companyId, $warehouseId): void {
                $join->on('product_warehouse.product_id', '=', 'products.id')
                    ->where('product_warehouse.company_id', '=', $companyId)
                    ->where('product_warehouse.warehouse_id', '=', $warehouseId);
            })
            ->where('products.is_active', true)
            ->where('products.track_stock', true)
            ->chunkById(self::QUERY_CHUNK_SIZE, function ($products) use (&$lowestStock, &$summary): void {
                $summary['tracked_products_count'] += $products->count();

                foreach ($products as $product) {
                    if (! $this->isLowStock($product)) {
                        continue;
                    }

                    $summary['low_stock_count']++;
                    $lowestStock[] = [
                        'ratio' => $this->stockRatio($product),
                        'product' => [
                            'uuid' => $product->uuid,
                            'sku' => $product->sku,
                            'name' => $product->name,
                            'unit_code' => $product->unit_code,
                            'stock' => (string) $product->getAttribute('current_stock'),
                            'min_stock' => (string) $product->min_stock,
                        ],
                    ];
                }

                usort($lowestStock, static function (array $left, array $right): int {
                    $ratioOrder = $left['ratio'] <=> $right['ratio'];

                    return $ratioOrder !== 0
                        ? $ratioOrder
                        : strcmp($left['product']['name'], $right['product']['name']);
                });
                $lowestStock = array_slice($lowestStock, 0, 4);
            }, 'products.id', 'id');

        $summary['low_stock_products'] = array_map(
            static fn (array $entry): array => $entry['product'],
            $lowestStock,
        );

        return $summary;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function topProducts(
        int $companyId,
        ?int $warehouseId,
        DateTimeInterface $startOfBusinessDay,
        DateTimeInterface $endOfBusinessDay,
    ): array {
        $soldLines = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.company_id', $companyId)
            ->whereBetween('sales.issue_date', [$startOfBusinessDay, $endOfBusinessDay])
            ->where('sales.sunat_status', '!=', SunatStatus::Annulled->value);

        $totalValue = (string) (clone $soldLines)->sum('sale_items.total');

        if (Money::cmp($totalValue, '0', 2) <= 0) {
            return [];
        }

        $query = (clone $soldLines)
            ->join('products', static function (JoinClause $join) use ($companyId): void {
                $join->on('products.id', '=', 'sale_items.product_id')
                    ->where('products.company_id', '=', $companyId);
            })
            ->when($warehouseId !== null, static function ($query) use ($companyId, $warehouseId): void {
                $query->leftJoin('product_warehouse', static function (JoinClause $join) use ($companyId, $warehouseId): void {
                    $join->on('product_warehouse.product_id', '=', 'products.id')
                        ->where('product_warehouse.company_id', '=', $companyId)
                        ->where('product_warehouse.warehouse_id', '=', $warehouseId);
                });
            })
            ->select([
                'products.uuid',
                'products.sku',
                'products.name',
                'products.unit_code',
                'products.sale_price',
                'products.track_stock',
            ])
            ->selectRaw('SUM(sale_items.quantity) as quantity_sold')
            ->selectRaw('SUM(sale_items.total) as total_sold')
            ->selectRaw($warehouseId === null ? 'NULL as current_stock' : 'COALESCE(product_warehouse.stock, 0) as current_stock')
            ->groupBy([
                'products.id',
                'products.uuid',
                'products.sku',
                'products.name',
                'products.unit_code',
                'products.sale_price',
                'products.track_stock',
                ...($warehouseId === null ? [] : ['product_warehouse.stock']),
            ])
            ->orderByDesc('quantity_sold')
            ->limit(4)
            ->get();

        return $query->map(static function (object $product) use ($totalValue): array {
            return [
                'uuid' => $product->uuid,
                'sku' => $product->sku,
                'name' => $product->name,
                'unit_code' => $product->unit_code,
                'quantity_sold' => (string) $product->quantity_sold,
                'total_sold' => Money::round((string) $product->total_sold, 2),
                'share' => min(100, (int) round(((float) $product->total_sold / (float) $totalValue) * 100)),
                'sale_price' => (string) $product->sale_price,
                'track_stock' => (bool) $product->track_stock,
                'stock' => $product->current_stock === null ? null : (string) $product->current_stock,
            ];
        })->all();
    }

    private function isLowStock(Product $product): bool
    {
        $threshold = Money::mul((string) $product->min_stock, '1.5', 4);

        return Money::cmp((string) $product->getAttribute('current_stock'), $threshold, 4) <= 0;
    }

    private function stockRatio(Product $product): float
    {
        $stock = (float) $product->getAttribute('current_stock');
        $minimum = (float) $product->min_stock;

        return $minimum > 0 ? $stock / $minimum : ($stock > 0 ? 1 : 0);
    }
}
