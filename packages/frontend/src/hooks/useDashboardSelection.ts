/**
 * Custom hook for dashboard selection state management
 */

import { useState, useMemo, useEffect } from 'react';

export function useDashboardSelection(teams: any[], teamLeaderboards: any[]) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [chartView, setChartView] = useState<'daily' | 'weekly'>('daily');

  // Auto-select first team if none selected and teams are available
  useEffect(() => {
    if (!selectedTeamId && teams.length > 0) {
      setSelectedTeamId(teams[0].id);
    }
  }, [selectedTeamId, teams]);

  // Get effective team ID
  const effectiveTeamId = useMemo(() => {
    return selectedTeamId || (teams.length > 0 ? teams[0].id : null);
  }, [selectedTeamId, teams]);

  // Get selected team data
  const selectedTeam = useMemo(() => {
    return teams.find(team => team.id === effectiveTeamId) || null;
  }, [teams, effectiveTeamId]);

  // Get selected team leaderboard
  const selectedTeamLeaderboard = useMemo(() => {
    return teamLeaderboards.find(board => board.teamId === effectiveTeamId);
  }, [teamLeaderboards, effectiveTeamId]);

  return {
    selectedTeamId: effectiveTeamId,
    setSelectedTeamId,
    chartView,
    setChartView,
    selectedTeam,
    selectedTeamLeaderboard,
  };
}