<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Catálogo 01 de SUNAT: tipo de comprobante de pago.
 */
enum DocumentType: string
{
    case Invoice = '01';
    case Receipt = '03';
    case CreditNote = '07';
    case DebitNote = '08';
    case InternalSaleNote = '00';

    public function label(): string
    {
        return match ($this) {
            self::Invoice => 'Factura electrónica',
            self::Receipt => 'Boleta de venta electrónica',
            self::CreditNote => 'Nota de crédito electrónica',
            self::DebitNote => 'Nota de débito electrónica',
            self::InternalSaleNote => 'Nota de venta interna',
        };
    }

    public function shortLabel(): string
    {
        return match ($this) {
            self::Invoice => 'Factura',
            self::Receipt => 'Boleta',
            self::CreditNote => 'Nota de crédito',
            self::DebitNote => 'Nota de débito',
            self::InternalSaleNote => 'Nota de venta',
        };
    }

    public function isElectronic(): bool
    {
        return $this !== self::InternalSaleNote;
    }

    /**
     * Prefijo de serie sugerido para el alta de nuevas series.
     */
    public function seriesPrefix(): string
    {
        return match ($this) {
            self::Invoice => 'F',
            self::Receipt => 'B',
            self::CreditNote => 'FC',
            self::DebitNote => 'FD',
            self::InternalSaleNote => 'NV',
        };
    }
}
