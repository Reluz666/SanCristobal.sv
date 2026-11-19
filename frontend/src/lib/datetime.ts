const LIMA_TIME_ZONE = "America/Lima";
const LOCALE = "es-PE";

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: LIMA_TIME_ZONE,
});

const shortDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: LIMA_TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: LIMA_TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: LIMA_TIME_ZONE,
});

const longDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: LIMA_TIME_ZONE,
});

function toDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: Date | string): string {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : "Sin fecha";
}

export function formatShortDate(value: Date | string): string {
  const date = toDate(value);
  return date ? shortDateFormatter.format(date) : "Sin fecha";
}

export function formatTime(value: Date | string): string {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : "--:--";
}

export function formatDateTime(value: Date | string): string {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : "Sin fecha";
}

export function formatLongDate(value: Date | string): string {
  const date = toDate(value);
  return date
    ? longDateFormatter.format(date).replace(/^\w/, (letter) => letter.toUpperCase())
    : "Sin fecha";
}

export function currentLimaDate(): Date {
  return new Date();
}

export { LIMA_TIME_ZONE };
