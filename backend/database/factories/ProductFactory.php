<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Company;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'category_id' => null,
            'unit_code' => 'NIU',
            'sku' => strtoupper(fake()->unique()->bothify('SKU-#####')),
            'barcode' => fake()->unique()->numerify('77########'),
            'name' => fake()->unique()->words(3, true),
            'tax_affectation_type' => '10',
            'purchase_price' => '5.0000',
            'sale_price' => '11.8000',
            'min_stock' => '5.0000',
            'track_stock' => true,
            'is_active' => true,
        ];
    }

    public function forCompany(Company $company): static
    {
        return $this->state(fn (): array => [
            'company_id' => $company->getKey(),
        ]);
    }
}
