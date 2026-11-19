import Decimal from "decimal.js";

import { decimal } from "@/lib/decimal";

export const CURRENCIES = {
  PEN: {
    code: "PEN",
    symbol: "S/",
    label: "Sol peruano",
    locale: "es-PE",
  },
  USD: {
    code: "USD",
    symbol: "US$",
    label: "Dólar estadounidense",
    locale: "en-US",
  },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export interface MoneyFormatOptions {
  currency?: CurrencyCode;
  /** Cantidad de decimales. Totales usan 2; precios unitarios pueden usar 4. */
  scale?: 2 | 3 | 4;
  /** Oculta el símbolo cuando la columna ya lo declara. */
  withSymbol?: boolean;
  /** Agrupa miles con coma. Desactivado en tickets y campos de captura. */
  grouped?: boolean;
}

const THOUSANDS_SEPARATOR = ",";
const DECIMAL_SEPARATOR = ".";

/**
 * Formatea un importe decimal sin convertirlo a number.
 * Garantiza alineación contable y evita pérdida de precisión.
 */
export function formatMoney(
  value: Decimal.Value,
  options: MoneyFormatOptions = {},
): string {
  const {
    currency = "PEN",
    scale = 2,
    withSymbol = true,
    grouped = true,
  } = options;

  const fixed = decimal(value).toFixed(scale, Decimal.ROUND_HALF_UP);
  const negative = fixed.startsWith("-");
  const unsigned = negative ? fixed.slice(1) : fixed;
  const [rawInteger = "0", rawFraction = ""] = unsigned.split(".");
  const integer = grouped
    ? rawInteger.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR)
    : rawInteger;
  const fraction = scale > 0 ? `${DECIMAL_SEPARATOR}${rawFraction.padEnd(scale, "0")}` : "";
  const symbol = withSymbol ? `${CURRENCIES[currency].symbol} ` : "";
  const sign = negative ? "-" : "";

  return `${sign}${symbol}${integer}${fraction}`;
}

/** Importe con signo explícito para variaciones y diferencias de caja. */
export function formatSignedMoney(
  value: Decimal.Value,
  options: MoneyFormatOptions = {},
): string {
  const formatted = formatMoney(value, options);
  return decimal(value).isPositive() ? `+${formatted}` : formatted;
}

/**
 * Cantidades de inventario: hasta cuatro decimales, sin ceros decorativos.
 */
export function formatQuantity(value: Decimal.Value, scale: 4 | 3 | 2 = 4): string {
  const fixed = decimal(value).toFixed(scale, Decimal.ROUND_HALF_UP);
  const negative = fixed.startsWith("-");
  const unsigned = negative ? fixed.slice(1) : fixed;
  const [rawInteger = "0", rawFraction = ""] = unsigned.split(".");
  const integer = rawInteger.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);
  const fraction = rawFraction.replace(/0+$/, "");
  const sign = negative ? "-" : "";

  return fraction.length > 0
    ? `${sign}${integer}.${fraction}`
    : `${sign}${integer}`;
}

/**
 * Recibe una tasa como decimal (0.18) y devuelve 18.00%.
 */
export function formatPercent(value: Decimal.Value, scale = 2): string {
  return `${decimal(value).times(100).toFixed(scale, Decimal.ROUND_HALF_UP)}%`;
}

/** Serie-correlativo de comprobantes: F001-00000124. */
export function formatReceiptNumber(series: string, correlative: number | string): string {
  const normalizedSeries = series.trim().toUpperCase().slice(0, 4).padEnd(4, "0");
  const normalizedCorrelative = String(correlative).replace(/\D/g, "").padStart(8, "0").slice(-8);

  return `${normalizedSeries}-${normalizedCorrelative}`;
}

/** RUC peruano: 11 dígitos, sin separadores, en fuente monoespaciada. */
export function formatRuc(ruc: string): string {
  return ruc.replace(/\D/g, "").slice(0, 11);
}

/** DNI peruano: 8 dígitos. */
export function formatDni(dni: string): string {
  return dni.replace(/\D/g, "").slice(0, 8);
}
