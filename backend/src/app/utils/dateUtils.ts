// Bangladesh timezone utilities for local date and datetime parsing.

export const BANGLADESH_TIME_ZONE = "Asia/Dhaka";
export const BANGLADESH_OFFSET_MINUTES = 6 * 60;
const BANGLADESH_OFFSET_MS = BANGLADESH_OFFSET_MINUTES * 60 * 1000;

const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function toBangladeshPseudoDate(date: Date): Date {
  return new Date(date.getTime() + BANGLADESH_OFFSET_MS);
}

function createDateFromBangladeshParts(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): Date {
  return new Date(
    Date.UTC(year, month, day, hour, minute, second, millisecond) -
      BANGLADESH_OFFSET_MS,
  );
}

function getValidatedDateMatch(dateString: string): RegExpMatchArray {
  const match = dateString.match(DATE_REGEX);

  if (!match) {
    throw new Error(`Invalid date string: ${dateString}`);
  }

  return match;
}

function getValidatedDateTimeMatch(dateTimeString: string): RegExpMatchArray {
  const match = dateTimeString.match(DATE_TIME_REGEX);

  if (!match) {
    throw new Error(`Invalid datetime string: ${dateTimeString}`);
  }

  return match;
}

export function parseLocalDateTime(dateTimeString: string): Date {
  const match = getValidatedDateTimeMatch(dateTimeString);
  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = match;

  return createDateFromBangladeshParts(
    parseInt(yearStr, 10),
    parseInt(monthStr, 10) - 1,
    parseInt(dayStr, 10),
    parseInt(hourStr, 10),
    parseInt(minuteStr, 10),
    parseInt(secondStr ?? "0", 10),
  );
}

export function parseLocalDate(dateString: string): Date {
  const match = getValidatedDateMatch(dateString);
  const [, yearStr, monthStr, dayStr] = match;

  return createDateFromBangladeshParts(
    parseInt(yearStr, 10),
    parseInt(monthStr, 10) - 1,
    parseInt(dayStr, 10),
  );
}

export function parseLocalDateEndOfDay(dateString: string): Date {
  const match = getValidatedDateMatch(dateString);
  const [, yearStr, monthStr, dayStr] = match;

  return createDateFromBangladeshParts(
    parseInt(yearStr, 10),
    parseInt(monthStr, 10) - 1,
    parseInt(dayStr, 10),
    23,
    59,
    59,
    999,
  );
}

export function formatBangladeshDateKey(date: Date): string {
  const bangladeshDate = toBangladeshPseudoDate(date);
  const year = bangladeshDate.getUTCFullYear();
  const month = String(bangladeshDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(bangladeshDate.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getBangladeshDayOfWeek(date: Date): number {
  return toBangladeshPseudoDate(date).getUTCDay();
}

export function getBangladeshStartOfDay(date: Date): Date {
  const bangladeshDate = toBangladeshPseudoDate(date);

  return createDateFromBangladeshParts(
    bangladeshDate.getUTCFullYear(),
    bangladeshDate.getUTCMonth(),
    bangladeshDate.getUTCDate(),
  );
}

export function getBangladeshEndOfDay(date: Date): Date {
  const bangladeshDate = toBangladeshPseudoDate(date);

  return createDateFromBangladeshParts(
    bangladeshDate.getUTCFullYear(),
    bangladeshDate.getUTCMonth(),
    bangladeshDate.getUTCDate(),
    23,
    59,
    59,
    999,
  );
}

export function addBangladeshDays(date: Date, days: number): Date {
  const bangladeshDate = toBangladeshPseudoDate(date);
  bangladeshDate.setUTCDate(bangladeshDate.getUTCDate() + days);

  return createDateFromBangladeshParts(
    bangladeshDate.getUTCFullYear(),
    bangladeshDate.getUTCMonth(),
    bangladeshDate.getUTCDate(),
    bangladeshDate.getUTCHours(),
    bangladeshDate.getUTCMinutes(),
    bangladeshDate.getUTCSeconds(),
    bangladeshDate.getUTCMilliseconds(),
  );
}
