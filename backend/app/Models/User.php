<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\IdentityDocumentType;
use App\Traits\AuditableModel;
use App\Traits\BelongsToCompany;
use App\Traits\HasUuid;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use AuditableModel;

    use BelongsToCompany;
    use HasApiTokens;
    use HasFactory;
    use HasRoles;
    use HasUuid;
    use Notifiable;
    use SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'company_id',
        'name',
        'email',
        'password',
        'document_type',
        'document_number',
        'phone',
        'is_active',
        'last_login_at',
        'email_verified_at',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'id',
        'company_id',
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'company_id' => 'integer',
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'document_type' => IdentityDocumentType::class,
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    public function isActive(): bool
    {
        return $this->is_active && $this->deleted_at === null;
    }
}
