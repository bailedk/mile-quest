import { useQuery } from '@tanstack/react-query';
import { activityService } from '@/services/activity.service';
import { ActivityFilters } from '@/types/activity.types';
import { subDays, format } from 'date-fns';

export function useUserActivities(filters?: ActivityFilters) {
  return useQuery({
    queryKey: ['activities', 'user', filters],
    queryFn: () => activityService.getUserActivities(filters),
    staleTime: 30000, // 30 seconds
    retry: 2,
  });
}

export function useTeamActivities(teamId: string | null, filters?: ActivityFilters) {
  return useQuery({
    queryKey: ['activities', 'team', teamId, filters],
    queryFn: () => teamId ? activityService.getTeamActivities(teamId, filters) : Promise.resolve([]),
    enabled: !!teamId,
    staleTime: 30000, // 30 seconds
    retry: 2,
  });
}

export function useUserStats() {
  return useQuery({
    queryKey: ['stats', 'user'],
    queryFn: () => activityService.getUserStats(),
    staleTime: 60000, // 1 minute
    retry: 2,
  });
}

export function useTeamStats(teamId: string | null) {
  return useQuery({
    queryKey: ['stats', 'team', teamId],
    queryFn: () => teamId ? activityService.getTeamStats(teamId) : Promise.resolve(null),
    enabled: !!teamId,
    staleTime: 60000, // 1 minute
    retry: 2,
  });
}

export function useTeamGoalProgress(teamId: string | null, goalId: string | null) {
  return useQuery({
    queryKey: ['goal-progress', teamId, goalId],
    queryFn: () => teamId && goalId ? activityService.getTeamGoalProgress(teamId, goalId) : Promise.resolve(null),
    enabled: !!teamId && !!goalId,
    staleTime: 60000, // 1 minute
    retry: 2,
  });
}

export function useActivitySummary(options?: {
  period?: 'daily' | 'weekly' | 'monthly';
  startDate?: string;
  endDate?: string;
  teamId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['activity-summary', options],
    queryFn: () => activityService.getActivitySummary(options),
    staleTime: 60000, // 1 minute
    retry: 2,
  });
}

// Specialized hooks for chart data
export function useDailyProgressData(limit = 30) {
  const endDate = new Date();
  const startDate = subDays(endDate, limit - 1);
  
  return useQuery({
    queryKey: ['activity-summary', 'daily', limit],
    queryFn: () => activityService.getActivitySummary({
      period: 'daily',
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      limit,
    }),
    staleTime: 60000, // 1 minute
    retry: 2,
    select: (data) => {
      // Transform API data to chart format
      return data.map(item => ({
        date: format(new Date(item.startDate), 'MMM dd'),
        distance: item.totalDistance,
        cumulative: 0, // Will be calculated below
      })).reduce((acc, item, index) => {
        const cumulative = index === 0 ? item.distance : acc[index - 1].cumulative + item.distance;
        acc.push({ ...item, cumulative });
        return acc;
      }, [] as Array<{ date: string; distance: number; cumulative: number }>);
    },
  });
}

export function useWeeklyProgressData(limit = 8) {
  const endDate = new Date();
  const startDate = subDays(endDate, (limit - 1) * 7);
  
  return useQuery({
    queryKey: ['activity-summary', 'weekly', limit],
    queryFn: () => activityService.getActivitySummary({
      period: 'weekly',
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      limit,
    }),
    staleTime: 60000, // 1 minute
    retry: 2,
    select: (data) => {
      // Transform API data to chart format
      return data.map(item => ({
        date: format(new Date(item.startDate), 'MMM dd'),
        distance: item.totalDistance,
        cumulative: 0, // Will be calculated below
      })).reduce((acc, item, index) => {
        const cumulative = index === 0 ? item.distance : acc[index - 1].cumulative + item.distance;
        acc.push({ ...item, cumulative });
        return acc;
      }, [] as Array<{ date: string; distance: number; cumulative: number }>);
    },
  });
}

export function useActivityBreakdownData(days = 7) {
  const endDate = new Date();
  const startDate = subDays(endDate, days - 1);
  
  return useQuery({
    queryKey: ['activity-summary', 'breakdown', days],
    queryFn: () => activityService.getActivitySummary({
      period: 'daily',
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      limit: days,
    }),
    staleTime: 60000, // 1 minute
    retry: 2,
    select: (data) => {
      // Transform API data to activity breakdown format
      return data.map(item => ({
        day: format(new Date(item.startDate), 'EEE'), // Mon, Tue, etc.
        distance: item.totalDistance,
        activities: item.totalActivities,
      }));
    },
  });
}