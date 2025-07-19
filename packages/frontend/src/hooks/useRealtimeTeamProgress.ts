import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createWebSocketService, WebSocketService, WebSocketConnectionState } from '@/services/websocket';
import { useAuth } from './useAuth';

interface ProgressUpdateData {
  teamGoalId: string;
  totalDistance: number;
  percentComplete: number;
  estimatedCompletionDate: string | null;
  isOnTrack: boolean;
  lastActivityAt: string;
  topContributors: Array<{
    userId: string;
    name: string;
    distance: number;
  }>;
}

interface MilestoneData {
  type: string;
  value: number;
  message: string;
  teamGoalId: string;
  goalName: string;
}

interface ActivityAddedData {
  user: {
    id: string;
    name: string;
  };
  activity: {
    distance: number;
    duration: number;
  };
  progress: {
    newTotalDistance: number;
    newPercentComplete: number;
    distanceAdded: number;
  };
  timestamp: string;
}

interface GoalCompletionData {
  teamGoalId: string;
  goalName: string;
  totalDistance: number;
  totalDuration: number;
  totalActivities: number;
  participantCount: number;
  completionTime: string;
  topContributors: Array<{
    userId: string;
    name: string;
    distance: number;
  }>;
  celebrationType: string;
}

interface RealtimeTeamProgressHookOptions {
  onProgressUpdate?: (data: ProgressUpdateData) => void;
  onMilestoneReached?: (data: MilestoneData) => void;
  onActivityAdded?: (data: ActivityAddedData) => void;
  onGoalCompleted?: (data: GoalCompletionData) => void;
  onConnectionStateChange?: (state: WebSocketConnectionState) => void;
  onError?: (error: Error) => void;
}

export function useRealtimeTeamProgress(
  teamId: string | null,
  options: RealtimeTeamProgressHookOptions = {}
) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const wsRef = useRef<WebSocketService | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const connectionStateRef = useRef<WebSocketConnectionState>(WebSocketConnectionState.DISCONNECTED);

  const {
    onProgressUpdate,
    onMilestoneReached,
    onActivityAdded,
    onGoalCompleted,
    onConnectionStateChange,
    onError
  } = options;

  // Handle progress updates
  const handleProgressUpdate = useCallback((data: ProgressUpdateData) => {
    // Update React Query cache for team progress
    queryClient.setQueryData(
      ['team-progress', teamId],
      (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          totalDistance: data.totalDistance,
          percentComplete: data.percentComplete,
          estimatedCompletionDate: data.estimatedCompletionDate,
          isOnTrack: data.isOnTrack,
          lastActivityAt: data.lastActivityAt,
          topContributors: data.topContributors,
        };
      }
    );

    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: ['goal-progress', teamId] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats', teamId] });
    
    onProgressUpdate?.(data);
  }, [queryClient, teamId, onProgressUpdate]);

  // Handle milestone reached
  const handleMilestoneReached = useCallback((data: MilestoneData) => {
    // Show milestone notification and invalidate achievements
    queryClient.invalidateQueries({ queryKey: ['achievements', teamId] });
    queryClient.invalidateQueries({ queryKey: ['milestones', teamId] });
    
    onMilestoneReached?.(data);
  }, [queryClient, teamId, onMilestoneReached]);

  // Handle activity added
  const handleActivityAdded = useCallback((data: ActivityAddedData) => {
    // Update activity feed
    queryClient.setQueryData(
      ['activities', 'team', teamId],
      (oldData: any[] | undefined) => {
        if (!oldData) return oldData;
        
        // Add the new activity to the beginning of the list
        const newActivity = {
          id: `temp-${Date.now()}`, // Temporary ID until real activity loads
          userId: data.user.id,
          userName: data.user.name,
          distance: data.activity.distance,
          duration: data.activity.duration,
          startTime: data.timestamp,
          isPrivate: false, // Real-time activities are typically public
          team: { name: 'Current Team' }, // Will be replaced by proper data
        };
        
        return [newActivity, ...oldData];
      }
    );

    // Update progress data
    queryClient.invalidateQueries({ queryKey: ['team-progress', teamId] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats', teamId] });
    
    onActivityAdded?.(data);
  }, [queryClient, teamId, onActivityAdded]);

  // Handle goal completion
  const handleGoalCompleted = useCallback((data: GoalCompletionData) => {
    // Invalidate all related queries to refresh the UI
    queryClient.invalidateQueries({ queryKey: ['team-progress', teamId] });
    queryClient.invalidateQueries({ queryKey: ['goal-progress', teamId] });
    queryClient.invalidateQueries({ queryKey: ['achievements', teamId] });
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    
    onGoalCompleted?.(data);
  }, [queryClient, teamId, onGoalCompleted]);

  // Handle connection state changes
  const handleConnectionStateChange = useCallback((state: WebSocketConnectionState) => {
    connectionStateRef.current = state;
    onConnectionStateChange?.(state);
  }, [onConnectionStateChange]);

  // Handle errors
  const handleError = useCallback((error: Error) => {
    console.error('WebSocket error in team progress:', error);
    onError?.(error);
  }, [onError]);

  // Setup WebSocket connection and subscriptions
  useEffect(() => {
    if (!teamId || !user) return;

    const setupWebSocket = async () => {
      try {
        // Create WebSocket service if not exists
        if (!wsRef.current) {
          wsRef.current = createWebSocketService();
          
          // Setup connection state monitoring
          wsRef.current.onConnectionStateChange(handleConnectionStateChange);
          wsRef.current.onError(handleError);
          
          await wsRef.current.connect();
        }

        // Subscribe to team progress channel
        const channelName = `private-team-${teamId}`;
        unsubscribeRef.current = wsRef.current.subscribe(channelName, (message) => {
          const { event, data } = message;

          switch (event) {
            case 'progress-update':
              handleProgressUpdate(data);
              break;

            case 'milestone-reached':
              handleMilestoneReached(data);
              break;

            case 'activity-added':
              handleActivityAdded(data);
              break;

            case 'goal-completed':
              handleGoalCompleted(data);
              break;

            case 'daily-summary':
              // Refresh dashboard stats for daily summary
              queryClient.invalidateQueries({ queryKey: ['dashboard-stats', teamId] });
              break;

            case 'team-encouragement':
              // Could trigger notification banner or modal
              console.log('Team encouragement:', data);
              break;

            default:
              console.log('Unknown team progress event:', event, data);
          }
        });
      } catch (error) {
        console.error('Failed to setup team progress WebSocket:', error);
        handleError(error as Error);
      }
    };

    setupWebSocket();

    // Cleanup function
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [teamId, user, handleProgressUpdate, handleMilestoneReached, handleActivityAdded, handleGoalCompleted, handleConnectionStateChange, handleError, queryClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, []);

  return {
    connectionState: connectionStateRef.current,
    isConnected: connectionStateRef.current === WebSocketConnectionState.CONNECTED,
    isReconnecting: connectionStateRef.current === WebSocketConnectionState.RECONNECTING,
    disconnect: () => wsRef.current?.disconnect(),
    reconnect: () => wsRef.current?.connect(),
  };
}