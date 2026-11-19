<?php

declare(strict_types=1);

namespace App\Http\Requests\Pos;

use App\Enums\DocumentType;
use App\Enums\SunatStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListSalesRequest extends FormRequest
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
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'series' => ['nullable', 'string', 'size:4'],
            'document_type' => ['nullable', Rule::enum(DocumentType::class)],
            'sunat_status' => ['nullable', Rule::enum(SunatStatus::class)],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
