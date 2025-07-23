/**
 * Activity Types for Mile Quest Frontend
 */

export type ActivitySource = 'MANUAL' | 'STRAVA' | 'APPLE_HEALTH' | 'GOOGLE_FIT';

export interface Activity {
  id: string;
  userId: string;
  /** Distance in meters */
  distance: number;
  /** Duration in seconds */
  duration: number;
  /** ISO 8601 date-time string in UTC when the activity occurred */
  timestamp: string;
  notes?: string;
  source: ActivitySource;
  externalId?: string;
  isPrivate: boolean;
  /** ISO 8601 date-time string in UTC when the record was created */
  createdAt: string;
  /** ISO 8601 date-time string in UTC when the record was last updated */
  updatedAt: string;
}

export interface ActivityCreateInput {
  /** Distance in meters */
  distance: number;
  /** Duration in seconds */
  duration: number;
  /** ISO 8601 date-time string in UTC when the activity occurred */
  timestamp: string;
  notes?: string;
  isPrivate?: boolean;
}

export interface ActivityUpdateInput {
  notes?: string;
  isPrivate?: boolean;
}

export interface ActivityListItem extends Activity {
  // Activities are now team-agnostic
  // This interface may be extended in the future with list-specific properties
}

export interface ActivityStats {
  totalDistance: number;
  totalActivities: number;
  totalDuration: number;
  averageDistance: number;
  averageDuration: number;
  currentStreak: number;
  longestStreak: number;
  /** ISO 8601 date-time string in UTC of the last activity, undefined if no activities */
  lastActivityAt?: string;
}

export interface ActivityFilters {
  source?: ActivitySource;
  isPrivate?: boolean;
  startDate?: string;
  endDate?: string;
  minDistance?: number;
  maxDistance?: number;
}

// Form validation types
export interface ActivityFormData {
  distance: string; // Form input is string, converted to number
  duration: string; // Form input is string, converted to number  
  date: string; // YYYY-MM-DD format
  time: string; // HH:MM format
  notes: string;
  isPrivate: boolean;
}

export interface ActivityFormErrors {
  distance?: string;
  duration?: string;
  date?: string;
  time?: string;
  notes?: string;
  general?: string;
}

export interface TeamGoalProgress {
  totalDistance: number;
  targetDistance: number;
  percentageComplete: number;
  remainingDistance: number;
  averageDailyDistance: number;
  daysRemaining: number;
  onTrack: boolean;
}

export interface ActivitySummaryItem {
  startDate: string;
  endDate: string;
  totalDistance: number;
  totalDuration: number;
  totalActivities: number;
  averagePace: number;
  averageDistance: number;
  activeDays: number;
}