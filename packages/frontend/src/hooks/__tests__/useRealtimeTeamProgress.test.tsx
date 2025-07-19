import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRealtimeTeamProgress } from '../useRealtimeTeamProgress';
import { MockWebSocketService } from '@/services/websocket/mock.service';
import { WebSocketConnectionState } from '@/services/websocket';

// Mock the auth hook
jest.mock('../useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    isAuthenticated: true,
  }),
}));

// Mock the WebSocket factory
const mockWebSocketService = new MockWebSocketService({});

jest.mock('@/services/websocket/factory', () => ({
  createWebSocketService: () => mockWebSocketService,
}));

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useRealtimeTeamProgress', () => {
  let mockCallbacks: any;
  
  beforeEach(() => {
    mockCallbacks = {
      onProgressUpdate: jest.fn(),
      onMilestoneReached: jest.fn(),
      onActivityAdded: jest.fn(),
      onGoalCompleted: jest.fn(),
      onConnectionStateChange: jest.fn(),
      onError: jest.fn(),
    };
    
    // Reset mock service
    jest.clearAllMocks();
  });

  it('should connect to WebSocket when teamId is provided', async () => {
    const wrapper = createWrapper();
    
    const { result } = renderHook(
      () => useRealtimeTeamProgress('team-123', mockCallbacks),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.connectionState).toBe(WebSocketConnectionState.CONNECTED);
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('should not connect when teamId is null', () => {
    const wrapper = createWrapper();
    
    const { result } = renderHook(
      () => useRealtimeTeamProgress(null, mockCallbacks),
      { wrapper }
    );

    expect(result.current.connectionState).toBe(WebSocketConnectionState.DISCONNECTED);
    expect(result.current.isConnected).toBe(false);
  });

  it('should handle progress updates', async () => {
    const wrapper = createWrapper();
    
    const { result } = renderHook(
      () => useRealtimeTeamProgress('team-123', mockCallbacks),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Simulate progress update
    const progressData = {
      teamGoalId: 'goal-123',
      totalDistance: 50.5,
      percentComplete: 75,
      estimatedCompletionDate: '2024-12-31',
      isOnTrack: true,
      lastActivityAt: new Date().toISOString(),
      topContributors: [
        { userId: 'user-1', name: 'John Doe', distance: 25.0 },
      ],
    };

    act(() => {
      mockWebSocketService.simulateEvent('progress-update', progressData);
    });

    expect(mockCallbacks.onProgressUpdate).toHaveBeenCalledWith(progressData);
  });

  it('should handle milestone reached events', async () => {
    const wrapper = createWrapper();
    
    const { result } = renderHook(
      () => useRealtimeTeamProgress('team-123', mockCallbacks),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const milestoneData = {
      type: 'distance',
      value: 100,
      message: 'Congratulations! You reached 100 miles!',
      teamGoalId: 'goal-123',
      goalName: 'Walk to NYC',
    };

    act(() => {
      mockWebSocketService.simulateEvent('milestone-reached', milestoneData);
    });

    expect(mockCallbacks.onMilestoneReached).toHaveBeenCalledWith(milestoneData);
  });

  it('should handle activity added events', async () => {
    const wrapper = createWrapper();
    
    const { result } = renderHook(
      () => useRealtimeTeamProgress('team-123', mockCallbacks),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const activityData = {
      user: { id: 'user-1', name: 'John Doe' },
      activity: { distance: 5.2, duration: 3600 },
      progress: {
        newTotalDistance: 55.7,
        newPercentComplete: 78,
        distanceAdded: 5.2,
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
    
    const { result } = renderHook(
      () => useRealtimeTeamProgress('team-123', mockCallbacks),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const completionData = {
      teamGoalId: 'goal-123',
      goalName: 'Walk to NYC',
      totalDistance: 200,
      totalDuration: 72000,
      totalActivities: 50,
      participantCount: 5,
      completionTime: new Date().toISOString(),
      topContributors: [
        { userId: 'user-1', name: 'John Doe', distance: 80 },
        { userId: 'user-2', name: 'Jane Smith', distance: 70 },
      ],
      celebrationType: 'CONFETTI',
    };

    act(() => {
      mockWebSocketService.simulateEvent('goal-completed', completionData);
    });

    expect(mockCallbacks.onGoalCompleted).toHaveBeenCalledWith(completionData);
  });

  it('should handle connection state changes', async () => {
    const wrapper = createWrapper();
    
    renderHook(
      () => useRealtimeTeamProgress('team-123', mockCallbacks),
      { wrapper }
    );

    // Simulate connection state change
    act(() => {
      mockWebSocketService.triggerStateChange(WebSocketConnectionState.RECONNECTING);
    });

    expect(mockCallbacks.onConnectionStateChange).toHaveBeenCalledWith(
      WebSocketConnectionState.RECONNECTING
    );
  });

  it('should handle errors', async () => {
    const wrapper = createWrapper();
    
    renderHook(
      () => useRealtimeTeamProgress('team-123', mockCallbacks),
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
      () => useRealtimeTeamProgress('team-123', mockCallbacks),
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

    // Test reconnect
    await act(async () => {
      await result.current.reconnect();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('should cleanup on unmount', async () => {
    const wrapper = createWrapper();
    
    const { unmount } = renderHook(
      () => useRealtimeTeamProgress('team-123', mockCallbacks),
      { wrapper }
    );

    await waitFor(() => {
      expect(mockWebSocketService.isConnected()).toBe(true);
    });

    unmount();

    // Verify cleanup was called
    expect(mockWebSocketService.isConnected()).toBe(false);
  });

  it('should handle team changes', async () => {
    const wrapper = createWrapper();
    
    const { result, rerender } = renderHook(
      ({ teamId }) => useRealtimeTeamProgress(teamId, mockCallbacks),
      { 
        wrapper,
        initialProps: { teamId: 'team-123' }
      }
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Change team
    rerender({ teamId: 'team-456' });

    // Should maintain connection but change subscription
    expect(result.current.isConnected).toBe(true);
  });
});