import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth.store';
import { transformLeaderboardData } from '@/utils/dashboardDataTransforms';
import type { TeamLeaderboard } from '@/types/dashboard';
import DashboardPage from './page';

const userId = 'user-alice';

const leaderboard: TeamLeaderboard = {
  teamId: 'team-1',
  teamName: 'Harbor Walkers',
  members: [
    { userId, name: 'Alice', avatarUrl: null, distance: 3200, percentage: 80 },
    { userId: 'user-bob', name: 'Bob', avatarUrl: null, distance: 1500, percentage: 37 },
  ],
};

const dashboardState = vi.hoisted(() => ({
  current: null as null | Record<string, unknown>,
}));

vi.mock('@/hooks/useDashboardData', () => ({
  useDashboardData: () => dashboardState.current,
}));

vi.mock('@/contexts/HydrationContext', () => ({
  useHydration: () => ({ isHydrated: true, isAuthInitialized: true }),
}));

describe('dashboard page with API payloads', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: userId,
        email: 'alice@example.com',
        name: 'Alice',
        emailVerified: true,
        preferredUnits: 'miles',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    dashboardState.current = {
      dashboardData: { teams: [], teamLeaderboards: [] },
      loading: false,
      error: null,
      refresh: vi.fn(),
      teams: [
        {
          id: 'team-1',
          name: 'Harbor Walkers',
          description: null,
          avatarUrl: null,
          memberCount: 2,
          role: 'admin',
          progress: {
            goalId: 'goal-1',
            goalName: 'Wharf to Ferry',
            currentDistance: 4700,
            targetDistance: 8000,
            percentComplete: 59,
            daysRemaining: 12,
            isOnTrack: true,
            startDate: '2026-10-01T00:00:00.000Z',
            endDate: '2026-11-01T00:00:00.000Z',
            status: 'ACTIVE',
          },
        },
      ],
      recentActivities: [
        {
          id: 'act-1',
          userId,
          userName: 'Alice',
          distance: 3200,
          duration: 1800,
          notes: 'Morning loop',
          createdAt: '2026-10-20T15:00:00.000Z',
          timestamp: new Date('2026-10-20T15:00:00.000Z'),
        },
      ],
      personalStats: {
        totalDistance: 3200,
        totalActivities: 1,
        currentStreak: 1,
        bestDay: { date: new Date('2026-10-20T00:00:00.000Z'), distance: 3200 },
        thisWeek: { distance: 3200, activities: 1 },
        thisMonth: { distance: 3200, activities: 1 },
      },
      teamLeaderboards: [leaderboard],
      chartData: {
        dailyProgress: [{ date: 'Oct 20', distance: 3200, cumulative: 3200 }],
        weeklyProgress: [{ date: 'Oct 20', distance: 3200, cumulative: 3200 }],
        activityBreakdown: [{ day: 'Mon', distance: 3200, activities: 1 }],
      },
    };
  });

  it('maps API leaderboard members into the swipeable leaderboard shape', () => {
    const members = transformLeaderboardData(leaderboard.members, userId);
    expect(members[0]).toMatchObject({
      userId,
      name: 'Alice',
      weekDistance: 3200,
      totalDistance: 3200,
      isCurrentUser: true,
      rank: 1,
    });
    expect(members[1].isCurrentUser).toBe(false);
  });

  it('renders a seeded team dashboard without throwing', () => {
    render(<DashboardPage />);

    expect(screen.getByText('Wharf to Ferry')).toBeInTheDocument();
    expect(screen.getByText('Alice (You)')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText(/Morning loop/)).toBeInTheDocument();
    expect(screen.queryByText('Application Error')).not.toBeInTheDocument();
  });
});
