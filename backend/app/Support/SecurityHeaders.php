<?php

declare(strict_types=1);

namespace App\Support;

use Symfony\Component\HttpFoundation\Response;

/**
 * Cabeceras de seguridad aplicadas tanto por middleware como por el
 * constructor de respuestas. Esto garantiza que incluso las respuestas de
 * error renderizadas fuera del pipeline conserven el blindaje HTTP.
 */
final class SecurityHeaders
{
    /**
     * @var array<string, string>
     */
    private const HEADERS = [
        'X-Content-Type-Options' => 'nosniff',
        'X-Frame-Options' => 'DENY',
        'Referrer-Policy' => 'no-referrer',
        'Strict-Transport-Security' => 'max-age=31536000; includeSubDomains',
        'Permissions-Policy' => 'camera=(), microphone=(), geolocation=()',
        'Content-Security-Policy' => "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        'Cache-Control' => 'no-store, private',
        'Pragma' => 'no-cache',
    ];

    public static function apply(Response $response): Response
    {
        foreach (self::HEADERS as $name => $value) {
            $response->headers->set($name, $value);
        }

        return $response;
    }
}
