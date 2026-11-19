<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Construye el contrato JSON único de la API.
 *
 * @phpstan-type ApiMeta array<string, mixed>
 */
final class ApiEnvelope
{
    /**
     * @param  array<string, mixed>  $meta
     */
    public static function success(
        mixed $data = null,
        string $message = 'OK',
        int $status = 200,
        array $meta = [],
    ): JsonResponse {
        return self::make(
            success: true,
            message: $message,
            data: $data,
            errors: null,
            status: $status,
            meta: $meta,
        );
    }

    /**
     * @param  array<string, mixed>|null  $errors
     * @param  array<string, mixed>  $meta
     */
    public static function error(
        string $message,
        int $status = 400,
        ?array $errors = null,
        array $meta = [],
    ): JsonResponse {
        return self::make(
            success: false,
            message: $message,
            data: null,
            errors: $errors,
            status: $status,
            meta: $meta,
        );
    }

    /**
     * @param  array<string, mixed>|null  $errors
     * @param  array<string, mixed>  $meta
     */
    private static function make(
        bool $success,
        string $message,
        mixed $data,
        ?array $errors,
        int $status,
        array $meta,
    ): JsonResponse {
        $traceId = self::traceId();

        $payload = [
            'success' => $success,
            'message' => $message,
            'data' => $data,
            'errors' => $errors,
            'meta' => [
                ...$meta,
                'timestamp' => now()->utc()->toIso8601String(),
                'trace_id' => $traceId,
            ],
        ];

        $response = response()
            ->json($payload, $status, [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ->header('X-Trace-Id', $traceId);

        return SecurityHeaders::apply($response);
    }

    /**
     * Convierte los errores de validación de Laravel en una lista estable para
     * el contrato de la API, sin perder el campo ni sus mensajes.
     *
     * @param  array<string, array<int, string>>  $errors
     * @return list<array{field: string, messages: list<string>}>
     */
    public static function validationErrors(array $errors): array
    {
        $normalized = [];

        foreach ($errors as $field => $messages) {
            $normalized[] = [
                'field' => (string) $field,
                'messages' => array_values(array_map(
                    static fn (mixed $message): string => (string) $message,
                    (array) $messages,
                )),
            ];
        }

        return $normalized;
    }

    public static function traceId(?Request $request = null): string
    {
        if ($request === null && app()->bound('request')) {
            $request = request();
        }

        $traceId = $request?->attributes->get('trace_id');

        return is_string($traceId) && $traceId !== ''
            ? $traceId
            : (string) Str::uuid();
    }
}
