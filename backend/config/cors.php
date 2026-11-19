<?php

declare(strict_types=1);

$allowedOrigins = array_values(array_filter(
    array_map(
        'trim',
        explode(',', (string) env(
            'CORS_ALLOWED_ORIGINS',
            env('FRONTEND_URL', 'http://localhost:5173,http://127.0.0.1:5173'),
        )),
    ),
    static fn (string $origin): bool => $origin !== '',
));

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => $allowedOrigins,
    'allowed_origins_patterns' => [],
    'allowed_headers' => [
        'Accept',
        'Authorization',
        'Content-Type',
        'Idempotency-Key',
        'Origin',
        'X-Idempotency-Key',
        'X-Request-Id',
        'X-Requested-With',
        'X-XSRF-TOKEN',
    ],
    'exposed_headers' => ['X-Trace-Id'],
    'max_age' => 3600,
    'supports_credentials' => false,
];
