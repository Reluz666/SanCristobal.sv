<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Customer
 */
final class CustomerResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Customer $customer */
        $customer = $this->resource;

        return [
            'uuid' => $customer->uuid,
            'identity_document_type' => $customer->identity_document_type->value,
            'identity_document_type_label' => $customer->identity_document_type->label(),
            'document_number' => $customer->document_number,
            'legal_name' => $customer->legal_name,
            'address' => $customer->address,
            'ubigeo' => $customer->ubigeo,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'is_generic' => $customer->isGeneric(),
        ];
    }
}
