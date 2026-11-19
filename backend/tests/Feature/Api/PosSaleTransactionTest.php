<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Enums\KardexMovementType;
use App\Models\CashRegister;
use App\Models\Company;
use App\Models\Customer;
use App\Models\KardexMovement;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\User;
use Database\Seeders\DemoPortfolioSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class PosSaleTransactionTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private User $cashier;

    private CashRegister $cashRegister;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DemoPortfolioSeeder::class);

        $this->company = Company::query()
            ->where('ruc', DemoPortfolioSeeder::COMPANY_RUC)
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

    public function test_successful_pos_sale_updates_stock_kardex_and_supports_idempotency(): void
    {
        Storage::fake('local');
        $product = $this->productByBarcode(DemoPortfolioSeeder::PRIMARY_PRODUCT_BARCODE);
        $this->assertSame('120.0000', (string) $this->stockOf($product)->stock);

        $idempotencyKey = 'pos-idempotency-key-test-001';

        $payload = [
            'document_type' => '03',
            'customer' => [
                'identity_document_type' => '1',
                'document_number' => '12345678',
                'legal_name' => 'JUAN CARLOS PEREZ GARCIA',
            ],
            'items' => [
                ['product_uuid' => $product->uuid, 'quantity' => '2'],
            ],
            'payments' => [
                ['payment_method' => 'CASH', 'amount' => '15.00'],
            ],
        ];

        // First call
        $response1 = $this->withHeader('X-Idempotency-Key', $idempotencyKey)
            ->postJson('/api/v1/pos/sales', $payload);

        $response1
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.sale.number', 'B001-00000001')
            ->assertJsonPath('data.sale.totals.total', '15.00');

        $saleId = $response1->json('data.sale.uuid');

        // Stock decreased by 2 (from 120 to 118)
        $this->assertSame('118.0000', (string) $this->stockOf($product)->stock);
        $this->assertDatabaseCount('sales', 1);

        // Second call with EXACT SAME Idempotency-Key (simulating double click or network retry)
        $response2 = $this->withHeader('X-Idempotency-Key', $idempotencyKey)
            ->postJson('/api/v1/pos/sales', $payload);

        $response2
            ->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.sale.uuid', $saleId)
            ->assertJsonPath('data.sale.number', 'B001-00000001');

        // Stock MUST STILL be 118.0000, NOT 116.0000!
        $this->assertSame('118.0000', (string) $this->stockOf($product)->stock);
        $this->assertDatabaseCount('sales', 1);

        // Exactly one OUT_SALE Kardex movement was registered
        $this->assertSame(1, KardexMovement::query()
            ->where('product_id', $product->getKey())
            ->where('movement_type', KardexMovementType::OutSale)
            ->count());
    }

    public function test_sale_returns_422_when_stock_is_insufficient(): void
    {
        Storage::fake('local');
        $product = $this->productByBarcode(DemoPortfolioSeeder::PRIMARY_PRODUCT_BARCODE);
        $this->stockOf($product)->update(['stock' => '1.0000']);

        $response = $this->postJson('/api/v1/pos/sales', [
            'document_type' => '03',
            'customer' => [
                'identity_document_type' => '1',
                'document_number' => '12345678',
                'legal_name' => 'JUAN CARLOS PEREZ',
            ],
            'items' => [
                ['product_uuid' => $product->uuid, 'quantity' => '5'],
            ],
            'payments' => [
                ['payment_method' => 'CASH', 'amount' => '37.50'],
            ],
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonPath('errors.0.code', 'insufficient_stock');

        $this->assertDatabaseCount('sales', 0);
        $this->assertSame('1.0000', (string) $this->stockOf($product)->stock);
    }

    public function test_invoice_returns_422_when_customer_lacks_valid_11_digit_ruc(): void
    {
        Storage::fake('local');
        $product = $this->productByBarcode(DemoPortfolioSeeder::PRIMARY_PRODUCT_BARCODE);
        $genericCustomer = Customer::query()
            ->where('identity_document_type', '0')
            ->where('document_number', '00000000')
            ->firstOrFail();

        $response = $this->postJson('/api/v1/pos/sales', [
            'document_type' => '01',
            'customer_uuid' => $genericCustomer->uuid,
            'items' => [
                ['product_uuid' => $product->uuid, 'quantity' => '1'],
            ],
            'payments' => [
                ['payment_method' => 'CASH', 'amount' => '7.50'],
            ],
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'La factura requiere un cliente identificado con RUC de 11 dígitos.');

        $this->assertDatabaseCount('sales', 0);
        $this->assertSame('120.0000', (string) $this->stockOf($product)->stock);
    }

    public function test_boleta_above_700_requires_identified_customer(): void
    {
        Storage::fake('local');
        $product = $this->productByBarcode(DemoPortfolioSeeder::PRIMARY_PRODUCT_BARCODE);
        $genericCustomer = Customer::query()
            ->where('identity_document_type', '0')
            ->where('document_number', '00000000')
            ->firstOrFail();

        $response = $this->postJson('/api/v1/pos/sales', [
            'document_type' => '03',
            'customer_uuid' => $genericCustomer->uuid,
            'items' => [
                ['product_uuid' => $product->uuid, 'quantity' => '94'],
            ],
            'payments' => [
                ['payment_method' => 'CASH', 'amount' => '705.00'],
            ],
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonPath(
                'message',
                'Las boletas superiores a S/ 700.00 requieren DNI o RUC del cliente.',
            );

        $this->assertDatabaseCount('sales', 0);
        $this->assertSame('120.0000', (string) $this->stockOf($product)->stock);
    }

    public function test_boleta_of_exactly_700_does_not_require_customer_identification(): void
    {
        Storage::fake('local');
        $product = $this->productByBarcode(DemoPortfolioSeeder::PRIMARY_PRODUCT_BARCODE);
        $this->stockOf($product)->update(['stock' => '2.0000']);
        $product->update(['sale_price' => '700.0000']);
        $genericCustomer = Customer::query()
            ->where('identity_document_type', '0')
            ->where('document_number', '00000000')
            ->firstOrFail();

        $response = $this->postJson('/api/v1/pos/sales', [
            'document_type' => '03',
            'customer_uuid' => $genericCustomer->uuid,
            'items' => [
                ['product_uuid' => $product->uuid, 'quantity' => '1'],
            ],
            'payments' => [
                ['payment_method' => 'CASH', 'amount' => '700.00'],
            ],
        ]);

        $response->assertCreated()->assertJsonPath('data.sale.totals.total', '700.00');
        $this->assertDatabaseHas('sales', [
            'total_amount' => '700.0000',
            'cash_register_session_id' => null,
        ]);
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
