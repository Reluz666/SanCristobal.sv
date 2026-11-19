<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\AuditableModel;
use App\Traits\BelongsToCompany;
use App\Traits\HasUuid;
use Database\Factories\WarehouseFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[UseFactory(WarehouseFactory::class)]
class Warehouse extends Model
{
    use AuditableModel;
    use BelongsToCompany;
    use HasFactory;
    use HasUuid;
    use SoftDeletes;

    protected $fillable = [
        'company_id',
        'code',
        'sunat_code',
        'name',
        'address',
        'is_active',
    ];

    protected $hidden = [
        'id',
        'company_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'deleted_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<DocumentSeries, $this>
     */
    public function documentSeries(): HasMany
    {
        return $this->hasMany(DocumentSeries::class);
    }

    /**
     * @return HasMany<CashRegister, $this>
     */
    public function cashRegisters(): HasMany
    {
        return $this->hasMany(CashRegister::class);
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

    /**
     * @return HasMany<Sale, $this>
     */
    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }
}
