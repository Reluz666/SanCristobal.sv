<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Estado de trazabilidad del comprobante ante SUNAT.
 */
enum SunatStatus: string
{
    case Internal = 'INTERNAL';
    case Pending = 'PENDING';
    case Accepted = 'ACCEPTED';
    case Observed = 'OBSERVED';
    case Rejected = 'REJECTED';
    case Annulled = 'ANNULLED';

    public function label(): string
    {
        return match ($this) {
            self::Internal => 'Solo control interno',
            self::Pending => 'Pendiente de envío',
            self::Accepted => 'Aceptado por SUNAT',
            self::Observed => 'Aceptado con observaciones',
            self::Rejected => 'Rechazado por SUNAT',
            self::Annulled => 'Anulado',
        };
    }

    public function isFinal(): bool
    {
        return in_array($this, [
            self::Accepted,
            self::Observed,
            self::Rejected,
            self::Annulled,
        ], true);
    }

    public function canRetry(): bool
    {
        return $this === self::Pending || $this === self::Rejected;
    }

    public function isElectronic(): bool
    {
        return $this !== self::Internal;
    }
}
