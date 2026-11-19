<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\IdentityDocumentType;
use App\Traits\AuditableModel;
use App\Traits\BelongsToCompany;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use AuditableModel;
    use BelongsToCompany;
    use HasUuid;
    use SoftDeletes;

    protected $fillable = [
        'company_id',
        'identity_document_type',
        'document_number',
        'legal_name',
        'address',
        'ubigeo',
        'email',
        'phone',
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
            'identity_document_type' => IdentityDocumentType::class,
            'is_active' => 'boolean',
            'deleted_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<Sale, $this>
     */
    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function isGeneric(): bool
    {
        return $this->identity_document_type === IdentityDocumentType::None
            && $this->document_number === '00000000';
    }
}
