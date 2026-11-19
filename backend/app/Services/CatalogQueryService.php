<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\CashRegisterSession;
use App\Models\Customer;
use App\Models\Product;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\IdentityDirectory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Query\JoinClause;

/**
 * Consultas de apoyo para la terminal POS: catalogo con existencias por
 * almacen, busqueda de clientes y padron local de demostracion.
 */
final class CatalogQueryService
{
    /**
     * @param  array{search?: string|null, category_uuid?: string|null, warehouse_uuid?: string|null, limit?: int|null}  $filters
     * @return array{products: Collection<int, Product>, warehouse: Warehouse|null}
     */
    public function products(array $filters, User $user): array
    {
        $cashSessionsEnabled = app(TenantContext::class)->company()?->cashSessionsEnabled() ?? false;
        $warehouse = $this->resolveWarehouse(
            $filters['warehouse_uuid'] ?? null,
            $user,
            ! $cashSessionsEnabled,
        );

        if (! $warehouse instanceof Warehouse) {
            return ['products' => new Collection, 'warehouse' => null];
        }

        $search = $this->normalizeSearch($filters['search'] ?? null);
        $limit = max(1, min(100, (int) ($filters['limit'] ?? 30)));
        $companyId = app(TenantContext::class)->companyId();

        $products = Product::query()
            ->select(['products.*'])
            ->selectRaw('COALESCE(product_warehouse.stock, 0) as stock')
            ->leftJoin('product_warehouse', static function (JoinClause $join) use ($warehouse, $companyId): void {
                $join->on('product_warehouse.product_id', '=', 'products.id')
                    ->where('product_warehouse.warehouse_id', '=', $warehouse->getKey());

                if ($companyId !== null) {
                    $join->where('product_warehouse.company_id', '=', $companyId);
                }
            })
            ->with(['category', 'unit'])
            ->where('products.is_active', true)
            ->when(
                isset($filters['category_uuid']) && $filters['category_uuid'] !== null,
                static fn ($query) => $query->whereHas(
                    'category',
                    static fn ($category) => $category->where('uuid', $filters['category_uuid']),
                ),
            )
            ->when($search !== '', static function ($query) use ($search): void {
                $term = '%'.$search.'%';

                $query->where(static function ($nested) use ($term): void {
                    $nested->where('products.sku', 'like', $term)
                        ->orWhere('products.barcode', 'like', $term)
                        ->orWhere('products.name', 'like', $term);
                });
            })
            ->orderByRaw(
                'CASE WHEN products.barcode = ? THEN 0 WHEN products.sku = ? THEN 1 ELSE 2 END',
                [$search, $search],
            )
            ->orderBy('products.name')
            ->limit($limit)
            ->get();

        return ['products' => $products, 'warehouse' => $warehouse];
    }

    /**
     * @return Collection<int, Customer>
     */
    public function customers(?string $search, int $limit = 15): Collection
    {
        $search = $this->normalizeSearch($search);
        $limit = max(1, min(50, $limit));

        return Customer::query()
            ->where('is_active', true)
            ->when($search !== '', static function ($query) use ($search): void {
                $term = '%'.$search.'%';

                $query->where(static function ($nested) use ($term): void {
                    $nested->where('document_number', 'like', $term)
                        ->orWhere('legal_name', 'like', $term);
                });
            })
            ->orderByRaw('CASE WHEN document_number = ? THEN 0 ELSE 1 END', [$search])
            ->orderBy('legal_name')
            ->limit($limit)
            ->get();
    }

    /**
     * @return array{customer: Customer|null, identity: array<string, mixed>|null}
     */
    public function lookup(string $documentNumber): array
    {
        $normalized = preg_replace('/\D+/', '', $documentNumber) ?? '';

        if ($normalized === '') {
            return ['customer' => null, 'identity' => null];
        }

        $customer = Customer::query()
            ->where('document_number', $normalized)
            ->where('is_active', true)
            ->first();

        return [
            'customer' => $customer,
            'identity' => IdentityDirectory::lookup($normalized),
        ];
    }

    public function resolveWarehouse(
        ?string $warehouseUuid,
        User $user,
        bool $requireExplicitSelection = false,
    ): ?Warehouse {
        if ($warehouseUuid !== null && $warehouseUuid !== '') {
            $warehouse = Warehouse::query()
                ->where('uuid', $warehouseUuid)
                ->where('is_active', true)
                ->first();

            if (! $warehouse instanceof Warehouse) {
                throw ApiException::notFound('El almacén indicado no existe o está inactivo.');
            }

            return $warehouse;
        }

        $cashSessionsEnabled = app(TenantContext::class)->company()?->cashSessionsEnabled() ?? false;
        $session = $cashSessionsEnabled
            ? CashRegisterSession::query()
                ->where('user_id', $user->getKey())
                ->open()
                ->with('cashRegister.warehouse')
                ->latest('opened_at')
                ->first()
            : null;

        $sessionWarehouse = $session?->cashRegister?->warehouse;

        if ($sessionWarehouse instanceof Warehouse && $sessionWarehouse->is_active) {
            return $sessionWarehouse;
        }

        $activeWarehouses = Warehouse::query()
            ->where('is_active', true)
            ->orderBy('code')
            ->limit(2)
            ->get();

        if ($requireExplicitSelection && $activeWarehouses->count() > 1) {
            throw ApiException::conflict('Selecciona el almacén para consultar existencias y vender.');
        }

        return $activeWarehouses->first();
    }

    private function normalizeSearch(?string $search): string
    {
        $normalized = trim((string) $search);

        return str_replace(['%', '_'], '', $normalized);
    }
}
