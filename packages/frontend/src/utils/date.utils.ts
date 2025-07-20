/**
 * Date utility functions for consistent timestamp handling across the application
 * All API timestamps should be ISO 8601 strings in UTC
 */

/**
 * Convert a Date object to ISO 8601 string for API requests
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
 * Format a date for display in the user's timezone
 * @param dateString - ISO 8601 date string from API
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted date string
 */
export function formatForDisplay(
  dateString: string, 
  options?: Intl.DateTimeFormatOptions
): string {
  const date = fromApiString(dateString);
  return date.toLocaleString(undefined, options);
}

/**
 * Get relative time string (e.g., "2 hours ago")
 * @param dateString - ISO 8601 date string from API
 * @returns Relative time string
 */
export function getRelativeTime(dateString: string): string {
  const date = fromApiString(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  
  return formatForDisplay(dateString, { 
    month: 'short', 
    day: 'numeric',
    year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined
  });
}

/**
 * Check if a date string represents today
 * @param dateString - ISO 8601 date string from API
 * @returns true if the date is today in the user's timezone
 */
export function isToday(dateString: string): boolean {
  const date = fromApiString(dateString);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if a date string represents this week
 * @param dateString - ISO 8601 date string from API
 * @returns true if the date is within the current week
 */
export function isThisWeek(dateString: string): boolean {
  const date = fromApiString(dateString);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  
  return date >= weekStart && date < weekEnd;
}

// Re-export as a namespace for easier imports
export const DateUtils = {
  toApiString,
  fromApiString,
  isValidISOString,
  toDateOnlyString,
  fromDateOnlyString,
  nowApiString,
  formatForDisplay,
  getRelativeTime,
  isToday,
  isThisWeek
};