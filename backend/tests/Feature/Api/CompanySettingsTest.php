<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\User;
use Database\Seeders\DemoPortfolioSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class CompanySettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DemoPortfolioSeeder::class);
    }

    public function test_admin_can_update_branding_and_payment_details_without_overwriting_other_settings(): void
    {
        $company = Company::query()->where('ruc', DemoPortfolioSeeder::COMPANY_RUC)->firstOrFail();
        $admin = User::query()->where('email', DemoPortfolioSeeder::ADMIN_EMAIL)->firstOrFail();
        $originalSunat = $company->settings['sunat'];

        Sanctum::actingAs($admin);

        $this->putJson('/api/v1/company/settings', [
            'branding' => [
                'display_name' => 'San Cristóbal Comercial',
                'logo_url' => '/marca/logo.svg',
                'primary_color' => '#124578',
            ],
            'payments' => [
                'yape_phone' => '+51 999 123 456',
                'plin_phone' => null,
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.branding.display_name', 'San Cristóbal Comercial')
            ->assertJsonPath('data.branding.logo_url', '/marca/logo.svg')
            ->assertJsonPath('data.branding.primary_color', '#124578')
            ->assertJsonPath('data.payments.yape_phone', '+51 999 123 456')
            ->assertJsonPath('data.payments.plin_phone', null);

        $settings = $company->fresh()->settings;

        $this->assertSame('San Cristóbal Comercial', $settings['branding']['display_name']);
        $this->assertSame($originalSunat, $settings['sunat']);
        $this->assertFalse($settings['features']['cash_sessions_enabled']);
    }

    public function test_cashier_cannot_update_company_settings(): void
    {
        $cashier = User::query()->where('email', DemoPortfolioSeeder::CASHIER_EMAIL)->firstOrFail();

        Sanctum::actingAs($cashier);

        $this->putJson('/api/v1/company/settings', [
            'branding' => [
                'display_name' => 'Cambio no autorizado',
                'logo_url' => null,
                'primary_color' => '#124578',
            ],
            'payments' => [
                'yape_phone' => null,
                'plin_phone' => null,
            ],
        ])->assertForbidden();
    }

    public function test_invalid_color_and_payment_phone_are_rejected(): void
    {
        $admin = User::query()->where('email', DemoPortfolioSeeder::ADMIN_EMAIL)->firstOrFail();

        Sanctum::actingAs($admin);

        $this->putJson('/api/v1/company/settings', [
            'branding' => [
                'display_name' => 'San Cristóbal',
                'logo_url' => null,
                'primary_color' => 'red',
            ],
            'payments' => [
                'yape_phone' => 'abc123',
                'plin_phone' => null,
            ],
        ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.0.field', 'branding.primary_color')
            ->assertJsonPath('errors.1.field', 'payments.yape_phone');
    }
}
