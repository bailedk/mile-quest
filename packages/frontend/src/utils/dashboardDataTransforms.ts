/**
 * Data transformation utilities for dashboard components
 */

import type { LeaderboardMember } from '@/components/dashboard/SwipeableLeaderboard';

// Transform team leaderboard data for SwipeableLeaderboard component
export const transformLeaderboardData = (
  members: any[], 
  userId?: string
): LeaderboardMember[] => {
  return members.map(member => ({
    userId: member.userId,
    name: member.name,
    weekDistance: member.distance, // TODO: Add week distance to API
    totalDistance: member.distance,
    rank: members.indexOf(member) + 1,
    isCurrentUser: member.userId === userId,
    avatarUrl: member.avatarUrl || undefined,
    streakDays: 0, // TODO: Add streak data to API
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