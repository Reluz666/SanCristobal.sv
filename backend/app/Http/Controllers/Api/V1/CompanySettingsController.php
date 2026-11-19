<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateCompanySettingsRequest;
use App\Http\Resources\CompanyResource;
use App\Services\TenantContext;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

final class CompanySettingsController extends Controller
{
    use ApiResponse;

    public function __invoke(UpdateCompanySettingsRequest $request, TenantContext $tenantContext): JsonResponse
    {
        abort_unless($request->user()?->can('settings.manage'), 403);

        $company = $tenantContext->company();
        abort_unless($company !== null, 404);

        $validated = $request->validated();
        $settings = is_array($company->settings) ? $company->settings : [];
        $branding = is_array($settings['branding'] ?? null) ? $settings['branding'] : [];
        $payments = is_array($settings['payments'] ?? null) ? $settings['payments'] : [];
        $settings['branding'] = array_replace($branding, $validated['branding']);
        $settings['payments'] = array_replace($payments, $validated['payments']);

        $company->settings = $settings;
        $company->save();

        return $this->successResponse(
            data: (new CompanyResource($company))->resolve(),
            message: 'Configuración de marca y pagos guardada.',
        );
    }
}
