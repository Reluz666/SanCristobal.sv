<?php

declare(strict_types=1);

namespace App\Http\Requests\Pos;

use App\Enums\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'idempotency_key' => ['nullable', 'string', 'max:64'],
            'document_type' => ['required', 'string', Rule::in(['00', '01', '03'])],
            'warehouse_uuid' => ['nullable', 'uuid'],
            'customer_uuid' => ['nullable', 'uuid'],
            'customer' => ['nullable', 'array'],
            'customer.identity_document_type' => [
                'required_with:customer',
                'string',
                Rule::in(['0', '1', '4', '6', '7']),
            ],
            'customer.document_number' => ['required_with:customer', 'string', 'max:15'],
            'customer.legal_name' => ['required_with:customer', 'string', 'max:200'],
            'customer.address' => ['nullable', 'string', 'max:255'],
            'customer.ubigeo' => ['nullable', 'string', 'size:6'],
            'customer.email' => ['nullable', 'email:rfc', 'max:254'],
            'customer.phone' => ['nullable', 'string', 'max:20'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.product_uuid' => ['required', 'uuid', 'distinct'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0', 'max:100000', 'decimal:0,4'],
            'payments' => ['required', 'array', 'min:1', 'max:10'],
            'payments.*.payment_method' => ['required', Rule::enum(PaymentMethod::class)],
            'payments.*.amount' => ['required', 'numeric', 'gt:0', 'max:99999999', 'decimal:0,2'],
            'payments.*.reference_number' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $idempotencyKey = $this->header('X-Idempotency-Key')
            ?? $this->header('Idempotency-Key')
            ?? $this->input('idempotency_key');

        if (is_string($idempotencyKey) && trim($idempotencyKey) !== '') {
            $this->merge(['idempotency_key' => trim($idempotencyKey)]);
        }

        $customer = $this->input('customer');

        if (is_array($customer)) {
            $customer['document_number'] = trim((string) ($customer['document_number'] ?? ''));
            $customer['legal_name'] = trim((string) ($customer['legal_name'] ?? ''));
            $this->merge(['customer' => $customer]);
        }

        $payments = $this->input('payments');

        if (is_array($payments)) {
            $normalized = array_map(static function (mixed $payment): mixed {
                if (! is_array($payment)) {
                    return $payment;
                }

                if (isset($payment['reference_number'])) {
                    $payment['reference_number'] = trim((string) $payment['reference_number']);
                }

                return $payment;
            }, $payments);

            $this->merge(['payments' => $normalized]);
        }
    }
}
