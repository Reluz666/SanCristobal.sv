<?php

declare(strict_types=1);

namespace App\Traits;

use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

/**
 * Configura la auditoría común de los modelos de negocio.
 *
 * La metadata de contexto (company_id, IP, user agent, trace_id) se completa
 * de forma centralizada en AppServiceProvider mediante el hook beforeLogging.
 */
trait AuditableModel
{
    use LogsActivity;

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->dontLogEmptyChanges()
            ->logExcept([
                'password',
                'remember_token',
                'two_factor_secret',
                'two_factor_recovery_codes',
            ])
            ->useLogName($this->getTable());
    }
}
