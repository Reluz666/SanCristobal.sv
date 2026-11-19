<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Models\Product;

/**
 * Salida de inventario sin existencias suficientes. Se renderiza como 422
 * con el contrato estandar y el detalle del producto afectado.
 */
final class InsufficientStockException extends ApiException
{
    public static function forProduct(Product $product, string $requested, string $available): self
    {
        return new self(
            statusCode: 422,
            errorCode: 'insufficient_stock',
            message: sprintf(
                'Stock insuficiente para %s (%s). Solicitado: %s, disponible: %s.',
                $product->name,
                $product->sku,
                $requested,
                $available,
            ),
            errors: [[
                'field' => 'items',
                'code' => 'insufficient_stock',
                'product_uuid' => $product->uuid,
                'sku' => $product->sku,
                'requested' => $requested,
                'available' => $available,
            ]],
        );
    }
}
