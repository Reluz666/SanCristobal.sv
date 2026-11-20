<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\DocumentType;
use App\Enums\IdentityDocumentType;
use App\Enums\KardexMovementType;
use App\Enums\TaxAffectationType;
use App\Models\CashRegister;
use App\Models\Category;
use App\Models\Company;
use App\Models\Customer;
use App\Models\DocumentSeries;
use App\Models\KardexMovement;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\TenantContext;
use App\Support\PermissionCatalog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use RuntimeException;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

final class DemoPortfolioSeeder extends Seeder
{
    public const COMPANY_RUC = '20607442381';

    public const ADMIN_EMAIL = 'admin@ventaspos.pe';

    public const CASHIER_EMAIL = 'cajero@ventaspos.pe';

    public const LOCAL_PASSWORD = 'Password123!';

    public const CASH_REGISTER_NAME = 'Caja Principal Pakamuros';

    public const PRIMARY_PRODUCT_BARCODE = '7751000000010';

    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            throw new RuntimeException(
                'DemoPortfolioSeeder solo se puede ejecutar en entornos local o testing.',
            );
        }

        DB::transaction(function (): void {
            $company = $this->seedCompany();
            $this->seedDemoCertificate($company);
            app(TenantContext::class)->set($company);
            setPermissionsTeamId($company->getKey());

            $this->seedRoles();
            $users = $this->seedUsers($company);
            $warehouse = $this->seedWarehouse($company);
            $this->seedDocumentSeries($company, $warehouse);
            $this->seedUnits();
            $categories = $this->seedCategories($company);
            $this->seedProducts($company, $warehouse, $categories, $users['admin']);
            $this->seedGenericCustomer($company);
            $this->seedCashRegister($company, $warehouse);

            app(PermissionRegistrar::class)->forgetCachedPermissions();
        });
    }

    private function seedCompany(): Company
    {
        return Company::query()->updateOrCreate(
            ['ruc' => self::COMPANY_RUC],
            [
                'legal_name' => 'SAN CRISTOBAL-PAKAMUROS E.I.R.L.',
                'trade_name' => 'SAN CRISTOBAL PAKAMUROS',
                'email' => 'sancristobalpakamuroseirl@gmail.com',
                'phone' => '980 875 104',
                'address' => 'Calle Pakamuros Mz. Q Lt. 15 - P.J. Santo Toribio de Mogrovejo, José Leonardo Ortiz, Chiclayo',
                'ubigeo' => '140105',
                'settings' => [
                    'branding' => [
                        'display_name' => 'SAN CRISTOBAL PAKAMUROS',
                        'primary_color' => '#03B7A3',
                        'logo_url' => '/logo.png',
                    ],
                    'payments' => [
                        'yape_phone' => null,
                        'plin_phone' => null,
                    ],
                    'currency' => 'PEN',
                    'igv_percentage' => '18.00',
                    'timezone' => 'America/Lima',
                    'features' => [
                        'cash_sessions_enabled' => false,
                    ],
                    'sunat' => [
                        'environment' => 'beta',
                    ],
                ],
                'is_active' => true,
                'onboarded_at' => now(),
            ],
        );
    }

    /**
     * Certificado autofirmado para firmar el XML en modo simulación.
     */
    private function seedDemoCertificate(Company $company): void
    {
        $path = storage_path('app/sunat/demo-cert.pem');

        if (is_file($path)) {
            $existingPem = File::get($path);
            $certificateEnd = strpos($existingPem, '-----END CERTIFICATE-----');
            $certificatePem = $certificateEnd === false
                ? ''
                : substr($existingPem, 0, $certificateEnd + strlen('-----END CERTIFICATE-----'));
            $existingCertificate = $certificatePem !== ''
                ? @openssl_x509_read($certificatePem)
                : false;
            $certificateDetails = $existingCertificate !== false
                ? openssl_x509_parse($existingCertificate)
                : false;

            if (
                is_array($certificateDetails)
                && ($certificateDetails['subject']['O'] ?? null) === $company->legal_name
            ) {
                return;
            }
        }

        $privateKey = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);

        if ($privateKey === false) {
            throw new RuntimeException('No se pudo generar la clave del certificado de demostración.');
        }

        $subject = [
            'countryName' => 'PE',
            'stateOrProvinceName' => 'Lambayeque',
            'organizationName' => (string) $company->legal_name,
            'commonName' => (string) $company->legal_name,
        ];

        $csr = openssl_csr_new($subject, $privateKey, ['digest_alg' => 'sha256']);
        $certificate = $csr === false || $csr === true
            ? false
            : openssl_csr_sign($csr, null, $privateKey, 3650, ['digest_alg' => 'sha256']);

        if (
            $certificate === false
            || ! openssl_x509_export($certificate, $certificatePem)
            || ! openssl_pkey_export($privateKey, $privateKeyPem)
        ) {
            throw new RuntimeException('No se pudo generar el certificado de demostración.');
        }

        File::ensureDirectoryExists(dirname($path));
        File::put($path, $certificatePem.$privateKeyPem);
        chmod($path, 0600);
    }

    private function seedRoles(): void
    {
        foreach (PermissionCatalog::all() as $permissionName) {
            Permission::findOrCreate($permissionName, 'web');
        }

        foreach (PermissionCatalog::roles() as $roleName => $permissions) {
            $role = Role::findOrCreate($roleName, 'web');
            $role->syncPermissions($permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /**
     * @return array{admin: User, cashier: User}
     */
    private function seedUsers(Company $company): array
    {
        $admin = User::query()
            ->withoutGlobalScope('company')
            ->updateOrCreate(
                ['company_id' => $company->getKey(), 'email' => self::ADMIN_EMAIL],
                [
                    'name' => 'Administrador General',
                    'password' => self::LOCAL_PASSWORD,
                    'document_type' => IdentityDocumentType::Dni,
                    'document_number' => '12345678',
                    'phone' => '980875104',
                    'is_active' => true,
                    'email_verified_at' => now(),
                ],
            );

        $cashier = User::query()
            ->withoutGlobalScope('company')
            ->updateOrCreate(
                ['company_id' => $company->getKey(), 'email' => self::CASHIER_EMAIL],
                [
                    'name' => 'Cajero Turno Principal',
                    'password' => self::LOCAL_PASSWORD,
                    'document_type' => IdentityDocumentType::Dni,
                    'document_number' => '87654321',
                    'phone' => '980875104',
                    'is_active' => true,
                    'email_verified_at' => now(),
                ],
            );

        $admin->syncRoles(['admin']);
        $cashier->syncRoles(['cashier']);

        return ['admin' => $admin, 'cashier' => $cashier];
    }

    private function seedWarehouse(Company $company): Warehouse
    {
        return Warehouse::query()->updateOrCreate(
            ['company_id' => $company->getKey(), 'code' => 'ALM-01'],
            [
                'sunat_code' => '0000',
                'name' => 'Almacén Principal Pakamuros',
                'address' => 'Calle Pakamuros Mz. Q Lt. 15 - P.J. Santo Toribio de Mogrovejo, José Leonardo Ortiz',
                'is_active' => true,
            ],
        );
    }

    private function seedDocumentSeries(Company $company, Warehouse $warehouse): void
    {
        $series = [
            ['document_type' => DocumentType::InternalSaleNote, 'series' => 'NV01'],
            ['document_type' => DocumentType::Receipt, 'series' => 'B001'],
            ['document_type' => DocumentType::Invoice, 'series' => 'F001'],
            ['document_type' => DocumentType::CreditNote, 'series' => 'FC01'],
            ['document_type' => DocumentType::CreditNote, 'series' => 'BC01'],
        ];

        foreach ($series as $item) {
            DocumentSeries::query()->updateOrCreate(
                ['company_id' => $company->getKey(), 'series' => $item['series']],
                [
                    'warehouse_id' => $warehouse->getKey(),
                    'document_type' => $item['document_type'],
                    'is_active' => true,
                ],
            );
        }
    }

    private function seedUnits(): void
    {
        $units = [
            ['code' => 'NIU', 'name' => 'Unidad / Paquete'],
            ['code' => 'BE', 'name' => 'Fardo'],
            ['code' => 'BX', 'name' => 'Caja'],
            ['code' => 'BG', 'name' => 'Bolsa'],
            ['code' => 'ZZ', 'name' => 'Servicio'],
            ['code' => 'KGM', 'name' => 'Kilogramo'],
            ['code' => 'LTR', 'name' => 'Litro'],
        ];

        foreach ($units as $unit) {
            Unit::query()->updateOrCreate(
                ['code' => $unit['code']],
                ['name' => $unit['name'], 'is_active' => true],
            );
        }
    }

    /**
     * @return array<string, Category>
     */
    private function seedCategories(Company $company): array
    {
        $definitions = [
            'papel-higienico' => 'Papel Higiénico',
            'servilletas' => 'Servilletas',
            'agua' => 'Agua de Mesa',
            'hielo' => 'Hielo',
        ];

        $categories = [];

        foreach ($definitions as $slug => $name) {
            $categories[$slug] = Category::query()->updateOrCreate(
                ['company_id' => $company->getKey(), 'slug' => $slug],
                ['name' => $name, 'is_active' => true],
            );
        }

        return $categories;
    }

    /**
     * @param  array<string, Category>  $categories
     */
    private function seedProducts(
        Company $company,
        Warehouse $warehouse,
        array $categories,
        User $admin,
    ): void {
        $products = [
            // --- Papel Higiénico: Golden Roll (Gofredo y precorte) ---
            [
                'sku' => 'PAP-GOLDEN-PQ6',
                'barcode' => self::PRIMARY_PRODUCT_BARCODE,
                'name' => 'Papel Higiénico Golden Roll Doble Hoja (Pqte x6 rollos)',
                'category' => 'papel-higienico',
                'unit_code' => 'NIU',
                'purchase_price' => '5.5000',
                'sale_price' => '7.5000',
                'min_stock' => '10.0000',
                'stock' => '120.0000',
            ],
            [
                'sku' => 'PAP-GOLDEN-FAR',
                'barcode' => '7751000000027',
                'name' => 'Papel Higiénico Golden Roll Doble Hoja (Fardo x40 rollos)',
                'category' => 'papel-higienico',
                'unit_code' => 'BE',
                'purchase_price' => '34.0000',
                'sale_price' => '42.0000',
                'min_stock' => '5.0000',
                'stock' => '50.0000',
            ],

            // --- Papel Higiénico: Cielo Soft (Encapsula olores) ---
            [
                'sku' => 'PAP-CIELO-PQ6',
                'barcode' => '7751000000034',
                'name' => 'Papel Higiénico Cielo Soft Doble Hoja (Pqte x6 rollos)',
                'category' => 'papel-higienico',
                'unit_code' => 'NIU',
                'purchase_price' => '5.0000',
                'sale_price' => '7.0000',
                'min_stock' => '10.0000',
                'stock' => '100.0000',
            ],
            [
                'sku' => 'PAP-CIELO-FAR',
                'barcode' => '7751000000041',
                'name' => 'Papel Higiénico Cielo Soft Doble Hoja (Fardo x40 rollos)',
                'category' => 'papel-higienico',
                'unit_code' => 'BE',
                'purchase_price' => '31.0000',
                'sale_price' => '39.0000',
                'min_stock' => '5.0000',
                'stock' => '45.0000',
            ],

            // --- Servilletas: Ecopel Negro y Dorado 33x33 cm ---
            [
                'sku' => 'SRV-ECOPEL-ND-100',
                'barcode' => '7751000000058',
                'name' => 'Servilletas Ecopel Negro y Dorado 33x33 cm (Pqte x100)',
                'category' => 'servilletas',
                'unit_code' => 'NIU',
                'purchase_price' => '3.2000',
                'sale_price' => '4.5000',
                'min_stock' => '12.0000',
                'stock' => '90.0000',
            ],
            [
                'sku' => 'SRV-ECOPEL-ND-FAR',
                'barcode' => '7751000000065',
                'name' => 'Servilletas Ecopel Negro y Dorado 33x33 cm (Caja x24 pqtes)',
                'category' => 'servilletas',
                'unit_code' => 'BX',
                'purchase_price' => '68.0000',
                'sale_price' => '85.0000',
                'min_stock' => '4.0000',
                'stock' => '30.0000',
            ],

            // --- Servilletas: Ecopel Cuadraditas Verde 14x13.5 cm ---
            [
                'sku' => 'SRV-ECOPEL-VRD-PQ',
                'barcode' => '7751000000072',
                'name' => 'Servilletas Ecopel Cuadraditas Verde 14x13.5 cm (Paquete)',
                'category' => 'servilletas',
                'unit_code' => 'NIU',
                'purchase_price' => '2.0000',
                'sale_price' => '3.0000',
                'min_stock' => '15.0000',
                'stock' => '150.0000',
            ],
            [
                'sku' => 'SRV-ECOPEL-VRD-FAR',
                'barcode' => '7751000000089',
                'name' => 'Servilletas Ecopel Cuadraditas Verde 14x13.5 cm (Fardo x30 pqtes)',
                'category' => 'servilletas',
                'unit_code' => 'BE',
                'purchase_price' => '52.0000',
                'sale_price' => '66.0000',
                'min_stock' => '5.0000',
                'stock' => '40.0000',
            ],

            // --- Agua de Mesa ---
            [
                'sku' => 'AGU-BIDON-20L',
                'barcode' => '7751000000096',
                'name' => 'Bidón de Agua de Mesa 20 Litros (Completo con envase)',
                'category' => 'agua',
                'unit_code' => 'NIU',
                'purchase_price' => '20.0000',
                'sale_price' => '28.0000',
                'min_stock' => '10.0000',
                'stock' => '60.0000',
            ],
            [
                'sku' => 'AGU-RECARGA-20L',
                'barcode' => '7751000000102',
                'name' => 'Recarga de Agua de Mesa 20 Litros',
                'category' => 'agua',
                'unit_code' => 'NIU',
                'purchase_price' => '5.0000',
                'sale_price' => '8.0000',
                'min_stock' => '15.0000',
                'stock' => '100.0000',
            ],

            // --- Hielo ---
            [
                'sku' => 'HIE-BOLSA-5KG',
                'barcode' => '7751000000119',
                'name' => 'Hielo en Cubos Bolsa 5 kg',
                'category' => 'hielo',
                'unit_code' => 'BG',
                'purchase_price' => '4.5000',
                'sale_price' => '7.0000',
                'min_stock' => '10.0000',
                'stock' => '80.0000',
            ],
            [
                'sku' => 'HIE-BOLSA-3KG',
                'barcode' => '7751000000126',
                'name' => 'Hielo en Cubos Bolsa 3 kg',
                'category' => 'hielo',
                'unit_code' => 'BG',
                'purchase_price' => '3.0000',
                'sale_price' => '5.0000',
                'min_stock' => '10.0000',
                'stock' => '60.0000',
            ],
        ];

        foreach ($products as $definition) {
            $product = Product::query()->updateOrCreate(
                ['company_id' => $company->getKey(), 'sku' => $definition['sku']],
                [
                    'category_id' => $categories[$definition['category']]->getKey(),
                    'unit_code' => $definition['unit_code'] ?? 'NIU',
                    'barcode' => $definition['barcode'],
                    'name' => $definition['name'],
                    'tax_affectation_type' => TaxAffectationType::Gravado,
                    'purchase_price' => $definition['purchase_price'],
                    'sale_price' => $definition['sale_price'],
                    'min_stock' => $definition['min_stock'],
                    'track_stock' => true,
                    'is_active' => true,
                ],
            );

            $this->seedInitialStock($company, $warehouse, $product, $definition, $admin);
        }
    }

    /**
     * @param  array<string, string>  $definition
     */
    private function seedInitialStock(
        Company $company,
        Warehouse $warehouse,
        Product $product,
        array $definition,
        User $admin,
    ): void {
        $initialMovementExists = KardexMovement::query()
            ->where('product_id', $product->getKey())
            ->where('warehouse_id', $warehouse->getKey())
            ->where('movement_type', KardexMovementType::InInitial)
            ->exists();

        $stockRow = ProductWarehouse::query()->firstOrNew([
            'product_id' => $product->getKey(),
            'warehouse_id' => $warehouse->getKey(),
        ]);

        if ($initialMovementExists) {
            $stockRow->save();

            return;
        }

        $quantity = $definition['stock'];
        $unitCost = $definition['purchase_price'];
        $totalCost = bcmul($quantity, $unitCost, 4);

        $stockRow->fill([
            'company_id' => $company->getKey(),
            'stock' => $quantity,
        ])->save();

        KardexMovement::query()->create([
            'company_id' => $company->getKey(),
            'warehouse_id' => $warehouse->getKey(),
            'product_id' => $product->getKey(),
            'user_id' => $admin->getKey(),
            'movement_type' => KardexMovementType::InInitial,
            'document_type' => null,
            'document_reference' => 'INICIAL-'.$product->sku,
            'movement_date' => now()->subDays(7),
            'quantity' => $quantity,
            'unit_cost' => $unitCost,
            'total_cost' => $totalCost,
            'balance_quantity' => $quantity,
            'balance_unit_cost' => $unitCost,
            'balance_total_cost' => $totalCost,
            'notes' => 'Carga inicial de inventario',
        ]);
    }

    private function seedGenericCustomer(Company $company): void
    {
        Customer::query()->updateOrCreate(
            [
                'company_id' => $company->getKey(),
                'identity_document_type' => IdentityDocumentType::None,
                'document_number' => '00000000',
            ],
            [
                'legal_name' => 'CLIENTES VARIOS',
                'address' => null,
                'ubigeo' => null,
                'email' => null,
                'phone' => null,
                'is_active' => true,
            ],
        );
    }

    private function seedCashRegister(Company $company, Warehouse $warehouse): void
    {
        CashRegister::query()->updateOrCreate(
            ['company_id' => $company->getKey(), 'name' => self::CASH_REGISTER_NAME],
            [
                'warehouse_id' => $warehouse->getKey(),
                'is_active' => true,
            ],
        );
    }
}
