<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Existencia transaccional por producto y almacén. Es la fila que se bloquea
 * con lockForUpdate() durante una venta o un ajuste de inventario.
 */
class ProductWarehouse extends Model
{
    use BelongsToCompany;

    protected $table = 'product_warehouse';

    protected $fillable = [
        'company_id',
        'product_id',
        'warehouse_id',
        'stock',
    ];

    protected $hidden = [
        'id',
        'company_id',
        'product_id',
        'warehouse_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'stock' => 'decimal:4',
        ];
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }
}
