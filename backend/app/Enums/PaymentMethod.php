<?php

declare(strict_types=1);

namespace App\Enums;

enum PaymentMethod: string
{
    case Cash = 'CASH';
    case Yape = 'YAPE';
    case Plin = 'PLIN';
    case Card = 'CARD';
    case Transfer = 'TRANSFER';

    public function label(): string
    {
        return match ($this) {
            self::Cash => 'Efectivo',
            self::Yape => 'Yape',
            self::Plin => 'Plin',
            self::Card => 'Tarjeta de crédito o débito',
            self::Transfer => 'Transferencia bancaria',
        };
    }

    /**
     * Medios que requieren número de operación o voucher para conciliar caja.
     */
    public function requiresReference(): bool
    {
        return $this !== self::Cash;
    }

    public function isElectronicWallet(): bool
    {
        return $this === self::Yape || $this === self::Plin;
    }
}
