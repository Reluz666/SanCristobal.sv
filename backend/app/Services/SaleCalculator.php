<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\TaxAffectationType;
use App\Exceptions\BusinessRuleException;
use App\Models\Product;
use App\Support\Money;

/**
 * Calculo contable de una venta con BCMath. El precio unitario del catalogo
 * incluye IGV (precio de venta al publico); el valor unitario sin IGV se
 * deriva y se redondea a cuatro decimales para persistencia.
 *
 * La base y el IGV se obtienen por linea y el IGV se calcula por diferencia
 * contra el total, de modo que la suma de las partes cierra exactamente.
 */
final class SaleCalculator
{
    private const IGV_DIVISOR = '1.1800';

    /**
     * @param  list<array{product: Product, quantity: string}>  $lines
     * @return array{
     *     lines: list<array{
     *         product: Product,
     *         quantity: string,
     *         unit_price: string,
     *         unit_value: string,
     *         unit_value_exact: string,
     *         subtotal: string,
     *         igv: string,
     *         total: string,
     *         affectation: TaxAffectationType,
     *         igv_rate: string
     *     }>,
     *     total_taxed: string,
     *     total_exonerated: string,
     *     total_unaffected: string,
     *     total_igv: string,
     *     total_discount: string,
     *     total_amount: string
     * }
     */
    public function calculate(array $lines): array
    {
        if ($lines === []) {
            throw BusinessRuleException::fromMessages([
                'items' => ['El comprobante debe incluir al menos un producto.'],
            ]);
        }

        $totalTaxed = '0.00';
        $totalExonerated = '0.00';
        $totalUnaffected = '0.00';
        $totalIgv = '0.00';
        $totalAmount = '0.00';
        $calculated = [];

        foreach ($lines as $line) {
            $product = $line['product'];
            $quantity = Money::norm($line['quantity'], 4);

            if (! Money::isPositive($quantity)) {
                throw BusinessRuleException::fromMessages([
                    'items' => ['La cantidad de cada producto debe ser mayor a cero.'],
                ]);
            }

            $unitPrice = Money::norm((string) $product->sale_price, 4);

            if (! Money::isPositive($unitPrice)) {
                throw BusinessRuleException::fromMessages([
                    'items' => ['El producto '.$product->sku.' no tiene un precio de venta válido.'],
                ]);
            }

            $gross = Money::round(Money::mul($quantity, $unitPrice, 6), 2);
            $affectation = $product->tax_affectation_type;

            if ($affectation->isTaxed()) {
                $subtotal = Money::round(Money::div($gross, self::IGV_DIVISOR, 6), 2);
                $igv = Money::sub($gross, $subtotal, 2);
                $totalTaxed = Money::add($totalTaxed, $subtotal, 2);
                $totalIgv = Money::add($totalIgv, $igv, 2);
            } else {
                $subtotal = $gross;
                $igv = '0.00';

                if ($affectation === TaxAffectationType::Exonerado) {
                    $totalExonerated = Money::add($totalExonerated, $subtotal, 2);
                } else {
                    $totalUnaffected = Money::add($totalUnaffected, $subtotal, 2);
                }
            }

            $totalAmount = Money::add($totalAmount, $gross, 2);

            $calculated[] = [
                'product' => $product,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'unit_value' => Money::div($subtotal, $quantity, 4),
                'unit_value_exact' => Money::div($subtotal, $quantity, 10),
                'subtotal' => $subtotal,
                'igv' => $igv,
                'total' => $gross,
                'affectation' => $affectation,
                'igv_rate' => $affectation->igvRate(),
            ];
        }

        if (! Money::isPositive($totalAmount)) {
            throw BusinessRuleException::fromMessages([
                'items' => ['El importe total del comprobante debe ser mayor a cero.'],
            ]);
        }

        return [
            'lines' => $calculated,
            'total_taxed' => $totalTaxed,
            'total_exonerated' => $totalExonerated,
            'total_unaffected' => $totalUnaffected,
            'total_igv' => $totalIgv,
            'total_discount' => '0.00',
            'total_amount' => $totalAmount,
        ];
    }
}
