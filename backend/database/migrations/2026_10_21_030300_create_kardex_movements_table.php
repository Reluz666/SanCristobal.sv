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
        Schema::create('kardex_movements', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();
            $table->foreignId('warehouse_id')
                ->constrained('warehouses')
                ->restrictOnDelete();
            $table->foreignId('product_id')
                ->constrained('products')
                ->restrictOnDelete();
            $table->foreignId('user_id')
                ->constrained('users')
                ->restrictOnDelete();
            $table->string('movement_type', 20);
            $table->char('document_type', 2)->nullable();
            $table->string('document_reference', 30)->nullable();
            $table->timestampTz('movement_date');
            $table->decimal('quantity', 14, 4);
            $table->decimal('unit_cost', 14, 4);
            $table->decimal('total_cost', 14, 4);
            $table->decimal('balance_quantity', 14, 4);
            $table->decimal('balance_unit_cost', 14, 4);
            $table->decimal('balance_total_cost', 14, 4);
            $table->nullableMorphs('reference');
            $table->string('notes', 500)->nullable();
            $table->timestampsTz();

            $table->index(['company_id', 'warehouse_id', 'product_id', 'movement_date'], 'kardex_company_stock_date_index');
            $table->index(['company_id', 'movement_date']);
            $table->index(['company_id', 'document_reference']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE kardex_movements ADD CONSTRAINT kardex_movement_type_check CHECK (movement_type IN ('IN_INITIAL', 'IN_PURCHASE', 'OUT_SALE', 'IN_RETURN', 'OUT_RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'))");
            DB::statement("ALTER TABLE kardex_movements ADD CONSTRAINT kardex_document_type_check CHECK (document_type IS NULL OR document_type IN ('00', '01', '03', '07', '08'))");
            DB::statement('ALTER TABLE kardex_movements ADD CONSTRAINT kardex_quantity_check CHECK (quantity >= 0)');
            DB::statement('ALTER TABLE kardex_movements ADD CONSTRAINT kardex_unit_cost_check CHECK (unit_cost >= 0)');
            DB::statement('ALTER TABLE kardex_movements ADD CONSTRAINT kardex_total_cost_check CHECK (total_cost >= 0)');
            DB::statement('ALTER TABLE kardex_movements ADD CONSTRAINT kardex_balance_quantity_check CHECK (balance_quantity >= 0)');
            DB::statement('ALTER TABLE kardex_movements ADD CONSTRAINT kardex_balance_unit_cost_check CHECK (balance_unit_cost >= 0)');
            DB::statement('ALTER TABLE kardex_movements ADD CONSTRAINT kardex_balance_total_cost_check CHECK (balance_total_cost >= 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('kardex_movements');
    }
};
