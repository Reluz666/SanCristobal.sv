<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\CashRegisterSession;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin CashRegisterSession
 */
final class CashRegisterSessionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var CashRegisterSession $session */
        $session = $this->resource;
        $summary = $session->getAttribute('summary');

        return [
            'uuid' => $session->uuid,
            'status' => $session->status,
            'is_open' => $session->isOpen(),
            'opened_at' => $session->opened_at?->toIso8601String(),
            'closed_at' => $session->closed_at?->toIso8601String(),
            'opening_balance' => (string) $session->opening_balance,
            'expected_closing_balance' => $session->expected_closing_balance !== null
                ? (string) $session->expected_closing_balance
                : null,
            'actual_closing_balance' => $session->actual_closing_balance !== null
                ? (string) $session->actual_closing_balance
                : null,
            'difference' => $session->difference !== null ? (string) $session->difference : null,
            'notes' => $session->notes,
            'summary' => is_array($summary) ? $summary : null,
            'cash_register' => $this->whenLoaded('cashRegister', static fn (): array => [
                'uuid' => $session->cashRegister->uuid,
                'name' => $session->cashRegister->name,
                'warehouse' => $session->cashRegister->relationLoaded('warehouse')
                    && $session->cashRegister->warehouse !== null
                        ? (new WarehouseResource($session->cashRegister->warehouse))->resolve()
                        : null,
            ]),
            'user' => $this->whenLoaded('user', static fn (): array => [
                'uuid' => $session->user->uuid,
                'name' => $session->user->name,
            ]),
            'created_at' => $session->created_at?->toIso8601String(),
        ];
    }
}
