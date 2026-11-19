<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Company;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Expone únicamente la configuración pública de la empresa. Las credenciales
 * SOL, certificados y tokens permanecen cifrados y fuera de la respuesta.
 *
 * @mixin Company
 */
final class CompanyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Company $company */
        $company = $this->resource;
        $settings = $company->settings;
        $branding = is_array($settings['branding'] ?? null) ? $settings['branding'] : [];
        $payments = is_array($settings['payments'] ?? null) ? $settings['payments'] : [];
        $sunatSettings = is_array($settings['sunat'] ?? null) ? $settings['sunat'] : [];
        $sunatMode = (string) config('sunat.mode', 'simulate');
        $sunatEnvironment = (string) ($sunatSettings['environment'] ?? config('sunat.environment', 'beta'));

        return [
            'uuid' => $company->uuid,
            'ruc' => $company->ruc,
            'legal_name' => $company->legal_name,
            'trade_name' => $company->trade_name,
            'email' => $company->email,
            'phone' => $company->phone,
            'address' => $company->address,
            'ubigeo' => $company->ubigeo,
            'currency' => in_array($settings['currency'] ?? null, ['PEN', 'USD'], true)
                ? $settings['currency']
                : 'PEN',
            'igv_percentage' => (string) ($settings['igv_percentage'] ?? '18.00'),
            'timezone' => (string) ($settings['timezone'] ?? 'America/Lima'),
            'features' => [
                'cash_sessions_enabled' => $company->cashSessionsEnabled(),
            ],
            'sunat' => [
                'mode' => in_array($sunatMode, ['simulate', 'auto', 'live'], true) ? $sunatMode : 'simulate',
                'environment' => in_array($sunatEnvironment, ['beta', 'production'], true) ? $sunatEnvironment : 'beta',
            ],
            'branding' => [
                'display_name' => (string) ($branding['display_name'] ?? $company->trade_name ?? $company->legal_name),
                'logo_url' => is_string($branding['logo_url'] ?? null) ? $branding['logo_url'] : null,
                'primary_color' => is_string($branding['primary_color'] ?? null)
                    && preg_match('/^#[0-9a-fA-F]{6}$/', $branding['primary_color']) === 1
                    ? $branding['primary_color']
                    : '#03B7A3',
            ],
            'payments' => [
                'yape_phone' => is_string($payments['yape_phone'] ?? null) && trim($payments['yape_phone']) !== ''
                    ? trim($payments['yape_phone'])
                    : null,
                'plin_phone' => is_string($payments['plin_phone'] ?? null) && trim($payments['plin_phone']) !== ''
                    ? trim($payments['plin_phone'])
                    : null,
            ],
            'is_active' => $company->is_active,
            'created_at' => $company->created_at?->toIso8601String(),
        ];
    }
}
