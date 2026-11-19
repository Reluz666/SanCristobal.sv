<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Sale;
use App\Models\User;
use App\Policies\Concerns\AuthorizesTenantAccess;

final class SalePolicy
{
    use AuthorizesTenantAccess;

    public function viewAny(User $user): bool
    {
        return $this->allows($user, 'sales.view');
    }

    public function view(User $user, Sale $sale): bool
    {
        return $this->allows($user, 'sales.view', $sale);
    }

    public function create(User $user): bool
    {
        return $this->allows($user, 'pos.operate')
            && $this->allows($user, 'sales.create');
    }

    public function void(User $user, Sale $sale): bool
    {
        return $this->allows($user, 'sales.void', $sale);
    }
}
