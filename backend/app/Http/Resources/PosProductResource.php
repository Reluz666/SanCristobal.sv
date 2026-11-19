<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Product;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Product
 */
final class PosProductResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Product $product */
        $product = $this->resource;
        $stock = (string) ($product->getAttribute('stock') ?? '0.0000');
        $minStock = (string) $product->min_stock;
        $trackStock = (bool) $product->track_stock;

        return [
            'uuid' => $product->uuid,
            'sku' => $product->sku,
            'barcode' => $product->barcode,
            'name' => $product->name,
            'unit_code' => $product->unit_code,
            'tax_affectation_type' => $product->tax_affectation_type->value,
            'tax_affectation_label' => $product->tax_affectation_type->label(),
            'sale_price' => Money::norm((string) $product->sale_price, 4),
            'currency' => 'PEN',
            'min_stock' => Money::norm($minStock, 4),
            'track_stock' => $trackStock,
            'stock' => Money::norm($stock, 4),
            'is_low_stock' => $trackStock && Money::cmp($stock, $minStock, 4) <= 0,
            'category' => $this->whenLoaded('category', static fn (): ?array => $product->category === null ? null : [
                'uuid' => $product->category->uuid,
                'name' => $product->category->name,
            ]),
            'unit' => $this->whenLoaded('unit', static fn (): ?array => $product->unit === null ? null : [
                'code' => $product->unit->code,
                'name' => $product->unit->name,
            ]),
        ];
    }
}
