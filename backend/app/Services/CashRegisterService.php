<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\PaymentMethod;
use App\Exceptions\ApiException;
use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\SalePayment;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

/**
 * Apertura y cierre de turnos de caja con arqueo exacto en BCMath.
 */
final class CashRegisterService
{
    public function openSession(User $user, string $cashRegisterUuid, string $openingBalance): CashRegisterSession
    {
        return DB::transaction(function () use ($user, $cashRegisterUuid, $openingBalance): CashRegisterSession {
            $cashRegister = CashRegister::query()
                ->where('uuid', $cashRegisterUuid)
                ->where('is_active', true)
                ->first();

            if (! $cashRegister instanceof CashRegister) {
                throw ApiException::notFound('La caja indicada no existe o está inactiva.');
            }

            $userHasOpenSession = CashRegisterSession::query()
                ->where('user_id', $user->getKey())
                ->open()
                ->lockForUpdate()
                ->exists();

            if ($userHasOpenSession) {
                throw ApiException::conflict('Ya existe un turno de caja abierto para este cajero.');
            }

            $registerHasOpenSession = CashRegisterSession::query()
                ->where('cash_register_id', $cashRegister->getKey())
                ->open()
                ->lockForUpdate()
                ->exists();

            if ($registerHasOpenSession) {
                throw ApiException::conflict('La caja ya se encuentra abierta por otro usuario.');
            }

            $session = CashRegisterSession::query()->create([
                'company_id' => $cashRegister->getAttribute('company_id'),
                'cash_register_id' => $cashRegister->getKey(),
                'user_id' => $user->getKey(),
                'opened_at' => now(),
                'opening_balance' => Money::round($openingBalance, 2),
                'status' => CashRegisterSession::STATUS_OPEN,
            ]);

            activity('cash_register')
                ->causedBy($user)
                ->performedOn($session)
                ->withProperties([
                    'event' => 'cash_register.opened',
                    'cash_register_uuid' => $cashRegister->uuid,
                    'opening_balance' => $session->opening_balance,
                ])
                ->log('Apertura de turno de caja');

            return $session->load(['cashRegister.warehouse', 'user']);
        });
    }

    public function closeSession(
        CashRegisterSession $session,
        string $actualClosingBalance,
        ?string $notes,
    ): CashRegisterSession {
        return DB::transaction(function () use ($session, $actualClosingBalance, $notes): CashRegisterSession {
            $locked = CashRegisterSession::query()
                ->whereKey($session->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if (! $locked->isOpen()) {
                throw ApiException::conflict('El turno de caja ya se encuentra cerrado.');
            }

            $cashTotal = $this->cashTotal($locked);
            $expected = Money::add((string) $locked->opening_balance, $cashTotal, 2);
            $actual = Money::round($actualClosingBalance, 2);
            $difference = Money::sub($actual, $expected, 2);

            $locked->fill([
                'closed_at' => now(),
                'expected_closing_balance' => $expected,
                'actual_closing_balance' => $actual,
                'difference' => $difference,
                'status' => CashRegisterSession::STATUS_CLOSED,
                'notes' => $notes,
            ])->save();

            activity('cash_register')
                ->performedOn($locked)
                ->withProperties([
                    'event' => 'cash_register.closed',
                    'opening_balance' => $locked->opening_balance,
                    'cash_sales' => $cashTotal,
                    'expected_closing_balance' => $expected,
                    'actual_closing_balance' => $actual,
                    'difference' => $difference,
                ])
                ->log('Cierre y arqueo de caja');

            return $locked->load(['cashRegister.warehouse', 'user']);
        });
    }

    /**
     * Resumen operativo del turno para la terminal POS.
     *
     * @return array{sales_count: int, cash_total: string, total_sales: string}
     */
    public function summary(CashRegisterSession $session): array
    {
        $sales = $session->sales()->get(['total_amount']);

        $total = '0.00';

        foreach ($sales as $sale) {
            $total = Money::add($total, (string) $sale->total_amount, 2);
        }

        return [
            'sales_count' => $sales->count(),
            'cash_total' => $this->cashTotal($session),
            'total_sales' => $total,
        ];
    }

    /**
     * Suma de pagos en efectivo de la sesion, sin float.
     */
    public function cashTotal(CashRegisterSession $session): string
    {
        $payments = SalePayment::query()
            ->whereHas('sale', static function ($query) use ($session): void {
                $query->where('cash_register_session_id', $session->getKey());
            })
            ->where('payment_method', PaymentMethod::Cash->value)
            ->pluck('amount');

        $total = '0.00';

        foreach ($payments as $amount) {
            $total = Money::add($total, (string) $amount, 2);
        }

        return $total;
    }
}
