<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Sale;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Sale
 */
final class SaleResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Sale $sale */
        $sale = $this->resource;

        return [
            'uuid' => $sale->uuid,
            'number' => $sale->number(),
            'document_type' => $sale->document_type->value,
            'document_type_label' => $sale->document_type->shortLabel(),
            'series' => $sale->series,
            'correlative' => $sale->correlative,
            'issue_date' => $sale->issue_date?->toIso8601String(),
            'currency' => $sale->currency,
            'exchange_rate' => (string) $sale->exchange_rate,
            'totals' => [
                'taxed' => (string) $sale->total_taxed,
                'exonerated' => (string) $sale->total_exonerated,
                'unaffected' => (string) $sale->total_unaffected,
                'igv' => (string) $sale->total_igv,
                'discount' => (string) $sale->total_discount,
                'total' => (string) $sale->total_amount,
            ],
            'sunat' => [
                'status' => $sale->sunat_status->value,
                'status_label' => $sale->sunat_status->label(),
                'hash' => $sale->sunat_hash,
                'code' => $sale->sunat_code,
                'description' => $sale->sunat_description,
                'has_xml' => $sale->sunat_xml_path !== null,
                'has_cdr' => $sale->sunat_cdr_path !== null,
            ],
            'customer' => $this->whenLoaded('customer', fn (): array => (new CustomerResource($sale->customer))->resolve()),
            'cashier' => $this->whenLoaded('user', static fn (): array => [
                'uuid' => $sale->user->uuid,
                'name' => $sale->user->name,
            ]),
            'warehouse' => $this->whenLoaded('warehouse', fn (): array => (new WarehouseResource($sale->warehouse))->resolve()),
            'items' => SaleItemResource::collection($this->whenLoaded('items')),
            'payments' => SalePaymentResource::collection($this->whenLoaded('payments')),
            'created_at' => $sale->created_at?->toIso8601String(),
        ];
    }
}
