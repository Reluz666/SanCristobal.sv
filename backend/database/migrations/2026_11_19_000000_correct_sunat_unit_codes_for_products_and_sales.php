<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Replace non-catalog demo unit codes with SUNAT Catalog No. 03 codes.
     * Existing sale items are snapshots, so update them along with products.
     */
    public function up(): void
    {
        DB::transaction(function (): void {
            $replacements = [
                'FAR' => ['code' => 'BE', 'name' => 'Fardo'],
                'BLS' => ['code' => 'BG', 'name' => 'Bolsa'],
            ];

            foreach ($replacements as $legacyCode => $canonicalUnit) {
                $now = now();
                $unit = DB::table('units')->where('code', $canonicalUnit['code']);

                if ($unit->exists()) {
                    $unit->update([
                        'name' => $canonicalUnit['name'],
                        'is_active' => true,
                        'updated_at' => $now,
                    ]);
                } else {
                    DB::table('units')->insert([
                        'code' => $canonicalUnit['code'],
                        'name' => $canonicalUnit['name'],
                        'is_active' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }

                DB::table('products')
                    ->where('unit_code', $legacyCode)
                    ->update([
                        'unit_code' => $canonicalUnit['code'],
                        'updated_at' => $now,
                    ]);

                DB::table('sale_items')
                    ->where('unit_code', $legacyCode)
                    ->update([
                        'unit_code' => $canonicalUnit['code'],
                        'updated_at' => $now,
                    ]);

                DB::table('units')->where('code', $legacyCode)->delete();
            }
        });
    }

    /**
     * The old codes were not valid for these commercial units. Reverting this
     * data correction could recreate invalid invoice XML, so it is intentional.
     */
    public function down(): void
    {
        // Intentionally irreversible data correction.
    }
};
