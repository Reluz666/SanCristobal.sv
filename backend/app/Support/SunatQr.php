<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Customer;
use App\Models\Sale;

/**
 * Texto plano del codigo QR de representacion impresa SUNAT.
 *
 * Formato:
 * RUC|TIPO|SERIE|CORRELATIVO|IGV|TOTAL|FECHA|TIPO_DOC_CLIENTE|NRO_DOC_CLIENTE|HASH|
 */
final class SunatQr
{
    public static function payload(Sale $sale, Customer $customer, string $ruc): string
    {
        $hash = (string) ($sale->sunat_hash ?? '');

        return implode('|', [
            $ruc,
            $sale->document_type->value,
            $sale->series,
            str_pad((string) $sale->correlative, 8, '0', STR_PAD_LEFT),
            Money::round((string) $sale->total_igv, 2),
            Money::round((string) $sale->total_amount, 2),
            $sale->issue_date?->format('Y-m-d') ?? '',
            $customer->identity_document_type->value,
            $customer->document_number,
            $hash,
            '',
        ]);
    }
}
