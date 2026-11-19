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
        Schema::create('sales', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();
            $table->foreignId('warehouse_id')
                ->constrained('warehouses')
                ->restrictOnDelete();
            $table->foreignId('cash_register_session_id')
                ->constrained('cash_register_sessions')
                ->restrictOnDelete();
            $table->foreignId('customer_id')
                ->constrained('customers')
                ->restrictOnDelete();
            $table->foreignId('user_id')
                ->constrained('users')
                ->restrictOnDelete();
            $table->char('document_type', 2);
            $table->char('series', 4);
            $table->unsignedBigInteger('correlative');
            $table->timestampTz('issue_date');
            $table->char('currency', 3)->default('PEN');
            $table->decimal('exchange_rate', 10, 4)->default(1.0000);
            $table->decimal('total_taxed', 12, 2)->default(0);
            $table->decimal('total_exonerated', 12, 2)->default(0);
            $table->decimal('total_unaffected', 12, 2)->default(0);
            $table->decimal('total_igv', 12, 2)->default(0);
            $table->decimal('total_discount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->string('sunat_status', 12)->default('INTERNAL');
            $table->string('sunat_hash', 64)->nullable();
            $table->string('sunat_xml_path', 255)->nullable();
            $table->string('sunat_cdr_path', 255)->nullable();
            $table->string('sunat_code', 10)->nullable();
            $table->string('sunat_description', 500)->nullable();
            $table->jsonb('sunat_response')->nullable();
            $table->timestampsTz();

            $table->unique(['company_id', 'document_type', 'series', 'correlative']);
            $table->index(['company_id', 'issue_date']);
            $table->index(['company_id', 'sunat_status']);
            $table->index(['company_id', 'customer_id']);
            $table->index(['company_id', 'user_id']);
            $table->index(['cash_register_session_id', 'issue_date']);
        });

        Schema::create('sale_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sale_id')
                ->constrained('sales')
                ->cascadeOnDelete();
            $table->foreignId('product_id')
                ->nullable()
                ->constrained('products')
                ->nullOnDelete();
            $table->string('description', 255);
            $table->char('unit_code', 3);
            $table->char('tax_affectation_type', 2);
            $table->decimal('quantity', 14, 4);
            $table->decimal('unit_value', 14, 4);
            $table->decimal('unit_price', 14, 4);
            $table->decimal('igv_percentage', 5, 2)->default(18.00);
            $table->decimal('total_igv', 12, 2)->default(0);
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->timestampsTz();

            $table->index(['sale_id']);
            $table->index(['product_id']);
        });

        Schema::create('sale_payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sale_id')
                ->constrained('sales')
                ->cascadeOnDelete();
            $table->string('payment_method', 10);
            $table->decimal('amount', 12, 2);
            $table->string('reference_number', 50)->nullable();
            $table->timestampsTz();

            $table->index(['sale_id']);
            $table->index(['payment_method']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE sales ADD CONSTRAINT sales_document_type_check CHECK (document_type IN ('00', '01', '03', '07', '08'))");
            DB::statement("ALTER TABLE sales ADD CONSTRAINT sales_series_check CHECK (series ~ '^[A-Z0-9]{4}$')");
            DB::statement('ALTER TABLE sales ADD CONSTRAINT sales_correlative_check CHECK (correlative > 0)');
            DB::statement("ALTER TABLE sales ADD CONSTRAINT sales_currency_check CHECK (currency IN ('PEN', 'USD'))");
            DB::statement('ALTER TABLE sales ADD CONSTRAINT sales_exchange_rate_check CHECK (exchange_rate > 0)');
            DB::statement('ALTER TABLE sales ADD CONSTRAINT sales_totals_check CHECK (total_taxed >= 0 AND total_exonerated >= 0 AND total_unaffected >= 0 AND total_igv >= 0 AND total_discount >= 0 AND total_amount >= 0)');
            DB::statement("ALTER TABLE sales ADD CONSTRAINT sales_sunat_status_check CHECK (sunat_status IN ('INTERNAL', 'PENDING', 'ACCEPTED', 'OBSERVED', 'REJECTED', 'ANNULLED'))");

            DB::statement("ALTER TABLE sale_items ADD CONSTRAINT sale_items_tax_affectation_check CHECK (tax_affectation_type IN ('10', '20', '30'))");
            DB::statement('ALTER TABLE sale_items ADD CONSTRAINT sale_items_quantity_check CHECK (quantity > 0)');
            DB::statement('ALTER TABLE sale_items ADD CONSTRAINT sale_items_unit_value_check CHECK (unit_value >= 0)');
            DB::statement('ALTER TABLE sale_items ADD CONSTRAINT sale_items_unit_price_check CHECK (unit_price >= 0)');
            DB::statement('ALTER TABLE sale_items ADD CONSTRAINT sale_items_igv_check CHECK (igv_percentage >= 0 AND igv_percentage <= 100)');

            DB::statement("ALTER TABLE sale_payments ADD CONSTRAINT sale_payments_method_check CHECK (payment_method IN ('CASH', 'YAPE', 'PLIN', 'CARD', 'TRANSFER'))");
            DB::statement('ALTER TABLE sale_payments ADD CONSTRAINT sale_payments_amount_check CHECK (amount > 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_payments');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
    }
};
