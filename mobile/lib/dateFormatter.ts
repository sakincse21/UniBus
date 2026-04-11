/**
 * Utility to format dates for API submission
 * Needs to match the format WebAPI expects: ISO-like datetime strings
 * from the browser's perspective (as if from a datetime-local input)
 */

/**
 * Convert a Date object and separate time to an ISO-like datetime string
 * that represents local time (not UTC)
 * 
 * This is needed because React Native's DateTimePicker gives us Date objects
 * in the device's local timezone, but we need to send datetime strings that
 * represent those local times (not converted to UTC)
 * 
 * @param date - The selected date (in local timezone)
 * @param time - The selected time (in local timezone)
 * @returns ISO-like string in format YYYY-MM-DDTHH:mm:00 (representing local time)
 */
export function formatLocalDateTime(date: Date, time: Date): string {
  // Extract date components from the date parameter (already in local time)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  // Extract time components from the time parameter (already in local time)
  const hours = String(time.getHours()).padStart(2, "0");
  const minutes = String(time.getMinutes()).padStart(2, "0");
  const seconds = "00";

  // Return in ISO-like format (representing local time, not UTC)
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Format a date for all-day events
 * @param date - The selected date (in local timezone)
 * @returns ISO-like string in format YYYY-MM-DDTHH:mm:ss
 */
export function formatLocalDateAllDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}T00:00:00`;
}

/**
 * Format end of day for all-day events
 * @param date - The selected date (in local timezone)
 * @returns ISO-like string in format YYYY-MM-DDTHH:mm:ss
 */
export function formatLocalDateEndOfDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}T23:59:59`;
}
