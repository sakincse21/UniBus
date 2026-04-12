export const BANGLADESH_TIME_ZONE = "Asia/Dhaka";

const API_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const API_LOCAL_DATE_TIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

function normalizeDateInput(value: string | Date): Date {
  if (value instanceof Date) {
    return value;
  }

  if (API_DATE_REGEX.test(value)) {
    return new Date(`${value}T00:00:00+06:00`);
  }

  if (API_LOCAL_DATE_TIME_REGEX.test(value)) {
    return new Date(`${value}+06:00`);
  }

  return new Date(value);
}

function getFormatParts(
  value: string | Date,
  options: Intl.DateTimeFormatOptions,
  locale = "en-BD",
): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat(locale, {
    timeZone: BANGLADESH_TIME_ZONE,
    ...options,
  }).formatToParts(normalizeDateInput(value));
}

function getPart(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function formatBangladesh(
  value: string | Date,
  options: Intl.DateTimeFormatOptions,
  locale = "en-BD",
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: BANGLADESH_TIME_ZONE,
    ...options,
  }).format(normalizeDateInput(value));
}

export function formatBangladeshDate(value: string | Date): string {
  const parts = getFormatParts(value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return `${getPart(parts, "day")}-${getPart(parts, "month")}-${getPart(parts, "year")}`;
}

export function formatBangladeshTime(value: string | Date): string {
  return formatBangladesh(value, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatBangladeshDateTime(value: string | Date): string {
  return `${formatBangladeshDate(value)}, ${formatBangladeshTime(value)}`;
}

export function formatBangladeshMonthYear(value: string | Date): string {
  return formatBangladesh(value, {
    month: "long",
    year: "numeric",
  });
}

export function getBangladeshDateKey(value: string | Date): string {
  if (typeof value === "string" && API_DATE_REGEX.test(value)) {
    return value;
  }

  const parts = getFormatParts(value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }, "en-CA");

  return `${getPart(parts, "year")}-${getPart(parts, "month")}-${getPart(parts, "day")}`;
}

export function parseApiDate(value: string): Date {
  return normalizeDateInput(value);
}

export function formatDateForApi(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
