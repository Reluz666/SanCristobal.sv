<?php

declare(strict_types=1);

namespace App\Http\Requests\Pos;

use Illuminate\Foundation\Http\FormRequest;

final class CloseCashRegisterRequest extends FormRequest
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
            'actual_closing_balance' => ['required', 'numeric', 'min:0', 'max:99999999', 'decimal:0,2'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
