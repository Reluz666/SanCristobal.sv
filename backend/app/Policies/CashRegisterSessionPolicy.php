<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\CashRegisterSession;
use App\Models\User;
use App\Policies\Concerns\AuthorizesTenantAccess;

final class CashRegisterSessionPolicy
{
    use AuthorizesTenantAccess;

    public function viewAny(User $user): bool
    {
        return $this->allows($user, 'cash.view');
    }

    public function view(User $user, CashRegisterSession $session): bool
    {
        return $this->allows($user, 'cash.view', $session);
    }

    public function open(User $user): bool
    {
        return $this->allows($user, 'cash.open');
    }

    public function close(User $user, CashRegisterSession $session): bool
    {
        if (! $this->allows($user, 'cash.close', $session)) {
            return false;
        }

        return (int) $session->getAttribute('user_id') === (int) $user->getKey()
            || $user->can('sales.void');
    }
}
