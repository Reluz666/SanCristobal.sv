<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\DocumentType;
use App\Enums\KardexMovementType;
use App\Traits\BelongsToCompany;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Movimiento del Kardex valorizado (Formato 13.1 SUNAT).
 */
class KardexMovement extends Model
{
    use BelongsToCompany;
    use HasUuid;

    protected $fillable = [
        'company_id',
        'warehouse_id',
        'product_id',
        'user_id',
        'movement_type',
        'document_type',
        'document_reference',
        'movement_date',
        'quantity',
        'unit_cost',
        'total_cost',
        'balance_quantity',
        'balance_unit_cost',
        'balance_total_cost',
        'reference_type',
        'reference_id',
        'notes',
    ];

    protected $hidden = [
        'id',
        'company_id',
        'warehouse_id',
        'product_id',
        'user_id',
        'reference_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'movement_type' => KardexMovementType::class,
            'document_type' => DocumentType::class,
            'movement_date' => 'datetime',
            'quantity' => 'decimal:4',
            'unit_cost' => 'decimal:4',
            'total_cost' => 'decimal:4',
            'balance_quantity' => 'decimal:4',
            'balance_unit_cost' => 'decimal:4',
            'balance_total_cost' => 'decimal:4',
        ];
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function reference(): MorphTo
    {
        return $this->morphTo();
    }
}
