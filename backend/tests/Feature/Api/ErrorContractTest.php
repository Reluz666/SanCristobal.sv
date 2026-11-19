<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

final class ErrorContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_not_found_responses_use_the_standard_envelope(): void
    {
        $response = $this->getJson('/api/v1/does-not-exist');

        $response
            ->assertNotFound()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertJsonPath('success', false)
            ->assertJsonPath('data', null)
            ->assertJsonStructure([
                'success',
                'message',
                'data',
                'errors',
                'meta' => ['timestamp', 'trace_id'],
            ]);

        $this->assertSame(
            $response->headers->get('X-Trace-Id'),
            $response->json('meta.trace_id'),
        );
    }

    public function test_validation_errors_use_the_standard_envelope(): void
    {
        Route::post('/api/v1/test-validation', function (Request $request): void {
            $request->validate([
                'email' => ['required', 'email'],
            ]);
        });

        $response = $this->postJson('/api/v1/test-validation', []);

        $response
            ->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Los datos enviados no son válidos.')
            ->assertJsonPath('errors.0.field', 'email');

        $this->assertIsArray($response->json('errors'));
        $this->assertIsArray($response->json('errors.0.messages'));
    }

    public function test_unauthenticated_requests_use_the_standard_envelope(): void
    {
        Route::get('/api/v1/test-protected', static fn (): array => ['ok' => true])
            ->middleware('auth:sanctum');

        $response = $this->getJson('/api/v1/test-protected');

        $response
            ->assertUnauthorized()
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'No autenticado.')
            ->assertHeader('X-Trace-Id');
    }

    public function test_login_rate_limiter_blocks_the_sixth_attempt(): void
    {
        Route::post('/api/v1/test-login', static fn (): array => ['ok' => true])
            ->middleware('throttle:login');

        foreach (range(1, 5) as $attempt) {
            $this->postJson('/api/v1/test-login', [
                'email' => 'admin@example.com',
            ])->assertOk();
        }

        $response = $this->postJson('/api/v1/test-login', [
            'email' => 'admin@example.com',
        ]);

        $response
            ->assertTooManyRequests()
            ->assertHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
            ->assertJsonPath('success', false)
            ->assertJsonPath('meta.trace_id', $response->headers->get('X-Trace-Id'));
    }

    public function test_unhandled_exceptions_use_the_standard_envelope(): void
    {
        Route::get('/api/v1/test-error', static function (): never {
            throw new \RuntimeException('Fallo controlado para la prueba.');
        });

        $response = $this->getJson('/api/v1/test-error');

        $response
            ->assertInternalServerError()
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Error interno del servidor.')
            ->assertJsonStructure([
                'success',
                'message',
                'data',
                'errors',
                'meta' => ['timestamp', 'trace_id'],
            ]);
    }
}
