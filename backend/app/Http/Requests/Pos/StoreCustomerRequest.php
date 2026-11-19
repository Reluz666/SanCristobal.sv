<?php

declare(strict_types=1);

namespace App\Http\Requests\Pos;

use App\Services\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreCustomerRequest extends FormRequest
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
        $companyId = app(TenantContext::class)->companyId();
        $documentType = (string) $this->input('identity_document_type');

        return [
            'identity_document_type' => ['required', 'string', Rule::in(['0', '1', '4', '6', '7'])],
            'document_number' => [
                'required',
                'string',
                'max:15',
                Rule::unique('customers', 'document_number')
                    ->where(static fn ($query) => $query
                        ->where('company_id', $companyId)
                        ->where('identity_document_type', $documentType)
                        ->whereNull('deleted_at')),
            ],
            'legal_name' => ['required', 'string', 'max:200'],
            'address' => ['nullable', 'string', 'max:255'],
            'ubigeo' => ['nullable', 'string', 'size:6'],
            'email' => ['nullable', 'email:rfc', 'max:254'],
            'phone' => ['nullable', 'string', 'max:20'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'document_number' => trim((string) $this->input('document_number')),
            'legal_name' => trim((string) $this->input('legal_name')),
        ]);
    }
}
