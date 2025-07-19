import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { dashboardService } from '@/services/dashboard.service';
import { LeaderboardData, LeaderboardMember } from './LiveLeaderboard';

export interface PositionChange {
  userId: string;
  userName: string;
  oldPosition: number;
  newPosition: number;
  direction: 'up' | 'down' | 'same';
  timestamp: Date;
}

export interface UseLiveLeaderboardOptions {
  view?: 'team' | 'individual' | 'goals';
  timePeriod?: 'daily' | 'weekly' | 'monthly' | 'all-time';
  maxEntries?: number;
  autoRefreshInterval?: number;
  enablePositionTracking?: boolean;
  onPositionChange?: (userId: string, change: PositionChange) => void;
  onError?: (error: Error) => void;
}

export interface LiveLeaderboardUpdate {
  type: 'full_update' | 'position_change' | 'stats_update' | 'new_member';
  data: {
    leaderboard?: LeaderboardData;
    userId?: string;
    newStats?: Partial<LeaderboardMember>;
    positionChange?: PositionChange;
  };
  timestamp: Date;
}

export function useLiveLeaderboard(
  teamId: string | null,
  options: UseLiveLeaderboardOptions = {}
) {
  const {
    view = 'team',
    timePeriod = 'all-time',
    maxEntries = 10,
    autoRefreshInterval = 30000,
    enablePositionTracking = true,
    onPositionChange,
    onError,
  } = options;

  const [positionChanges, setPositionChanges] = useState<PositionChange[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const previousDataRef = useRef<LeaderboardData | null>(null);
  const subscriptionRef = useRef<(() => void) | null>(null);
  const queryClient = useQueryClient();
  
  const { isConnected, service } = useWebSocketContext();

  // Query key based on filters
  const queryKey = [
    'live-leaderboard',
    teamId,
    view,
    timePeriod,
    maxEntries,
  ];

  // Fetch leaderboard data
  const {
    data: leaderboardData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!teamId) return null;
      
      // For MVP, we'll use dashboard service and transform the data
      // In production, this would call a dedicated leaderboard API
      const dashboardData = await dashboardService.getDashboardData();
      
      return transformDashboardToLeaderboard(dashboardData, {
        view,
        timePeriod,
        maxEntries,
      });
    },
    enabled: !!teamId,
    staleTime: autoRefreshInterval / 2, // Consider data stale at half refresh interval
    refetchInterval: autoRefreshInterval,
    onError: (err) => {
      console.error('Leaderboard query error:', err);
      if (onError) {
        onError(err instanceof Error ? err : new Error('Leaderboard fetch failed'));
      }
    },
  });

  // Transform dashboard data to leaderboard format
  const transformDashboardToLeaderboard = useCallback((
    dashboardData: any,
    filters: { view: string; timePeriod: string; maxEntries: number }
  ): LeaderboardData => {
    const { teamLeaderboards } = dashboardData;
    
    // Find current team's leaderboard
    const teamLeaderboard = teamLeaderboards?.find((lb: any) => 
      lb.teamId === teamId
    );

    if (!teamLeaderboard) {
      return {
        team: [],
        individual: [],
        goals: [],
        lastUpdated: new Date(),
      };
    }

    // Transform team members to leaderboard format
    const transformedMembers: LeaderboardMember[] = teamLeaderboard.members.map(
      (member: any, index: number) => ({
        userId: member.userId,
        userName: member.name,
        avatarUrl: member.avatarUrl,
        totalDistance: member.distance || 0,
        totalDuration: 0, // Would need to add to API
        activityCount: 0, // Would need to add to API
        rank: index + 1,
        goalProgress: member.percentage || 0,
        // Add mock recent activity for demo (in production, this comes from API)
        recentActivity: index < 3 ? {
          timestamp: new Date(Date.now() - Math.random() * 60 * 60 * 1000),
          distance: Math.random() * 5,
          type: Math.random() > 0.5 ? 'run' : 'walk',
        } : undefined,
        isOnline: Math.random() > 0.3, // Mock online status
      })
    );

    // Apply time period filtering (in production, this would be handled by API)
    let filteredMembers = transformedMembers;
    if (filters.timePeriod !== 'all-time') {
      // For demo purposes, randomly reduce some distances for time-filtered views
      filteredMembers = transformedMembers.map(member => ({
        ...member,
        totalDistance: member.totalDistance * (0.3 + Math.random() * 0.7),
      }));
    }

    // Sort by distance and update ranks
    filteredMembers.sort((a, b) => b.totalDistance - a.totalDistance);
    filteredMembers.forEach((member, index) => {
      member.rank = index + 1;
    });

    return {
      team: filters.view === 'team' ? filteredMembers : [],
      individual: filters.view === 'individual' ? filteredMembers : [],
      goals: filters.view === 'goals' ? [{
        goalId: '1',
        goalName: 'Team Goal',
        members: filteredMembers,
      }] : [],
      lastUpdated: new Date(),
    };
  }, [teamId]);

  // Track position changes
  const trackPositionChanges = useCallback((
    oldData: LeaderboardData | null,
    newData: LeaderboardData
  ) => {
    if (!enablePositionTracking || !oldData) return;

    const oldPositions = new Map<string, number>();
    const getCurrentViewData = (data: LeaderboardData) => {
      switch (view) {
        case 'individual':
          return data.individual;
        case 'goals':
          return data.goals.flatMap(g => g.members);
        case 'team':
        default:
          return data.team;
      }
    };

    // Map old positions
    getCurrentViewData(oldData).forEach(member => {
      oldPositions.set(member.userId, member.rank);
    });

    // Check for changes in new data
    const changes: PositionChange[] = [];
    getCurrentViewData(newData).forEach(member => {
      const oldPosition = oldPositions.get(member.userId);
      
      if (oldPosition !== undefined && oldPosition !== member.rank) {
        const change: PositionChange = {
          userId: member.userId,
          userName: member.userName,
          oldPosition,
          newPosition: member.rank,
          direction: member.rank < oldPosition ? 'up' : 'down',
          timestamp: new Date(),
        };
        
        changes.push(change);
        
        // Update member's change indicator
        member.change = change.direction;
        
        // Call position change callback
        if (onPositionChange) {
          onPositionChange(member.userId, change);
        }
      }
    });

    if (changes.length > 0) {
      setPositionChanges(prev => [...changes, ...prev].slice(0, 20)); // Keep last 20 changes
    }
  }, [view, enablePositionTracking, onPositionChange]);

  // Handle WebSocket leaderboard updates
  const handleLeaderboardUpdate = useCallback((message: any) => {
    console.log('Received leaderboard update:', message);
    
    const { event, data, timestamp } = message;
    
    if (!leaderboardData) return;

    try {
      let shouldRefetch = false;
      
      switch (event) {
        case 'leaderboard:stats_update':
        case 'leaderboard:ranking_change':
        case 'leaderboard:new_member':
          shouldRefetch = true;
          break;
        default:
          console.log('Unknown leaderboard event:', event);
      }

      if (shouldRefetch) {
        // Invalidate and refetch current query
        queryClient.invalidateQueries({ queryKey });
        setLastUpdate(new Date(timestamp || Date.now()));
      }
    } catch (err) {
      console.error('Error handling leaderboard update:', err);
      if (onError) {
        onError(err instanceof Error ? err : new Error('Failed to handle leaderboard update'));
      }
    }
  }, [leaderboardData, queryClient, queryKey, onError]);

  // Subscribe to WebSocket updates
  useEffect(() => {
    if (!isConnected || !service || !teamId) {
      return;
    }

    try {
      // Subscribe to team-specific leaderboard updates
      const channelName = `leaderboard-team-${teamId}`;
      const unsubscribe = service.subscribe(channelName, handleLeaderboardUpdate);
      
      subscriptionRef.current = unsubscribe;
      
      console.log(`Subscribed to leaderboard updates: ${channelName}`);
      
      return () => {
        if (subscriptionRef.current) {
          subscriptionRef.current();
          subscriptionRef.current = null;
        }
      };
    } catch (err) {
      console.error('Failed to subscribe to leaderboard updates:', err);
      if (onError) {
        onError(err instanceof Error ? err : new Error('WebSocket subscription failed'));
      }
    }
  }, [isConnected, service, teamId, handleLeaderboardUpdate, onError]);

  // Track position changes when data updates
  useEffect(() => {
    if (leaderboardData && previousDataRef.current) {
      trackPositionChanges(previousDataRef.current, leaderboardData);
    }
    previousDataRef.current = leaderboardData;
    
    if (leaderboardData) {
      setLastUpdate(leaderboardData.lastUpdated);
    }
  }, [leaderboardData, trackPositionChanges]);

  // Manual refresh function
  const refreshLeaderboard = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current();
      }
    };
  }, []);

  return {
    data: leaderboardData,
    isLoading,
    error,
    lastUpdate,
    positionChanges,
    refreshLeaderboard,
    isRefreshing,
    isConnected,
    // Helper functions
    clearPositionChanges: () => setPositionChanges([]),
    getRecentChanges: (limit = 5) => positionChanges.slice(0, limit),
  };
}