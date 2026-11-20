<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Activity;
use App\Models\Company;
use Database\Seeders\DemoPortfolioSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DemoPortfolioSeeder::class);
    }

    public function test_login_returns_token_roles_permissions_and_public_company_config(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => DemoPortfolioSeeder::ADMIN_EMAIL,
            'password' => DemoPortfolioSeeder::LOCAL_PASSWORD,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.token_type', 'Bearer')
            ->assertJsonPath('data.user.email', DemoPortfolioSeeder::ADMIN_EMAIL)
            ->assertJsonPath('data.company.ruc', DemoPortfolioSeeder::COMPANY_RUC)
            ->assertJsonPath('data.company.currency', 'PEN')
            ->assertJsonPath('data.company.igv_percentage', '18.00')
            ->assertJsonPath('data.roles.0', 'admin')
            ->assertJsonStructure([
                'data' => [
                    'token',
                    'expires_at',
                    'user' => ['uuid', 'name', 'email'],
                    'roles',
                    'permissions',
                    'company' => ['uuid', 'ruc', 'legal_name', 'currency', 'igv_percentage'],
                ],
            ]);

        $this->assertIsString($response->json('data.token'));
        $this->assertContains('settings.manage', $response->json('data.permissions'));
        $this->assertDatabaseHas('activity_log', [
            'log_name' => 'auth',
            'description' => 'Inicio de sesión exitoso',
        ]);
    }

    public function test_local_seed_is_idempotent_and_only_creates_san_cristobal(): void
    {
        $this->assertDatabaseCount('companies', 1);
        $this->assertDatabaseHas('companies', [
            'ruc' => DemoPortfolioSeeder::COMPANY_RUC,
            'legal_name' => 'SAN CRISTOBAL-PAKAMUROS E.I.R.L.',
            'is_active' => true,
        ]);

        $this->seed(DemoPortfolioSeeder::class);

        $this->assertDatabaseCount('companies', 1);
        $this->assertDatabaseHas('companies', [
            'ruc' => DemoPortfolioSeeder::COMPANY_RUC,
        ]);
    }

    public function test_cashier_role_receives_limited_permissions(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => DemoPortfolioSeeder::CASHIER_EMAIL,
            'password' => DemoPortfolioSeeder::LOCAL_PASSWORD,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.roles.0', 'cashier');

        $permissions = $response->json('data.permissions');

        $this->assertIsArray($permissions);
        $this->assertContains('pos.operate', $permissions);
        $this->assertContains('customers.manage', $permissions);
        $this->assertNotContains('settings.manage', $permissions);
        $this->assertNotContains('users.manage', $permissions);
    }

    public function test_invalid_credentials_are_rejected_and_audited(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => DemoPortfolioSeeder::ADMIN_EMAIL,
            'password' => 'incorrecta',
        ]);

        $response
            ->assertUnauthorized()
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'El correo o la contraseña no son correctos.')
            ->assertHeader('X-Trace-Id');

        $this->assertDatabaseHas('activity_log', [
            'log_name' => 'auth',
            'description' => 'Intento de inicio de sesión fallido',
        ]);
    }

    public function test_inactive_company_blocks_login(): void
    {
        $company = Company::query()->where('ruc', DemoPortfolioSeeder::COMPANY_RUC)->firstOrFail();
        $company->update(['is_active' => false]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => DemoPortfolioSeeder::ADMIN_EMAIL,
            'password' => DemoPortfolioSeeder::LOCAL_PASSWORD,
        ]);

        $response
            ->assertForbidden()
            ->assertJsonPath('message', 'La empresa asociada no se encuentra activa.');
    }

    public function test_me_returns_the_current_session_and_logout_revokes_the_token(): void
    {
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => DemoPortfolioSeeder::ADMIN_EMAIL,
            'password' => DemoPortfolioSeeder::LOCAL_PASSWORD,
        ])->assertOk();

        $token = $login->json('data.token');

        $this->assertIsString($token);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.token', $token)
            ->assertJsonPath('data.user.email', DemoPortfolioSeeder::ADMIN_EMAIL)
            ->assertJsonPath('data.company.ruc', DemoPortfolioSeeder::COMPANY_RUC);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Sesión cerrada correctamente.');

        $this->assertDatabaseCount('personal_access_tokens', 0);

        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized();

        $this->assertDatabaseHas('activity_log', [
            'log_name' => 'auth',
            'description' => 'Cierre de sesión',
        ]);
    }

    public function test_failed_login_does_not_store_the_password(): void
    {
        $this->postJson('/api/v1/auth/login', [
            'email' => DemoPortfolioSeeder::ADMIN_EMAIL,
            'password' => 'super-secreta-no-debe-persistir',
        ])->assertUnauthorized();

        $activity = Activity::query()
            ->where('log_name', 'auth')
            ->latest('id')
            ->firstOrFail();

        $properties = $activity->properties?->toJson() ?? '';

        $this->assertStringNotContainsString('super-secreta-no-debe-persistir', $properties);
    }
}
