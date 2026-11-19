<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\TaxAffectationType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleItem extends Model
{
    protected $fillable = [
        'sale_id',
        'product_id',
        'description',
        'unit_code',
        'tax_affectation_type',
        'quantity',
        'unit_value',
        'unit_price',
        'igv_percentage',
        'total_igv',
        'subtotal',
        'total',
    ];

    protected $hidden = [
        'id',
        'sale_id',
        'product_id',
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'tax_affectation_type' => TaxAffectationType::class,
            'quantity' => 'decimal:4',
            'unit_value' => 'decimal:4',
            'unit_price' => 'decimal:4',
            'igv_percentage' => 'decimal:2',
            'total_igv' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<Sale, $this>
     */
    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
