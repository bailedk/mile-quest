/**
 * Custom hook for dashboard data management and transformations
 */

import { useMemo } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
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
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    onError: (error) => {
      console.error('Dashboard error:', error);
    },
  });

  // Memoized data transformations
  const teams = useMemo(() => dashboardData?.teams || [], [dashboardData?.teams]);
  const recentActivities = useMemo(() => dashboardData?.recentActivities || [], [dashboardData?.recentActivities]);
  const personalStats = useMemo(() => dashboardData?.personalStats || null, [dashboardData?.personalStats]);
  const teamLeaderboards = useMemo(() => dashboardData?.teamLeaderboards || [], [dashboardData?.teamLeaderboards]);

  // Chart data generation (would normally come from API)
  const chartData = useMemo(() => ({
    dailyProgress: generateDailyProgressData(),
    weeklyProgress: generateWeeklyProgressData(),
    activityBreakdown: generateActivityBreakdownData(),
  }), []);

  return {
    // Raw data
    dashboardData,
    loading,
    error,
    refresh,
    
    // Transformed data
    teams,
    recentActivities,
    personalStats,
    teamLeaderboards,
    chartData,
  };
}