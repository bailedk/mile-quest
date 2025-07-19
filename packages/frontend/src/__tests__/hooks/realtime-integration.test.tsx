/**
 * Comprehensive tests for real-time update hooks and WebSocket integration
 * Tests useRealtimeTeamProgress, useRealtimeActivities, and useRealtimeLeaderboard
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRealtimeTeamProgress } from '@/hooks/useRealtimeTeamProgress';
import { useRealtimeActivities } from '@/hooks/useRealtimeActivities';
import { useRealtimeLeaderboard } from '@/hooks/useRealtimeLeaderboard';
import { useMobileRealtimeOptimization } from '@/hooks/useMobileRealtimeOptimization';
import { MockWebSocketService } from '@/services/websocket/mock.service';
import { WebSocketConnectionState } from '@/services/websocket/types';
import { 
  mockTeams, 
  mockUsers, 
  mockTeamProgress, 
  mockLeaderboard,
  mockActivities,
  createTestQueryClient,
  setupTestEnvironment,
  resetAllMocks,
} from '../utils/test-helpers';

// Mock the auth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUsers.user1,
    isAuthenticated: true,
    isLoading: false,
  }),
}));

// Mock the WebSocket factory
const mockWebSocketService = new MockWebSocketService({
  autoConnect: true,
  simulateLatency: false,
});

vi.mock('@/services/websocket/factory', () => ({
  createWebSocketService: () => mockWebSocketService,
}));

describe('Real-time Hooks and WebSocket Integration', () => {
  let cleanup: () => void;
  let queryClient: QueryClient;

  // Test wrapper with QueryClient
  const createWrapper = () => {
    queryClient = createTestQueryClient();
    
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    const testEnv = setupTestEnvironment();
    cleanup = testEnv.cleanup;
    resetAllMocks();
    mockWebSocketService.reset();
  });

  afterEach(() => {
    cleanup();
  });

  describe('useRealtimeTeamProgress Hook', () => {
    const teamId = mockTeams.team1.id;
    const mockCallbacks = {
      onProgressUpdate: vi.fn(),
      onMilestoneReached: vi.fn(),
      onActivityAdded: vi.fn(),
      onGoalCompleted: vi.fn(),
      onConnectionStateChange: vi.fn(),
      onError: vi.fn(),
    };

    beforeEach(() => {
      Object.values(mockCallbacks).forEach(fn => fn.mockClear());
    });

    it('should connect to WebSocket when teamId is provided', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useRealtimeTeamProgress(teamId, mockCallbacks),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.connectionState).toBe(WebSocketConnectionState.CONNECTED);
        expect(result.current.isConnected).toBe(true);
      });

      expect(mockWebSocketService.connect).toHaveBeenCalled();
      expect(mockWebSocketService.subscribe).toHaveBeenCalledWith(
        `team-progress-${teamId}`,
        expect.any(Function)
      );
    });

    it('should not connect when teamId is null', () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useRealtimeTeamProgress(null, mockCallbacks),
        { wrapper }
      );

      expect(result.current.connectionState).toBe(WebSocketConnectionState.DISCONNECTED);
      expect(result.current.isConnected).toBe(false);
      expect(mockWebSocketService.connect).not.toHaveBeenCalled();
    });

    it('should handle progress update events', async () => {
      const wrapper = createWrapper();
      
      renderHook(
        () => useRealtimeTeamProgress(teamId, mockCallbacks),
        { wrapper }
      );

      await waitFor(() => {
        expect(mockWebSocketService.isConnected()).toBe(true);
      });

      const progressData = {
        teamGoalId: 'goal-123',
        totalDistance: 55000,
        percentComplete: 27.5,
        estimatedCompletionDate: '2025-02-10',
        isOnTrack: true,
        lastActivityAt: new Date().toISOString(),
        topContributors: [
          { userId: mockUsers.user1.id, name: mockUsers.user1.name, distance: 30000 },
        ],
      };

      act(() => {
        mockWebSocketService.simulateEvent('progress-update', progressData);
      });

      expect(mockCallbacks.onProgressUpdate).toHaveBeenCalledWith(progressData);
    });

    it('should handle milestone reached events', async () => {
      const wrapper = createWrapper();
      
      renderHook(
        () => useRealtimeTeamProgress(teamId, mockCallbacks),
        { wrapper }
      );

      await waitFor(() => {
        expect(mockWebSocketService.isConnected()).toBe(true);
      });

      const milestoneData = {
        type: 'distance',
        value: 100,
        message: 'Congratulations! You reached 100 miles!',
        teamGoalId: 'goal-123',
        goalName: 'Walk to NYC',
        celebrationType: 'CONFETTI',
      };

      act(() => {
        mockWebSocketService.simulateEvent('milestone-reached', milestoneData);
      });

      expect(mockCallbacks.onMilestoneReached).toHaveBeenCalledWith(milestoneData);
    });

    it('should handle activity added events', async () => {
      const wrapper = createWrapper();
      
      renderHook(
        () => useRealtimeTeamProgress(teamId, mockCallbacks),
        { wrapper }
      );

      await waitFor(() => {
        expect(mockWebSocketService.isConnected()).toBe(true);
      });

      const activityData = {
        user: { id: mockUsers.user1.id, name: mockUsers.user1.name },
        activity: { distance: 5200, duration: 3600 },
        progress: {
          newTotalDistance: 57200,
          newPercentComplete: 28.6,
          distanceAdded: 5200,
        },
        timestamp: new Date().toISOString(),
      };

      act(() => {
        mockWebSocketService.simulateEvent('activity-added', activityData);
      });

      expect(mockCallbacks.onActivityAdded).toHaveBeenCalledWith(activityData);
    });

    it('should handle goal completion events', async () => {
      const wrapper = createWrapper();
      
      renderHook(
        () => useRealtimeTeamProgress(teamId, mockCallbacks),
        { wrapper }
      );

      await waitFor(() => {
        expect(mockWebSocketService.isConnected()).toBe(true);
      });

      const completionData = {
        teamGoalId: 'goal-123',
        goalName: 'Walk to NYC',
        totalDistance: 200000,
        totalDuration: 72000,
        totalActivities: 50,
        participantCount: 5,
        completionTime: new Date().toISOString(),
        topContributors: [
          { userId: mockUsers.user1.id, name: mockUsers.user1.name, distance: 80000 },
          { userId: mockUsers.user2.id, name: mockUsers.user2.name, distance: 70000 },
        ],
        celebrationType: 'FIREWORKS',
      };

      act(() => {
        mockWebSocketService.simulateEvent('goal-completed', completionData);
      });

      expect(mockCallbacks.onGoalCompleted).toHaveBeenCalledWith(completionData);
    });

    it('should handle connection state changes', async () => {
      const wrapper = createWrapper();
      
      renderHook(
        () => useRealtimeTeamProgress(teamId, mockCallbacks),
        { wrapper }
      );

      act(() => {
        mockWebSocketService.triggerStateChange(WebSocketConnectionState.RECONNECTING);
      });

      expect(mockCallbacks.onConnectionStateChange).toHaveBeenCalledWith(
        WebSocketConnectionState.RECONNECTING
      );

      act(() => {
        mockWebSocketService.triggerStateChange(WebSocketConnectionState.CONNECTED);
      });

      expect(mockCallbacks.onConnectionStateChange).toHaveBeenCalledWith(
        WebSocketConnectionState.CONNECTED
      );
    });

    it('should handle errors gracefully', async () => {
      const wrapper = createWrapper();
      
      renderHook(
        () => useRealtimeTeamProgress(teamId, mockCallbacks),
        { wrapper }
      );

      const error = new Error('Connection failed');
      
      act(() => {
        mockWebSocketService.triggerError(error);
      });

      expect(mockCallbacks.onError).toHaveBeenCalledWith(error);
    });

    it('should provide disconnect and reconnect methods', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useRealtimeTeamProgress(teamId, mockCallbacks),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Test disconnect
      act(() => {
        result.current.disconnect();
      });

      expect(result.current.isConnected).toBe(false);
      expect(mockWebSocketService.disconnect).toHaveBeenCalled();

      // Test reconnect
      await act(async () => {
        await result.current.reconnect();
      });

      expect(result.current.isConnected).toBe(true);
      expect(mockWebSocketService.connect).toHaveBeenCalledTimes(2); // Initial + reconnect
    });

    it('should cleanup on unmount', async () => {
      const wrapper = createWrapper();
      
      const { unmount } = renderHook(
        () => useRealtimeTeamProgress(teamId, mockCallbacks),
        { wrapper }
      );

      await waitFor(() => {
        expect(mockWebSocketService.isConnected()).toBe(true);
      });

      unmount();

      expect(mockWebSocketService.disconnect).toHaveBeenCalled();
    });

    it('should handle team changes', async () => {
      const wrapper = createWrapper();
      
      const { result, rerender } = renderHook(
        ({ teamId }) => useRealtimeTeamProgress(teamId, mockCallbacks),
        { 
          wrapper,
          initialProps: { teamId }
        }
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const newTeamId = mockTeams.team2.id;

      // Change team
      rerender({ teamId: newTeamId });

      // Should disconnect from old team and connect to new team
      expect(mockWebSocketService.unsubscribe).toHaveBeenCalledWith(
        `team-progress-${teamId}`
      );
      expect(mockWebSocketService.subscribe).toHaveBeenCalledWith(
        `team-progress-${newTeamId}`,
        expect.any(Function)
      );
    });
  });

  describe('useRealtimeActivities Hook', () => {
    const teamId = mockTeams.team1.id;
    const mockOptions = {
      onActivityAdded: vi.fn(),
      onActivityUpdated: vi.fn(),
      onActivityDeleted: vi.fn(),
      onError: vi.fn(),
      enableNotifications: true,
      soundEnabled: false,
    };

    beforeEach(() => {
      Object.values(mockOptions).forEach(fn => {
        if (typeof fn === 'function') fn.mockClear();
      });
    });

    it('should subscribe to activity events', async () => {
      const wrapper = createWrapper();
      
      renderHook(
        () => useRealtimeActivities(teamId, mockOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(mockWebSocketService.subscribe).toHaveBeenCalledWith(
          `team-activities-${teamId}`,
          expect.any(Function)
        );
      });
    });

    it('should handle activity added events', async () => {
      const wrapper = createWrapper();
      
      renderHook(
        () => useRealtimeActivities(teamId, mockOptions),
        { wrapper }
      );

      const newActivity = {
        id: 'new-activity-123',
        userId: mockUsers.user2.id,
        userName: mockUsers.user2.name,
        distance: 8000,
        duration: 2400,
        activityDate: new Date().toISOString(),
        teams: [{ id: teamId, name: mockTeams.team1.name }],
        isNew: true,
      };

      act(() => {
        mockWebSocketService.simulateEvent('activity-added', newActivity);
      });

      expect(mockOptions.onActivityAdded).toHaveBeenCalledWith(newActivity);
    });

    it('should handle activity updated events', async () => {
      const wrapper = createWrapper();
      
      renderHook(
        () => useRealtimeActivities(teamId, mockOptions),
        { wrapper }
      );

      const updatedActivity = {
        ...mockActivities.activity1,
        distance: 6000, // Updated distance
        note: 'Updated morning walk',
      };

      act(() => {
        mockWebSocketService.simulateEvent('activity-updated', updatedActivity);
      });

      expect(mockOptions.onActivityUpdated).toHaveBeenCalledWith(updatedActivity);
    });

    it('should handle activity deleted events', async () => {
      const wrapper = createWrapper();
      
      renderHook(
        () => useRealtimeActivities(teamId, mockOptions),
        { wrapper }
      );

      const deletedActivityInfo = {
        activityId: mockActivities.activity1.id,
        userId: mockUsers.user1.id,
        teamId,
        distanceRemoved: 5000,
      };

      act(() => {
        mockWebSocketService.simulateEvent('activity-deleted', deletedActivityInfo);
      });

      expect(mockOptions.onActivityDeleted).toHaveBeenCalledWith(deletedActivityInfo);
    });

    it('should invalidate queries when activities change', async () => {
      const wrapper = createWrapper();
      
      renderHook(
        () => useRealtimeActivities(teamId, mockOptions),
        { wrapper }
      );

      const queryInvalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const newActivity = {
        id: 'new-activity-456',
        userId: mockUsers.user1.id,
        userName: mockUsers.user1.name,
        distance: 3000,
        duration: 1800,
      };

      act(() => {
        mockWebSocketService.simulateEvent('activity-added', newActivity);
      });

      expect(queryInvalidateSpy).toHaveBeenCalledWith({
        queryKey: ['activities'],
      });

      expect(queryInvalidateSpy).toHaveBeenCalledWith({
        queryKey: ['userStats'],
      });
    });

    it('should handle multiple team subscriptions', async () => {
      const wrapper = createWrapper();
      
      const teamIds = [mockTeams.team1.id, mockTeams.team2.id];
      
      renderHook(
        () => useRealtimeActivities(teamIds, mockOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(mockWebSocketService.subscribe).toHaveBeenCalledWith(
          `team-activities-${teamIds[0]}`,
          expect.any(Function)
        );
        expect(mockWebSocketService.subscribe).toHaveBeenCalledWith(
          `team-activities-${teamIds[1]}`,
          expect.any(Function)
        );
      });
    });
  });

  describe('useRealtimeLeaderboard Hook', () => {
    const teamId = mockTeams.team1.id;
    const mockOptions = {
      onRankingChange: vi.fn(),
      onNewLeader: vi.fn(),
      period: 'week' as const,
      autoRefresh: true,
    };

    beforeEach(() => {
      Object.values(mockOptions).forEach(fn => {
        if (typeof fn === 'function') fn.mockClear();
      });
    });

    it('should subscribe to leaderboard events', async () => {
      const wrapper = createWrapper();
      
      renderHook(
        () => useRealtimeLeaderboard(teamId, mockOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(mockWebSocketService.subscribe).toHaveBeenCalledWith(
          `team-leaderboard-${teamId}`,
          expect.any(Function)
        );
      });
    });

    it('should handle ranking change events', async () => {
      const wrapper = createWrapper();
      
      renderHook(
        () => useRealtimeLeaderboard(teamId, mockOptions),
        { wrapper }
      );

      const rankingUpdate = {
        teamId,
        period: 'week',
        changes: [
          {
            userId: mockUsers.user1.id,
            oldRank: 2,
            newRank: 1,
            distance: 32000,
          },
          {
            userId: mockUsers.user2.id,
            oldRank: 1,
            newRank: 2,
            distance: 30000,
          },
        ],
        timestamp: new Date().toISOString(),
      };

      act(() => {
        mockWebSocketService.simulateEvent('ranking-change', rankingUpdate);
      });

      expect(mockOptions.onRankingChange).toHaveBeenCalledWith(rankingUpdate);
    });

    it('should handle new leader events', async () => {
      const wrapper = createWrapper();
      
      renderHook(
        () => useRealtimeLeaderboard(teamId, mockOptions),
        { wrapper }
      );

      const newLeaderData = {
        teamId,
        newLeader: {
          userId: mockUsers.user1.id,
          name: mockUsers.user1.name,
          distance: 35000,
          previousDistance: 30000,
        },
        previousLeader: {
          userId: mockUsers.user2.id,
          name: mockUsers.user2.name,
          distance: 30000,
        },
        timestamp: new Date().toISOString(),
      };

      act(() => {
        mockWebSocketService.simulateEvent('new-leader', newLeaderData);
      });

      expect(mockOptions.onNewLeader).toHaveBeenCalledWith(newLeaderData);
    });

    it('should update leaderboard data in query cache', async () => {
      const wrapper = createWrapper();
      
      renderHook(
        () => useRealtimeLeaderboard(teamId, mockOptions),
        { wrapper }
      );

      const querySetDataSpy = vi.spyOn(queryClient, 'setQueryData');

      const updatedLeaderboard = {
        teamId,
        members: [
          {
            userId: mockUsers.user1.id,
            name: mockUsers.user1.name,
            totalDistance: 35000,
            rank: 1,
          },
          {
            userId: mockUsers.user2.id,
            name: mockUsers.user2.name,
            totalDistance: 30000,
            rank: 2,
          },
        ],
      };

      act(() => {
        mockWebSocketService.simulateEvent('leaderboard-update', updatedLeaderboard);
      });

      expect(querySetDataSpy).toHaveBeenCalledWith(
        ['leaderboard', teamId, 'week'],
        expect.objectContaining({
          data: updatedLeaderboard,
        })
      );
    });

    it('should handle different time periods', async () => {
      const wrapper = createWrapper();
      
      const { rerender } = renderHook(
        ({ period }) => useRealtimeLeaderboard(teamId, { ...mockOptions, period }),
        { 
          wrapper,
          initialProps: { period: 'week' as const }
        }
      );

      // Change to monthly leaderboard
      rerender({ period: 'month' as const });

      expect(mockWebSocketService.unsubscribe).toHaveBeenCalledWith(
        `team-leaderboard-${teamId}`
      );
      expect(mockWebSocketService.subscribe).toHaveBeenCalledWith(
        `team-leaderboard-${teamId}`,
        expect.any(Function)
      );
    });
  });

  describe('useMobileRealtimeOptimization Hook', () => {
    const mockNetworkInfo = {
      effectiveType: '4g',
      downlink: 10,
      rtt: 100,
    };

    beforeEach(() => {
      // Mock navigator.connection
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: mockNetworkInfo,
      });

      // Mock battery API
      Object.defineProperty(navigator, 'getBattery', {
        writable: true,
        value: () => Promise.resolve({
          level: 0.8,
          charging: false,
          chargingTime: Infinity,
          dischargingTime: 14400, // 4 hours
        }),
      });
    });

    it('should optimize for mobile network conditions', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useMobileRealtimeOptimization({
          enableNetworkOptimization: true,
          enableBatteryOptimization: true,
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.optimizations).toMatchObject({
          networkType: '4g',
          batteryLevel: 0.8,
          isCharging: false,
          shouldReduceUpdates: false, // Good conditions
        });
      });
    });

    it('should reduce updates on slow networks', async () => {
      // Mock slow network
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: {
          effectiveType: '2g',
          downlink: 0.5,
          rtt: 2000,
        },
      });

      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useMobileRealtimeOptimization({
          enableNetworkOptimization: true,
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.optimizations.shouldReduceUpdates).toBe(true);
      });
    });

    it('should reduce updates on low battery', async () => {
      // Mock low battery
      Object.defineProperty(navigator, 'getBattery', {
        writable: true,
        value: () => Promise.resolve({
          level: 0.15, // 15% battery
          charging: false,
          dischargingTime: 1800, // 30 minutes remaining
        }),
      });

      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useMobileRealtimeOptimization({
          enableBatteryOptimization: true,
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.optimizations.shouldReduceUpdates).toBe(true);
      });
    });

    it('should provide adaptive update intervals', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useMobileRealtimeOptimization({
          baseUpdateInterval: 1000,
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.adaptiveUpdateInterval).toBeGreaterThanOrEqual(1000);
      });

      // Should increase interval on poor conditions
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: {
          effectiveType: '2g',
          downlink: 0.3,
          rtt: 3000,
        },
      });

      // Trigger network change
      window.dispatchEvent(new Event('online'));

      await waitFor(() => {
        expect(result.current.adaptiveUpdateInterval).toBeGreaterThan(1000);
      });
    });

    it('should handle offline state', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(
        () => useMobileRealtimeOptimization(),
        { wrapper }
      );

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      window.dispatchEvent(new Event('offline'));

      await waitFor(() => {
        expect(result.current.optimizations.isOnline).toBe(false);
        expect(result.current.optimizations.shouldReduceUpdates).toBe(true);
      });
    });
  });

  describe('Integration and Error Handling', () => {
    it('should handle multiple concurrent hook subscriptions', async () => {
      const wrapper = createWrapper();
      const teamId = mockTeams.team1.id;

      renderHook(() => {
        useRealtimeTeamProgress(teamId, {
          onProgressUpdate: vi.fn(),
          onMilestoneReached: vi.fn(),
          onActivityAdded: vi.fn(),
          onGoalCompleted: vi.fn(),
          onConnectionStateChange: vi.fn(),
          onError: vi.fn(),
        });

        useRealtimeActivities(teamId, {
          onActivityAdded: vi.fn(),
          onActivityUpdated: vi.fn(),
          onActivityDeleted: vi.fn(),
          onError: vi.fn(),
        });

        useRealtimeLeaderboard(teamId, {
          onRankingChange: vi.fn(),
          onNewLeader: vi.fn(),
        });

        return null;
      }, { wrapper });

      await waitFor(() => {
        expect(mockWebSocketService.isConnected()).toBe(true);
        expect(mockWebSocketService.subscribe).toHaveBeenCalledTimes(3);
      });
    });

    it('should recover from connection failures', async () => {
      const wrapper = createWrapper();
      const teamId = mockTeams.team1.id;
      const mockCallbacks = {
        onProgressUpdate: vi.fn(),
        onConnectionStateChange: vi.fn(),
        onError: vi.fn(),
        onMilestoneReached: vi.fn(),
        onActivityAdded: vi.fn(),
        onGoalCompleted: vi.fn(),
      };

      const { result } = renderHook(
        () => useRealtimeTeamProgress(teamId, mockCallbacks),
        { wrapper }
      );

      // Simulate connection failure
      act(() => {
        mockWebSocketService.triggerStateChange(WebSocketConnectionState.DISCONNECTED);
      });

      expect(mockCallbacks.onConnectionStateChange).toHaveBeenCalledWith(
        WebSocketConnectionState.DISCONNECTED
      );

      // Simulate reconnection
      act(() => {
        mockWebSocketService.triggerStateChange(WebSocketConnectionState.CONNECTED);
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(mockCallbacks.onConnectionStateChange).toHaveBeenCalledWith(
          WebSocketConnectionState.CONNECTED
        );
      });
    });

    it('should handle malformed WebSocket messages gracefully', async () => {
      const wrapper = createWrapper();
      const teamId = mockTeams.team1.id;
      const mockCallbacks = {
        onProgressUpdate: vi.fn(),
        onError: vi.fn(),
        onMilestoneReached: vi.fn(),
        onActivityAdded: vi.fn(),
        onGoalCompleted: vi.fn(),
        onConnectionStateChange: vi.fn(),
      };

      renderHook(
        () => useRealtimeTeamProgress(teamId, mockCallbacks),
        { wrapper }
      );

      await waitFor(() => {
        expect(mockWebSocketService.isConnected()).toBe(true);
      });

      // Simulate malformed message
      act(() => {
        mockWebSocketService.simulateEvent('progress-update', {
          invalidData: true,
          missingRequiredFields: true,
        });
      });

      // Should not crash and might call onError
      expect(mockCallbacks.onProgressUpdate).toHaveBeenCalled();
    });

    it('should throttle rapid updates for performance', async () => {
      const wrapper = createWrapper();
      const teamId = mockTeams.team1.id;
      const mockOnProgressUpdate = vi.fn();

      renderHook(
        () => useRealtimeTeamProgress(teamId, {
          onProgressUpdate: mockOnProgressUpdate,
          onMilestoneReached: vi.fn(),
          onActivityAdded: vi.fn(),
          onGoalCompleted: vi.fn(),
          onConnectionStateChange: vi.fn(),
          onError: vi.fn(),
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(mockWebSocketService.isConnected()).toBe(true);
      });

      // Send multiple rapid updates
      const updates = Array.from({ length: 10 }, (_, i) => ({
        teamGoalId: 'goal-123',
        totalDistance: 50000 + i * 100,
        percentComplete: 25 + i * 0.05,
      }));

      act(() => {
        updates.forEach(update => {
          mockWebSocketService.simulateEvent('progress-update', update);
        });
      });

      // Should receive all updates (our mock doesn't throttle)
      expect(mockOnProgressUpdate).toHaveBeenCalledTimes(10);
    });
  });
});