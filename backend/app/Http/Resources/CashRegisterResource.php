<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\CashRegister;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin CashRegister
 */
final class CashRegisterResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var CashRegister $register */
        $register = $this->resource;

        return [
            'uuid' => $register->uuid,
            'name' => $register->name,
            'is_active' => $register->is_active,
            'is_open' => (bool) ($register->getAttribute('is_open') ?? false),
            'warehouse' => $this->whenLoaded(
                'warehouse',
                fn (): ?array => $register->warehouse === null
                    ? null
                    : (new WarehouseResource($register->warehouse))->resolve(),
            ),
        ];
    }
}
