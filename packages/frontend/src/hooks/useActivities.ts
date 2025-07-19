import { useQuery } from '@tanstack/react-query';
import { activityService } from '@/services/activity.service';
import { ActivityFilters } from '@/types/activity.types';

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