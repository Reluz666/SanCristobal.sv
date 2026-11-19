<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Enums\DocumentType;
use App\Enums\KardexMovementType;
use App\Enums\SunatStatus;
use App\Models\CashRegister;
use App\Models\Company;
use App\Models\KardexMovement;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\Sale;
use App\Models\User;
use Database\Seeders\DemoPortfolioSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class CreditNoteReversalTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private User $admin;

    private User $cashier;

    private CashRegister $cashRegister;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DemoPortfolioSeeder::class);

        $this->company = Company::query()
            ->where('ruc', DemoPortfolioSeeder::COMPANY_RUC)
            ->firstOrFail();
        $this->admin = User::query()
            ->where('email', DemoPortfolioSeeder::ADMIN_EMAIL)
            ->firstOrFail();
        $this->cashier = User::query()
            ->where('email', DemoPortfolioSeeder::CASHIER_EMAIL)
            ->firstOrFail();
        $this->cashRegister = CashRegister::query()
            ->where('name', DemoPortfolioSeeder::CASH_REGISTER_NAME)
            ->firstOrFail();

        Sanctum::actingAs($this->cashier);
        config(['sunat.mode' => 'simulate']);
    }

    public function test_sale_can_be_voided_via_credit_note_and_reverses_stock_to_kardex(): void
    {
        Storage::fake('local');

        $product = $this->productByBarcode(DemoPortfolioSeeder::PRIMARY_PRODUCT_BARCODE);
        $this->assertSame('120.0000', (string) $this->stockOf($product)->stock);

        // 1. Emit sale of 2 units
        $saleResponse = $this->postJson('/api/v1/pos/sales', [
            'document_type' => '03',
            'customer' => [
                'identity_document_type' => '1',
                'document_number' => '12345678',
                'legal_name' => 'JUAN CARLOS PEREZ',
            ],
            'items' => [
                ['product_uuid' => $product->uuid, 'quantity' => '2'],
            ],
            'payments' => [
                ['payment_method' => 'CASH', 'amount' => '15.00'],
            ],
        ])->assertCreated();

        $saleUuid = (string) $saleResponse->json('data.sale.uuid');
        $this->assertSame('118.0000', (string) $this->stockOf($product)->stock);

        // 2. Void sale as Admin (who has 'sales.void' permission)
        Sanctum::actingAs($this->admin);

        $voidResponse = $this->postJson('/api/v1/pos/sales/'.$saleUuid.'/void', [
            'reason' => 'Devolución total por insatisfacción del cliente',
        ]);

        $voidResponse
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.sale.sunat.status', 'ANNULLED');

        $this->assertStringContainsString('restituidas al inventario', (string) $voidResponse->json('message'));

        // 3. Verify Sale model is updated
        $sale = Sale::query()->where('uuid', $saleUuid)->firstOrFail();
        $this->assertSame(SunatStatus::Annulled, $sale->sunat_status);
        $this->assertStringContainsString('Nota de Crédito', (string) $sale->sunat_description);
        $this->assertStringContainsString('Devolución total', (string) $sale->sunat_description);

        // 4. Verify Stock is exactly restored in product_warehouse
        $stock = $this->stockOf($product);
        $this->assertSame('120.0000', (string) $stock->stock);

        // 5. Verify Kardex movement IN_RETURN is created
        $reversalMovement = KardexMovement::query()
            ->where('product_id', $product->getKey())
            ->where('movement_type', KardexMovementType::InReturn)
            ->firstOrFail();

        $this->assertSame('2.0000', (string) $reversalMovement->quantity);
        $this->assertSame('120.0000', (string) $reversalMovement->balance_quantity);
        $this->assertSame(DocumentType::CreditNote, $reversalMovement->document_type);
        $this->assertStringStartsWith('BC01-', (string) $reversalMovement->document_reference);
        $this->assertStringContainsString('Retorno de stock', (string) $reversalMovement->notes);
    }

    public function test_voiding_an_already_annulled_sale_returns_422(): void
    {
        Storage::fake('local');

        $product = $this->productByBarcode(DemoPortfolioSeeder::PRIMARY_PRODUCT_BARCODE);

        $saleResponse = $this->postJson('/api/v1/pos/sales', [
            'document_type' => '03',
            'customer' => [
                'identity_document_type' => '1',
                'document_number' => '12345678',
                'legal_name' => 'JUAN CARLOS PEREZ',
            ],
            'items' => [
                ['product_uuid' => $product->uuid, 'quantity' => '1'],
            ],
            'payments' => [
                ['payment_method' => 'CASH', 'amount' => '7.50'],
            ],
        ])->assertCreated();

        $saleUuid = (string) $saleResponse->json('data.sale.uuid');

        Sanctum::actingAs($this->admin);

        // First void succeeds
        $this->postJson('/api/v1/pos/sales/'.$saleUuid.'/void')->assertOk();

        // Second void attempt fails with 422
        $secondResponse = $this->postJson('/api/v1/pos/sales/'.$saleUuid.'/void');

        $secondResponse
            ->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'El comprobante ya fue anulado previamente.');
    }

    public function test_cashier_without_sales_void_permission_cannot_void_sale(): void
    {
        Storage::fake('local');

        $product = $this->productByBarcode(DemoPortfolioSeeder::PRIMARY_PRODUCT_BARCODE);

        $saleResponse = $this->postJson('/api/v1/pos/sales', [
            'document_type' => '03',
            'customer' => [
                'identity_document_type' => '1',
                'document_number' => '12345678',
                'legal_name' => 'JUAN CARLOS PEREZ',
            ],
            'items' => [
                ['product_uuid' => $product->uuid, 'quantity' => '1'],
            ],
            'payments' => [
                ['payment_method' => 'CASH', 'amount' => '7.50'],
            ],
        ])->assertCreated();

        $saleUuid = (string) $saleResponse->json('data.sale.uuid');

        // Cashier role does NOT have 'sales.void'
        Sanctum::actingAs($this->cashier);

        $this->postJson('/api/v1/pos/sales/'.$saleUuid.'/void')
            ->assertForbidden()
            ->assertJsonPath('success', false);
    }

    private function productByBarcode(string $barcode): Product
    {
        return Product::query()->where('barcode', $barcode)->firstOrFail();
    }

    private function stockOf(Product $product): ProductWarehouse
    {
        return ProductWarehouse::query()
            ->where('product_id', $product->getKey())
            ->where('warehouse_id', $this->cashRegister->warehouse_id)
            ->firstOrFail();
    }
}
