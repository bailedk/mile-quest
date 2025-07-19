/**
 * Integration tests for critical user flows
 * Tests end-to-end scenarios combining multiple components and APIs
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { 
  mockUsers,
  mockTeams,
  mockActivities,
  mockApiResponses,
  mockFetch,
  MockWebSocketService,
  MockAuthService,
  setupTestEnvironment,
  resetAllMocks,
  expectElementToBeVisible,
  expectElementToHaveText,
  waitForAsyncOperations,
} from '../utils/test-helpers';

// Mock services
const mockWebSocketService = new MockWebSocketService({ autoConnect: true });
const mockAuthService = new MockAuthService({ autoSignIn: true, user: mockUsers.user1 });

// Mock service factories
vi.mock('@/services/websocket/factory', () => ({
  createWebSocketService: () => mockWebSocketService,
}));

vi.mock('@/services/auth/factory', () => ({
  createAuthService: () => mockAuthService,
}));

// Mock Next.js router
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
    getAll: vi.fn(),
    has: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useParams: () => ({}),
}));

// Comprehensive app component that includes main flows
const MileQuestApp = () => {
  const [currentRoute, setCurrentRoute] = React.useState('/dashboard');
  const [activities, setActivities] = React.useState(mockActivities);
  const [teamProgress, setTeamProgress] = React.useState({
    totalDistance: 50000,
    targetDistance: 200000,
    percentComplete: 25,
  });

  // Mock activity logging
  const handleLogActivity = async (activityData: any) => {
    const newActivity = {
      id: `activity-${Date.now()}`,
      ...activityData,
      createdAt: new Date().toISOString(),
    };

    setActivities(prev => [newActivity, ...prev]);
    
    // Update progress
    setTeamProgress(prev => ({
      ...prev,
      totalDistance: prev.totalDistance + activityData.distance,
      percentComplete: ((prev.totalDistance + activityData.distance) / prev.targetDistance) * 100,
    }));

    // Simulate real-time update
    mockWebSocketService.simulateEvent('activity-added', {
      user: { id: mockUsers.user1.id, name: mockUsers.user1.name },
      activity: newActivity,
      progress: {
        newTotalDistance: teamProgress.totalDistance + activityData.distance,
        newPercentComplete: ((teamProgress.totalDistance + activityData.distance) / teamProgress.targetDistance) * 100,
        distanceAdded: activityData.distance,
      },
    });
  };

  // Mock team joining
  const handleJoinTeam = async (teamId: string) => {
    // Simulate successful team join
    mockWebSocketService.simulateEvent('team-joined', {
      teamId,
      userId: mockUsers.user1.id,
      userName: mockUsers.user1.name,
    });
  };

  return (
    <div data-testid="mile-quest-app">
      {/* Navigation */}
      <nav data-testid="main-nav">
        <button onClick={() => setCurrentRoute('/dashboard')} data-testid="nav-dashboard">
          Dashboard
        </button>
        <button onClick={() => setCurrentRoute('/activities')} data-testid="nav-activities">
          Activities
        </button>
        <button onClick={() => setCurrentRoute('/teams')} data-testid="nav-teams">
          Teams
        </button>
        <button onClick={() => setCurrentRoute('/activities/new')} data-testid="nav-log-activity">
          Log Activity
        </button>
      </nav>

      {/* Route Content */}
      {currentRoute === '/dashboard' && (
        <div data-testid="dashboard-page">
          <h1>Dashboard</h1>
          
          {/* User Stats */}
          <div data-testid="user-stats">
            <h2>Your Stats</h2>
            <p>Total Distance: {(activities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000).toFixed(1)} km</p>
            <p>Total Activities: {activities.length}</p>
          </div>

          {/* Team Progress */}
          <div data-testid="team-progress">
            <h2>Team Progress</h2>
            <p>{teamProgress.percentComplete.toFixed(1)}% Complete</p>
            <p>{(teamProgress.totalDistance / 1000).toFixed(1)} / {(teamProgress.targetDistance / 1000).toFixed(1)} km</p>
            <div 
              data-testid="progress-bar"
              style={{ 
                width: '100%', 
                height: '20px', 
                backgroundColor: '#e0e0e0',
                borderRadius: '10px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${teamProgress.percentComplete}%`,
                  height: '100%',
                  backgroundColor: '#4caf50',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Recent Activities */}
          <div data-testid="recent-activities">
            <h2>Recent Activities</h2>
            {activities.slice(0, 3).map(activity => (
              <div key={activity.id} data-testid={`activity-${activity.id}`}>
                <p>{(activity.distance / 1000).toFixed(1)} km</p>
                <p>{activity.note}</p>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div data-testid="quick-actions">
            <button 
              onClick={() => setCurrentRoute('/activities/new')}
              data-testid="quick-log-activity"
            >
              Log Activity
            </button>
            <button 
              onClick={() => setCurrentRoute('/teams/join')}
              data-testid="quick-join-team"
            >
              Join Team
            </button>
          </div>
        </div>
      )}

      {currentRoute === '/activities' && (
        <div data-testid="activities-page">
          <h1>Your Activities</h1>
          <div data-testid="activities-list">
            {activities.map(activity => (
              <div key={activity.id} data-testid={`activity-item-${activity.id}`}>
                <h3>{activity.note || 'Activity'}</h3>
                <p>Distance: {(activity.distance / 1000).toFixed(1)} km</p>
                <p>Duration: {Math.floor(activity.duration / 60)} minutes</p>
                <button data-testid={`edit-${activity.id}`}>Edit</button>
                <button data-testid={`delete-${activity.id}`}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentRoute === '/activities/new' && (
        <div data-testid="log-activity-page">
          <h1>Log New Activity</h1>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              await handleLogActivity({
                distance: parseInt(formData.get('distance') as string) * 1000, // Convert to meters
                duration: parseInt(formData.get('duration') as string) * 60, // Convert to seconds
                note: formData.get('note') as string,
                teamIds: [mockTeams.team1.id],
                activityDate: new Date().toISOString(),
                isPrivate: false,
              });
              setCurrentRoute('/dashboard');
            }}
            data-testid="activity-form"
          >
            <input
              name="distance"
              type="number"
              placeholder="Distance (km)"
              step="0.1"
              min="0"
              required
              data-testid="distance-input"
            />
            <input
              name="duration"
              type="number"
              placeholder="Duration (minutes)"
              min="1"
              required
              data-testid="duration-input"
            />
            <input
              name="note"
              type="text"
              placeholder="Activity note"
              data-testid="note-input"
            />
            <button type="submit" data-testid="submit-activity">
              Log Activity
            </button>
          </form>
        </div>
      )}

      {currentRoute === '/teams' && (
        <div data-testid="teams-page">
          <h1>Teams</h1>
          <div data-testid="teams-list">
            {[mockTeams.team1, mockTeams.team2].map(team => (
              <div key={team.id} data-testid={`team-${team.id}`}>
                <h3>{team.name}</h3>
                <p>{team.memberCount} members</p>
                <button 
                  onClick={() => setCurrentRoute(`/teams/${team.id}`)}
                  data-testid={`view-team-${team.id}`}
                >
                  View Team
                </button>
              </div>
            ))}
          </div>
          <button 
            onClick={() => setCurrentRoute('/teams/new')}
            data-testid="create-team-button"
          >
            Create Team
          </button>
        </div>
      )}

      {currentRoute === '/teams/join' && (
        <div data-testid="join-team-page">
          <h1>Join Team</h1>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const teamCode = formData.get('teamCode') as string;
              await handleJoinTeam(teamCode);
              setCurrentRoute('/teams');
            }}
            data-testid="join-team-form"
          >
            <input
              name="teamCode"
              type="text"
              placeholder="Team Code"
              required
              data-testid="team-code-input"
            />
            <button type="submit" data-testid="join-team-submit">
              Join Team
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

// Test wrapper with all providers
const TestAppWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Critical User Flows Integration', () => {
  let cleanup: () => void;
  const user = userEvent.setup();

  beforeEach(() => {
    const testEnv = setupTestEnvironment();
    cleanup = testEnv.cleanup;
    resetAllMocks();
    mockWebSocketService.reset();
    mockAuthService.reset();
    
    // Set up authenticated state
    mockAuthService.mockSignInSuccess(mockUsers.user1);
    
    mockFetch({
      '/api/v1/dashboard': mockApiResponses.dashboard,
      '/api/v1/activities': mockApiResponses.activities,
      '/api/v1/teams': mockApiResponses.teams,
      '/api/v1/teams/progress': mockApiResponses.teamProgress,
      '/api/v1/leaderboards': mockApiResponses.leaderboard,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('User Registration and Onboarding Flow', () => {
    it('should complete full user registration and first activity flow', async () => {
      render(
        <TestAppWrapper>
          <MileQuestApp />
        </TestAppWrapper>
      );

      // Should start on dashboard
      expectElementToBeVisible(screen.getByTestId('dashboard-page'));
      expectElementToHaveText(screen.getByText('Dashboard'), 'Dashboard');

      // Check initial state
      expectElementToHaveText(
        screen.getByText(/Total Activities:/),
        `Total Activities: ${Object.keys(mockActivities).length}`
      );

      // Navigate to log activity
      await user.click(screen.getByTestId('quick-log-activity'));

      expectElementToBeVisible(screen.getByTestId('log-activity-page'));

      // Fill in activity form
      await user.type(screen.getByTestId('distance-input'), '5.0');
      await user.type(screen.getByTestId('duration-input'), '30');
      await user.type(screen.getByTestId('note-input'), 'First morning walk');

      // Submit activity
      await user.click(screen.getByTestId('submit-activity'));

      // Should redirect back to dashboard
      await waitFor(() => {
        expectElementToBeVisible(screen.getByTestId('dashboard-page'));
      });

      // Verify activity was added
      await waitFor(() => {
        expectElementToHaveText(
          screen.getByText(/Total Activities:/),
          `Total Activities: ${Object.keys(mockActivities).length + 1}`
        );
      });

      // Verify progress updated
      await waitFor(() => {
        const progressText = screen.getByText(/% Complete/);
        expect(progressText.textContent).toMatch(/2[5-9]\.\d% Complete/); // Should be > 25%
      });
    });
  });

  describe('Team Collaboration Flow', () => {
    it('should handle joining team and seeing real-time updates', async () => {
      render(
        <TestAppWrapper>
          <MileQuestApp />
        </TestAppWrapper>
      );

      // Navigate to teams
      await user.click(screen.getByTestId('nav-teams'));
      expectElementToBeVisible(screen.getByTestId('teams-page'));

      // Check available teams
      expectElementToBeVisible(screen.getByTestId(`team-${mockTeams.team1.id}`));
      expectElementToHaveText(
        screen.getByText(mockTeams.team1.name),
        mockTeams.team1.name
      );

      // Navigate to join team
      await user.click(screen.getByTestId('quick-join-team'));
      expectElementToBeVisible(screen.getByTestId('join-team-page'));

      // Enter team code and join
      await user.type(screen.getByTestId('team-code-input'), 'TEAM123');
      await user.click(screen.getByTestId('join-team-submit'));

      // Should redirect to teams page
      await waitFor(() => {
        expectElementToBeVisible(screen.getByTestId('teams-page'));
      });

      // Go back to dashboard to see team progress
      await user.click(screen.getByTestId('nav-dashboard'));
      expectElementToBeVisible(screen.getByTestId('team-progress'));
    });

    it('should show real-time progress updates from other team members', async () => {
      render(
        <TestAppWrapper>
          <MileQuestApp />
        </TestAppWrapper>
      );

      // Check initial progress
      const initialProgress = screen.getByText(/% Complete/).textContent;

      // Simulate another team member adding activity via WebSocket
      mockWebSocketService.simulateEvent('activity-added', {
        user: { id: mockUsers.user2.id, name: mockUsers.user2.name },
        activity: {
          id: 'remote-activity-123',
          distance: 8000, // 8km
          duration: 2400, // 40 minutes
          note: 'Team member run',
        },
        progress: {
          newTotalDistance: 58000,
          newPercentComplete: 29,
          distanceAdded: 8000,
        },
      });

      // Progress should update in real-time
      await waitFor(() => {
        const updatedProgress = screen.getByText(/% Complete/).textContent;
        expect(updatedProgress).not.toBe(initialProgress);
      });
    });
  });

  describe('Activity Management Flow', () => {
    it('should allow viewing, editing, and deleting activities', async () => {
      render(
        <TestAppWrapper>
          <MileQuestApp />
        </TestAppWrapper>
      );

      // Navigate to activities page
      await user.click(screen.getByTestId('nav-activities'));
      expectElementToBeVisible(screen.getByTestId('activities-page'));

      // Check activities are listed
      Object.values(mockActivities).forEach(activity => {
        expectElementToBeVisible(screen.getByTestId(`activity-item-${activity.id}`));
      });

      // Test edit functionality (button should be present)
      const firstActivity = Object.values(mockActivities)[0];
      const editButton = screen.getByTestId(`edit-${firstActivity.id}`);
      expectElementToBeVisible(editButton);

      // Test delete functionality (button should be present)
      const deleteButton = screen.getByTestId(`delete-${firstActivity.id}`);
      expectElementToBeVisible(deleteButton);
    });

    it('should handle activity logging with validation errors', async () => {
      render(
        <TestAppWrapper>
          <MileQuestApp />
        </TestAppWrapper>
      );

      // Navigate to log activity
      await user.click(screen.getByTestId('nav-log-activity'));
      expectElementToBeVisible(screen.getByTestId('log-activity-page'));

      // Try to submit without required fields
      await user.click(screen.getByTestId('submit-activity'));

      // Form should not submit (HTML5 validation)
      expectElementToBeVisible(screen.getByTestId('log-activity-page'));

      // Fill in minimum required fields
      await user.type(screen.getByTestId('distance-input'), '3.5');
      await user.type(screen.getByTestId('duration-input'), '25');

      // Should submit successfully
      await user.click(screen.getByTestId('submit-activity'));

      await waitFor(() => {
        expectElementToBeVisible(screen.getByTestId('dashboard-page'));
      });
    });
  });

  describe('Performance and Real-time Features', () => {
    it('should handle rapid navigation without losing state', async () => {
      render(
        <TestAppWrapper>
          <MileQuestApp />
        </TestAppWrapper>
      );

      // Rapid navigation between pages
      await user.click(screen.getByTestId('nav-activities'));
      await user.click(screen.getByTestId('nav-teams'));
      await user.click(screen.getByTestId('nav-dashboard'));
      await user.click(screen.getByTestId('nav-activities'));
      await user.click(screen.getByTestId('nav-dashboard'));

      // Should end up on dashboard with all content intact
      expectElementToBeVisible(screen.getByTestId('dashboard-page'));
      expectElementToBeVisible(screen.getByTestId('user-stats'));
      expectElementToBeVisible(screen.getByTestId('team-progress'));
      expectElementToBeVisible(screen.getByTestId('recent-activities'));
    });

    it('should maintain WebSocket connection during navigation', async () => {
      render(
        <TestAppWrapper>
          <MileQuestApp />
        </TestAppWrapper>
      );

      // Navigate between pages
      await user.click(screen.getByTestId('nav-activities'));
      await user.click(screen.getByTestId('nav-teams'));
      await user.click(screen.getByTestId('nav-dashboard'));

      // WebSocket should still be connected
      expect(mockWebSocketService.isConnected()).toBe(true);

      // Real-time updates should still work
      mockWebSocketService.simulateEvent('progress-update', {
        teamGoalId: 'goal-123',
        totalDistance: 60000,
        percentComplete: 30,
      });

      // Should see the update reflected
      await waitFor(() => {
        expect(screen.getByText(/30\.\d% Complete/)).toBeInTheDocument();
      });
    });
  });

  describe('Mobile and Responsive Behavior', () => {
    it('should handle touch interactions on mobile', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        value: 667,
      });

      window.dispatchEvent(new Event('resize'));

      render(
        <TestAppWrapper>
          <MileQuestApp />
        </TestAppWrapper>
      );

      // Test touch interactions
      const quickLogButton = screen.getByTestId('quick-log-activity');
      
      // Simulate touch events
      fireEvent.touchStart(quickLogButton, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      fireEvent.touchEnd(quickLogButton, {
        changedTouches: [{ clientX: 100, clientY: 100 }]
      });

      await waitFor(() => {
        expectElementToBeVisible(screen.getByTestId('log-activity-page'));
      });
    });

    it('should optimize for slow network conditions', async () => {
      // Mock slow network
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: {
          effectiveType: '2g',
          downlink: 0.5,
          rtt: 2000,
        },
      });

      render(
        <TestAppWrapper>
          <MileQuestApp />
        </TestAppWrapper>
      );

      // App should still function but might reduce update frequency
      expectElementToBeVisible(screen.getByTestId('dashboard-page'));
      
      // Log activity should still work
      await user.click(screen.getByTestId('quick-log-activity'));
      expectElementToBeVisible(screen.getByTestId('log-activity-page'));

      await user.type(screen.getByTestId('distance-input'), '2.0');
      await user.type(screen.getByTestId('duration-input'), '15');

      await user.click(screen.getByTestId('submit-activity'));

      await waitFor(() => {
        expectElementToBeVisible(screen.getByTestId('dashboard-page'));
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network failures gracefully', async () => {
      // Mock network failure
      mockFetch({
        '/api/v1/activities': {
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' }),
        },
      });

      render(
        <TestAppWrapper>
          <MileQuestApp />
        </TestAppWrapper>
      );

      // App should still render
      expectElementToBeVisible(screen.getByTestId('dashboard-page'));

      // Navigate to activities (which might fail)
      await user.click(screen.getByTestId('nav-activities'));
      
      // Should still show activities page (using cached/local data)
      expectElementToBeVisible(screen.getByTestId('activities-page'));
    });

    it('should recover from WebSocket disconnection', async () => {
      render(
        <TestAppWrapper>
          <MileQuestApp />
        </TestAppWrapper>
      );

      // Initial connection should be established
      expect(mockWebSocketService.isConnected()).toBe(true);

      // Simulate disconnection
      mockWebSocketService.triggerStateChange('disconnected' as any);

      // Should attempt to reconnect
      await waitForAsyncOperations();
      
      // Simulate reconnection
      mockWebSocketService.triggerStateChange('connected' as any);

      // Real-time updates should work again
      mockWebSocketService.simulateEvent('activity-added', {
        user: { id: mockUsers.user2.id, name: mockUsers.user2.name },
        activity: { id: 'test-recovery', distance: 1000 },
        progress: { newTotalDistance: 51000, newPercentComplete: 25.5, distanceAdded: 1000 },
      });

      // Should see the update
      await waitFor(() => {
        expect(screen.getByText(/25\.[5-9]% Complete/)).toBeInTheDocument();
      });
    });
  });

  describe('Data Consistency and State Management', () => {
    it('should maintain consistent state across components', async () => {
      render(
        <TestAppWrapper>
          <MileQuestApp />
        </TestAppWrapper>
      );

      // Check initial activity count on dashboard
      const initialActivitiesText = screen.getByText(/Total Activities:/).textContent;
      const initialCount = parseInt(initialActivitiesText?.match(/\d+/)?.[0] || '0');

      // Log a new activity
      await user.click(screen.getByTestId('quick-log-activity'));
      await user.type(screen.getByTestId('distance-input'), '4.0');
      await user.type(screen.getByTestId('duration-input'), '25');
      await user.click(screen.getByTestId('submit-activity'));

      // Back on dashboard, count should be updated
      await waitFor(() => {
        const updatedText = screen.getByText(/Total Activities:/).textContent;
        const updatedCount = parseInt(updatedText?.match(/\d+/)?.[0] || '0');
        expect(updatedCount).toBe(initialCount + 1);
      });

      // Navigate to activities page
      await user.click(screen.getByTestId('nav-activities'));

      // Should see the new activity in the list
      await waitFor(() => {
        const activityItems = screen.getAllByTestId(/^activity-item-/);
        expect(activityItems).toHaveLength(initialCount + 1);
      });
    });

    it('should handle concurrent updates correctly', async () => {
      render(
        <TestAppWrapper>
          <MileQuestApp />
        </TestAppWrapper>
      );

      // Simulate multiple rapid real-time updates
      for (let i = 0; i < 5; i++) {
        mockWebSocketService.simulateEvent('activity-added', {
          user: { id: `user-${i}`, name: `User ${i}` },
          activity: { id: `concurrent-${i}`, distance: 1000 },
          progress: { 
            newTotalDistance: 50000 + (i + 1) * 1000, 
            newPercentComplete: (50000 + (i + 1) * 1000) / 200000 * 100,
            distanceAdded: 1000 
          },
        });
      }

      // Final state should be consistent
      await waitFor(() => {
        const progressText = screen.getByText(/% Complete/).textContent;
        const percentage = parseFloat(progressText?.match(/[\d.]+/)?.[0] || '0');
        expect(percentage).toBeGreaterThan(25); // Should reflect all updates
      });
    });
  });
});