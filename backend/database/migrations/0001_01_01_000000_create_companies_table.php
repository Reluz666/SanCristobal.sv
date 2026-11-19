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
        Schema::create('companies', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('ruc', 11)->unique();
            $table->string('legal_name', 200);
            $table->string('trade_name', 200)->nullable();
            $table->string('email', 254)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('address', 255)->nullable();
            $table->char('ubigeo', 6)->nullable();
            $table->jsonb('settings')->default('{}');
            $table->boolean('is_active')->default(true)->index();
            $table->timestampTz('onboarded_at')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE companies ADD CONSTRAINT companies_ruc_format_check CHECK (ruc ~ '^[0-9]{11}$')");
            DB::statement("ALTER TABLE companies ADD CONSTRAINT companies_ubigeo_format_check CHECK (ubigeo IS NULL OR ubigeo ~ '^[0-9]{6}$')");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
