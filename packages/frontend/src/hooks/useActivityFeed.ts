import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './useWebSocket';
import { ActivityListItem } from '@/types/activity.types';
import { WebSocketConnectionState } from '@/services/websocket';

export interface ActivityFeedItem extends ActivityListItem {
  // Extended with real-time specific fields
  isNew?: boolean;
  highlightUntil?: number;
  userId: string;
  userName: string;
  teamId: string;
  teamName: string;
}

export interface ActivityFeedUpdate {
  type: 'activity:created' | 'activity:updated' | 'activity:deleted' | 'activity:achievement';
  data: ActivityFeedItem;
  timestamp: number;
  source: 'team' | 'global' | 'personal';
}

export interface UseActivityFeedOptions {
  /**
   * Feed types to subscribe to
   * - 'personal': User's own activities across all teams
   * - 'teams': Activities from user's teams
   * - 'global': All public activities (requires permission)
   */
  feedTypes?: ('personal' | 'teams' | 'global')[];
  
  /**
   * Specific team IDs to subscribe to (overrides 'teams' feedType)
   */
  teamIds?: string[];
  
  /**
   * Maximum number of activities to keep in memory
   */
  maxItems?: number;
  
  /**
   * How long to highlight new activities (ms)
   */
  highlightDuration?: number;
  
  /**
   * Filter function for activities
   */
  filter?: (activity: ActivityFeedItem) => boolean;
  
  /**
   * Event handlers
   */
  onActivity?: (update: ActivityFeedUpdate) => void;
  onError?: (error: Error) => void;
  enableLogging?: boolean;
}

export function useActivityFeed(options: UseActivityFeedOptions = {}) {
  const {
    feedTypes = ['teams'],
    teamIds,
    maxItems = 100,
    highlightDuration = 5000,
    filter,
    onActivity,
    onError,
    enableLogging = false
  } = options;
  
  const queryClient = useQueryClient();
  const { service, isConnected, connectionState, error } = useWebSocket({
    autoConnect: true,
    reconnectOnAuthChange: true,
  });
  
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());
  const lastOptionsRef = useRef<string>('');

  const log = useCallback((message: string, data?: any) => {
    if (enableLogging) {
      console.log(`[ActivityFeed] ${message}`, data);
    }
  }, [enableLogging]);

  const addActivity = useCallback((activity: ActivityFeedItem, source: 'team' | 'global' | 'personal') => {
    const now = Date.now();
    const newActivity: ActivityFeedItem = {
      ...activity,
      isNew: true,
      highlightUntil: now + highlightDuration,
    };

    // Apply filter if provided
    if (filter && !filter(newActivity)) {
      log('Activity filtered out', newActivity);
      return;
    }

    setActivities(prev => {
      // Check for duplicates
      const exists = prev.some(a => a.id === activity.id);
      if (exists) {
        log('Duplicate activity, skipping', activity);
        return prev;
      }

      // Add new activity and sort by date (newest first)
      const updated = [newActivity, ...prev]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, maxItems); // Limit to maxItems

      log('Added activity to feed', { activity: newActivity, total: updated.length });
      return updated;
    });

    // Create update object for callback
    const update: ActivityFeedUpdate = {
      type: 'activity:created',
      data: newActivity,
      timestamp: now,
      source,
    };

    if (onActivity) {
      try {
        onActivity(update);
      } catch (error) {
        console.error('Error in activity callback:', error);
      }
    }
  }, [filter, highlightDuration, maxItems, onActivity, log]);

  const updateActivity = useCallback((activity: ActivityFeedItem, source: 'team' | 'global' | 'personal') => {
    setActivities(prev => {
      const index = prev.findIndex(a => a.id === activity.id);
      if (index === -1) {
        log('Activity to update not found, adding instead', activity);
        return prev;
      }

      const updated = [...prev];
      updated[index] = { ...updated[index], ...activity };
      
      log('Updated activity in feed', activity);
      return updated;
    });

    const update: ActivityFeedUpdate = {
      type: 'activity:updated',
      data: activity,
      timestamp: Date.now(),
      source,
    };

    if (onActivity) {
      try {
        onActivity(update);
      } catch (error) {
        console.error('Error in activity callback:', error);
      }
    }
  }, [onActivity, log]);

  const removeActivity = useCallback((activityId: string, source: 'team' | 'global' | 'personal') => {
    let removedActivity: ActivityFeedItem | null = null;
    
    setActivities(prev => {
      const updated = prev.filter(a => {
        if (a.id === activityId) {
          removedActivity = a;
          return false;
        }
        return true;
      });
      
      if (removedActivity) {
        log('Removed activity from feed', removedActivity);
      }
      
      return updated;
    });

    if (removedActivity) {
      const update: ActivityFeedUpdate = {
        type: 'activity:deleted',
        data: removedActivity,
        timestamp: Date.now(),
        source,
      };

      if (onActivity) {
        try {
          onActivity(update);
        } catch (error) {
          console.error('Error in activity callback:', error);
        }
      }
    }
  }, [onActivity, log]);

  const handleFeedMessage = useCallback((channel: string, source: 'team' | 'global' | 'personal') => (message: any) => {
    const { event, data, timestamp } = message;
    
    log('Received feed message', { channel, event, data, timestamp });

    try {
      switch (event) {
        case 'activity:created':
          addActivity(data, source);
          
          // Invalidate related queries
          if (source === 'team' && data.teamId) {
            queryClient.invalidateQueries({ queryKey: ['activities', 'team', data.teamId] });
            queryClient.invalidateQueries({ queryKey: ['stats', 'team', data.teamId] });
            queryClient.invalidateQueries({ queryKey: ['goal-progress', data.teamId] });
            queryClient.invalidateQueries({ queryKey: ['leaderboard', data.teamId] });
          }
          break;

        case 'activity:updated':
          updateActivity(data, source);
          
          // Invalidate related queries
          if (source === 'team' && data.teamId) {
            queryClient.invalidateQueries({ queryKey: ['activities', 'team', data.teamId] });
            queryClient.invalidateQueries({ queryKey: ['stats', 'team', data.teamId] });
            queryClient.invalidateQueries({ queryKey: ['goal-progress', data.teamId] });
            queryClient.invalidateQueries({ queryKey: ['leaderboard', data.teamId] });
          }
          break;

        case 'activity:deleted':
          removeActivity(data.id || data, source);
          
          // Invalidate related queries
          if (source === 'team' && data.teamId) {
            queryClient.invalidateQueries({ queryKey: ['activities', 'team', data.teamId] });
            queryClient.invalidateQueries({ queryKey: ['stats', 'team', data.teamId] });
            queryClient.invalidateQueries({ queryKey: ['goal-progress', data.teamId] });
            queryClient.invalidateQueries({ queryKey: ['leaderboard', data.teamId] });
          }
          break;

        case 'activity:achievement':
          // Special case for achievement-related activities
          if (data.activity) {
            addActivity(data.activity, source);
          }
          
          const achievementUpdate: ActivityFeedUpdate = {
            type: 'activity:achievement',
            data: data.activity || data,
            timestamp: timestamp || Date.now(),
            source,
          };

          if (onActivity) {
            try {
              onActivity(achievementUpdate);
            } catch (error) {
              console.error('Error in achievement callback:', error);
            }
          }
          break;

        default:
          log('Unknown feed event type', event);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Feed message handling failed');
      console.error('Error handling feed message:', err);
      if (onError) {
        onError(err);
      }
    }
  }, [addActivity, updateActivity, removeActivity, queryClient, onActivity, onError, log]);

  const subscribeToChannel = useCallback((channel: string, source: 'team' | 'global' | 'personal') => {
    if (!service || !isConnected) {
      log('Cannot subscribe: service not available or not connected');
      return;
    }

    try {
      log('Subscribing to feed channel', { channel, source });
      const unsubscribe = service.subscribe(channel, handleFeedMessage(channel, source));
      subscriptionsRef.current.set(channel, unsubscribe);
      log('Successfully subscribed to feed channel', channel);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Feed subscription failed');
      console.error(`Failed to subscribe to feed channel ${channel}:`, err);
      if (onError) {
        onError(err);
      }
    }
  }, [service, isConnected, handleFeedMessage, onError, log]);

  const unsubscribeFromChannel = useCallback((channel: string) => {
    const unsubscribe = subscriptionsRef.current.get(channel);
    if (unsubscribe) {
      log('Unsubscribing from feed channel', channel);
      unsubscribe();
      subscriptionsRef.current.delete(channel);
    }
  }, [log]);

  const unsubscribeFromAllChannels = useCallback(() => {
    log('Unsubscribing from all feed channels');
    subscriptionsRef.current.forEach((unsubscribe, channel) => {
      log('Unsubscribing from feed channel', channel);
      unsubscribe();
    });
    subscriptionsRef.current.clear();
  }, [log]);

  // Remove highlight from old activities
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActivities(prev => {
        let hasChanges = false;
        const updated = prev.map(activity => {
          if (activity.isNew && activity.highlightUntil && now > activity.highlightUntil) {
            hasChanges = true;
            return { ...activity, isNew: false, highlightUntil: undefined };
          }
          return activity;
        });
        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle subscription changes
  useEffect(() => {
    const currentOptions = JSON.stringify({ feedTypes, teamIds });
    const lastOptions = lastOptionsRef.current;

    if (currentOptions === lastOptions && isConnected && connectionState === WebSocketConnectionState.CONNECTED) {
      return;
    }

    // Unsubscribe from all current channels
    unsubscribeFromAllChannels();

    // Subscribe to new channels if connected
    if (isConnected && connectionState === WebSocketConnectionState.CONNECTED) {
      setIsLoading(true);

      // Subscribe based on feed types
      feedTypes.forEach(feedType => {
        switch (feedType) {
          case 'personal':
            subscribeToChannel('feed-personal', 'personal');
            break;
          case 'teams':
            if (teamIds && teamIds.length > 0) {
              // Subscribe to specific teams
              teamIds.forEach(teamId => {
                subscribeToChannel(`feed-team-${teamId}`, 'team');
              });
            } else {
              // Subscribe to all user's teams
              subscribeToChannel('feed-teams', 'team');
            }
            break;
          case 'global':
            subscribeToChannel('feed-global', 'global');
            break;
        }
      });

      setIsLoading(false);
    }

    lastOptionsRef.current = currentOptions;
  }, [feedTypes, teamIds, isConnected, connectionState, subscribeToChannel, unsubscribeFromAllChannels]);

  // Handle WebSocket errors
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeFromAllChannels();
    };
  }, [unsubscribeFromAllChannels]);

  // Helper functions
  const getNewActivities = useCallback((): ActivityFeedItem[] => {
    return activities.filter(a => a.isNew);
  }, [activities]);

  const getActivitiesByTeam = useCallback((teamId: string): ActivityFeedItem[] => {
    return activities.filter(a => a.teamId === teamId);
  }, [activities]);

  const getActivitiesByUser = useCallback((userId: string): ActivityFeedItem[] => {
    return activities.filter(a => a.userId === userId);
  }, [activities]);

  const clearNewFlags = useCallback(() => {
    setActivities(prev => prev.map(a => ({ ...a, isNew: false, highlightUntil: undefined })));
  }, []);

  const clearFeed = useCallback(() => {
    setActivities([]);
  }, []);

  return {
    // State
    activities,
    isLoading,
    isConnected,
    connectionState,
    error,
    
    // Computed values
    newCount: activities.filter(a => a.isNew).length,
    totalCount: activities.length,
    
    // Helper functions
    getNewActivities,
    getActivitiesByTeam,
    getActivitiesByUser,
    clearNewFlags,
    clearFeed,
    
    // Current config
    feedTypes,
    teamIds,
    subscribedChannels: Array.from(subscriptionsRef.current.keys()),
  };
}