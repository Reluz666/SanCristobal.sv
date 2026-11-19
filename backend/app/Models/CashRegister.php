<?php

declare(strict_types=1);

namespace App\Models;

use App\Traits\AuditableModel;
use App\Traits\BelongsToCompany;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CashRegister extends Model
{
    use AuditableModel;
    use BelongsToCompany;
    use HasUuid;
    use SoftDeletes;

    protected $fillable = [
        'company_id',
        'warehouse_id',
        'name',
        'is_active',
    ];

    protected $hidden = [
        'id',
        'company_id',
        'warehouse_id',
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
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /**
     * @return HasMany<CashRegisterSession, $this>
     */
    public function sessions(): HasMany
    {
        return $this->hasMany(CashRegisterSession::class);
    }
}
