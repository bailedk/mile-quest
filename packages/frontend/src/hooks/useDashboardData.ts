/**
 * Custom hook for dashboard data management and transformations
 */

import { useMemo } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { 
  useDailyProgressData,
  useWeeklyProgressData,
  useActivityBreakdownData,
  useUserStats,
} from '@/hooks/useActivities';
import { useUserTeams } from '@/hooks/useTeams';
import { 
  generateDailyProgressData, 
  generateWeeklyProgressData, 
  generateActivityBreakdownData 
} from '@/utils/chartMockData';

export function useDashboardData() {
  const { 
    data: dashboardData, 
    isLoading: loading, 
    error, 
    refresh 
  } = useDashboard({
    autoRefresh: true,
    refreshInterval: 10 * 60 * 1000, // 10 minutes
    onError: (error) => {
      console.error('Dashboard error:', error);
    },
  });

  // Fetch real chart data
  const { data: dailyProgressData, isLoading: dailyLoading } = useDailyProgressData(30);
  const { data: weeklyProgressData, isLoading: weeklyLoading } = useWeeklyProgressData(8);
  const { data: activityBreakdownData, isLoading: breakdownLoading } = useActivityBreakdownData(7);
  
  // Fetch additional data using individual hooks for enhanced functionality
  const { data: userStats, isLoading: statsLoading } = useUserStats();
  const { data: userTeams, isLoading: teamsLoading } = useUserTeams();

  // Memoized data transformations with fallback to individual hooks
  const teams = useMemo(() => 
    dashboardData?.teams || userTeams || [], 
    [dashboardData?.teams, userTeams]
  );
  const recentActivities = useMemo(() => 
    dashboardData?.recentActivities || [], 
    [dashboardData?.recentActivities]
  );
  const personalStats = useMemo(() => 
    dashboardData?.personalStats || userStats || null, 
    [dashboardData?.personalStats, userStats]
  );
  const teamLeaderboards = useMemo(() => 
    dashboardData?.teamLeaderboards || [], 
    [dashboardData?.teamLeaderboards]
  );

  // Chart data with fallback to mock data during loading
  const chartData = useMemo(() => ({
    dailyProgress: dailyProgressData || generateDailyProgressData(),
    weeklyProgress: weeklyProgressData || generateWeeklyProgressData(),
    activityBreakdown: activityBreakdownData || generateActivityBreakdownData(),
  }), [dailyProgressData, weeklyProgressData, activityBreakdownData]);

  // Include all loading states
  const isChartDataLoading = dailyLoading || weeklyLoading || breakdownLoading;
  const isAdditionalDataLoading = statsLoading || teamsLoading;

  return {
    // Raw data
    dashboardData,
    loading: loading || isChartDataLoading || isAdditionalDataLoading,
    error,
    refresh,
    
    // Transformed data
    teams,
    recentActivities,
    personalStats,
    teamLeaderboards,
    chartData,
    
    // Individual data from React Query hooks
    userStats,
    userTeams,
    
    // Loading state breakdowns
    dashboardLoading: loading,
    chartLoading: isChartDataLoading,
    additionalDataLoading: isAdditionalDataLoading,
  };
}