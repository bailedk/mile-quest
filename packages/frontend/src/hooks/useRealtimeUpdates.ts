import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './useWebSocket';
import { WebSocketConnectionState } from '@/services/websocket';

export interface RealtimeUpdate {
  type: string;
  data: any;
  channel: string;
  timestamp: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon?: string;
  earnedAt: string;
  userId: string;
  teamId?: string;
}

export interface UseRealtimeUpdatesOptions {
  channels: string[];
  onUpdate?: (update: RealtimeUpdate) => void;
  onAchievement?: (achievement: Achievement) => void;
  onError?: (error: Error) => void;
  enableLogging?: boolean;
}

export function useRealtimeUpdates(options: UseRealtimeUpdatesOptions) {
  const { channels, onUpdate, onAchievement, onError, enableLogging = false } = options;
  const queryClient = useQueryClient();
  const { service, isConnected, connectionState, error } = useWebSocket({
    autoConnect: true,
    reconnectOnAuthChange: true,
  });
  
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());
  const lastChannelsRef = useRef<string[]>([]);

  const log = useCallback((message: string, data?: any) => {
    if (enableLogging) {
      console.log(`[RealtimeUpdates] ${message}`, data);
    }
  }, [enableLogging]);

  const handleMessage = useCallback((channel: string) => (message: any) => {
    const { event, data, timestamp } = message;
    
    log('Received message', { channel, event, data, timestamp });

    const update: RealtimeUpdate = {
      type: event,
      data,
      channel,
      timestamp: timestamp || Date.now(),
    };

    // Call custom handler if provided
    if (onUpdate) {
      try {
        onUpdate(update);
      } catch (error) {
        console.error('Error in update handler:', error);
      }
    }

    // Handle specific event types
    switch (event) {
      case 'achievement:earned':
        if (onAchievement && data) {
          try {
            onAchievement(data);
          } catch (error) {
            console.error('Error in achievement handler:', error);
          }
        }
        // Invalidate achievements query
        queryClient.invalidateQueries({ queryKey: ['achievements'] });
        break;

      case 'team:updated':
        // Invalidate team-related queries
        queryClient.invalidateQueries({ queryKey: ['teams'] });
        if (data?.teamId) {
          queryClient.invalidateQueries({ queryKey: ['team', data.teamId] });
        }
        break;

      case 'goal:updated':
        // Invalidate goal-related queries
        if (data?.teamId) {
          queryClient.invalidateQueries({ queryKey: ['goal-progress', data.teamId] });
          queryClient.invalidateQueries({ queryKey: ['team', data.teamId] });
        }
        break;

      case 'leaderboard:updated':
        // Invalidate leaderboard queries
        if (data?.teamId) {
          queryClient.invalidateQueries({ queryKey: ['leaderboard', data.teamId] });
        }
        break;

      case 'stats:updated':
        // Invalidate stats queries
        if (data?.teamId) {
          queryClient.invalidateQueries({ queryKey: ['stats', 'team', data.teamId] });
        }
        if (data?.userId) {
          queryClient.invalidateQueries({ queryKey: ['stats', 'user', data.userId] });
        }
        break;

      default:
        log('Unhandled event type', event);
    }
  }, [queryClient, onUpdate, onAchievement, log]);

  const subscribeToChannel = useCallback((channel: string) => {
    if (!service || !isConnected) {
      log('Cannot subscribe: service not available or not connected');
      return;
    }

    try {
      log('Subscribing to channel', channel);
      const unsubscribe = service.subscribe(channel, handleMessage(channel));
      subscriptionsRef.current.set(channel, unsubscribe);
      log('Successfully subscribed to channel', channel);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Subscription failed');
      console.error(`Failed to subscribe to channel ${channel}:`, err);
      if (onError) {
        onError(err);
      }
    }
  }, [service, isConnected, handleMessage, onError, log]);

  const unsubscribeFromChannel = useCallback((channel: string) => {
    const unsubscribe = subscriptionsRef.current.get(channel);
    if (unsubscribe) {
      log('Unsubscribing from channel', channel);
      unsubscribe();
      subscriptionsRef.current.delete(channel);
    }
  }, [log]);

  const unsubscribeFromAllChannels = useCallback(() => {
    log('Unsubscribing from all channels');
    subscriptionsRef.current.forEach((unsubscribe, channel) => {
      log('Unsubscribing from channel', channel);
      unsubscribe();
    });
    subscriptionsRef.current.clear();
  }, [log]);

  // Handle channel changes and connection state
  useEffect(() => {
    const currentChannels = [...channels];
    const lastChannels = lastChannelsRef.current;

    // Find channels to remove (in lastChannels but not in currentChannels)
    const channelsToRemove = lastChannels.filter(channel => !currentChannels.includes(channel));
    channelsToRemove.forEach(channel => unsubscribeFromChannel(channel));

    // Find channels to add (in currentChannels but not in lastChannels)
    const channelsToAdd = currentChannels.filter(channel => !lastChannels.includes(channel));

    // Subscribe to new channels if connected
    if (isConnected && connectionState === WebSocketConnectionState.CONNECTED) {
      channelsToAdd.forEach(channel => subscribeToChannel(channel));
    }

    lastChannelsRef.current = currentChannels;

    // Resubscribe to all channels when connection is established
    if (isConnected && connectionState === WebSocketConnectionState.CONNECTED) {
      // Check if any channels are not subscribed
      const unsubscribedChannels = currentChannels.filter(
        channel => !subscriptionsRef.current.has(channel)
      );
      unsubscribedChannels.forEach(channel => subscribeToChannel(channel));
    }

    // Cleanup on unmount or channel change
    return () => {
      // Only unsubscribe from removed channels
      channelsToRemove.forEach(channel => unsubscribeFromChannel(channel));
    };
  }, [channels, isConnected, connectionState, subscribeToChannel, unsubscribeFromChannel]);

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

  return {
    isConnected,
    connectionState,
    error,
    subscribedChannels: Array.from(subscriptionsRef.current.keys()),
  };
}