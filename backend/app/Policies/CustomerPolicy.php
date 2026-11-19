<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Customer;
use App\Models\User;
use App\Policies\Concerns\AuthorizesTenantAccess;

final class CustomerPolicy
{
    use AuthorizesTenantAccess;

    public function viewAny(User $user): bool
    {
        return $this->allows($user, 'customers.view');
    }

    public function view(User $user, Customer $customer): bool
    {
        return $this->allows($user, 'customers.view', $customer);
    }

    public function create(User $user): bool
    {
        return $this->allows($user, 'customers.manage');
    }

    public function update(User $user, Customer $customer): bool
    {
        return $this->allows($user, 'customers.manage', $customer);
    }
}
