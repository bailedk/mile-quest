/**
 * Team progress tracking types
 */

export interface TeamProgressData {
  teamId: string;
  teamGoalId: string;
  goalName: string;
  targetDistance: number;
  targetDate?: Date;
  totalDistance: number;
  totalActivities: number;
  totalDuration: number;
  percentComplete: number;
  estimatedCompletionDate?: Date;
  currentSegmentIndex: number;
  segmentProgress: number;
  lastActivityAt?: Date;
  daysRemaining?: number;
  averageDailyDistance: number;
  requiredDailyDistance?: number;
  isOnTrack?: boolean;
  participantCount: number;
  topContributors: ContributorData[];
}

export interface ContributorData {
  userId: string;
  name: string;
  avatarUrl?: string;
  totalDistance: number;
  totalActivities: number;
  percentOfTeamTotal: number;
}

export interface ProgressUpdateResult {
  teamProgress: TeamProgressData;
  milestoneReached?: MilestoneData;
  shouldNotify: boolean;
}

export interface MilestoneData {
  type: 'PERCENT' | 'SEGMENT' | 'COMPLETION';
  value: number;
  message: string;
}

export interface ProgressNotification {
  teamId: string;
  type: 'MILESTONE' | 'DAILY_UPDATE' | 'GOAL_COMPLETE' | 'BEHIND_SCHEDULE';
  title: string;
  message: string;
  data: Record<string, any>;
}

export interface TeamProgressFilters {
  teamIds?: string[];
  goalIds?: string[];
  includeInactive?: boolean;
  includePrivateActivities?: boolean;
}

export interface ProgressCalculationOptions {
  includeEstimates?: boolean;
  includeContributors?: boolean;
  contributorLimit?: number;
}

export interface DailyProgressSummary {
  date: Date;
  totalDistance: number;
  totalActivities: number;
  activeUsers: number;
  averageDistance: number;
}

export interface ProgressTrend {
  period: 'WEEK' | 'MONTH';
  data: DailyProgressSummary[];
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  percentChange: number;
}