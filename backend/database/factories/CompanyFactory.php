<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Company>
 */
class CompanyFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $legalName = fake()->company().' S.A.C.';

        return [
            'ruc' => fake()->unique()->numerify('###########'),
            'legal_name' => $legalName,
            'trade_name' => fake()->company(),
            'email' => fake()->unique()->companyEmail(),
            'phone' => fake()->numerify('9########'),
            'address' => fake()->streetAddress(),
            'ubigeo' => fake()->numerify('######'),
            'settings' => [
                'branding' => [
                    'display_name' => $legalName,
                    'primary_color' => '#18181b',
                ],
                'sunat' => [
                    'environment' => 'beta',
                ],
            ],
            'is_active' => true,
            'onboarded_at' => now(),
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes): array => [
            'is_active' => false,
            'onboarded_at' => null,
        ]);
    }
}
