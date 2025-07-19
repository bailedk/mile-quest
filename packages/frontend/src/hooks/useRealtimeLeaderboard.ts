import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './useWebSocket';
import { WebSocketConnectionState } from '@/services/websocket';

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  totalDistance: number;
  totalDuration: number;
  activityCount: number;
  rank: number;
  change?: 'up' | 'down' | 'same' | 'new';
}

export interface LeaderboardUpdate {
  type: 'ranking_change' | 'new_entry' | 'updated_stats';
  entries: LeaderboardEntry[];
  timestamp: number;
  changedUserId?: string;
}

export interface UseRealtimeLeaderboardOptions {
  onLeaderboardUpdate?: (update: LeaderboardUpdate) => void;
  onError?: (error: Error) => void;
  enableLogging?: boolean;
  refreshInterval?: number; // Optional periodic refresh in ms
}

export function useRealtimeLeaderboard(
  teamId: string | null,
  options: UseRealtimeLeaderboardOptions = {}
) {
  const {
    onLeaderboardUpdate,
    onError,
    enableLogging = false,
    refreshInterval,
  } = options;

  const queryClient = useQueryClient();
  const { service, isConnected, connectionState, error } = useWebSocket({
    autoConnect: true,
    reconnectOnAuthChange: true,
  });

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastTeamIdRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const log = useCallback((message: string, data?: any) => {
    if (enableLogging) {
      console.log(`[RealtimeLeaderboard] ${message}`, data);
    }
  }, [enableLogging]);

  // Handle leaderboard updates
  const handleLeaderboardUpdate = useCallback((message: any) => {
    const { event, data, timestamp } = message;

    if (!teamId) return;

    log('Received leaderboard update', { event, data, timestamp });

    let updateType: LeaderboardUpdate['type'] = 'updated_stats';
    let changedUserId: string | undefined;

    switch (event) {
      case 'leaderboard:ranking_change':
        updateType = 'ranking_change';
        changedUserId = data.changedUserId;
        break;
      case 'leaderboard:new_entry':
        updateType = 'new_entry';
        changedUserId = data.newUserId;
        break;
      case 'leaderboard:stats_update':
      default:
        updateType = 'updated_stats';
        changedUserId = data.updatedUserId;
        break;
    }

    const update: LeaderboardUpdate = {
      type: updateType,
      entries: data.entries || data.leaderboard || [],
      timestamp: timestamp || Date.now(),
      changedUserId,
    };

    // Call custom handler if provided
    if (onLeaderboardUpdate) {
      try {
        onLeaderboardUpdate(update);
      } catch (error) {
        console.error('Error in leaderboard update handler:', error);
      }
    }

    // Update React Query cache
    const queryKey = ['leaderboard', teamId];
    
    queryClient.setQueryData(queryKey, (oldData: LeaderboardEntry[] | undefined) => {
      if (!oldData || !update.entries.length) {
        return update.entries;
      }

      // For efficiency, replace the entire leaderboard data
      // but preserve any client-side annotations if needed
      return update.entries.map((entry, index) => ({
        ...entry,
        rank: index + 1, // Ensure ranks are sequential
      }));
    });

    // Also invalidate to ensure data freshness
    queryClient.invalidateQueries({ 
      queryKey: ['leaderboard', teamId],
      exact: false,
    });

    log('Updated leaderboard cache', { updateType, entriesCount: update.entries.length });
  }, [teamId, queryClient, onLeaderboardUpdate, log]);

  // Subscribe to leaderboard updates
  const subscribeToLeaderboard = useCallback((currentTeamId: string) => {
    if (!service || !isConnected) {
      log('Cannot subscribe: service not available or not connected');
      return;
    }

    try {
      // Subscribe to global leaderboard and team-specific updates
      const globalChannelName = `leaderboard-global`;
      const teamChannelName = `leaderboard-team-${currentTeamId}`;
      
      log('Subscribing to leaderboard channels', { globalChannelName, teamChannelName });

      // Subscribe to both channels - global for overall rankings, team for team-specific updates
      const globalUnsubscribe = service.subscribe(globalChannelName, handleLeaderboardUpdate);
      const teamUnsubscribe = service.subscribe(teamChannelName, handleLeaderboardUpdate);

      // Combine unsubscribe functions
      unsubscribeRef.current = () => {
        globalUnsubscribe();
        teamUnsubscribe();
      };

      log('Successfully subscribed to leaderboard channels');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Leaderboard subscription failed');
      console.error('Failed to subscribe to leaderboard channels:', err);
      if (onError) {
        onError(err);
      }
    }
  }, [service, isConnected, handleLeaderboardUpdate, onError, log]);

  // Unsubscribe from leaderboard updates
  const unsubscribeFromLeaderboard = useCallback(() => {
    if (unsubscribeRef.current) {
      log('Unsubscribing from leaderboard channels');
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, [log]);

  // Set up periodic refresh if enabled
  const setupPeriodicRefresh = useCallback(() => {
    if (refreshInterval && refreshInterval > 0 && teamId) {
      refreshTimerRef.current = setInterval(() => {
        log('Periodic leaderboard refresh');
        queryClient.invalidateQueries({ 
          queryKey: ['leaderboard', teamId],
          exact: false,
        });
      }, refreshInterval);
    }
  }, [refreshInterval, teamId, queryClient, log]);

  const clearPeriodicRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // Handle team changes and connection state
  useEffect(() => {
    const currentTeamId = teamId;
    const lastTeamId = lastTeamIdRef.current;

    // If team changed, unsubscribe from old team
    if (lastTeamId && lastTeamId !== currentTeamId) {
      unsubscribeFromLeaderboard();
      clearPeriodicRefresh();
    }

    // Subscribe to new team if connected and team exists
    if (currentTeamId && isConnected && connectionState === WebSocketConnectionState.CONNECTED) {
      subscribeToLeaderboard(currentTeamId);
      setupPeriodicRefresh();
    }

    lastTeamIdRef.current = currentTeamId;

    // Cleanup on unmount or team change
    return () => {
      if (currentTeamId !== teamId) {
        unsubscribeFromLeaderboard();
        clearPeriodicRefresh();
      }
    };
  }, [
    teamId,
    isConnected,
    connectionState,
    subscribeToLeaderboard,
    unsubscribeFromLeaderboard,
    setupPeriodicRefresh,
    clearPeriodicRefresh,
  ]);

  // Handle WebSocket errors
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeFromLeaderboard();
      clearPeriodicRefresh();
    };
  }, [unsubscribeFromLeaderboard, clearPeriodicRefresh]);

  return {
    isConnected,
    connectionState,
    error,
    teamId,
    // Helper function to manually refresh leaderboard
    refreshLeaderboard: () => {
      if (teamId) {
        queryClient.invalidateQueries({ 
          queryKey: ['leaderboard', teamId],
          exact: false,
        });
      }
    },
  };
}