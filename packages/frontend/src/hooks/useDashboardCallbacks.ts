/**
 * Custom hook for dashboard callback handlers
 */

import { useCallback } from 'react';

// Define Achievement type locally
interface Achievement {
  id: string;
  title: string;
  description: string;
  points: number;
  icon?: string;
}

interface UseDashboardCallbacksProps {
  refresh: () => Promise<void>;
  setAchievements: React.Dispatch<React.SetStateAction<Achievement[]>>;
}

export function useDashboardCallbacks({
  refresh,
  setAchievements,
}: UseDashboardCallbacksProps) {
  
  // Handle activity updates (placeholder for future polling)
  const handleActivityUpdate = useCallback((update: any) => {
    console.log('Activity update:', update);
    // Future: Update local state with new activity
  }, []);

  // Handle activity errors
  const handleActivityError = useCallback((error: Error) => {
    console.error('Activity error:', error);
  }, []);

  // Handle achievement notifications
  const handleAchievement = useCallback((achievement: Achievement) => {
    setAchievements(prev => [...prev, achievement]);
  }, [setAchievements]);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    try {
      await refresh();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [refresh]);

  // Handle achievement dismissal
  const handleAchievementDismiss = useCallback((achievementId: string) => {
    setAchievements(prev => prev.filter(a => a.id !== achievementId));
  }, [setAchievements]);

  return {
    handleActivityUpdate,
    handleActivityError,
    handleAchievement,
    handleRefresh,
    handleAchievementDismiss,
  };
}