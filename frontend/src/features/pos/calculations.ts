import Decimal from "decimal.js";

import { decimal, divide, multiply, round, subtract } from "@/lib/decimal";
import type { CartLine, CartLineTotal, CartTotals } from "@/types/pos";

const IGV_DIVISOR = "1.18";

function comparePositive(value: Decimal): boolean {
  return value.isPositive() && !value.isZero();
}

/**
 * Réplica exacta del cálculo del backend (SaleCalculator):
 * precio de lista con IGV incluido, base redondeada a 2 decimales e IGV por
 * diferencia para que la suma de las líneas cierre contra el total.
 */
export function calculateCart(lines: readonly CartLine[]): CartTotals {
  let taxed = new Decimal(0);
  let exonerated = new Decimal(0);
  let unaffected = new Decimal(0);
  let igv = new Decimal(0);
  let total = new Decimal(0);
  let itemCount = new Decimal(0);
  const calculated: CartLineTotal[] = [];

  for (const line of lines) {
    const quantity = decimal(line.quantity);

    if (!comparePositive(quantity)) {
      continue;
    }

    const unitPrice = decimal(line.product.sale_price);
    const gross = round(multiply(quantity, unitPrice), 2);
    const isTaxed = line.product.tax_affectation_type === "10";
    const subtotal = isTaxed ? round(divide(gross, IGV_DIVISOR), 2) : gross;
    const lineIgv = isTaxed ? subtract(gross, subtotal) : new Decimal(0);

    if (isTaxed) {
      taxed = taxed.plus(subtotal);
      igv = igv.plus(lineIgv);
    } else if (line.product.tax_affectation_type === "20") {
      exonerated = exonerated.plus(subtotal);
    } else {
      unaffected = unaffected.plus(subtotal);
    }

    total = total.plus(gross);
    itemCount = itemCount.plus(quantity);

    calculated.push({
      product: line.product,
      quantity: quantity.toFixed(4),
      subtotal: subtotal.toFixed(2),
      igv: lineIgv.toFixed(2),
      total: gross.toFixed(2),
      unitValue: round(divide(subtotal, quantity), 4).toFixed(4),
    });
  }

  return {
    lines: calculated,
    taxed: taxed.toFixed(2),
    exonerated: exonerated.toFixed(2),
    unaffected: unaffected.toFixed(2),
    igv: igv.toFixed(2),
    total: total.toFixed(2),
    itemCount: itemCount.toFixed(4),
  };
}

export function lineTotal(quantity: string, unitPrice: string): string {
  return round(multiply(decimal(quantity), unitPrice), 2).toFixed(2);
}
