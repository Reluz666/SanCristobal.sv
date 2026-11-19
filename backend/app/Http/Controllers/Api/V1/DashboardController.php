<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\DashboardSummaryService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class DashboardController extends Controller
{
    use ApiResponse;

    public function __invoke(Request $request, DashboardSummaryService $dashboard): JsonResponse
    {
        $user = $this->currentUser($request);
        abort_unless($user->can('dashboard.view'), 403);

        return $this->successResponse(
            data: $dashboard->forUser(
                $user,
                canViewSales: $user->can('sales.view'),
                canViewProducts: $user->can('products.view'),
            ),
            message: 'Resumen del dashboard consultado.',
        );
    }
}
