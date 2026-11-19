<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Leyenda SUNAT 1000: importe total en letras.
 *
 * Se usa tanto en el XML UBL como en la representacion impresa del ticket.
 * El importe se recibe como string decimal para no perder precision.
 */
final class AmountInWords
{
    private const UNITS = [
        '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ',
        'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO',
        'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO',
        'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
    ];

    private const TENS = [
        '', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA',
    ];

    private const HUNDREDS = [
        '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS',
        'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
    ];

    public static function currency(string $amount, string $currency = 'PEN'): string
    {
        $normalized = Money::round($amount, 2);
        [$integer, $cents] = explode('.', $normalized);
        $name = $currency === 'USD' ? 'DOLARES AMERICANOS' : 'SOLES';

        return sprintf('SON %s CON %s/100 %s', self::integer((int) $integer), $cents, $name);
    }

    private static function integer(int $number): string
    {
        if ($number === 0) {
            return 'CERO';
        }

        if ($number >= 1_000_000) {
            $millions = intdiv($number, 1_000_000);
            $rest = $number % 1_000_000;
            $head = $millions === 1 ? 'UN MILLON' : self::integer($millions).' MILLONES';

            return trim($head.' '.($rest > 0 ? self::integer($rest) : ''));
        }

        if ($number >= 1000) {
            $thousands = intdiv($number, 1000);
            $rest = $number % 1000;
            $head = $thousands === 1 ? 'MIL' : self::integer($thousands).' MIL';

            return trim($head.' '.($rest > 0 ? self::integer($rest) : ''));
        }

        if ($number === 100) {
            return 'CIEN';
        }

        $words = [];
        $hundreds = intdiv($number, 100);
        $rest = $number % 100;

        if ($hundreds > 0) {
            $words[] = self::HUNDREDS[$hundreds];
        }

        if ($rest > 0) {
            if ($rest < 30) {
                $words[] = self::UNITS[$rest];
            } else {
                $unit = $rest % 10;
                $words[] = self::TENS[intdiv($rest, 10)].($unit > 0 ? ' Y '.self::UNITS[$unit] : '');
            }
        }

        return implode(' ', $words);
    }
}
