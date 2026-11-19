<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fuerza respuestas JSON en la API y propaga un trace_id generado en servidor
 * a todos los logs y respuestas. Nunca confia en un trace_id enviado por el
 * cliente para evitar inyección de correlación.
 */
final class ForceJsonResponse
{
    public function handle(Request $request, Closure $next): Response
    {
        $traceId = (string) Str::uuid();
        $request->attributes->set('trace_id', $traceId);

        if ($request->is('api/*')) {
            $request->headers->set('Accept', 'application/json');
        }

        $response = $next($request);

        $response->headers->set('X-Trace-Id', $traceId);

        return $response;
    }
}
