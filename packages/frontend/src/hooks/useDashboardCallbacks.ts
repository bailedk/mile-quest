/**
 * Custom hook for dashboard callback handlers
 */

import { useCallback } from 'react';

interface UseDashboardCallbacksProps {
  refresh: () => Promise<void>;
}

export function useDashboardCallbacks({
  refresh,
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

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    try {
      await refresh();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [refresh]);

  return {
    handleActivityUpdate,
    handleActivityError,
    handleRefresh,
  };
}