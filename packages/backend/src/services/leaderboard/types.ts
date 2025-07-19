/**
 * Leaderboard service types and interfaces
 * Supports team and global leaderboards with privacy controls
 */

export type LeaderboardPeriod = 'week' | 'month' | 'all';

export interface LeaderboardEntry {
  /** User ID */
  userId: string;
  /** User display name */
  name: string;
  /** User avatar URL */
  avatarUrl: string | null;
  /** Total distance in meters (from public activities only) */
  totalDistance: number;
  /** Total number of public activities */
  activityCount: number;
  /** Average distance per activity */
  averageDistance: number;
  /** User's rank in the leaderboard (1-based) */
  rank: number;
  /** Whether this entry is for the current user */
  isCurrentUser: boolean;
  /** Whether user has private activities (not included in totals) */
  hasPrivateActivities: boolean;
  /** Last activity date (from public activities only) */
  lastActivityAt: Date | null;
}

export interface TeamLeaderboard {
  /** Team information */
  team: {
    id: string;
    name: string;
    memberCount: number;
  };
  /** Leaderboard period */
  period: LeaderboardPeriod;
  /** Date range for the leaderboard */
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  /** Leaderboard entries */
  entries: LeaderboardEntry[];
  /** Total number of members with public activities */
  totalActiveMembers: number;
  /** Generated timestamp */
  generatedAt: Date;
}

export interface GlobalLeaderboard {
  /** Leaderboard period */
  period: LeaderboardPeriod;
  /** Date range for the leaderboard */
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  /** Leaderboard entries */
  entries: LeaderboardEntry[];
  /** Total number of users with public activities */
  totalActiveUsers: number;
  /** Generated timestamp */
  generatedAt: Date;
}

export interface UserRank {
  /** User's current rank */
  rank: number;
  /** Total number of participants */
  totalParticipants: number;
  /** User's total distance */
  totalDistance: number;
  /** Distance to next rank (if not #1) */
  distanceToNextRank: number | null;
  /** Distance from previous rank (if not last) */
  distanceFromPreviousRank: number | null;
}

export interface LeaderboardOptions {
  /** Period to calculate for */
  period: LeaderboardPeriod;
  /** Limit number of entries returned */
  limit?: number;
  /** Specific user ID to include context for */
  userId?: string;
  /** For team leaderboards: specific team goal ID */
  teamGoalId?: string;
}

export interface LeaderboardCacheKey {
  type: 'team' | 'global';
  teamId?: string;
  period: LeaderboardPeriod;
  teamGoalId?: string;
}