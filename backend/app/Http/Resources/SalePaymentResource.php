<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\SalePayment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SalePayment
 */
final class SalePaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var SalePayment $payment */
        $payment = $this->resource;

        return [
            'payment_method' => $payment->payment_method->value,
            'payment_method_label' => $payment->payment_method->label(),
            'amount' => (string) $payment->amount,
            'reference_number' => $payment->reference_number,
        ];
    }
}
