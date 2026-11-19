<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\SaleItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SaleItem
 */
final class SaleItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var SaleItem $item */
        $item = $this->resource;

        return [
            'description' => $item->description,
            'unit_code' => $item->unit_code,
            'tax_affectation_type' => $item->tax_affectation_type->value,
            'tax_affectation_label' => $item->tax_affectation_type->label(),
            'quantity' => (string) $item->quantity,
            'unit_value' => (string) $item->unit_value,
            'unit_price' => (string) $item->unit_price,
            'igv_percentage' => (string) $item->igv_percentage,
            'total_igv' => (string) $item->total_igv,
            'subtotal' => (string) $item->subtotal,
            'total' => (string) $item->total,
            'product' => $this->whenLoaded('product', static fn (): ?array => $item->product === null ? null : [
                'uuid' => $item->product->uuid,
                'sku' => $item->product->sku,
                'barcode' => $item->product->barcode,
            ]),
        ];
    }
}
