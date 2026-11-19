<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\TaxAffectationType;
use App\Traits\AuditableModel;
use App\Traits\BelongsToCompany;
use App\Traits\HasUuid;
use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[UseFactory(ProductFactory::class)]
class Product extends Model
{
    use AuditableModel;
    use BelongsToCompany;
    use HasFactory;
    use HasUuid;
    use SoftDeletes;

    protected $fillable = [
        'company_id',
        'category_id',
        'unit_code',
        'sku',
        'barcode',
        'name',
        'tax_affectation_type',
        'purchase_price',
        'sale_price',
        'min_stock',
        'track_stock',
        'is_active',
    ];

    protected $hidden = [
        'id',
        'company_id',
        'category_id',
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'tax_affectation_type' => TaxAffectationType::class,
            'purchase_price' => 'decimal:4',
            'sale_price' => 'decimal:4',
            'min_stock' => 'decimal:4',
            'track_stock' => 'boolean',
            'is_active' => 'boolean',
            'deleted_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Category, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * @return BelongsTo<Unit, $this>
     */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'unit_code', 'code');
    }

    /**
     * @return HasMany<ProductWarehouse, $this>
     */
    public function productWarehouses(): HasMany
    {
        return $this->hasMany(ProductWarehouse::class);
    }

    /**
     * @return HasMany<KardexMovement, $this>
     */
    public function kardexMovements(): HasMany
    {
        return $this->hasMany(KardexMovement::class);
    }
}
