<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class HealthEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_endpoint_uses_the_standard_envelope_and_security_headers(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'no-referrer')
            ->assertHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.api_version', 'v1')
            ->assertJsonStructure([
                'success',
                'message',
                'data',
                'errors',
                'meta' => ['timestamp', 'trace_id'],
            ]);

        $traceId = $response->headers->get('X-Trace-Id');

        $this->assertIsString($traceId);
        $this->assertNotSame('', $traceId);
        $this->assertSame($traceId, $response->json('meta.trace_id'));
    }
}
