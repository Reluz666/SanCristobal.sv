<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Pos\CloseCashRegisterRequest;
use App\Http\Requests\Pos\OpenCashRegisterRequest;
use App\Http\Resources\CashRegisterResource;
use App\Http\Resources\CashRegisterSessionResource;
use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Services\CashRegisterService;
use App\Services\TenantContext;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class CashRegisterController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly CashRegisterService $cashRegisters,
    ) {}

    public function registers(): JsonResponse
    {
        $this->authorize('viewAny', CashRegister::class);
        $this->ensureCashSessionsEnabled();

        $registers = CashRegister::query()
            ->with('warehouse')
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        $openRegisterIds = CashRegisterSession::query()
            ->open()
            ->pluck('cash_register_id')
            ->map(static fn (mixed $id): int => (int) $id)
            ->all();

        $registers->each(static function (CashRegister $register) use ($openRegisterIds): void {
            $register->setAttribute(
                'is_open',
                in_array((int) $register->getKey(), $openRegisterIds, true),
            );
        });

        return $this->successResponse(
            data: CashRegisterResource::collection($registers)->resolve(),
            message: 'Cajas consultadas.',
        );
    }

    public function current(Request $request): JsonResponse
    {
        $this->authorize('viewAny', CashRegisterSession::class);
        $this->ensureCashSessionsEnabled();

        $session = CashRegisterSession::query()
            ->where('user_id', $this->currentUser($request)->getKey())
            ->open()
            ->with(['cashRegister.warehouse', 'user'])
            ->latest('opened_at')
            ->first();

        if (! $session instanceof CashRegisterSession) {
            return $this->successResponse(
                data: null,
                message: 'No hay un turno de caja abierto para este usuario.',
            );
        }

        $session->setAttribute('summary', $this->cashRegisters->summary($session));

        return $this->successResponse(
            data: (new CashRegisterSessionResource($session))->resolve(),
            message: 'Turno de caja activo.',
        );
    }

    public function open(OpenCashRegisterRequest $request): JsonResponse
    {
        $this->authorize('open', CashRegisterSession::class);
        $this->ensureCashSessionsEnabled();

        $validated = $request->validated();
        $session = $this->cashRegisters->openSession(
            $this->currentUser($request),
            (string) $validated['cash_register_uuid'],
            (string) $validated['opening_balance'],
        );

        $session->setAttribute('summary', $this->cashRegisters->summary($session));

        return $this->successResponse(
            data: (new CashRegisterSessionResource($session))->resolve(),
            message: 'Turno de caja aperturado.',
            status: 201,
        );
    }

    public function close(CloseCashRegisterRequest $request, CashRegisterSession $session): JsonResponse
    {
        $this->authorize('close', $session);
        $this->ensureCashSessionsEnabled();

        $validated = $request->validated();
        $session = $this->cashRegisters->closeSession(
            $session,
            (string) $validated['actual_closing_balance'],
            isset($validated['notes']) ? (string) $validated['notes'] : null,
        );

        $session->setAttribute('summary', $this->cashRegisters->summary($session));

        return $this->successResponse(
            data: (new CashRegisterSessionResource($session))->resolve(),
            message: 'Turno de caja cerrado y arqueado.',
        );
    }

    private function ensureCashSessionsEnabled(): void
    {
        if (! app(TenantContext::class)->company()?->cashSessionsEnabled()) {
            throw ApiException::conflict('La gestión de caja está desactivada para esta empresa.');
        }
    }
}
