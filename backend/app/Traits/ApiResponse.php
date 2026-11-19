<?php

declare(strict_types=1);

namespace App\Traits;

use App\Support\ApiEnvelope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Pagination\LengthAwarePaginator;

trait ApiResponse
{
    /**
     * @param  array<string, mixed>  $meta
     */
    protected function successResponse(
        mixed $data = null,
        string $message = 'OK',
        int $status = 200,
        array $meta = [],
    ): JsonResponse {
        return ApiEnvelope::success($data, $message, $status, $meta);
    }

    /**
     * @param  array<string, mixed>|null  $errors
     * @param  array<string, mixed>  $meta
     */
    protected function errorResponse(
        string $message,
        int $status = 400,
        ?array $errors = null,
        array $meta = [],
    ): JsonResponse {
        return ApiEnvelope::error($message, $status, $errors, $meta);
    }

    /**
     * @param  class-string<JsonResource>  $resource
     */
    protected function paginatedResponse(LengthAwarePaginator $paginator, string $resource, string $message = 'OK'): JsonResponse
    {
        return ApiEnvelope::success(
            data: $resource::collection($paginator->getCollection())->resolve(),
            message: $message,
            meta: [
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'last_page' => $paginator->lastPage(),
                    'total' => $paginator->total(),
                    'from' => $paginator->firstItem(),
                    'to' => $paginator->lastItem(),
                ],
            ],
        );
    }
}
