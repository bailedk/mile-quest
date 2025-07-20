/**
 * Custom hook for dashboard callback handlers
 */

import { useCallback } from 'react';
import type { Achievement } from '@/hooks/useRealtimeUpdates';

interface UseDashboardCallbacksProps {
  refresh: () => Promise<void>;
  connect: () => Promise<void>;
  isConnected: boolean;
  error: Error | null;
  setAchievements: React.Dispatch<React.SetStateAction<Achievement[]>>;
}

export function useDashboardCallbacks({
  refresh,
  connect,
  isConnected,
  error,
  setAchievements,
}: UseDashboardCallbacksProps) {
  
  // Handle activity updates from real-time subscription
  const handleActivityUpdate = useCallback((update: any) => {
    console.log('Real-time activity update:', update);
    // Future: Update local state with new activity
  }, []);

  // Handle activity errors
  const handleActivityError = useCallback((error: Error) => {
    console.error('Real-time activity error:', error);
  }, []);

  // Handle achievement notifications
  const handleAchievement = useCallback((achievement: Achievement) => {
    setAchievements(prev => [...prev, achievement]);
  }, [setAchievements]);

  // Handle real-time errors
  const handleRealtimeError = useCallback((error: Error) => {
    console.error('Real-time connection error:', error);
  }, []);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    try {
      // Refresh dashboard data
      await refresh();
      
      // Try to reconnect WebSocket if disconnected
      if (!isConnected && error) {
        try {
          await connect();
        } catch (err) {
          console.error('Failed to reconnect during refresh:', err);
        }
      }
    } catch (err) {
      console.error('Failed to refresh dashboard:', err);
    }
  }, [refresh, connect, isConnected, error]);

  // Handle achievement dismissal
  const handleAchievementDismiss = useCallback((achievementId: string) => {
    setAchievements(prev => prev.filter(a => a.id !== achievementId));
  }, [setAchievements]);

  // Handle connection retry
  const handleConnectionRetry = useCallback(async () => {
    try {
      await connect();
    } catch (err) {
      console.error('Manual connection retry failed:', err);
    }
  }, [connect]);

  return {
    handleActivityUpdate,
    handleActivityError,
    handleAchievement,
    handleRealtimeError,
    handleRefresh,
    handleAchievementDismiss,
    handleConnectionRetry,
  };
}