<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\KardexMovement;
use App\Services\InventorySummaryService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class InventorySummaryController extends Controller
{
    use ApiResponse;

    public function __invoke(Request $request, InventorySummaryService $summary): JsonResponse
    {
        $this->authorize('viewAny', KardexMovement::class);

        return $this->successResponse(
            data: $summary->forUser($this->currentUser($request)),
            message: 'Resumen de inventario consultado.',
        );
    }
}
