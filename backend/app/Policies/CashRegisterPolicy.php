<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\CashRegister;
use App\Models\User;
use App\Policies\Concerns\AuthorizesTenantAccess;

final class CashRegisterPolicy
{
    use AuthorizesTenantAccess;

    public function viewAny(User $user): bool
    {
        return $this->allows($user, 'cash.view');
    }

    public function view(User $user, CashRegister $cashRegister): bool
    {
        return $this->allows($user, 'cash.view', $cashRegister);
    }
}
