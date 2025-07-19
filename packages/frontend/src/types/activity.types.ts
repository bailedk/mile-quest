/**
 * Activity Types for Mile Quest Frontend
 */

export type ActivitySource = 'MANUAL' | 'STRAVA' | 'APPLE_HEALTH' | 'GOOGLE_FIT';

export interface Activity {
  id: string;
  userId: string;
  teamId: string;
  teamGoalId?: string;
  distance: number; // in meters
  duration: number; // in seconds
  startTime: string; // ISO date string
  endTime: string; // ISO date string
  notes?: string;
  source: ActivitySource;
  externalId?: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityCreateInput {
  teamId: string;
  teamGoalId?: string;
  distance: number;
  duration: number;
  startTime: string;
  endTime: string;
  notes?: string;
  isPrivate?: boolean;
}

export interface ActivityUpdateInput {
  distance?: number;
  duration?: number;
  startTime?: string;
  endTime?: string;
  notes?: string;
  isPrivate?: boolean;
}

export interface ActivityListItem extends Activity {
  team: {
    id: string;
    name: string;
  };
  teamGoal?: {
    id: string;
    name: string;
  };
}

export interface ActivityStats {
  totalDistance: number;
  totalActivities: number;
  totalDuration: number;
  averageDistance: number;
  averageDuration: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityAt?: string;
}

export interface ActivityFilters {
  teamId?: string;
  teamGoalId?: string;
  source?: ActivitySource;
  isPrivate?: boolean;
  startDate?: string;
  endDate?: string;
  minDistance?: number;
  maxDistance?: number;
}

// Form validation types
export interface ActivityFormData {
  teamId: string;
  distance: string; // Form input is string, converted to number
  duration: string; // Form input is string, converted to number  
  date: string; // YYYY-MM-DD format
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  notes: string;
  isPrivate: boolean;
}

export interface ActivityFormErrors {
  teamId?: string;
  distance?: string;
  duration?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
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