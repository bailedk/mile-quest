import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './useWebSocket';
import { ActivityListItem } from '@/types/activity.types';
import { WebSocketConnectionState } from '@/services/websocket';

export interface RealtimeActivityUpdate {
  type: 'activity:created' | 'activity:updated' | 'activity:deleted';
  data: ActivityListItem;
  teamId: string;
  timestamp: number;
}

export interface UseRealtimeActivitiesOptions {
  onActivity?: (update: RealtimeActivityUpdate) => void;
  onError?: (error: Error) => void;
  enableLogging?: boolean;
}

export function useRealtimeActivities(
  teamId: string | null,
  options: UseRealtimeActivitiesOptions = {}
) {
  const { onActivity, onError, enableLogging = false } = options;
  const queryClient = useQueryClient();
  const { service, isConnected, connectionState, error } = useWebSocket({
    autoConnect: true,
    reconnectOnAuthChange: true,
  });
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastTeamIdRef = useRef<string | null>(null);

  const log = useCallback((message: string, data?: any) => {
    if (enableLogging) {
      console.log(`[RealtimeActivities] ${message}`, data);
    }
  }, [enableLogging]);

  const handleActivityUpdate = useCallback((message: any) => {
    const { event, data, timestamp } = message;
    
    if (!teamId) return;

    log('Received activity update', { event, data, timestamp });

    const update: RealtimeActivityUpdate = {
      type: event,
      data,
      teamId,
      timestamp: timestamp || Date.now(),
    };

    // Call custom handler if provided
    if (onActivity) {
      try {
        onActivity(update);
      } catch (error) {
        console.error('Error in activity update handler:', error);
      }
    }

    // Update query cache based on event type
    switch (event) {
      case 'activity:created':
        log('Adding new activity to cache', data);
        // Add new activity to the list
        queryClient.setQueryData(
          ['activities', 'team', teamId],
          (oldData: ActivityListItem[] | undefined) => {
            if (!oldData) return [data];
            // Avoid duplicates by checking if activity already exists
            const exists = oldData.some(activity => activity.id === data.id);
            if (exists) return oldData;
            return [data, ...oldData];
          }
        );
        
        // Invalidate related queries to refresh aggregated data
        queryClient.invalidateQueries({ queryKey: ['stats', 'team', teamId] });
        queryClient.invalidateQueries({ queryKey: ['goal-progress', teamId] });
        queryClient.invalidateQueries({ queryKey: ['leaderboard', teamId] });
        break;

      case 'activity:updated':
        log('Updating activity in cache', data);
        // Update activity in the list
        queryClient.setQueryData(
          ['activities', 'team', teamId],
          (oldData: ActivityListItem[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.map(activity => 
              activity.id === data.id ? { ...activity, ...data } : activity
            );
          }
        );
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['stats', 'team', teamId] });
        queryClient.invalidateQueries({ queryKey: ['goal-progress', teamId] });
        queryClient.invalidateQueries({ queryKey: ['leaderboard', teamId] });
        break;

      case 'activity:deleted':
        log('Removing activity from cache', data);
        // Remove activity from the list
        queryClient.setQueryData(
          ['activities', 'team', teamId],
          (oldData: ActivityListItem[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.filter(activity => activity.id !== data.id);
          }
        );
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['stats', 'team', teamId] });
        queryClient.invalidateQueries({ queryKey: ['goal-progress', teamId] });
        queryClient.invalidateQueries({ queryKey: ['leaderboard', teamId] });
        break;

      default:
        log('Unknown activity event type', event);
    }
  }, [teamId, queryClient, onActivity, log]);

  const subscribeToTeam = useCallback((currentTeamId: string) => {
    if (!service || !isConnected) {
      log('Cannot subscribe: service not available or not connected');
      return;
    }

    try {
      const channelName = `team-${currentTeamId}`;
      log('Subscribing to team channel', channelName);
      
      const unsubscribe = service.subscribe(channelName, handleActivityUpdate);
      unsubscribeRef.current = unsubscribe;
      
      log('Successfully subscribed to team channel', channelName);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Subscription failed');
      console.error('Failed to subscribe to team channel:', err);
      if (onError) {
        onError(err);
      }
    }
  }, [service, isConnected, handleActivityUpdate, onError, log]);

  const unsubscribeFromTeam = useCallback(() => {
    if (unsubscribeRef.current) {
      log('Unsubscribing from team channel');
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, [log]);

  // Handle team changes and connection state
  useEffect(() => {
    const currentTeamId = teamId;
    const lastTeamId = lastTeamIdRef.current;

    // If team changed, unsubscribe from old team
    if (lastTeamId && lastTeamId !== currentTeamId) {
      unsubscribeFromTeam();
    }

    // Subscribe to new team if connected and team exists
    if (currentTeamId && isConnected && connectionState === WebSocketConnectionState.CONNECTED) {
      subscribeToTeam(currentTeamId);
    }

    lastTeamIdRef.current = currentTeamId;

    // Cleanup on unmount or team change
    return () => {
      if (currentTeamId !== teamId) {
        unsubscribeFromTeam();
      }
    };
  }, [teamId, isConnected, connectionState, subscribeToTeam, unsubscribeFromTeam]);

  // Handle WebSocket errors
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeFromTeam();
    };
  }, [unsubscribeFromTeam]);

  return {
    isConnected,
    connectionState,
    error,
    teamId,
  };
}