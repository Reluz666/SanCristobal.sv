<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\KardexMovement;
use App\Models\User;
use App\Policies\Concerns\AuthorizesTenantAccess;

final class KardexMovementPolicy
{
    use AuthorizesTenantAccess;

    public function viewAny(User $user): bool
    {
        return $this->allows($user, 'inventory.kardex.view');
    }

    public function view(User $user, KardexMovement $movement): bool
    {
        return $this->allows($user, 'inventory.kardex.view', $movement);
    }
}
