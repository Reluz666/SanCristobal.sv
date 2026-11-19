<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

final class HealthController extends Controller
{
    use ApiResponse;

    public function __invoke(): JsonResponse
    {
        return $this->successResponse(
            data: [
                'service' => config('app.name'),
                'api_version' => 'v1',
                'status' => 'available',
                'timestamp' => now()->utc()->toIso8601String(),
            ],
            message: 'Servicio disponible.',
        );
    }
}
