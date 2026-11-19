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
        Schema::table('sales', function (Blueprint $table): void {
            $table->foreignId('cash_register_session_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        if (DB::table('sales')->whereNull('cash_register_session_id')->exists()) {
            throw new RuntimeException(
                'No se puede revertir la migración: existen ventas directas sin sesión de caja.',
            );
        }

        Schema::table('sales', function (Blueprint $table): void {
            $table->foreignId('cash_register_session_id')->nullable(false)->change();
        });
    }
};
