<?php

declare(strict_types=1);

namespace Tests\Feature\Security;

use App\Enums\DocumentType;
use App\Enums\SunatStatus;
use App\Exceptions\ApiException;
use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\Company;
use App\Models\Customer;
use App\Models\Sale;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\SaleService;
use App\Services\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

final class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_global_scope_only_returns_records_of_the_active_company(): void
    {
        $companyA = Company::factory()->create();
        $companyB = Company::factory()->create();

        $userA = User::factory()->forCompany($companyA)->create();
        $userB = User::factory()->forCompany($companyB)->create();

        app(TenantContext::class)->set($companyA);

        $this->assertTrue(User::query()->whereKey($userA->getKey())->exists());
        $this->assertFalse(User::query()->whereKey($userB->getKey())->exists());
    }

    public function test_new_records_receive_the_active_company_automatically(): void
    {
        $company = Company::factory()->create();
        app(TenantContext::class)->set($company);

        $user = User::factory()->make([
            'company_id' => null,
            'email' => 'tenant-scope@example.com',
        ]);

        $user->save();

        $this->assertSame((int) $company->getKey(), (int) $user->getAttribute('company_id'));
    }

    public function test_writing_to_another_company_is_blocked(): void
    {
        $companyA = Company::factory()->create();
        $companyB = Company::factory()->create();

        app(TenantContext::class)->set($companyA);

        $user = User::factory()->make([
            'company_id' => $companyB->getKey(),
            'email' => 'cross-tenant@example.com',
        ]);

        $this->expectException(AuthorizationException::class);

        $user->save();
    }

    public function test_company_settings_are_encrypted_at_rest_and_decrypted_on_read(): void
    {
        $company = Company::factory()->create([
            'settings' => [
                'branding' => ['display_name' => 'Marca Protegida'],
                'sunat' => [
                    'environment' => 'beta',
                    'sol_user' => 'MODDATOS',
                    'sol_password' => 'clave-super-secreta',
                ],
            ],
        ]);

        $rawSettings = (string) DB::table('companies')
            ->where('id', $company->getKey())
            ->value('settings');

        $this->assertStringNotContainsString('clave-super-secreta', $rawSettings);
        $this->assertStringContainsString('Marca Protegida', $rawSettings);
        $this->assertSame(
            'clave-super-secreta',
            $company->fresh()?->settings['sunat']['sol_password'] ?? null,
        );
    }

    public function test_uuid_is_the_public_route_key(): void
    {
        $company = Company::factory()->create();
        $user = User::factory()->forCompany($company)->create();

        $this->assertSame('uuid', $user->getRouteKeyName());
        $this->assertSame($user->getAttribute('uuid'), $user->getRouteKey());
    }

    public function test_user_of_company_a_cannot_read_or_void_sale_of_company_b(): void
    {
        $companyA = Company::factory()->create();
        $companyB = Company::factory()->create();

        $userA = User::factory()->forCompany($companyA)->create();
        $userB = User::factory()->forCompany($companyB)->create();

        setPermissionsTeamId($companyA->getKey());
        Permission::findOrCreate('sales.view', 'web');
        Permission::findOrCreate('sales.void', 'web');
        $userA->givePermissionTo(['sales.view', 'sales.void']);

        // Create Sale for Company B
        app(TenantContext::class)->set($companyB);

        $warehouseB = Warehouse::factory()->forCompany($companyB)->create();
        $cashRegisterB = CashRegister::query()->create([
            'company_id' => $companyB->getKey(),
            'warehouse_id' => $warehouseB->getKey(),
            'name' => 'Caja B',
            'is_active' => true,
        ]);
        $sessionB = CashRegisterSession::query()->create([
            'company_id' => $companyB->getKey(),
            'cash_register_id' => $cashRegisterB->getKey(),
            'user_id' => $userB->getKey(),
            'opening_balance' => '100.00',
            'opened_at' => now(),
            'status' => 'OPEN',
        ]);
        $customerB = Customer::query()->create([
            'company_id' => $companyB->getKey(),
            'identity_document_type' => '1',
            'document_number' => '44556677',
            'legal_name' => 'Cliente Empresa B',
            'is_active' => true,
        ]);
        $saleB = Sale::query()->create([
            'company_id' => $companyB->getKey(),
            'warehouse_id' => $warehouseB->getKey(),
            'cash_register_session_id' => $sessionB->getKey(),
            'customer_id' => $customerB->getKey(),
            'user_id' => $userB->getKey(),
            'document_type' => DocumentType::Receipt,
            'series' => 'B001',
            'correlative' => 1,
            'issue_date' => now(),
            'currency' => 'PEN',
            'exchange_rate' => '1.0000',
            'total_taxed' => '10.00',
            'total_exonerated' => '0.00',
            'total_unaffected' => '0.00',
            'total_igv' => '1.80',
            'total_discount' => '0.00',
            'total_amount' => '11.80',
            'sunat_status' => SunatStatus::Accepted,
        ]);

        // Attempt as User A (from Company A)
        app(TenantContext::class)->set($companyA);
        Sanctum::actingAs($userA);

        // 1. Reading Sale of Company B via API is blocked (404 Not Found due to tenant scope)
        $this->getJson('/api/v1/pos/sales/'.$saleB->uuid)
            ->assertNotFound()
            ->assertJsonPath('success', false);

        // 2. Voiding Sale of Company B via API is blocked (404 Not Found)
        $this->postJson('/api/v1/pos/sales/'.$saleB->uuid.'/void', [
            'reason' => 'Intento de anulación cross-tenant',
        ])
            ->assertNotFound()
            ->assertJsonPath('success', false);

        // 3. Direct invocation on SaleService throws ApiException with 403 Forbidden
        $this->expectException(ApiException::class);
        app(SaleService::class)->voidSale($saleB, $userA, 'Intento no autorizado');
    }
}
