<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Catálogo 06 de SUNAT: tipo de documento de identidad del cliente.
 *
 * El tipo '0' (sin documento) solo es válido para ventas al portador por
 * montos menores al límite tributario configurado (S/ 700).
 */
enum IdentityDocumentType: string
{
    case Dni = '1';
    case ForeignCard = '4';
    case Ruc = '6';
    case Passport = '7';
    case None = '0';

    public function label(): string
    {
        return match ($this) {
            self::Dni => 'DNI',
            self::ForeignCard => 'Carnet de extranjería',
            self::Ruc => 'RUC',
            self::Passport => 'Pasaporte',
            self::None => 'Sin documento',
        };
    }

    public function maxLength(): int
    {
        return match ($this) {
            self::Dni => 8,
            self::Ruc => 11,
            self::ForeignCard, self::Passport => 12,
            self::None => 8,
        };
    }

    public function requiresDocumentNumber(): bool
    {
        return $this !== self::None;
    }
}
