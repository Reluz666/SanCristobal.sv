<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Tipos de movimiento del Kardex valorizado.
 *
 * Los valores persistidos coinciden con la restriccion CHECK de la tabla
 * kardex_movements y con el Formato 13.1 de SUNAT.
 */
enum KardexMovementType: string
{
    case InInitial = 'IN_INITIAL';
    case InPurchase = 'IN_PURCHASE';
    case OutSale = 'OUT_SALE';
    case InReturn = 'IN_RETURN';
    case OutReturn = 'OUT_RETURN';
    case AdjustmentIn = 'ADJUSTMENT_IN';
    case AdjustmentOut = 'ADJUSTMENT_OUT';

    public function label(): string
    {
        return match ($this) {
            self::InInitial => 'Saldo inicial',
            self::InPurchase => 'Compra',
            self::OutSale => 'Venta',
            self::InReturn => 'Devolución recibida',
            self::OutReturn => 'Devolución emitida',
            self::AdjustmentIn => 'Ajuste de ingreso',
            self::AdjustmentOut => 'Ajuste de salida',
        };
    }

    public function isOutbound(): bool
    {
        return in_array($this, [
            self::OutSale,
            self::OutReturn,
            self::AdjustmentOut,
        ], true);
    }
}
