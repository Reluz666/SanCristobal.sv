<?php

declare(strict_types=1);

namespace App\DTOs;

/**
 * Linea solicitada desde la terminal POS. El precio NO se acepta desde el
 * cliente: se toma siempre del catalogo del servidor.
 */
final readonly class SaleItemDTO
{
    public function __construct(
        public string $productUuid,
        public string $quantity,
    ) {}
}
