<?php

declare(strict_types=1);

namespace App\Traits;

use App\Models\Company;
use App\Services\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Auth;
use LogicException;

/**
 * Aisla automaticamente toda consulta y escritura por empresa.
 *
 * El scope se activa con el TenantContext (middleware EnsureTenantScope) o,
 * como respaldo, con la empresa del usuario ya autenticado. Durante la
 * resolución inicial del token de Sanctum aún no existe usuario autenticado;
 * por eso el contexto nulo no filtra. Toda ruta de negocio DEBE usar el
 * middleware `tenant` para cerrar esa ventana.
 */
trait BelongsToCompany
{
    protected static function bootBelongsToCompany(): void
    {
        static::addGlobalScope('company', static function (Builder $builder): void {
            $companyId = self::resolveCompanyId();

            if ($companyId === null) {
                return;
            }

            $builder->where(
                $builder->getModel()->qualifyColumn('company_id'),
                $companyId,
            );
        });

        static::creating(static function (Model $model): void {
            $companyId = self::resolveCompanyId();
            $assignedCompanyId = $model->getAttribute('company_id');

            if ($companyId !== null) {
                if ($assignedCompanyId !== null && (int) $assignedCompanyId !== $companyId) {
                    throw new AuthorizationException('No puede operar sobre registros de otra empresa.');
                }

                $model->setAttribute('company_id', $companyId);

                return;
            }

            if ($assignedCompanyId === null) {
                throw new LogicException('No existe una empresa activa en el contexto de ejecución.');
            }
        });
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeForCompany(Builder $query, Company|int $company): Builder
    {
        $companyId = $company instanceof Company ? (int) $company->getKey() : $company;

        return $query->withoutGlobalScope('company')
            ->where($this->qualifyColumn('company_id'), $companyId);
    }

    private static function resolveCompanyId(): ?int
    {
        $tenantId = app(TenantContext::class)->companyId();

        if ($tenantId !== null) {
            return $tenantId;
        }

        if (! Auth::hasUser()) {
            return null;
        }

        $companyId = Auth::user()?->getAttribute('company_id');

        return $companyId === null ? null : (int) $companyId;
    }
}
