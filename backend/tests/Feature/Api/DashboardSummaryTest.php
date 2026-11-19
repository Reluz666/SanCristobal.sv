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
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class DashboardSummaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_summarizes_sales_and_stock_across_multiple_chunks(): void
    {
        $this->seed(DemoPortfolioSeeder::class);

        $company = Company::query()
            ->where('ruc', DemoPortfolioSeeder::COMPANY_RUC)
            ->firstOrFail();
        $settings = $company->settings;
        $settings['timezone'] = (string) config('app.timezone', 'UTC');
        $company->update(['settings' => $settings]);

        $admin = User::query()
            ->where('email', DemoPortfolioSeeder::ADMIN_EMAIL)
            ->firstOrFail();
        $warehouse = Warehouse::query()->where('is_active', true)->firstOrFail();
        Sanctum::actingAs($admin);

        $timezone = (string) config('app.timezone', 'UTC');
        $this->travelTo(Carbon::parse('2026-11-19 16:00:00', $timezone));
        $customerId = (int) DB::table('customers')->where('company_id', $company->getKey())->value('id');
        $this->insertSales($company, $warehouse, $admin, $customerId, $timezone);

        $before = $this->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->json('data');

        $this->assertSame(505, $before['sales']['count']);
        $this->assertSame('505.00', $before['sales']['total']);
        $this->assertSame('1.00', $before['sales']['average_ticket']);
        $this->assertSame(500, $before['hourly_sales'][2]['count']);
        $this->assertSame(5, $before['hourly_sales'][3]['count']);

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

        foreach ($products->chunk(100) as $productBatch) {
            ProductWarehouse::query()->insert($productBatch->map(static fn (Product $product): array => [
                'company_id' => $company->getKey(),
                'product_id' => $product->getKey(),
                'warehouse_id' => $warehouse->getKey(),
                'stock' => '4.0000',
                'created_at' => now(),
                'updated_at' => now(),
            ])->all());
        }

        $after = $this->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->json('data');

        $this->assertSame(505, $after['sales']['count']);
        $this->assertSame(505, $after['stock']['tracked_products_count'] - $before['stock']['tracked_products_count']);
        $this->assertSame(505, $after['stock']['low_stock_count'] - $before['stock']['low_stock_count']);
        $this->assertCount(4, $after['stock']['low_stock_products']);
    }

    private function insertSales(
        Company $company,
        Warehouse $warehouse,
        User $user,
        int $customerId,
        string $timezone,
    ): void {
        $sales = [];
        $createdAt = now();
        $businessDay = Carbon::parse('2026-11-19 00:00:00', $timezone);

        for ($index = 1; $index <= 506; $index++) {
            $annulled = $index === 506;
            $issueDate = $businessDay->copy()->setTime($index <= 500 || $annulled ? 9 : 14, 15);

            $sales[] = [
                'uuid' => (string) Str::uuid(),
                'company_id' => $company->getKey(),
                'warehouse_id' => $warehouse->getKey(),
                'cash_register_session_id' => null,
                'customer_id' => $customerId,
                'user_id' => $user->getKey(),
                'document_type' => '03',
                'series' => 'B001',
                'correlative' => $index,
                'issue_date' => $issueDate,
                'currency' => 'PEN',
                'exchange_rate' => '1.0000',
                'total_taxed' => $annulled ? '83.90' : '0.85',
                'total_exonerated' => '0.00',
                'total_unaffected' => '0.00',
                'total_igv' => $annulled ? '15.10' : '0.15',
                'total_discount' => '0.00',
                'total_amount' => $annulled ? '99.00' : '1.00',
                'sunat_status' => $annulled ? 'ANNULLED' : 'INTERNAL',
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ];

            if (count($sales) === 100) {
                DB::table('sales')->insert($sales);
                $sales = [];
            }
        }

        if ($sales !== []) {
            DB::table('sales')->insert($sales);
        }
    }
}
