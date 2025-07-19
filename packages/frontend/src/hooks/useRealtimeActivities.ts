import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createWebSocketService, WebSocketService } from '@/services/websocket';
import { ActivityListItem } from '@/types/activity.types';

export function useRealtimeActivities(teamId: string | null) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocketService | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!teamId) return;

    const setupWebSocket = async () => {
      try {
        // Create WebSocket service if not exists
        if (!wsRef.current) {
          wsRef.current = createWebSocketService();
          await wsRef.current.connect();
        }

        // Subscribe to team channel
        const channelName = `team-${teamId}`;
        unsubscribeRef.current = wsRef.current.subscribe(channelName, (message) => {
          const { event, data } = message;

          switch (event) {
            case 'activity:created':
              // Add new activity to the list
              queryClient.setQueryData(
                ['activities', 'team', teamId],
                (oldData: ActivityListItem[] | undefined) => {
                  if (!oldData) return [data];
                  return [data, ...oldData];
                }
              );
              
              // Invalidate stats to refresh
              queryClient.invalidateQueries({ queryKey: ['stats', 'team', teamId] });
              queryClient.invalidateQueries({ queryKey: ['goal-progress', teamId] });
              break;

            case 'activity:updated':
              // Update activity in the list
              queryClient.setQueryData(
                ['activities', 'team', teamId],
                (oldData: ActivityListItem[] | undefined) => {
                  if (!oldData) return oldData;
                  return oldData.map(activity => 
                    activity.id === data.id ? data : activity
                  );
                }
              );
              break;

            case 'activity:deleted':
              // Remove activity from the list
              queryClient.setQueryData(
                ['activities', 'team', teamId],
                (oldData: ActivityListItem[] | undefined) => {
                  if (!oldData) return oldData;
                  return oldData.filter(activity => activity.id !== data.id);
                }
              );
              
              // Invalidate stats to refresh
              queryClient.invalidateQueries({ queryKey: ['stats', 'team', teamId] });
              queryClient.invalidateQueries({ queryKey: ['goal-progress', teamId] });
              break;
          }
        });
      } catch (error) {
        console.error('Failed to setup WebSocket:', error);
      }
    };

    setupWebSocket();

    // Cleanup
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [teamId, queryClient]);

  // Disconnect on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, []);
}