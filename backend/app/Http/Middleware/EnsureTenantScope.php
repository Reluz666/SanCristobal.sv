<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\Company;
use App\Models\User;
use App\Services\TenantContext;
use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Establece la empresa activa y el equipo de permisos antes de resolver
 * modelos. Debe ejecutarse despues de auth:sanctum.
 */
final class EnsureTenantScope
{
    public function __construct(
        private readonly TenantContext $tenantContext,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException('Se requiere autenticación.');
        }

        if (! $user->isActive()) {
            throw new AuthorizationException('La cuenta de usuario está inactiva.');
        }

        $company = $user->company()->first();

        if (! $company instanceof Company || ! $company->isActive()) {
            throw new AuthorizationException('La empresa asociada no se encuentra activa.');
        }

        $this->tenantContext->set($company);
        $request->attributes->set('company', $company);

        setPermissionsTeamId($company->getKey());
        $user->unsetRelation('roles')->unsetRelation('permissions');

        return $next($request);
    }
}
