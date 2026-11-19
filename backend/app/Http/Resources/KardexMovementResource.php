<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\KardexMovement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin KardexMovement
 */
final class KardexMovementResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var KardexMovement $movement */
        $movement = $this->resource;

        return [
            'uuid' => $movement->uuid,
            'movement_date' => $movement->movement_date?->toIso8601String(),
            'movement_type' => $movement->movement_type->value,
            'movement_type_label' => $movement->movement_type->label(),
            'is_outbound' => $movement->movement_type->isOutbound(),
            'document_type' => $movement->document_type?->value,
            'document_type_label' => $movement->document_type?->shortLabel(),
            'document_reference' => $movement->document_reference,
            'quantity' => (string) $movement->quantity,
            'unit_cost' => (string) $movement->unit_cost,
            'total_cost' => (string) $movement->total_cost,
            'balance_quantity' => (string) $movement->balance_quantity,
            'balance_unit_cost' => (string) $movement->balance_unit_cost,
            'balance_total_cost' => (string) $movement->balance_total_cost,
            'notes' => $movement->notes,
            'product' => $this->whenLoaded('product', static fn (): array => [
                'uuid' => $movement->product->uuid,
                'sku' => $movement->product->sku,
                'name' => $movement->product->name,
            ]),
            'warehouse' => $this->whenLoaded('warehouse', static fn (): array => [
                'uuid' => $movement->warehouse->uuid,
                'name' => $movement->warehouse->name,
            ]),
            'user' => $this->whenLoaded('user', static fn (): array => [
                'uuid' => $movement->user->uuid,
                'name' => $movement->user->name,
            ]),
        ];
    }
}
