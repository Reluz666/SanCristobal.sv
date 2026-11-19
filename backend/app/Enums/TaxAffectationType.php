<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Catálogo 07 de SUNAT: tipo de afectación del IGV.
 */
enum TaxAffectationType: string
{
    case Gravado = '10';
    case Exonerado = '20';
    case Inafecto = '30';

    public function label(): string
    {
        return match ($this) {
            self::Gravado => 'Gravado - Operación onerosa',
            self::Exonerado => 'Exonerado del IGV',
            self::Inafecto => 'Inafecto al IGV',
        };
    }

    /**
     * Tasa de IGV expresada como decimal para BCMath.
     */
    public function igvRate(): string
    {
        return match ($this) {
            self::Gravado => '0.1800',
            self::Exonerado, self::Inafecto => '0.0000',
        };
    }

    public function isTaxed(): bool
    {
        return $this === self::Gravado;
    }
}
