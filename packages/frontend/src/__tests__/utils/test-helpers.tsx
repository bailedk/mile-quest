/**
 * Test helper utilities for frontend testing
 */
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { MockWebSocketService } from '@/services/websocket/mock.service';
import { MockAuthService } from '@/services/auth/mock.service';

// Mock data for testing
export const mockUsers = {
  user1: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: '2025-01-01T00:00:00Z',
  },
  user2: {
    id: 'user-456',
    email: 'john@example.com',
    name: 'John Doe',
    createdAt: '2025-01-01T00:00:00Z',
  },
};

export const mockTeams = {
  team1: {
    id: 'team-123',
    name: 'Test Team',
    memberCount: 5,
    createdAt: '2025-01-01T00:00:00Z',
    goals: [
      {
        id: 'goal-123',
        name: 'Walk to NYC',
        targetDistance: 200000, // 200km
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-03-01T00:00:00Z',
        status: 'ACTIVE' as const,
      },
    ],
  },
  team2: {
    id: 'team-456',
    name: 'Walking Group',
    memberCount: 3,
    createdAt: '2025-01-01T00:00:00Z',
    goals: [
      {
        id: 'goal-456',
        name: 'Monthly Challenge',
        targetDistance: 100000, // 100km
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-02-01T00:00:00Z',
        status: 'ACTIVE' as const,
      },
    ],
  },
};

export const mockActivities = {
  activity1: {
    id: 'activity-123',
    distance: 5000, // 5km
    duration: 3600, // 1 hour
    pace: 12.0, // 12 min/km
    activityDate: '2025-01-15T10:00:00Z',
    note: 'Morning walk',
    isPrivate: false,
    createdAt: '2025-01-15T10:00:00Z',
    teams: [{ id: mockTeams.team1.id, name: mockTeams.team1.name }],
  },
  activity2: {
    id: 'activity-456',
    distance: 10000, // 10km
    duration: 2700, // 45 minutes
    pace: 4.5, // 4.5 min/km
    activityDate: '2025-01-16T07:00:00Z',
    note: 'Morning run',
    isPrivate: false,
    createdAt: '2025-01-16T07:00:00Z',
    teams: [{ id: mockTeams.team1.id, name: mockTeams.team1.name }],
  },
};

export const mockUserStats = {
  totalDistance: 75000, // 75km
  totalDuration: 36000, // 10 hours
  totalActivities: 15,
  averagePace: 8.0, // 8 min/km
  averageDistance: 5000, // 5km per activity
  currentStreak: 7, // 7 days
  longestStreak: 14, // 14 days
  lastActivityDate: '2025-01-18T00:00:00Z',
  weeklyStats: {
    distance: 15000,
    duration: 7200,
    activities: 3,
  },
  monthlyStats: {
    distance: 75000,
    duration: 36000,
    activities: 15,
  },
};

export const mockTeamProgress = {
  teamId: mockTeams.team1.id,
  teamGoalId: mockTeams.team1.goals[0].id,
  totalDistance: 50000, // 50km
  targetDistance: 200000, // 200km
  percentComplete: 25, // 25%
  remainingDistance: 150000, // 150km
  isCompleted: false,
  estimatedCompletionDate: '2025-02-15T00:00:00Z',
  paceStatus: 'ON_TRACK' as const,
  lastUpdated: '2025-01-19T00:00:00Z',
  topContributors: [
    {
      userId: mockUsers.user1.id,
      name: mockUsers.user1.name,
      distance: 30000,
      activityCount: 6,
    },
    {
      userId: mockUsers.user2.id,
      name: mockUsers.user2.name,
      distance: 20000,
      activityCount: 4,
    },
  ],
};

export const mockLeaderboard = {
  teamId: mockTeams.team1.id,
  teamName: mockTeams.team1.name,
  members: [
    {
      userId: mockUsers.user1.id,
      name: mockUsers.user1.name,
      totalDistance: 30000,
      rank: 1,
    },
    {
      userId: mockUsers.user2.id,
      name: mockUsers.user2.name,
      totalDistance: 20000,
      rank: 2,
    },
  ],
};

export const mockDashboardData = {
  user: {
    teams: [
      {
        ...mockTeams.team1,
        progress: {
          currentDistance: 50000,
          targetDistance: 200000,
          percentComplete: 25,
        },
      },
      {
        ...mockTeams.team2,
        progress: {
          currentDistance: 30000,
          targetDistance: 100000,
          percentComplete: 30,
        },
      },
    ],
    recentActivities: [mockActivities.activity1, mockActivities.activity2],
    stats: mockUserStats,
    leaderboards: [mockLeaderboard],
  },
};

// Mock services
export const mockWebSocketService = new MockWebSocketService({
  autoConnect: true,
  simulateLatency: false,
});

export const mockAuthService = new MockAuthService({
  autoSignIn: true,
  user: mockUsers.user1,
});

// Mock API responses
export const mockApiResponses = {
  dashboard: {
    success: true,
    data: mockDashboardData,
  },
  activities: {
    success: true,
    data: {
      items: [mockActivities.activity1, mockActivities.activity2],
      hasMore: false,
      nextCursor: null,
    },
  },
  userStats: {
    success: true,
    data: { stats: mockUserStats },
  },
  teams: {
    success: true,
    data: { teams: [mockTeams.team1, mockTeams.team2] },
  },
  teamProgress: {
    success: true,
    data: mockTeamProgress,
  },
  leaderboard: {
    success: true,
    data: mockLeaderboard,
  },
};

// Test wrapper with providers
interface TestWrapperProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

export function TestWrapper({ 
  children, 
  queryClient = createTestQueryClient() 
}: TestWrapperProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Create test query client
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Custom render function with providers
export function renderWithProviders(
  ui: React.ReactElement,
  options: RenderOptions & { 
    queryClient?: QueryClient;
  } = {}
) {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <TestWrapper queryClient={queryClient}>
        {children}
      </TestWrapper>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

// Mock fetch responses
export function mockFetch(responses: Record<string, any>) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    const urlString = url.toString();
    
    for (const [pattern, response] of Object.entries(responses)) {
      if (urlString.includes(pattern)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(response),
          headers: new Headers({
            'Content-Type': 'application/json',
          }),
        } as Response);
      }
    }

    // Default error response
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    } as Response);
  });
}

// Mock IntersectionObserver for chart components
export function mockIntersectionObserver() {
  global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(() => []),
  }));
}

// Mock ResizeObserver for responsive components
export function mockResizeObserver() {
  global.ResizeObserver = vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
}

// Mock chart data generators
export function generateMockChartData(days: number = 7) {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i));
    
    return {
      date: date.toISOString().split('T')[0],
      distance: Math.floor(Math.random() * 10000) + 1000, // 1-11km
      duration: Math.floor(Math.random() * 3600) + 1800, // 30-90 minutes
      activities: Math.floor(Math.random() * 3) + 1, // 1-3 activities
    };
  });
}

export function generateMockProgressData() {
  return {
    daily: generateMockChartData(30),
    weekly: generateMockChartData(12).map((item, i) => ({
      ...item,
      week: `Week ${i + 1}`,
    })),
  };
}

// Mock user interactions
export function createMockTouchEvent(type: string, touches: Array<{ clientX: number; clientY: number }>) {
  return new TouchEvent(type, {
    touches: touches.map(touch => ({
      ...touch,
      identifier: 0,
      target: document.body,
      currentTarget: document.body,
      pageX: touch.clientX,
      pageY: touch.clientY,
      radiusX: 11.5,
      radiusY: 11.5,
      rotationAngle: 0,
      force: 0.5,
    })) as any,
    bubbles: true,
    cancelable: true,
  });
}

export function createMockMouseEvent(type: string, options: { clientX: number; clientY: number }) {
  return new MouseEvent(type, {
    ...options,
    bubbles: true,
    cancelable: true,
  });
}

// Mock local storage
export function mockLocalStorage() {
  const store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    },
  };
}

// Mock navigator APIs
export function mockNavigatorAPIs() {
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: true,
  });

  Object.defineProperty(navigator, 'connection', {
    writable: true,
    value: {
      effectiveType: '4g',
      downlink: 10,
      rtt: 100,
    },
  });

  // Mock service worker
  Object.defineProperty(navigator, 'serviceWorker', {
    writable: true,
    value: {
      register: vi.fn(() => Promise.resolve({
        active: { postMessage: vi.fn() },
        waiting: null,
        installing: null,
      })),
      ready: Promise.resolve({
        active: { postMessage: vi.fn() },
        sync: { register: vi.fn() },
      }),
    },
  });
}

// Reset all mocks
export function resetAllMocks() {
  vi.clearAllMocks();
  mockWebSocketService.reset();
  mockAuthService.reset();
  
  // Reset fetch mock
  if (global.fetch && vi.isMockFunction(global.fetch)) {
    global.fetch.mockClear();
  }
}

// Setup function for common test needs
export function setupTestEnvironment() {
  mockIntersectionObserver();
  mockResizeObserver();
  mockNavigatorAPIs();
  
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    writable: true,
    value: mockLocalStorage(),
  });

  return {
    cleanup: () => {
      resetAllMocks();
    },
  };
}

// Wait for async operations
export function waitForAsyncOperations() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// Expect helpers for common assertions
export const expectElementToBeVisible = (element: HTMLElement | null) => {
  expect(element).toBeInTheDocument();
  expect(element).toBeVisible();
};

export const expectElementToHaveText = (element: HTMLElement | null, text: string) => {
  expect(element).toBeInTheDocument();
  expect(element).toHaveTextContent(text);
};

export const expectElementToHaveClass = (element: HTMLElement | null, className: string) => {
  expect(element).toBeInTheDocument();
  expect(element).toHaveClass(className);
};