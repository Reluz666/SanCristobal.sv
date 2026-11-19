<?php

declare(strict_types=1);

namespace App\DTOs;

use App\Enums\DocumentType;
use App\Enums\KardexMovementType;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;

/**
 * Datos inmutables para registrar un movimiento del Kardex valorizado.
 * Los identificadores son internos (BIGINT) y nunca viajan al frontend.
 */
final readonly class KardexMovementDTO
{
    public function __construct(
        public int $companyId,
        public int $warehouseId,
        public int $productId,
        public int $userId,
        public KardexMovementType $movementType,
        public DateTimeInterface $movementDate,
        public string $quantity,
        public ?string $unitCost = null,
        public ?DocumentType $documentType = null,
        public ?string $documentReference = null,
        public ?Model $reference = null,
        public ?string $notes = null,
    ) {}
}
