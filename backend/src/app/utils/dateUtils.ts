/**
 * Timezone-aware date parsing utilities
 * Handles datetime-local input from frontend browsers which send local time strings
 */

/**
 * Parse a datetime-local string (e.g., "2026-04-16T10:00") accounting for timezone offset
 * Browser datetime-local inputs represent local time, so we need to convert them properly
 * 
 * @param dateTimeString - ISO-like string from datetime-local input (e.g., "2026-04-16T10:00")
 * @returns Date object representing the correct UTC time
 */
export function parseLocalDateTime(dateTimeString: string): Date {
  // Parse the datetime-local string
  const [dateStr, timeStr] = dateTimeString.split("T");
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const [hourStr, minStr] = timeStr.split(":");

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // JavaScript months are 0-indexed
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);

  // Create a local date (this is how the browser interprets datetime-local)
  const localDate = new Date(year, month, day, hour, min, 0);

  // Get the timezone offset in minutes
  const offsetMs = localDate.getTimezoneOffset() * 60 * 1000;

  // Convert to UTC by accounting for timezone offset
  // If timezone offset is positive (e.g., UTC-5), we need to ADD to get UTC
  // If timezone offset is negative (e.g., UTC+5), we need to SUBTRACT from to get UTC
  const utcDate = new Date(localDate.getTime() + offsetMs);

  return utcDate;
}

/**
 * Parse a date string (e.g., "2026-04-16") accounting for timezone offset
 * This ensures the date represents midnight local time (start of day)
 * 
 * @param dateString - Date string in format YYYY-MM-DD
 * @returns Date object representing start of day in UTC
 */
export function parseLocalDate(dateString: string): Date {
  const [yearStr, monthStr, dayStr] = dateString.split("-");

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // JavaScript months are 0-indexed
  const day = parseInt(dayStr, 10);

  // Create a local date at midnight
  const localDate = new Date(year, month, day, 0, 0, 0);

  // Get the timezone offset in minutes
  const offsetMs = localDate.getTimezoneOffset() * 60 * 1000;

  // Convert to UTC
  const utcDate = new Date(localDate.getTime() + offsetMs);

  return utcDate;
}
