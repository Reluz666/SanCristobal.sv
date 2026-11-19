import Decimal from "decimal.js";

/**
 * Configuración única de precisión financiera del frontend.
 * Los importes viajan como strings desde PostgreSQL y nunca se convierten
 * a number para calculos.
 */
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 30,
});

export type DecimalInput = Decimal.Value;

export const IGV_RATE = new Decimal("0.18");

export function decimal(value: DecimalInput): Decimal {
  return new Decimal(value);
}

export function zero(): Decimal {
  return new Decimal(0);
}

export function add(...values: DecimalInput[]): Decimal {
  return values.reduce<Decimal>((total, value) => total.plus(value), zero());
}

export function subtract(minuend: DecimalInput, ...subtrahends: DecimalInput[]): Decimal {
  return subtrahends.reduce<Decimal>((total, value) => total.minus(value), decimal(minuend));
}

export function multiply(...values: DecimalInput[]): Decimal {
  return values.reduce<Decimal>((total, value) => total.times(value), new Decimal(1));
}

export function divide(dividend: DecimalInput, divisor: DecimalInput): Decimal {
  return decimal(dividend).dividedBy(divisor);
}

export function sum(values: readonly DecimalInput[]): Decimal {
  return add(...values);
}

export function round(value: DecimalInput, scale = 2): Decimal {
  return decimal(value).toDecimalPlaces(scale, Decimal.ROUND_HALF_UP);
}

export function toFixed(value: DecimalInput, scale = 2): string {
  return decimal(value).toFixed(scale, Decimal.ROUND_HALF_UP);
}

export function isZero(value: DecimalInput): boolean {
  return decimal(value).isZero();
}

export function isNegative(value: DecimalInput): boolean {
  return decimal(value).isNegative();
}

export function isPositive(value: DecimalInput): boolean {
  return decimal(value).isPositive();
}

export function max(...values: DecimalInput[]): Decimal {
  return Decimal.max(...values.map((value) => decimal(value)));
}

export function min(...values: DecimalInput[]): Decimal {
  return Decimal.min(...values.map((value) => decimal(value)));
}

export interface IgvBreakdown {
  /** Base imponible con dos decimales. */
  base: string;
  /** IGV con dos decimales. */
  igv: string;
  /** Total con dos decimales. */
  total: string;
}

/**
 * Separa el IGV de un precio que ya lo incluye (precio de venta al publico).
 * Se redondea la base y el IGV se obtiene por diferencia para que la suma
 * siempre cierre exactamente contra el total.
 */
export function splitIgvFromGross(gross: DecimalInput, rate: DecimalInput = IGV_RATE): IgvBreakdown {
  const total = round(gross, 2);
  const divisor = add(1, rate);
  const base = total.dividedBy(divisor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const igv = total.minus(base);

  return {
    base: base.toFixed(2),
    igv: igv.toFixed(2),
    total: total.toFixed(2),
  };
}

/**
 * Agrega IGV a un subtotal neto.
 */
export function addIgvToNet(net: DecimalInput, rate: DecimalInput = IGV_RATE): IgvBreakdown {
  const base = round(net, 2);
  const igv = base.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const total = base.plus(igv);

  return {
    base: base.toFixed(2),
    igv: igv.toFixed(2),
    total: total.toFixed(2),
  };
}

/**
 * Calcula el valor unitario sin IGV a partir de un precio con IGV.
 * Se conservan cuatro decimales para el Kardex y las lineas de venta.
 */
export function netUnitPrice(grossUnitPrice: DecimalInput, rate: DecimalInput = IGV_RATE): string {
  return decimal(grossUnitPrice)
    .dividedBy(add(1, rate))
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
    .toFixed(4);
}
