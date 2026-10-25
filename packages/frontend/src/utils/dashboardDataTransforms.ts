/**
 * Data transformation utilities for dashboard components
 */

import type { LeaderboardMember } from '@/components/dashboard/SwipeableLeaderboard';
import type { TeamLeaderboard } from '@/types/dashboard';

type ApiLeaderboardMember = TeamLeaderboard['members'][number];

// The dashboard leaderboard is one distance per member (the active goal window).
// Week and all-time views share that distance until the API splits them.
export const transformLeaderboardData = (
  members: ApiLeaderboardMember[] | null | undefined,
  userId?: string
): LeaderboardMember[] => {
  return (members ?? []).map((member, index) => ({
    userId: member.userId,
    name: member.name || 'Walker',
    weekDistance: member.distance ?? 0,
    totalDistance: member.distance ?? 0,
    rank: index + 1,
    isCurrentUser: member.userId === userId,
    avatarUrl: member.avatarUrl || undefined,
    streakDays: 0,
  }));
};

// Generate chart data based on view type
export const generateChartData = (viewType: 'daily' | 'weekly') => {
  // This would normally come from API data
  // For now, using mock data generators
  if (viewType === 'daily') {
    return {
      dailyProgress: [], // Would be generated from real data
      activityBreakdown: [], // Would be generated from real data
    };
  } else {
    return {
      weeklyProgress: [], // Would be generated from real data
      activityBreakdown: [], // Would be generated from real data
    };
  }
};