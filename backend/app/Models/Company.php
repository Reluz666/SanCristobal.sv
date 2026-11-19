<?php

declare(strict_types=1);

namespace App\Models;

use App\Casts\EncryptedSettings;
use App\Traits\HasUuid;
use Database\Factories\CompanyFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Company extends Model
{
    /** @use HasFactory<CompanyFactory> */
    use HasFactory;

    use HasUuid;
    use SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'ruc',
        'legal_name',
        'trade_name',
        'email',
        'phone',
        'address',
        'ubigeo',
        'settings',
        'is_active',
        'onboarded_at',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'settings' => EncryptedSettings::class,
            'is_active' => 'boolean',
            'onboarded_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function isActive(): bool
    {
        return $this->is_active && $this->deleted_at === null;
    }

    public function cashSessionsEnabled(): bool
    {
        return (bool) data_get($this->settings, 'features.cash_sessions_enabled', false);
    }
}
