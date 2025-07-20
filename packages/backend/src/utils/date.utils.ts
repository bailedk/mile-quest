/**
 * Date utility functions for consistent timestamp handling across the application
 * All API timestamps should be ISO 8601 strings in UTC
 */

/**
 * Convert a Date object to ISO 8601 string for API responses
 * @param date - Date object to convert
 * @returns ISO 8601 formatted string (e.g., "2025-01-20T14:30:00.000Z")
 */
export function toApiString(date: Date): string {
  return date.toISOString();
}

/**
 * Parse an API date string to a Date object
 * @param dateString - ISO 8601 date string from API
 * @returns Date object
 * @throws Error if dateString is invalid
 */
export function fromApiString(dateString: string): Date {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  return date;
}

/**
 * Validate if a string is a valid ISO 8601 date
 * @param dateString - String to validate
 * @returns true if valid ISO 8601 date
 */
export function isValidISOString(dateString: string): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.toISOString() === dateString;
}

/**
 * Format a date as YYYY-MM-DD for date-only fields
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format
 */
export function toDateOnlyString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parse a YYYY-MM-DD date string
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object set to midnight UTC
 */
export function fromDateOnlyString(dateString: string): Date {
  const date = new Date(dateString + 'T00:00:00.000Z');
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  return date;
}

/**
 * Get current timestamp as ISO 8601 string
 * @returns Current time as ISO 8601 string
 */
export function nowApiString(): string {
  return new Date().toISOString();
}

/**
 * Add timezone offset information to a date for display purposes
 * @param date - Date object
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Object with both UTC and local representations
 */
export function withTimezone(date: Date, timezone: string) {
  const utcString = date.toISOString();
  const localString = date.toLocaleString('en-US', { 
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  return {
    utc: utcString,
    local: localString,
    timezone
  };
}

/**
 * Ensure a date is in the past (for activity dates)
 * @param date - Date to validate
 * @returns true if date is in the past
 */
export function isPastDate(date: Date): boolean {
  return date.getTime() <= Date.now();
}

/**
 * Ensure a date is in the future (for goal target dates)
 * @param date - Date to validate
 * @returns true if date is in the future
 */
export function isFutureDate(date: Date): boolean {
  return date.getTime() > Date.now();
}

// Re-export as a namespace for easier imports
export const DateUtils = {
  toApiString,
  fromApiString,
  isValidISOString,
  toDateOnlyString,
  fromDateOnlyString,
  nowApiString,
  withTimezone,
  isPastDate,
  isFutureDate
};