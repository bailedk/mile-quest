import type { AuthTokens, AuthUser } from '@mile-quest/shared';

export type { AuthTokens, AuthUser };

export interface LoginResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface RefreshResult {
  tokens: AuthTokens;
}

export interface ActivityListItem {
  id: string;
  distance: number;
  duration: number;
  pace: number;
  timestamp: string;
  notes: string | null;
  isPrivate: boolean;
  source: string;
  externalId: string | null;
  createdAt: string;
}

export interface ActivityListPage {
  items: ActivityListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface DashboardTeamProgress {
  goalId: string;
  goalName: string;
  currentDistance: number;
  targetDistance: number;
  percentComplete: number;
  daysRemaining: number;
  isOnTrack: boolean;
}

export interface DashboardTeam {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  role: string;
  progress: DashboardTeamProgress | null;
}

export interface LeaderboardMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  distance: number;
  percentage: number;
}

export interface DashboardResponse {
  teams: DashboardTeam[];
  recentActivities: Array<{
    id: string;
    distance: number;
    duration: number;
    timestamp: string;
    teamName: string;
    userName: string;
    isOwn: boolean;
    notes?: string | null;
  }>;
  personalStats: {
    totalDistance: number;
    totalActivities: number;
    currentStreak: number;
    bestDay: { date: string | null; distance: number };
    thisWeek: { distance: number; activities: number };
    thisMonth: { distance: number; activities: number };
  };
  teamLeaderboards: Array<{
    teamId: string;
    teamName: string;
    members: LeaderboardMember[];
  }>;
}

export interface CreateActivityInput {
  distance: number;
  duration: number;
  timestamp: string;
  notes?: string;
  source?: 'MANUAL' | 'STRAVA' | 'APPLE_HEALTH' | 'GOOGLE_FIT' | 'HEALTH_CONNECT';
  externalId?: string;
  isPrivate?: boolean;
}

export interface CreatedActivity {
  id: string;
  source: string;
  externalId: string | null;
  deduped?: boolean;
}
