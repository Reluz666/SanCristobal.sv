<?php

declare(strict_types=1);

namespace App\Support;

use InvalidArgumentException;

/**
 * Aritmetica decimal con BCMath. Todo importe, costo, stock o impuesto se
 * representa como string decimal; nunca como float.
 */
final class Money
{
    public const SCALE = 4;

    public const IGV_RATE = '0.1800';

    public static function norm(string $value, int $scale = self::SCALE): string
    {
        self::assertNumeric($value);

        return bcadd($value, '0', $scale);
    }

    public static function add(string $a, string $b, int $scale = self::SCALE): string
    {
        self::assertNumeric($a);
        self::assertNumeric($b);

        return bcadd($a, $b, $scale);
    }

    public static function sub(string $a, string $b, int $scale = self::SCALE): string
    {
        self::assertNumeric($a);
        self::assertNumeric($b);

        return bcsub($a, $b, $scale);
    }

    public static function mul(string $a, string $b, int $scale = self::SCALE): string
    {
        self::assertNumeric($a);
        self::assertNumeric($b);

        return bcmul($a, $b, $scale);
    }

    public static function div(string $a, string $b, int $scale = self::SCALE): string
    {
        self::assertNumeric($a);
        self::assertNumeric($b);

        if (bccomp($b, '0', 8) === 0) {
            throw new InvalidArgumentException('Division entre cero.');
        }

        return bcdiv($a, $b, $scale);
    }

    public static function cmp(string $a, string $b, int $scale = self::SCALE): int
    {
        return bccomp($a, $b, $scale);
    }

    /**
     * Redondeo half-up (away from zero) explicito. BCMath trunca, por lo que
     * se suma media unidad del ultimo decimal antes de truncar.
     */
    public static function round(string $value, int $scale = 2): string
    {
        self::assertNumeric($value);

        $half = '0.'.str_repeat('0', $scale).'5';
        $adjusted = bccomp($value, '0', 10) >= 0
            ? bcadd($value, $half, $scale + 4)
            : bcsub($value, $half, $scale + 4);

        return bcadd($adjusted, '0', $scale);
    }

    public static function isNegative(string $value): bool
    {
        return bccomp($value, '0', self::SCALE) < 0;
    }

    public static function isPositive(string $value): bool
    {
        return bccomp($value, '0', self::SCALE) > 0;
    }

    private static function assertNumeric(string $value): void
    {
        if (preg_match('/^-?\d+(\.\d+)?$/', $value) !== 1) {
            throw new InvalidArgumentException('Valor decimal invalido: '.$value);
        }
    }
}
