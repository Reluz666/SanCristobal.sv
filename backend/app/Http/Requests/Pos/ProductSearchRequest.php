<?php

declare(strict_types=1);

namespace App\Http\Requests\Pos;

use Illuminate\Foundation\Http\FormRequest;

final class ProductSearchRequest extends FormRequest
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
            'search' => ['nullable', 'string', 'max:100'],
            'category_uuid' => ['nullable', 'uuid'],
            'warehouse_uuid' => ['nullable', 'uuid'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
