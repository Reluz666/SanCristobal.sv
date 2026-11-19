<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql' || DB::getDriverName() === 'sqlite') {
            DB::statement("CREATE UNIQUE INDEX cash_register_sessions_one_open_per_user_unique ON cash_register_sessions (user_id) WHERE status = 'OPEN'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql' || DB::getDriverName() === 'sqlite') {
            DB::statement('DROP INDEX IF EXISTS cash_register_sessions_one_open_per_user_unique');
        }
    }
};
