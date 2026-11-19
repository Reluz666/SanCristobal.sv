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
        Schema::create('customers', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();
            $table->char('identity_document_type', 1)->default('0');
            $table->string('document_number', 15);
            $table->string('legal_name', 200);
            $table->string('address', 255)->nullable();
            $table->char('ubigeo', 6)->nullable();
            $table->string('email', 254)->nullable();
            $table->string('phone', 20)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['company_id', 'identity_document_type', 'document_number']);
            $table->index(['company_id', 'document_number']);
            $table->index(['company_id', 'legal_name']);
        });

        Schema::create('cash_registers', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();
            $table->foreignId('warehouse_id')
                ->constrained('warehouses')
                ->restrictOnDelete();
            $table->string('name', 80);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['company_id', 'name']);
            $table->index(['company_id', 'warehouse_id', 'is_active']);
        });

        Schema::create('cash_register_sessions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();
            $table->foreignId('cash_register_id')
                ->constrained('cash_registers')
                ->restrictOnDelete();
            $table->foreignId('user_id')
                ->constrained('users')
                ->restrictOnDelete();
            $table->timestampTz('opened_at');
            $table->timestampTz('closed_at')->nullable();
            $table->decimal('opening_balance', 12, 2);
            $table->decimal('expected_closing_balance', 12, 2)->nullable();
            $table->decimal('actual_closing_balance', 12, 2)->nullable();
            $table->decimal('difference', 12, 2)->nullable();
            $table->string('status', 10)->default('OPEN');
            $table->text('notes')->nullable();
            $table->timestampsTz();

            $table->index(['company_id', 'status']);
            $table->index(['cash_register_id', 'status']);
            $table->index(['company_id', 'opened_at']);
        });

        if (DB::getDriverName() === 'pgsql' || DB::getDriverName() === 'sqlite') {
            DB::statement("CREATE UNIQUE INDEX cash_register_sessions_one_open_unique ON cash_register_sessions (cash_register_id) WHERE status = 'OPEN'");
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE customers ADD CONSTRAINT customers_identity_document_check CHECK (identity_document_type IN ('0', '1', '4', '6', '7'))");
            DB::statement("ALTER TABLE customers ADD CONSTRAINT customers_document_number_check CHECK (document_number ~ '^[0-9A-Za-z]{1,15}$')");
            DB::statement("ALTER TABLE customers ADD CONSTRAINT customers_ubigeo_check CHECK (ubigeo IS NULL OR ubigeo ~ '^[0-9]{6}$')");
            DB::statement("ALTER TABLE cash_register_sessions ADD CONSTRAINT cash_sessions_status_check CHECK (status IN ('OPEN', 'CLOSED'))");
            DB::statement('ALTER TABLE cash_register_sessions ADD CONSTRAINT cash_sessions_opening_balance_check CHECK (opening_balance >= 0)');
            DB::statement('ALTER TABLE cash_register_sessions ADD CONSTRAINT cash_sessions_actual_balance_check CHECK (actual_closing_balance IS NULL OR actual_closing_balance >= 0)');
            DB::statement('ALTER TABLE cash_register_sessions ADD CONSTRAINT cash_sessions_dates_check CHECK (closed_at IS NULL OR closed_at >= opened_at)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_register_sessions');
        Schema::dropIfExists('cash_registers');
        Schema::dropIfExists('customers');
    }
};
