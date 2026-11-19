<?php

declare(strict_types=1);

use App\Exceptions\ApiException;
use App\Http\Middleware\EnsureTenantScope;
use App\Http\Middleware\ForceJsonResponse;
use App\Http\Middleware\SecurityHeadersMiddleware;
use App\Support\ApiEnvelope;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(SecurityHeadersMiddleware::class);
        $middleware->prepend(ForceJsonResponse::class);
        $middleware->alias([
            'tenant' => EnsureTenantScope::class,
        ]);
        $middleware->prependToPriorityList(
            before: SubstituteBindings::class,
            prepend: EnsureTenantScope::class,
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $isApiRequest = static fn (Request $request): bool => $request->is('api/*')
            || $request->expectsJson();

        $exceptions->shouldRenderJsonWhen(
            static fn (Request $request): bool => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->dontReport([
            AuthenticationException::class,
            AuthorizationException::class,
            ModelNotFoundException::class,
            NotFoundHttpException::class,
            ThrottleRequestsException::class,
            ValidationException::class,
        ]);

        $exceptions->render(static function (ApiException $exception, Request $request) use ($isApiRequest) {
            if (! $isApiRequest($request)) {
                return null;
            }

            $errors = $exception->errors();

            if ($errors === null) {
                $errors = [[
                    'code' => $exception->errorCode(),
                ]];
            }

            return ApiEnvelope::error(
                message: $exception->getMessage(),
                status: $exception->statusCode(),
                errors: $errors,
            );
        });

        $exceptions->render(static function (ValidationException $exception, Request $request) use ($isApiRequest) {
            if (! $isApiRequest($request)) {
                return null;
            }

            return ApiEnvelope::error(
                message: 'Los datos enviados no son válidos.',
                status: 422,
                errors: ApiEnvelope::validationErrors($exception->errors()),
            );
        });

        $exceptions->render(static function (AuthenticationException $exception, Request $request) use ($isApiRequest) {
            if (! $isApiRequest($request)) {
                return null;
            }

            return ApiEnvelope::error('No autenticado.', 401);
        });

        $exceptions->render(static function (AuthorizationException $exception, Request $request) use ($isApiRequest) {
            if (! $isApiRequest($request)) {
                return null;
            }

            $message = $exception->getMessage() !== ''
                ? $exception->getMessage()
                : 'No tiene autorización para realizar esta acción.';

            return ApiEnvelope::error($message, 403);
        });

        $exceptions->render(static function (ModelNotFoundException $exception, Request $request) use ($isApiRequest) {
            if (! $isApiRequest($request)) {
                return null;
            }

            return ApiEnvelope::error('El recurso solicitado no existe.', 404);
        });

        $exceptions->render(static function (NotFoundHttpException $exception, Request $request) use ($isApiRequest) {
            if (! $isApiRequest($request)) {
                return null;
            }

            return ApiEnvelope::error('La ruta solicitada no existe.', 404);
        });

        $exceptions->render(static function (ThrottleRequestsException $exception, Request $request) use ($isApiRequest) {
            if (! $isApiRequest($request)) {
                return null;
            }

            return ApiEnvelope::error(
                'Demasiadas solicitudes. Intente nuevamente en unos instantes.',
                429,
            )->withHeaders($exception->getHeaders());
        });

        $exceptions->render(static function (HttpExceptionInterface $exception, Request $request) use ($isApiRequest) {
            if (! $isApiRequest($request)) {
                return null;
            }

            $status = $exception->getStatusCode();
            $message = match ($status) {
                405 => 'Método HTTP no permitido.',
                413 => 'La solicitud excede el tamaño permitido.',
                415 => 'El tipo de contenido no es soportado.',
                default => $status >= 500
                    ? 'Error interno del servidor.'
                    : 'La solicitud no pudo ser procesada.',
            };

            return ApiEnvelope::error($message, $status);
        });

        $exceptions->render(static function (Throwable $exception, Request $request) use ($isApiRequest) {
            if (! $isApiRequest($request)) {
                return null;
            }

            $traceId = ApiEnvelope::traceId($request);

            Log::error('Excepción no controlada en la API.', [
                'trace_id' => $traceId,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
            ]);

            $errors = config('app.debug')
                ? [[
                    'code' => 'internal_error',
                    'detail' => $exception->getMessage(),
                ]]
                : null;

            return ApiEnvelope::error('Error interno del servidor.', 500, $errors);
        });
    })
    ->create();
