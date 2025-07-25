/**
 * Date formatting utilities for the dashboard
 */

// Helper function to get relative time
export function getRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return 'Unknown';
  
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  
  // Check if the date is valid
  if (isNaN(then.getTime())) {
    return 'Invalid date';
  }
  
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return then.toLocaleDateString();
}

// Helper to format date for best day display
export function formatBestDayDate(date: Date | string | null | undefined): string {
  if (!date) return 'No activities yet';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Check if the date is valid
  if (isNaN(dateObj.getTime())) {
    return 'No activities yet';
  }
  
  return dateObj.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
}