<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Enums\KardexMovementType;
use App\Enums\SunatStatus;
use App\Models\CashRegister;
use App\Models\Company;
use App\Models\Customer;
use App\Models\DocumentSeries;
use App\Models\KardexMovement;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\Sale;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\DemoPortfolioSeeder;
use DOMDocument;
use DOMXPath;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class PosSaleFlowTest extends TestCase
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

    public function test_cashier_emits_receipt_and_updates_stock_kardex_and_sunat(): void
    {
        Storage::fake('local');
        $this->travelTo('2026-10-21 10:00:00');
        $product = $this->productByBarcode(DemoPortfolioSeeder::PRIMARY_PRODUCT_BARCODE);
        $this->assertSame('120.0000', (string) $this->stockOf($product)->stock);

        $response = $this->postJson('/api/v1/pos/sales', [
            'document_type' => '03',
            'customer' => [
                'identity_document_type' => '1',
                'document_number' => '12345678',
                'legal_name' => 'JUAN CARLOS PEREZ GARCIA',
            ],
            'items' => [
                ['product_uuid' => $product->uuid, 'quantity' => '1'],
            ],
            'payments' => [
                ['payment_method' => 'CASH', 'amount' => '7.50'],
            ],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.sale.number', 'B001-00000001')
            ->assertJsonPath('data.sale.document_type', '03')
            ->assertJsonPath('data.sale.totals.taxed', '6.36')
            ->assertJsonPath('data.sale.totals.igv', '1.14')
            ->assertJsonPath('data.sale.totals.total', '7.50')
            ->assertJsonPath('data.sale.sunat.status', 'ACCEPTED')
            ->assertJsonPath('data.sale.sunat.code', '0')
            ->assertJsonMissingPath('data.sale.id')
            ->assertJsonMissingPath('data.sale.company_id')
            ->assertJsonPath('data.sale.customer.document_number', '12345678');

        $this->assertMatchesRegularExpression(
            sprintf(
                '/^%s\|03\|B001\|00000001\|1\.14\|7\.50\|2026-10-21\|1\|12345678\|[A-Za-z0-9+\/]{43}=\|$/',
                preg_quote(DemoPortfolioSeeder::COMPANY_RUC, '/'),
            ),
            (string) $response->json('data.ticket.sunat.qr_text'),
        );

        $sale = Sale::query()->where('series', 'B001')->firstOrFail();

        $this->assertSame(SunatStatus::Accepted, $sale->sunat_status);
        $this->assertSame(44, mb_strlen((string) $sale->sunat_hash));
        $this->assertNotNull($sale->sunat_xml_path);
        Storage::disk('local')->assertExists($sale->sunat_xml_path);

        $xml = Storage::disk('local')->get($sale->sunat_xml_path);
        $this->assertIsString($xml);
        $this->assertStringContainsString('B001-00000001', $xml);
        $this->assertStringContainsString('ds:Signature', $xml);
        $this->assertSame($sale->sunat_hash, $this->xmlDigest($xml));

        $this->assertNotNull($sale->sunat_cdr_path);
        $this->assertStringStartsWith('sunat/'.$this->company->uuid.'/', $sale->sunat_cdr_path);
        $this->assertStringNotContainsString('sunat/sunat/', $sale->sunat_cdr_path);
        Storage::disk('local')->assertExists($sale->sunat_cdr_path);

        $stock = $this->stockOf($product);
        $this->assertSame('119.0000', (string) $stock->stock);

        $movement = KardexMovement::query()
            ->where('product_id', $product->getKey())
            ->where('movement_type', KardexMovementType::OutSale)
            ->firstOrFail();

        $this->assertSame('B001-00000001', $movement->document_reference);
        $this->assertSame('1.0000', (string) $movement->quantity);
        $this->assertSame('119.0000', (string) $movement->balance_quantity);
        $this->assertSame('654.5000', (string) $movement->balance_total_cost);

        $this->assertDatabaseHas('document_series', [
            'company_id' => $this->company->getKey(),
            'series' => 'B001',
            'current_correlative' => 1,
        ]);

        $this->assertDatabaseHas('activity_log', [
            'company_id' => $this->company->getKey(),
            'subject_type' => Sale::class,
            'subject_id' => $sale->getKey(),
        ]);
    }

    public function test_cashier_can_list_active_warehouses_for_the_pos(): void
    {
        $secondWarehouse = Warehouse::factory()->forCompany($this->company)->create([
            'code' => 'ALM-02',
            'sunat_code' => '0002',
            'name' => 'Almacén Secundario',
        ]);

        $this->getJson('/api/v1/pos/warehouses')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonFragment(['uuid' => $secondWarehouse->uuid, 'name' => 'Almacén Secundario']);
    }

    public function test_sale_requires_warehouse_selection_when_multiple_are_active(): void
    {
        Warehouse::factory()->forCompany($this->company)->create([
            'code' => 'ALM-02',
            'sunat_code' => '0002',
            'name' => 'Almacén Secundario',
        ]);

        $product = $this->productByBarcode(DemoPortfolioSeeder::PRIMARY_PRODUCT_BARCODE);

        $this->getJson('/api/v1/pos/products')
            ->assertStatus(409)
            ->assertJsonPath('message', 'Selecciona el almacén para consultar existencias y vender.');

        $this->postJson('/api/v1/pos/sales', [
            'document_type' => '03',
            'items' => [['product_uuid' => $product->uuid, 'quantity' => '1']],
            'payments' => [['payment_method' => 'CASH', 'amount' => '7.50']],
        ])
            ->assertStatus(409)
            ->assertJsonPath('message', 'Selecciona el almacén desde el que se registrará la venta.');

        $this->assertDatabaseCount('sales', 0);
        $this->assertSame('120.0000', (string) $this->stockOf($product)->stock);
    }

    public function test_sale_uses_the_selected_warehouse_for_stock_series_and_ticket(): void
    {
        Storage::fake('local');

        $secondWarehouse = Warehouse::factory()->forCompany($this->company)->create([
            'code' => 'ALM-02',
            'sunat_code' => '0002',
            'name' => 'Almacén Secundario',
        ]);
        $product = $this->productByBarcode(DemoPortfolioSeeder::PRIMARY_PRODUCT_BARCODE);

        ProductWarehouse::query()->create([
            'company_id' => $this->company->getKey(),
            'product_id' => $product->getKey(),
            'warehouse_id' => $secondWarehouse->getKey(),
            'stock' => '5.0000',
        ]);
        DocumentSeries::query()->create([
            'company_id' => $this->company->getKey(),
            'warehouse_id' => $secondWarehouse->getKey(),
            'document_type' => '03',
            'series' => 'B002',
            'current_correlative' => 0,
            'is_active' => true,
        ]);

        $this->getJson('/api/v1/pos/products?warehouse_uuid='.$secondWarehouse->uuid)
            ->assertOk()
            ->assertJsonPath('meta.warehouse.uuid', $secondWarehouse->uuid);

        $this->postJson('/api/v1/pos/sales', [
            'document_type' => '03',
            'warehouse_uuid' => $secondWarehouse->uuid,
            'items' => [['product_uuid' => $product->uuid, 'quantity' => '1']],
            'payments' => [['payment_method' => 'CASH', 'amount' => '7.50']],
        ])
            ->assertCreated()
            ->assertJsonPath('data.sale.warehouse.uuid', $secondWarehouse->uuid)
            ->assertJsonPath('data.sale.number', 'B002-00000001');

        $this->assertSame('120.0000', (string) $this->stockOf($product)->stock);
        $this->assertSame('4.0000', (string) ProductWarehouse::query()
            ->where('product_id', $product->getKey())
            ->where('warehouse_id', $secondWarehouse->getKey())
            ->firstOrFail()
            ->stock);
    }

    public function test_sale_returns_422_when_stock_is_insufficient_and_rolls_back(): void
    {
        Storage::fake('local');
        $product = $this->productByBarcode(DemoPortfolioSeeder::PRIMARY_PRODUCT_BARCODE);
        $this->stockOf($product)->update(['stock' => '0.0000']);

        $response = $this->postJson('/api/v1/pos/sales', [
            'document_type' => '03',
            'customer' => [
                'identity_document_type' => '1',
                'document_number' => '12345678',
                'legal_name' => 'JUAN CARLOS PEREZ GARCIA',
            ],
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
            ->assertJsonPath('errors.0.code', 'insufficient_stock');

        $this->assertStringContainsString('Stock insuficiente', (string) $response->json('message'));
        $this->assertDatabaseCount('sales', 0);
        $this->assertDatabaseMissing('kardex_movements', ['movement_type' => 'OUT_SALE']);
        $this->assertSame('0.0000', (string) $this->stockOf($product)->stock);
        $this->assertDatabaseHas('document_series', [
            'company_id' => $this->company->getKey(),
            'series' => 'B001',
            'current_correlative' => 0,
        ]);
    }

    public function test_invoice_without_ruc_returns_422_and_does_not_change_stock(): void
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
        $this->assertDatabaseMissing('kardex_movements', ['movement_type' => 'OUT_SALE']);
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
            ->assertJsonPath(
                'message',
                'Las boletas superiores a S/ 700.00 requieren DNI o RUC del cliente.',
            );

        $this->assertDatabaseCount('sales', 0);
        $this->assertSame('120.0000', (string) $this->stockOf($product)->stock);
    }

    public function test_sale_is_created_without_a_cash_session(): void
    {
        Storage::fake('local');
        Sanctum::actingAs($this->cashier);

        $product = $this->productByBarcode(DemoPortfolioSeeder::PRIMARY_PRODUCT_BARCODE);

        $response = $this->postJson('/api/v1/pos/sales', [
            'document_type' => '03',
            'customer' => [
                'identity_document_type' => '1',
                'document_number' => '12345678',
                'legal_name' => 'JUAN CARLOS PEREZ GARCIA',
            ],
            'items' => [
                ['product_uuid' => $product->uuid, 'quantity' => '1'],
            ],
            'payments' => [
                ['payment_method' => 'CASH', 'amount' => '7.50'],
            ],
        ]);

        $response->assertCreated();

        $this->assertDatabaseHas('sales', ['cash_register_session_id' => null]);
    }

    public function test_sale_accepts_mixed_payments(): void
    {
        Storage::fake('local');
        $product = $this->productByBarcode(DemoPortfolioSeeder::PRIMARY_PRODUCT_BARCODE);

        $response = $this->postJson('/api/v1/pos/sales', [
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
                ['payment_method' => 'CASH', 'amount' => '5.00'],
                ['payment_method' => 'YAPE', 'amount' => '10.00', 'reference_number' => 'YAPE-000123'],
            ],
        ]);

        $response->assertCreated()->assertJsonPath('data.sale.totals.total', '15.00');
        $this->assertDatabaseCount('sale_payments', 2);
        $this->assertDatabaseHas('sale_payments', ['payment_method' => 'CASH', 'amount' => '5.00']);
        $this->assertDatabaseHas('sale_payments', ['payment_method' => 'YAPE', 'amount' => '10.00']);
    }

    public function test_payments_must_match_the_total_exactly(): void
    {
        Storage::fake('local');
        $product = $this->productByBarcode(DemoPortfolioSeeder::PRIMARY_PRODUCT_BARCODE);

        $response = $this->postJson('/api/v1/pos/sales', [
            'document_type' => '03',
            'customer' => [
                'identity_document_type' => '1',
                'document_number' => '12345678',
                'legal_name' => 'JUAN CARLOS PEREZ GARCIA',
            ],
            'items' => [
                ['product_uuid' => $product->uuid, 'quantity' => '1'],
            ],
            'payments' => [
                ['payment_method' => 'CASH', 'amount' => '20.00'],
            ],
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonPath(
                'message',
                'La suma de los pagos debe ser exactamente igual al total del comprobante.',
            );

        $this->assertDatabaseCount('sales', 0);
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

    private function xmlDigest(string $xml): ?string
    {
        $document = new DOMDocument;
        $document->loadXML($xml);

        $xpath = new DOMXPath($document);
        $xpath->registerNamespace('ds', 'http://www.w3.org/2000/09/xmldsig#');
        $nodes = $xpath->query('//ds:DigestValue');
        $node = $nodes === false ? null : $nodes->item(0);

        return $node?->nodeValue;
    }
}
