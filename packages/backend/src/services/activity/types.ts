import { Activity, Team, User, ActivitySource } from '@prisma/client';
import { AchievementWithUser } from '../achievement/types';

export interface ActivityWithRelations extends Activity {
  user: Pick<User, 'id' | 'name' | 'avatarUrl'>;
  team: Pick<Team, 'id' | 'name'>;
  teams?: Pick<Team, 'id' | 'name'>[];
}

export interface CreateActivityInput {
  teamIds: string[];
  distance: number; // in meters
  duration: number; // in seconds
  activityDate: string; // ISO date string
  note?: string;
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
  activityDate: Date;
  note: string | null;
  isPrivate: boolean;
  createdAt: Date;
  teams: {
    id: string;
    name: string;
  }[];
}

export interface TeamProgressUpdate {
  teamId: string;
  teamGoalId?: string;
  newTotalDistance: number;
  newPercentComplete: number;
}

export interface CreateActivityResult {
  activity: ActivityWithRelations;
  teamUpdates: TeamProgressUpdate[];
  newAchievements: AchievementWithUser[];
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
  progress: {
    totalDistance: number;
    percentComplete: number;
    currentSegmentIndex: number;
    distanceToNextWaypoint: number;
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