import { Activity, Team, User, ActivitySource } from '@prisma/client';

export interface ActivityWithRelations extends Activity {
  user: Pick<User, 'id' | 'name' | 'avatarUrl'>;
}

export interface CreateActivityInput {
  distance: number; // in meters
  duration: number; // in seconds
  timestamp: Date; // Activity timestamp
  notes?: string;
  isPrivate?: boolean;
  source?: ActivitySource;
}

export interface UpdateActivityInput {
  note?: string;
  isPrivate?: boolean;
}

export interface ActivityListItem {
  id: string;
  distance: number;
  duration: number;
  pace: number; // min/km or min/mi based on user preference
  timestamp: Date;
  notes: string | null;
  isPrivate: boolean;
  source: ActivitySource;
  createdAt: Date;
}

export interface TeamProgressUpdate {
  teamId: string;
  teamGoalId?: string;
  newTotalDistance: number;
  newPercentComplete: number;
}

export interface CreateActivityResult {
  activity: ActivityWithRelations;
}

export interface DeleteActivityResult {
  deleted: boolean;
  teamUpdates: TeamProgressUpdate[];
}

// Aggregation types for BE-015
export interface UserActivityStats {
  totalDistance: number;
  totalDuration: number;
  totalActivities: number;
  averagePace: number;
  averageDistance: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date | null;
  weeklyStats: {
    distance: number;
    duration: number;
    activities: number;
  };
  monthlyStats: {
    distance: number;
    duration: number;
    activities: number;
  };
}

export interface TeamProgressInfo {
  team: {
    id: string;
    name: string;
    goalDistance: number;
    startDate: Date;
    endDate: Date;
  };
  goal: {
    id: string;
    name: string;
    description?: string;
    startLocation: {
      lat: number;
      lng: number;
      address?: string;
    };
    endLocation: {
      lat: number;
      lng: number;
      address?: string;
    };
    waypoints: Array<{
      id: string;
      position: {
        lat: number;
        lng: number;
      };
      address?: string;
      order: number;
      isLocked?: boolean;
    }>;
    routePolyline: string;
    routeBounds?: {
      southwest: {
        lat: number;
        lng: number;
      };
      northeast: {
        lat: number;
        lng: number;
      };
    };
  };
  progress: {
    totalDistance: number;
    percentComplete: number;
    currentSegmentIndex: number;
    distanceToNextWaypoint: number;
    segmentProgress: number;
    averageDailyDistance: number;
    projectedCompletionDate: Date | null;
    daysRemaining: number;
    lastActivityAt: Date | null;
  };
  memberStats: {
    totalMembers: number;
    activeMembers: number;
    topContributors: {
      userId: string;
      name: string;
      distance: number;
      percentage: number;
    }[];
  };
}

export interface ActivitySummaryPeriod {
  startDate: Date;
  endDate: Date;
  totalDistance: number;
  totalDuration: number;
  totalActivities: number;
  averagePace: number;
  averageDistance: number;
  activeDays: number;
}

export interface ActivitySummaryOptions {
  period: 'daily' | 'weekly' | 'monthly';
  startDate?: string;
  endDate?: string;
  teamId?: string;
  limit?: number;
}