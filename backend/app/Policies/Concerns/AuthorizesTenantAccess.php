<?php

declare(strict_types=1);

namespace App\Policies\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Tercera capa de aislamiento: permiso RBAC y pertenencia a la empresa del
 * usuario, independientemente del GlobalScope y del middleware tenant.
 */
trait AuthorizesTenantAccess
{
    protected function allows(User $user, string $permission, ?Model $model = null): bool
    {
        if (! $user->isActive() || ! $user->can($permission)) {
            return false;
        }

        if (! $model instanceof Model) {
            return true;
        }

        return (int) $model->getAttribute('company_id') === (int) $user->getAttribute('company_id');
    }
}
