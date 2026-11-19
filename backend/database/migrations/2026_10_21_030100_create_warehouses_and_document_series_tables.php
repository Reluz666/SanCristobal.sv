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
        Schema::create('warehouses', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();
            $table->string('code', 20);
            $table->char('sunat_code', 4)->default('0000');
            $table->string('name', 120);
            $table->string('address', 255)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['company_id', 'code']);
            $table->unique(['company_id', 'sunat_code']);
            $table->index(['company_id', 'is_active']);
        });

        Schema::create('document_series', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();
            $table->foreignId('warehouse_id')
                ->constrained('warehouses')
                ->restrictOnDelete();
            $table->char('document_type', 2);
            $table->char('series', 4);
            $table->unsignedBigInteger('current_correlative')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            $table->unique(['company_id', 'series']);
            $table->index(['company_id', 'document_type', 'is_active']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE warehouses ADD CONSTRAINT warehouses_sunat_code_check CHECK (sunat_code ~ '^[0-9]{4}$')");
            DB::statement("ALTER TABLE document_series ADD CONSTRAINT document_series_document_type_check CHECK (document_type IN ('00', '01', '03', '07', '08'))");
            DB::statement("ALTER TABLE document_series ADD CONSTRAINT document_series_series_check CHECK (series ~ '^[A-Z0-9]{4}$')");
            DB::statement('ALTER TABLE document_series ADD CONSTRAINT document_series_correlative_check CHECK (current_correlative >= 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('document_series');
        Schema::dropIfExists('warehouses');
    }
};
