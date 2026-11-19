<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;

final class UpdateCompanySettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'branding' => ['required', 'array:display_name,logo_url,primary_color'],
            'branding.display_name' => ['required', 'string', 'max:160', 'not_regex:/^\s*$/'],
            'branding.logo_url' => [
                'present',
                'nullable',
                'string',
                'max:2048',
                static function (string $attribute, mixed $value, Closure $fail): void {
                    if (! is_string($value) || $value === '' || str_starts_with($value, '/')) {
                        return;
                    }

                    $scheme = parse_url($value, PHP_URL_SCHEME);

                    if (! filter_var($value, FILTER_VALIDATE_URL) || ! in_array($scheme, ['http', 'https'], true)) {
                        $fail('El logo debe usar una ruta local o una URL HTTP/HTTPS válida.');
                    }
                },
            ],
            'branding.primary_color' => ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'payments' => ['required', 'array:yape_phone,plin_phone'],
            'payments.yape_phone' => ['present', 'nullable', 'string', 'max:32', 'regex:/^\+?[0-9\s().-]{6,32}$/'],
            'payments.plin_phone' => ['present', 'nullable', 'string', 'max:32', 'regex:/^\+?[0-9\s().-]{6,32}$/'],
        ];
    }
}
