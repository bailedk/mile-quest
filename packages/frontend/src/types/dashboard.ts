/**
 * Dashboard API types matching backend response structure
 */

export interface DashboardTeam {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  memberCount: number;
  role: string;
  progress: {
    goalId: string | null;
    goalName: string | null;
    currentDistance: number;
    targetDistance: number;
    percentComplete: number;
    daysRemaining: number | null;
    isOnTrack: boolean | null;
    startDate?: Date | string;
    endDate?: Date | string;
    status?: string;
  } | null;
}

export interface DashboardActivity {
  id: string;
  distance: number;
  duration: number;
  pace: number;
  /** Activity timestamp as Date object */
  timestamp: Date;
  note: string | null;
  teamName: string;
  userName: string;
  isOwn: boolean;
}

export interface PersonalStats {
  totalDistance: number;
  totalActivities: number;
  currentStreak: number;
  bestDay: {
    date: Date | null;
    distance: number;
  };
  thisWeek: {
    distance: number;
    activities: number;
  };
  thisMonth: {
    distance: number;
    activities: number;
  };
}

export interface TeamLeaderboard {
  teamId: string;
  teamName: string;
  members: {
    userId: string;
    name: string;
    avatarUrl: string | null;
    distance: number;
    percentage: number;
  }[];
}

export interface DashboardResponse {
  teams: DashboardTeam[];
  recentActivities: DashboardActivity[];
  personalStats: PersonalStats;
  teamLeaderboards: TeamLeaderboard[];
}

// Additional types for dashboard state management
export interface DashboardData extends DashboardResponse {
  lastUpdated: Date;
}

export interface DashboardError {
  message: string;
  code?: string;
  details?: string;
}

export interface DashboardState {
  data: DashboardData | null;
  isLoading: boolean;
  error: DashboardError | null;
  lastRefresh: Date | null;
}