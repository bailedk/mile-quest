import { useQuery } from '@tanstack/react-query';
import { teamService } from '@/services/team.service';

export function useUserTeams() {
  return useQuery({
    queryKey: ['teams', 'user'],
    queryFn: () => teamService.getUserTeams(),
    staleTime: 300000, // 5 minutes
    retry: 2,
  });
}

export function useTeam(teamId: string | null) {
  return useQuery({
    queryKey: ['team', teamId],
    queryFn: () => teamId ? teamService.getTeam(teamId) : Promise.resolve(null),
    enabled: !!teamId,
    staleTime: 300000, // 5 minutes
    retry: 2,
  });
}