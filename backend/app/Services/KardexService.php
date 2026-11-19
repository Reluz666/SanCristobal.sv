<?php

declare(strict_types=1);

namespace App\Services;

use App\DTOs\KardexMovementDTO;
use App\Enums\KardexMovementType;
use App\Exceptions\BusinessRuleException;
use App\Exceptions\InsufficientStockException;
use App\Models\KardexMovement;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

/**
 * Kardex valorizado en tiempo real (Formato 13.1).
 *
 * El saldo se calcula bajo bloqueo pesimista de product_warehouse, de modo
 * que dos ventas simultaneas del mismo producto no pueden vender el mismo
 * stock. El costo unitario de salida es el costo promedio ponderado vigente.
 */
final class KardexService
{
    public function registerMovement(KardexMovementDTO $dto): KardexMovement
    {
        return DB::transaction(function () use ($dto): KardexMovement {
            $product = Product::query()
                ->whereKey($dto->productId)
                ->firstOrFail();

            $quantity = Money::norm($dto->quantity, 4);

            if (! Money::isPositive($quantity)) {
                throw BusinessRuleException::fromMessages([
                    'quantity' => ['La cantidad del movimiento debe ser mayor a cero.'],
                ]);
            }

            $stock = ProductWarehouse::query()
                ->where('company_id', $dto->companyId)
                ->where('warehouse_id', $dto->warehouseId)
                ->where('product_id', $dto->productId)
                ->lockForUpdate()
                ->first();

            if (! $stock instanceof ProductWarehouse) {
                $stock = new ProductWarehouse;
                $stock->fill([
                    'company_id' => $dto->companyId,
                    'warehouse_id' => $dto->warehouseId,
                    'product_id' => $dto->productId,
                    'stock' => '0.0000',
                ]);
                $stock->save();
            }

            $currentQuantity = Money::norm((string) $stock->stock, 4);
            $lastMovement = $this->lastMovement($dto);
            $currentUnitCost = $lastMovement instanceof KardexMovement
                ? Money::norm((string) $lastMovement->balance_unit_cost, 4)
                : Money::norm((string) $product->purchase_price, 4);
            $currentTotalCost = Money::mul($currentQuantity, $currentUnitCost, 4);

            $isOutbound = in_array($dto->movementType, [
                KardexMovementType::OutSale,
                KardexMovementType::OutReturn,
                KardexMovementType::AdjustmentOut,
            ], true);

            if ($isOutbound && $product->track_stock && Money::cmp($currentQuantity, $quantity, 4) < 0) {
                throw InsufficientStockException::forProduct($product, $quantity, $currentQuantity);
            }

            if ($isOutbound) {
                $unitCost = $currentUnitCost;
                $totalCost = Money::mul($quantity, $unitCost, 4);
                $balanceQuantity = Money::sub($currentQuantity, $quantity, 4);
                $balanceTotalCost = Money::sub($currentTotalCost, $totalCost, 4);
            } else {
                $unitCost = Money::norm($dto->unitCost ?? $currentUnitCost, 4);
                $totalCost = Money::mul($quantity, $unitCost, 4);
                $balanceQuantity = Money::add($currentQuantity, $quantity, 4);
                $balanceTotalCost = Money::add($currentTotalCost, $totalCost, 4);
            }

            if (Money::isNegative($balanceQuantity)) {
                $balanceQuantity = '0.0000';
            }

            if (Money::isNegative($balanceTotalCost)) {
                $balanceTotalCost = '0.0000';
            }

            if (Money::cmp($balanceQuantity, '0', 4) === 0) {
                $balanceTotalCost = '0.0000';
                $balanceUnitCost = '0.0000';
            } else {
                $balanceUnitCost = Money::div($balanceTotalCost, $balanceQuantity, 4);
            }

            if ($product->track_stock) {
                $stock->stock = $balanceQuantity;
                $stock->save();
            }

            $movement = KardexMovement::query()->create([
                'company_id' => $dto->companyId,
                'warehouse_id' => $dto->warehouseId,
                'product_id' => $dto->productId,
                'user_id' => $dto->userId,
                'movement_type' => $dto->movementType,
                'document_type' => $dto->documentType,
                'document_reference' => $dto->documentReference,
                'movement_date' => $dto->movementDate,
                'quantity' => $quantity,
                'unit_cost' => $unitCost,
                'total_cost' => $totalCost,
                'balance_quantity' => $balanceQuantity,
                'balance_unit_cost' => $balanceUnitCost,
                'balance_total_cost' => $balanceTotalCost,
                'reference_type' => $dto->reference?->getMorphClass(),
                'reference_id' => $dto->reference?->getKey(),
                'notes' => $dto->notes,
            ]);

            return $movement;
        });
    }

    private function lastMovement(KardexMovementDTO $dto): ?KardexMovement
    {
        return KardexMovement::query()
            ->where('company_id', $dto->companyId)
            ->where('warehouse_id', $dto->warehouseId)
            ->where('product_id', $dto->productId)
            ->orderByDesc('movement_date')
            ->orderByDesc('id')
            ->first();
    }
}
