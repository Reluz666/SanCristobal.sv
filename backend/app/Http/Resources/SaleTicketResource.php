<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Sale;
use App\Support\AmountInWords;
use App\Support\SunatQr;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Estructura de impresion termica de 80 mm.
 *
 * @mixin Sale
 */
final class SaleTicketResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Sale $sale */
        $sale = $this->resource;
        $company = $sale->company;
        $customer = $sale->customer;
        $branding = is_array($company->settings['branding'] ?? null)
            ? $company->settings['branding']
            : [];

        return [
            'company' => [
                'ruc' => $company->ruc,
                'legal_name' => $company->legal_name,
                'trade_name' => $company->trade_name ?? (string) ($branding['display_name'] ?? $company->legal_name),
                'address' => $company->address,
                'phone' => $company->phone,
                'email' => $company->email,
                'logo_url' => $branding['logo_url'] ?? null,
            ],
            'document' => [
                'type' => $sale->document_type->value,
                'type_label' => $sale->document_type->shortLabel(),
                'series' => $sale->series,
                'correlative' => $sale->correlative,
                'number' => $sale->number(),
                'issue_date' => $sale->issue_date?->toIso8601String(),
                'currency' => $sale->currency,
                'sunat_status' => $sale->sunat_status->value,
            ],
            'customer' => [
                'identity_document_type' => $customer->identity_document_type->value,
                'identity_document_type_label' => $customer->identity_document_type->label(),
                'document_number' => $customer->document_number,
                'legal_name' => $customer->legal_name,
                'address' => $customer->address,
            ],
            'cashier' => [
                'name' => $sale->user->name,
            ],
            'items' => $sale->items->map(static fn ($item): array => [
                'description' => $item->description,
                'quantity' => (string) $item->quantity,
                'unit_code' => $item->unit_code,
                'unit_price' => (string) $item->unit_price,
                'subtotal' => (string) $item->subtotal,
                'igv' => (string) $item->total_igv,
                'total' => (string) $item->total,
            ])->values()->all(),
            'totals' => [
                'taxed' => (string) $sale->total_taxed,
                'exonerated' => (string) $sale->total_exonerated,
                'unaffected' => (string) $sale->total_unaffected,
                'igv' => (string) $sale->total_igv,
                'discount' => (string) $sale->total_discount,
                'total' => (string) $sale->total_amount,
                'amount_in_words' => AmountInWords::currency((string) $sale->total_amount, $sale->currency),
            ],
            'payments' => $sale->payments->map(static fn ($payment): array => [
                'payment_method' => $payment->payment_method->value,
                'payment_method_label' => $payment->payment_method->label(),
                'amount' => (string) $payment->amount,
                'reference_number' => $payment->reference_number,
            ])->values()->all(),
            'sunat' => [
                'status' => $sale->sunat_status->value,
                'status_label' => $sale->sunat_status->label(),
                'hash' => $sale->sunat_hash,
                'code' => $sale->sunat_code,
                'description' => $sale->sunat_description,
                'qr_text' => SunatQr::payload($sale, $customer, $company->ruc),
                'has_xml' => $sale->sunat_xml_path !== null,
                'has_cdr' => $sale->sunat_cdr_path !== null,
            ],
            'print' => [
                'width_mm' => 80,
                'copies' => 1,
                'footer' => 'Representación impresa del comprobante electrónico. Consulte su validez en SUNAT.',
            ],
        ];
    }
}
