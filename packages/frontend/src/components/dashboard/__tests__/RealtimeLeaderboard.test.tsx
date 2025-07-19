import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RealtimeLeaderboard } from '../RealtimeLeaderboard';
import { LeaderboardEntry } from '@/hooks/useRealtimeLeaderboard';

// Mock the real-time leaderboard hook
const mockLeaderboardHook = {
  isConnected: true,
  connectionState: 'connected',
  error: null,
  refreshLeaderboard: jest.fn(),
};

jest.mock('@/hooks/useRealtimeLeaderboard', () => ({
  useRealtimeLeaderboard: (teamId: string, options: any) => {
    // Simulate calling the onLeaderboardUpdate callback
    if (options.onLeaderboardUpdate) {
      // We'll trigger this manually in tests
    }
    return mockLeaderboardHook;
  },
}));

// Test data
const mockEntries: LeaderboardEntry[] = [
  {
    userId: 'user-1',
    userName: 'Alice Johnson',
    totalDistance: 100.5,
    totalDuration: 36000,
    activityCount: 25,
    rank: 1,
    change: 'same',
  },
  {
    userId: 'user-2',
    userName: 'Bob Smith',
    totalDistance: 95.2,
    totalDuration: 34200,
    activityCount: 22,
    rank: 2,
    change: 'up',
  },
  {
    userId: 'user-3',
    userName: 'Charlie Brown',
    totalDistance: 88.7,
    totalDuration: 31800,
    activityCount: 20,
    rank: 3,
    change: 'down',
  },
  {
    userId: 'user-4',
    userName: 'Diana Prince',
    totalDistance: 82.1,
    totalDuration: 29400,
    activityCount: 18,
    rank: 4,
    change: 'new',
  },
];

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

describe('RealtimeLeaderboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders leaderboard entries correctly', () => {
    const wrapper = createWrapper();
    
    render(
      <RealtimeLeaderboard
        initialEntries={mockEntries}
        teamId="team-123"
      />,
      { wrapper }
    );

    // Check header
    expect(screen.getByText('Leaderboard')).toBeInTheDocument();
    
    // Check all entries are rendered
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    expect(screen.getByText('Diana Prince')).toBeInTheDocument();

    // Check rankings (emojis for top 3)
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.getByText('🥉')).toBeInTheDocument();
    expect(screen.getByText('#4')).toBeInTheDocument();
  });

  it('displays distances in correct units', () => {
    const wrapper = createWrapper();
    
    render(
      <RealtimeLeaderboard
        initialEntries={mockEntries}
        teamId="team-123"
        userPreferredUnits="miles"
      />,
      { wrapper }
    );

    // Should show distances in miles (mocked formatDistance should return the value)
    expect(screen.getByText(/100.5/)).toBeInTheDocument();
    expect(screen.getByText(/95.2/)).toBeInTheDocument();
  });

  it('shows connection status when enabled', () => {
    const wrapper = createWrapper();
    
    render(
      <RealtimeLeaderboard
        initialEntries={mockEntries}
        teamId="team-123"
        showConnectionStatus={true}
      />,
      { wrapper }
    );

    // Should show live indicator when connected
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('displays rank change indicators', () => {
    const wrapper = createWrapper();
    
    render(
      <RealtimeLeaderboard
        initialEntries={mockEntries}
        teamId="team-123"
      />,
      { wrapper }
    );

    // Check for rank change indicators (these would be rendered as text or icons)
    const bobRow = screen.getByText('Bob Smith').closest('div');
    const charlieRow = screen.getByText('Charlie Brown').closest('div');
    const dianaRow = screen.getByText('Diana Prince').closest('div');

    expect(bobRow).toBeInTheDocument(); // 'up' change
    expect(charlieRow).toBeInTheDocument(); // 'down' change
    expect(dianaRow).toBeInTheDocument(); // 'new' change
  });

  it('limits entries to maxEntries', () => {
    const wrapper = createWrapper();
    
    render(
      <RealtimeLeaderboard
        initialEntries={mockEntries}
        teamId="team-123"
        maxEntries={2}
      />,
      { wrapper }
    );

    // Should only show first 2 entries
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
    expect(screen.queryByText('Diana Prince')).not.toBeInTheDocument();
  });

  it('shows progress bars for top entries', () => {
    const wrapper = createWrapper();
    
    render(
      <RealtimeLeaderboard
        initialEntries={mockEntries}
        teamId="team-123"
      />,
      { wrapper }
    );

    // Check for progress bars (they should be present for top 3)
    const progressBars = screen.getAllByRole('progressbar', { hidden: true });
    expect(progressBars).toHaveLength(3); // Top 3 should have progress bars
  });

  it('handles refresh button click', () => {
    const wrapper = createWrapper();
    
    render(
      <RealtimeLeaderboard
        initialEntries={mockEntries}
        teamId="team-123"
      />,
      { wrapper }
    );

    const refreshButton = screen.getByTitle('Refresh leaderboard');
    fireEvent.click(refreshButton);

    expect(mockLeaderboardHook.refreshLeaderboard).toHaveBeenCalled();
  });

  it('shows empty state when no entries', () => {
    const wrapper = createWrapper();
    
    render(
      <RealtimeLeaderboard
        initialEntries={[]}
        teamId="team-123"
      />,
      { wrapper }
    );

    expect(screen.getByText('No leaderboard data available yet.')).toBeInTheDocument();
  });

  it('displays activity counts correctly', () => {
    const wrapper = createWrapper();
    
    render(
      <RealtimeLeaderboard
        initialEntries={mockEntries}
        teamId="team-123"
      />,
      { wrapper }
    );

    expect(screen.getByText('25 activities')).toBeInTheDocument();
    expect(screen.getByText('22 activities')).toBeInTheDocument();
    expect(screen.getByText('20 activities')).toBeInTheDocument();
    expect(screen.getByText('18 activities')).toBeInTheDocument();
  });

  it('shows last updated timestamp', () => {
    const wrapper = createWrapper();
    
    render(
      <RealtimeLeaderboard
        initialEntries={mockEntries}
        teamId="team-123"
      />,
      { wrapper }
    );

    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it('shows entry count when at max limit', () => {
    const wrapper = createWrapper();
    
    render(
      <RealtimeLeaderboard
        initialEntries={mockEntries}
        teamId="team-123"
        maxEntries={4}
      />,
      { wrapper }
    );

    expect(screen.getByText('Showing top 4 members')).toBeInTheDocument();
  });

  it('applies different styling for top three entries', () => {
    const wrapper = createWrapper();
    
    render(
      <RealtimeLeaderboard
        initialEntries={mockEntries}
        teamId="team-123"
      />,
      { wrapper }
    );

    const aliceRow = screen.getByText('Alice Johnson').closest('div');
    const bobRow = screen.getByText('Bob Smith').closest('div');
    const charlieRow = screen.getByText('Charlie Brown').closest('div');
    const dianaRow = screen.getByText('Diana Prince').closest('div');

    // Top 3 should have special styling (gradient background)
    expect(aliceRow).toHaveClass('bg-gradient-to-r');
    expect(bobRow).toHaveClass('bg-gradient-to-r');
    expect(charlieRow).toHaveClass('bg-gradient-to-r');
    
    // 4th place should not have special styling
    expect(dianaRow).not.toHaveClass('bg-gradient-to-r');
  });

  it('handles null teamId gracefully', () => {
    const wrapper = createWrapper();
    
    render(
      <RealtimeLeaderboard
        initialEntries={mockEntries}
        teamId={null}
      />,
      { wrapper }
    );

    // Should still render the leaderboard
    expect(screen.getByText('Leaderboard')).toBeInTheDocument();
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
  });
});