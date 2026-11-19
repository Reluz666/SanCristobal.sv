<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Warehouse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Warehouse
 */
final class WarehouseResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Warehouse $warehouse */
        $warehouse = $this->resource;

        return [
            'uuid' => $warehouse->uuid,
            'code' => $warehouse->code,
            'sunat_code' => $warehouse->sunat_code,
            'name' => $warehouse->name,
            'address' => $warehouse->address,
            'is_active' => $warehouse->is_active,
        ];
    }
}
