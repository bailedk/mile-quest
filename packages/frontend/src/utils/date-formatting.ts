/**
 * Hydration-safe date formatting utilities
 * 
 * These utilities ensure consistent date formatting between server and client
 * to prevent hydration mismatches in Next.js SSR/SSG
 */

import { format as dateFnsFormat, isValid } from 'date-fns';

/**
 * Format a date with hydration safety
 * Returns empty string during SSR to avoid mismatches
 */
export function formatDateSafe(
  date: Date | string | number,
  formatStr: string,
  hydrated: boolean
): string {
  if (!hydrated) return '';
  
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
      
    if (!isValid(dateObj)) return '';
    
    return dateFnsFormat(dateObj, formatStr);
  } catch {
    return '';
  }
}

/**
 * Common date format patterns that are hydration-safe
 */
export const dateFormats = {
  // Date formats
  fullDate: 'EEEE, MMMM d, yyyy',     // Monday, January 1, 2024
  shortDate: 'MMM d, yyyy',           // Jan 1, 2024
  dateWithDay: 'EEE, MMM d, yyyy',    // Mon, Jan 1, 2024
  isoDate: 'yyyy-MM-dd',              // 2024-01-01
  
  // Time formats
  time12: 'h:mm a',                   // 1:30 PM
  time24: 'HH:mm',                    // 13:30
  timeWithSeconds: 'h:mm:ss a',       // 1:30:45 PM
  
  // Combined formats
  dateTime12: 'MMM d, yyyy h:mm a',   // Jan 1, 2024 1:30 PM
  dateTime24: 'MMM d, yyyy HH:mm',    // Jan 1, 2024 13:30
  
  // Relative formats
  monthYear: 'MMMM yyyy',             // January 2024
  dayMonth: 'MMM d',                  // Jan 1
} as const;

/**
 * Get current date/time with hydration safety
 * Returns null during SSR
 */
export function getCurrentDateSafe(hydrated: boolean): Date | null {
  if (!hydrated) return null;
  return new Date();
}

/**
 * Format relative time (e.g., "2 hours ago")
 * Returns empty string during SSR
 */
export function formatRelativeTime(
  date: Date | string | number,
  hydrated: boolean
): string {
  if (!hydrated) return '';
  
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
      
    if (!isValid(dateObj)) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return formatDateSafe(dateObj, dateFormats.shortDate, true);
  } catch {
    return '';
  }
}

/**
 * Get default date input value with hydration safety
 * Returns empty string during SSR
 */
export function getDefaultDateInputValue(hydrated: boolean): string {
  if (!hydrated) return '';
  return dateFnsFormat(new Date(), 'yyyy-MM-dd');
}

/**
 * Get default time input value with hydration safety
 * Returns empty string during SSR
 */
export function getDefaultTimeInputValue(hydrated: boolean): string {
  if (!hydrated) return '';
  return dateFnsFormat(new Date(), 'HH:mm');
}