<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Product;
use App\Models\User;
use App\Policies\Concerns\AuthorizesTenantAccess;

final class ProductPolicy
{
    use AuthorizesTenantAccess;

    public function viewAny(User $user): bool
    {
        return $this->allows($user, 'products.view');
    }

    public function view(User $user, Product $product): bool
    {
        return $this->allows($user, 'products.view', $product);
    }

    public function update(User $user, Product $product): bool
    {
        return $this->allows($user, 'products.manage', $product);
    }
}
