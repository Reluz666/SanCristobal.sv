<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
final class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var User $user */
        $user = $this->resource;

        return [
            'uuid' => $user->uuid,
            'name' => $user->name,
            'email' => $user->email,
            'document_type' => $user->document_type?->value,
            'document_number' => $user->document_number,
            'phone' => $user->phone,
            'is_active' => $user->is_active,
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'company' => new CompanyResource($this->whenLoaded('company')),
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }
}
