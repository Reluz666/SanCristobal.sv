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
        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('email', 254);
            $table->timestampTz('email_verified_at')->nullable();
            $table->string('password');
            $table->string('document_type', 2)->nullable();
            $table->string('document_number', 15)->nullable();
            $table->string('phone', 20)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampTz('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique(['company_id', 'email']);
            $table->unique(['company_id', 'document_type', 'document_number']);
            $table->index(['company_id', 'is_active']);
        });

        Schema::create('password_reset_tokens', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();
            $table->string('email', 254);
            $table->string('token');
            $table->timestampTz('created_at')->nullable();

            $table->unique(['company_id', 'email']);
        });

        Schema::create('sessions', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->foreignId('company_id')
                ->nullable()
                ->constrained('companies')
                ->nullOnDelete();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_document_type_check CHECK (document_type IS NULL OR document_type IN ('1', '4', '6', '7', 'A'))");
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_document_number_check CHECK (document_number IS NULL OR document_number ~ '^[0-9A-Za-z]{1,15}$')");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
