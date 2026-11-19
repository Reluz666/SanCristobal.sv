<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Facturación electrónica SUNAT
|--------------------------------------------------------------------------
|
| SUNAT_MODE:
| - simulate: firma y genera XML, sin salir a la red (demo).
| - auto: intenta SUNAT y usa simulación local si no hay conexión.
| - live: exige una respuesta real de SUNAT.
|
| Las credenciales SOL de producción nunca se versionan: se configuran en
| cada despliegue o se cifran dentro de companies.settings.
|
*/

return [
    'mode' => env('SUNAT_MODE', 'simulate'),

    'environment' => env('SUNAT_ENVIRONMENT', 'beta'),

    'sol_ruc' => env('SUNAT_SOL_RUC', env('SUNAT_RUC', '20000000001')),

    'sol_user' => env('SUNAT_SOL_USER', 'MODDATOS'),

    'sol_password' => env('SUNAT_SOL_PASSWORD', 'moddatos'),

    'certificate_path' => env('SUNAT_CERTIFICATE_PATH', 'sunat/demo-cert.pem'),

    'certificate_password' => env('SUNAT_CERTIFICATE_PASSWORD'),

    'timeout' => (int) env('SUNAT_TIMEOUT', 8),
];
