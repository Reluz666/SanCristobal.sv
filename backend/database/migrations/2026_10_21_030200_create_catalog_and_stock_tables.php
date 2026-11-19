<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('units', function (Blueprint $table): void {
            $table->id();
            $table->char('code', 3)->unique();
            $table->string('name', 80);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });

        Schema::create('categories', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('slug', 120);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            $table->unique(['company_id', 'slug']);
            $table->index(['company_id', 'is_active']);
        });

        Schema::create('products', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();
            $table->foreignId('category_id')
                ->nullable()
                ->constrained('categories')
                ->nullOnDelete();
            $table->char('unit_code', 3)->default('NIU');
            $table->string('sku', 50);
            $table->string('barcode', 50)->nullable();
            $table->string('name', 200);
            $table->char('tax_affectation_type', 2)->default('10');
            $table->decimal('purchase_price', 14, 4)->default(0);
            $table->decimal('sale_price', 14, 4)->default(0);
            $table->decimal('min_stock', 14, 4)->default(0);
            $table->boolean('track_stock')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->foreign('unit_code')
                ->references('code')
                ->on('units')
                ->restrictOnDelete();
            $table->unique(['company_id', 'sku']);
            $table->index(['company_id', 'barcode']);
            $table->index(['company_id', 'is_active']);
            $table->index(['company_id', 'category_id']);
        });

        Schema::create('product_warehouse', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();
            $table->foreignId('product_id')
                ->constrained('products')
                ->cascadeOnDelete();
            $table->foreignId('warehouse_id')
                ->constrained('warehouses')
                ->cascadeOnDelete();
            $table->decimal('stock', 14, 4)->default(0);
            $table->timestampsTz();

            $table->unique(['product_id', 'warehouse_id']);
            $table->index(['company_id', 'warehouse_id']);
        });

        if (DB::getDriverName() === 'pgsql' || DB::getDriverName() === 'sqlite') {
            DB::statement('CREATE UNIQUE INDEX products_company_barcode_unique ON products (company_id, barcode) WHERE barcode IS NOT NULL AND deleted_at IS NULL');
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE products ADD CONSTRAINT products_tax_affectation_check CHECK (tax_affectation_type IN ('10', '20', '30'))");
            DB::statement('ALTER TABLE products ADD CONSTRAINT products_purchase_price_check CHECK (purchase_price >= 0)');
            DB::statement('ALTER TABLE products ADD CONSTRAINT products_sale_price_check CHECK (sale_price >= 0)');
            DB::statement('ALTER TABLE products ADD CONSTRAINT products_min_stock_check CHECK (min_stock >= 0)');
            DB::statement('ALTER TABLE product_warehouse ADD CONSTRAINT product_warehouse_stock_check CHECK (stock >= 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('product_warehouse');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('units');
    }
};
