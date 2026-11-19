<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Company;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\DemoPortfolioSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class InventorySummaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_summary_includes_all_active_products_beyond_the_catalog_list_limit(): void
    {
        $this->seed(DemoPortfolioSeeder::class);

        $company = Company::query()
            ->where('ruc', DemoPortfolioSeeder::COMPANY_RUC)
            ->firstOrFail();
        $admin = User::query()
            ->where('email', DemoPortfolioSeeder::ADMIN_EMAIL)
            ->firstOrFail();
        $warehouse = Warehouse::query()->where('is_active', true)->orderBy('code')->firstOrFail();

        Sanctum::actingAs($admin);

        $before = $this->getJson('/api/v1/inventory/summary')
            ->assertOk()
            ->assertJsonPath('data.warehouse.uuid', $warehouse->uuid)
            ->json('data');

        $products = Product::factory()
            ->count(505)
            ->forCompany($company)
            ->state([
                'sale_price' => '2.0000',
                'min_stock' => '5.0000',
                'track_stock' => true,
                'is_active' => true,
            ])
            ->create();

        foreach ($products as $product) {
            ProductWarehouse::query()->create([
                'company_id' => $company->getKey(),
                'product_id' => $product->getKey(),
                'warehouse_id' => $warehouse->getKey(),
                'stock' => '4.0000',
            ]);
        }

        $after = $this->getJson('/api/v1/inventory/summary')
            ->assertOk()
            ->json('data');

        $this->assertSame(505, $after['active_products_count'] - $before['active_products_count']);
        $this->assertSame('2020.0000', bcsub($after['total_units'], $before['total_units'], 4));
        $this->assertSame('4040.00', bcsub($after['retail_value'], $before['retail_value'], 2));
        $this->assertSame(505, $after['low_stock_count'] - $before['low_stock_count']);
    }
}
