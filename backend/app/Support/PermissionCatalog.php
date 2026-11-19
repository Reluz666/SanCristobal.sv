<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Catálogo único de permisos RBAC. Los nombres son estables porque viajan al
 * frontend y se usan en directivas, policies y middleware.
 */
final class PermissionCatalog
{
    public const ADMIN = [
        'dashboard.view',
        'pos.operate',
        'pos.void',
        'sales.view',
        'sales.create',
        'sales.void',
        'cash.view',
        'cash.open',
        'cash.close',
        'customers.view',
        'customers.manage',
        'products.view',
        'products.manage',
        'inventory.view',
        'inventory.adjust',
        'inventory.kardex.view',
        'warehouses.view',
        'warehouses.manage',
        'series.manage',
        'invoicing.view',
        'invoicing.send',
        'invoicing.void',
        'users.view',
        'users.manage',
        'roles.manage',
        'audit.view',
        'settings.manage',
        'reports.view',
    ];

    public const CASHIER = [
        'dashboard.view',
        'pos.operate',
        'sales.view',
        'sales.create',
        'cash.view',
        'cash.open',
        'cash.close',
        'customers.view',
        'customers.manage',
        'products.view',
    ];

    public const WAREHOUSE = [
        'dashboard.view',
        'products.view',
        'products.manage',
        'inventory.view',
        'inventory.adjust',
        'inventory.kardex.view',
        'warehouses.view',
        'reports.view',
    ];

    /**
     * @return array<string, list<string>>
     */
    public static function roles(): array
    {
        return [
            'admin' => self::ADMIN,
            'cashier' => self::CASHIER,
            'warehouse' => self::WAREHOUSE,
        ];
    }

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return array_values(array_unique(self::ADMIN));
    }
}
