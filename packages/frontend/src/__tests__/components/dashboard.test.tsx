/**
 * Comprehensive tests for dashboard components
 * Tests dashboard components with real data integration
 */
import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { TeamProgressCard } from '@/components/dashboard/TeamProgressCard';
import { RecentActivities } from '@/components/dashboard/RecentActivities';
import { RealtimeLeaderboard } from '@/components/dashboard/RealtimeLeaderboard';
import { TeamProgressOverview } from '@/components/dashboard/TeamProgressOverview';
import { ActivityFeedItem } from '@/components/dashboard/ActivityFeedItem';
import { 
  renderWithProviders,
  mockUserStats,
  mockTeams,
  mockActivities,
  mockTeamProgress,
  mockLeaderboard,
  mockApiResponses,
  mockFetch,
  setupTestEnvironment,
  resetAllMocks,
  expectElementToBeVisible,
  expectElementToHaveText,
  waitForAsyncOperations,
} from '../utils/test-helpers';

describe('Dashboard Components', () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupTestEnvironment();
    cleanup = testEnv.cleanup;
    resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('DashboardStats', () => {
    it('should display user statistics correctly', () => {
      renderWithProviders(
        <DashboardStats stats={mockUserStats} />
      );

      // Check total distance
      expectElementToHaveText(
        screen.getByText(/75\.0 km/i),
        '75.0 km'
      );

      // Check current streak
      expectElementToHaveText(
        screen.getByText(/7 days/i),
        '7 days'
      );

      // Check total activities
      expectElementToHaveText(
        screen.getByText(/15 activities/i),
        '15 activities'
      );

      // Check average pace
      expectElementToHaveText(
        screen.getByText(/8\.0 min\/km/i),
        '8.0 min/km'
      );
    });

    it('should handle zero stats gracefully', () => {
      const zeroStats = {
        ...mockUserStats,
        totalDistance: 0,
        totalActivities: 0,
        currentStreak: 0,
        averagePace: 0,
      };

      renderWithProviders(
        <DashboardStats stats={zeroStats} />
      );

      expectElementToHaveText(
        screen.getByText(/0\.0 km/i),
        '0.0 km'
      );

      expectElementToHaveText(
        screen.getByText(/0 days/i),
        '0 days'
      );

      expectElementToHaveText(
        screen.getByText(/0 activities/i),
        '0 activities'
      );

      expectElementToHaveText(
        screen.getByText(/0\.0 min\/km/i),
        '0.0 min/km'
      );
    });

    it('should format large numbers correctly', () => {
      const largeStats = {
        ...mockUserStats,
        totalDistance: 1500000, // 1500 km
        totalActivities: 1234,
      };

      renderWithProviders(
        <DashboardStats stats={largeStats} />
      );

      expectElementToHaveText(
        screen.getByText(/1500\.0 km/i),
        '1500.0 km'
      );

      expectElementToHaveText(
        screen.getByText(/1234 activities/i),
        '1234 activities'
      );
    });

    it('should show weekly and monthly stats', () => {
      renderWithProviders(
        <DashboardStats stats={mockUserStats} />
      );

      // Weekly stats
      expectElementToHaveText(
        screen.getByText(/This Week/i),
        'This Week'
      );

      expectElementToHaveText(
        screen.getByText(/15\.0 km/i),
        '15.0 km'
      );

      // Monthly stats  
      expectElementToHaveText(
        screen.getByText(/This Month/i),
        'This Month'
      );

      expectElementToHaveText(
        screen.getByText(/75\.0 km/i),
        '75.0 km'
      );
    });

    it('should be responsive on mobile devices', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      window.dispatchEvent(new Event('resize'));

      renderWithProviders(
        <DashboardStats stats={mockUserStats} />
      );

      const container = screen.getByTestId('dashboard-stats');
      expect(container).toHaveClass('grid-cols-2'); // Mobile layout
    });
  });

  describe('TeamProgressCard', () => {
    const mockTeam = {
      ...mockTeams.team1,
      progress: {
        currentDistance: 50000,
        targetDistance: 200000,
        percentComplete: 25,
      },
    };

    it('should display team progress information', () => {
      renderWithProviders(
        <TeamProgressCard team={mockTeam} />
      );

      // Team name
      expectElementToHaveText(
        screen.getByText(mockTeam.name),
        mockTeam.name
      );

      // Progress percentage
      expectElementToHaveText(
        screen.getByText(/25%/i),
        '25%'
      );

      // Distance progress
      expectElementToHaveText(
        screen.getByText(/50\.0 km/i),
        '50.0 km'
      );

      expectElementToHaveText(
        screen.getByText(/200\.0 km/i),
        '200.0 km'
      );
    });

    it('should show progress bar with correct width', () => {
      renderWithProviders(
        <TeamProgressCard team={mockTeam} />
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '25');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');

      const progressFill = progressBar.querySelector('.bg-primary');
      expect(progressFill).toHaveStyle('width: 25%');
    });

    it('should handle teams without progress', () => {
      const teamWithoutProgress = {
        ...mockTeams.team1,
        progress: null,
      };

      renderWithProviders(
        <TeamProgressCard team={teamWithoutProgress} />
      );

      expectElementToHaveText(
        screen.getByText(/No active goal/i),
        'No active goal'
      );
    });

    it('should handle completed goals', () => {
      const completedTeam = {
        ...mockTeam,
        progress: {
          currentDistance: 200000,
          targetDistance: 200000,
          percentComplete: 100,
        },
      };

      renderWithProviders(
        <TeamProgressCard team={completedTeam} />
      );

      expectElementToHaveText(
        screen.getByText(/100%/i),
        '100%'
      );

      expectElementToHaveText(
        screen.getByText(/Goal Completed!/i),
        'Goal Completed!'
      );

      const progressBar = screen.getByRole('progressbar');
      const progressFill = progressBar.querySelector('.bg-primary');
      expect(progressFill).toHaveStyle('width: 100%');
    });

    it('should be clickable and navigate to team details', () => {
      const mockPush = vi.fn();
      
      // Mock useRouter
      vi.mock('next/navigation', () => ({
        useRouter: () => ({ push: mockPush }),
      }));

      renderWithProviders(
        <TeamProgressCard team={mockTeam} />
      );

      const card = screen.getByRole('button', { name: /view team details/i });
      fireEvent.click(card);

      expect(mockPush).toHaveBeenCalledWith(`/teams/${mockTeam.id}`);
    });
  });

  describe('RecentActivities', () => {
    const mockActivitiesList = [mockActivities.activity1, mockActivities.activity2];

    it('should display list of recent activities', () => {
      renderWithProviders(
        <RecentActivities activities={mockActivitiesList} />
      );

      expectElementToHaveText(
        screen.getByText(/Recent Activities/i),
        'Recent Activities'
      );

      // Check both activities are displayed
      expect(screen.getByText(/Morning walk/i)).toBeInTheDocument();
      expect(screen.getByText(/Morning run/i)).toBeInTheDocument();

      // Check distances
      expect(screen.getByText(/5\.0 km/i)).toBeInTheDocument();
      expect(screen.getByText(/10\.0 km/i)).toBeInTheDocument();
    });

    it('should handle empty activity list', () => {
      renderWithProviders(
        <RecentActivities activities={[]} />
      );

      expectElementToHaveText(
        screen.getByText(/No recent activities/i),
        'No recent activities'
      );

      expectElementToHaveText(
        screen.getByText(/Log your first activity/i),
        'Log your first activity to see it here!'
      );
    });

    it('should limit number of displayed activities', () => {
      const manyActivities = Array.from({ length: 15 }, (_, i) => ({
        ...mockActivities.activity1,
        id: `activity-${i}`,
        note: `Activity ${i}`,
      }));

      renderWithProviders(
        <RecentActivities activities={manyActivities} limit={5} />
      );

      // Should only show 5 activities
      const activityItems = screen.getAllByTestId(/activity-item/);
      expect(activityItems).toHaveLength(5);
    });

    it('should show "View All" link when there are more activities', () => {
      const manyActivities = Array.from({ length: 10 }, (_, i) => ({
        ...mockActivities.activity1,
        id: `activity-${i}`,
      }));

      renderWithProviders(
        <RecentActivities activities={manyActivities} limit={5} />
      );

      const viewAllLink = screen.getByText(/View All Activities/i);
      expectElementToBeVisible(viewAllLink);
      expect(viewAllLink).toHaveAttribute('href', '/activities');
    });
  });

  describe('ActivityFeedItem', () => {
    it('should display activity information correctly', () => {
      renderWithProviders(
        <ActivityFeedItem activity={mockActivities.activity1} />
      );

      // Distance and duration
      expectElementToHaveText(
        screen.getByText(/5\.0 km/i),
        '5.0 km'
      );

      expectElementToHaveText(
        screen.getByText(/1h 0m/i),
        '1h 0m'
      );

      // Activity note
      expectElementToHaveText(
        screen.getByText(/Morning walk/i),
        'Morning walk'
      );

      // Team information
      expectElementToHaveText(
        screen.getByText(mockTeams.team1.name),
        mockTeams.team1.name
      );
    });

    it('should format time correctly for different durations', () => {
      const activityShort = {
        ...mockActivities.activity1,
        duration: 1800, // 30 minutes
      };

      const activityLong = {
        ...mockActivities.activity1,
        duration: 7200, // 2 hours
      };

      const { rerender } = renderWithProviders(
        <ActivityFeedItem activity={activityShort} />
      );

      expectElementToHaveText(
        screen.getByText(/30m/i),
        '30m'
      );

      rerender(<ActivityFeedItem activity={activityLong} />);

      expectElementToHaveText(
        screen.getByText(/2h 0m/i),
        '2h 0m'
      );
    });

    it('should show privacy indicator for private activities', () => {
      const privateActivity = {
        ...mockActivities.activity1,
        isPrivate: true,
      };

      renderWithProviders(
        <ActivityFeedItem activity={privateActivity} />
      );

      const privateIcon = screen.getByTestId('private-icon');
      expectElementToBeVisible(privateIcon);
    });

    it('should display relative time correctly', () => {
      const recentActivity = {
        ...mockActivities.activity1,
        activityDate: new Date().toISOString(), // Just now
      };

      renderWithProviders(
        <ActivityFeedItem activity={recentActivity} />
      );

      expectElementToHaveText(
        screen.getByText(/just now|few seconds ago/i),
        expect.stringMatching(/just now|few seconds ago/i)
      );
    });

    it('should handle multiple teams', () => {
      const multiTeamActivity = {
        ...mockActivities.activity1,
        teams: [
          { id: mockTeams.team1.id, name: mockTeams.team1.name },
          { id: mockTeams.team2.id, name: mockTeams.team2.name },
        ],
      };

      renderWithProviders(
        <ActivityFeedItem activity={multiTeamActivity} />
      );

      expectElementToHaveText(
        screen.getByText(mockTeams.team1.name),
        mockTeams.team1.name
      );

      expectElementToHaveText(
        screen.getByText(mockTeams.team2.name),
        mockTeams.team2.name
      );
    });
  });

  describe('RealtimeLeaderboard', () => {
    beforeEach(() => {
      mockFetch({
        '/api/v1/leaderboards': mockApiResponses.leaderboard,
      });
    });

    it('should display team leaderboard correctly', async () => {
      renderWithProviders(
        <RealtimeLeaderboard teamId={mockTeams.team1.id} />
      );

      await waitFor(() => {
        expectElementToHaveText(
          screen.getByText(/Team Leaderboard/i),
          'Team Leaderboard'
        );
      });

      // Check leaderboard entries
      await waitFor(() => {
        expectElementToHaveText(
          screen.getByText(/Test User/i),
          'Test User'
        );

        expectElementToHaveText(
          screen.getByText(/John Doe/i),
          'John Doe'
        );
      });

      // Check distances
      expect(screen.getByText(/30\.0 km/i)).toBeInTheDocument();
      expect(screen.getByText(/20\.0 km/i)).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      renderWithProviders(
        <RealtimeLeaderboard teamId={mockTeams.team1.id} />
      );

      expectElementToBeVisible(
        screen.getByTestId('leaderboard-loading')
      );
    });

    it('should handle empty leaderboard', async () => {
      mockFetch({
        '/api/v1/leaderboards': {
          success: true,
          data: { ...mockLeaderboard, members: [] },
        },
      });

      renderWithProviders(
        <RealtimeLeaderboard teamId={mockTeams.team1.id} />
      );

      await waitFor(() => {
        expectElementToHaveText(
          screen.getByText(/No activities yet/i),
          'No activities yet'
        );
      });
    });

    it('should update with real-time data', async () => {
      const { queryClient } = renderWithProviders(
        <RealtimeLeaderboard teamId={mockTeams.team1.id} />
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText(/Test User/i)).toBeInTheDocument();
      });

      // Simulate real-time update
      const updatedLeaderboard = {
        ...mockLeaderboard,
        members: [
          {
            ...mockLeaderboard.members[0],
            totalDistance: 35000, // Updated distance
          },
          ...mockLeaderboard.members.slice(1),
        ],
      };

      // Update query cache to simulate real-time update
      queryClient.setQueryData(
        ['leaderboard', mockTeams.team1.id],
        { success: true, data: updatedLeaderboard }
      );

      await waitFor(() => {
        expect(screen.getByText(/35\.0 km/i)).toBeInTheDocument();
      });
    });

    it('should handle different time periods', async () => {
      const { rerender } = renderWithProviders(
        <RealtimeLeaderboard teamId={mockTeams.team1.id} period="week" />
      );

      await waitForAsyncOperations();

      // Should fetch with week parameter
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('period=week'),
        expect.any(Object)
      );

      rerender(
        <RealtimeLeaderboard teamId={mockTeams.team1.id} period="month" />
      );

      await waitForAsyncOperations();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('period=month'),
        expect.any(Object)
      );
    });
  });

  describe('TeamProgressOverview', () => {
    beforeEach(() => {
      mockFetch({
        '/api/v1/teams/progress': mockApiResponses.teamProgress,
      });
    });

    it('should display team progress overview', async () => {
      renderWithProviders(
        <TeamProgressOverview teamId={mockTeams.team1.id} />
      );

      await waitFor(() => {
        expectElementToHaveText(
          screen.getByText(/Team Progress/i),
          'Team Progress'
        );
      });

      // Check progress information
      await waitFor(() => {
        expectElementToHaveText(
          screen.getByText(/25%/i),
          '25%'
        );

        expectElementToHaveText(
          screen.getByText(/50\.0 km/i),
          '50.0 km'
        );

        expectElementToHaveText(
          screen.getByText(/200\.0 km/i),
          '200.0 km'
        );
      });
    });

    it('should show top contributors', async () => {
      renderWithProviders(
        <TeamProgressOverview teamId={mockTeams.team1.id} />
      );

      await waitFor(() => {
        expectElementToHaveText(
          screen.getByText(/Top Contributors/i),
          'Top Contributors'
        );
      });

      // Check contributor information
      await waitFor(() => {
        expectElementToHaveText(
          screen.getByText(/Test User/i),
          'Test User'
        );

        expectElementToHaveText(
          screen.getByText(/30\.0 km/i),
          '30.0 km'
        );
      });
    });

    it('should update progress with real-time updates', async () => {
      const { queryClient } = renderWithProviders(
        <TeamProgressOverview teamId={mockTeams.team1.id} />
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText(/25%/i)).toBeInTheDocument();
      });

      // Simulate progress update
      const updatedProgress = {
        ...mockTeamProgress,
        totalDistance: 60000,
        percentComplete: 30,
      };

      queryClient.setQueryData(
        ['teamProgress', mockTeams.team1.id],
        { success: true, data: updatedProgress }
      );

      await waitFor(() => {
        expect(screen.getByText(/30%/i)).toBeInTheDocument();
        expect(screen.getByText(/60\.0 km/i)).toBeInTheDocument();
      });
    });

    it('should show estimated completion date', async () => {
      renderWithProviders(
        <TeamProgressOverview teamId={mockTeams.team1.id} />
      );

      await waitFor(() => {
        expectElementToHaveText(
          screen.getByText(/Estimated Completion/i),
          'Estimated Completion'
        );
      });

      // Should show formatted date
      await waitFor(() => {
        expect(screen.getByText(/Feb 15, 2025/i)).toBeInTheDocument();
      });
    });

    it('should handle pace status indicators', async () => {
      renderWithProviders(
        <TeamProgressOverview teamId={mockTeams.team1.id} />
      );

      await waitFor(() => {
        expectElementToHaveText(
          screen.getByText(/On Track/i),
          'On Track'
        );
      });

      const statusIndicator = screen.getByTestId('pace-status');
      expect(statusIndicator).toHaveClass('text-green-600'); // On track color
    });
  });

  describe('Integration and Performance', () => {
    it('should handle concurrent component loading', async () => {
      mockFetch({
        '/api/v1/dashboard': mockApiResponses.dashboard,
        '/api/v1/leaderboards': mockApiResponses.leaderboard,
        '/api/v1/teams/progress': mockApiResponses.teamProgress,
      });

      renderWithProviders(
        <div>
          <RealtimeLeaderboard teamId={mockTeams.team1.id} />
          <TeamProgressOverview teamId={mockTeams.team1.id} />
          <RecentActivities activities={mockActivitiesList} />
        </div>
      );

      // All components should load without conflicts
      await waitFor(() => {
        expect(screen.getByText(/Team Leaderboard/i)).toBeInTheDocument();
        expect(screen.getByText(/Team Progress/i)).toBeInTheDocument();
        expect(screen.getByText(/Recent Activities/i)).toBeInTheDocument();
      });
    });

    it('should be accessible with proper ARIA labels', () => {
      renderWithProviders(
        <DashboardStats stats={mockUserStats} />
      );

      // Check accessibility attributes
      const statsContainer = screen.getByRole('region', { name: /user statistics/i });
      expectElementToBeVisible(statsContainer);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label');
    });

    it('should handle error states gracefully', async () => {
      mockFetch({
        '/api/v1/leaderboards': {
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' }),
        },
      });

      renderWithProviders(
        <RealtimeLeaderboard teamId={mockTeams.team1.id} />
      );

      await waitFor(() => {
        expectElementToHaveText(
          screen.getByText(/Failed to load leaderboard/i),
          'Failed to load leaderboard'
        );
      });
    });
  });
});