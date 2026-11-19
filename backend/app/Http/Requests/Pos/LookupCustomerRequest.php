<?php

declare(strict_types=1);

namespace App\Http\Requests\Pos;

use Illuminate\Foundation\Http\FormRequest;

final class LookupCustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'document_number' => ['required', 'string', 'regex:/^\d{8,11}$/'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'document_number' => preg_replace('/\D+/', '', (string) $this->input('document_number')) ?? '',
        ]);
    }
}
