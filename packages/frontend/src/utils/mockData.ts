import { TeamListItem } from '@/types/team.types';
import { ActivityStats, TeamGoalProgress } from '@/types/activity.types';
import { subDays, subHours } from 'date-fns';

// Mock user data
export const mockUser = {
  id: 'user-123',
  name: 'Sarah Johnson',
  email: 'sarah@example.com',
  preferredUnits: 'miles' as const,
};

// Mock teams data
export const mockTeams: TeamListItem[] = [
  {
    id: 'team-1',
    name: 'Walking Warriors',
    description: 'We walk together, we grow stronger!',
    avatarUrl: null,
    memberCount: 4,
    role: 'MEMBER',
    joinedAt: subDays(new Date(), 30).toISOString(),
  },
  {
    id: 'team-2',
    name: 'Morning Strollers',
    description: 'Early bird walkers unite!',
    avatarUrl: null,
    memberCount: 6,
    role: 'ADMIN',
    joinedAt: subDays(new Date(), 15).toISOString(),
  },
];

// Mock team progress data
export const mockTeamProgress: Record<string, TeamGoalProgress> = {
  'team-1': {
    totalDistance: 32000, // 32km
    targetDistance: 100000, // 100km
    percentageComplete: 32,
    remainingDistance: 68000,
    averageDailyDistance: 3200,
    daysRemaining: 21,
    onTrack: true,
  },
  'team-2': {
    totalDistance: 45000, // 45km
    targetDistance: 50000, // 50km
    percentageComplete: 90,
    remainingDistance: 5000,
    averageDailyDistance: 5000,
    daysRemaining: 7,
    onTrack: true,
  },
};

// Mock user stats
export const mockUserStats: ActivityStats = {
  totalDistance: 125000, // 125km total
  totalActivities: 45,
  totalDuration: 162000, // 45 hours
  averageDistance: 2777, // ~2.8km per activity
  averageDuration: 3600, // 1 hour average
  currentStreak: 7,
  longestStreak: 14,
  lastActivityAt: subHours(new Date(), 3).toISOString(),
};

// Mock recent activities
export const mockRecentActivities = [
  {
    id: 'activity-1',
    userName: 'Mike Chen',
    userInitials: 'MC',
    distance: 3500, // 3.5km
    duration: 2700, // 45 minutes
    timestamp: subHours(new Date(), 1).toISOString(),
    notes: 'Beautiful morning walk in the park',
  },
  {
    id: 'activity-2',
    userName: 'Lisa Brown',
    userInitials: 'LB',
    distance: 2800, // 2.8km
    duration: 2100, // 35 minutes
    timestamp: subHours(new Date(), 3).toISOString(),
    notes: undefined,
  },
  {
    id: 'activity-3',
    userName: 'You',
    userInitials: 'YO',
    distance: 4200, // 4.2km
    duration: 3000, // 50 minutes
    timestamp: subHours(new Date(), 5).toISOString(),
    notes: 'Great walk with the team!',
  },
  {
    id: 'activity-4',
    userName: 'Tom Wilson',
    userInitials: 'TW',
    distance: 1800, // 1.8km
    duration: 1500, // 25 minutes
    timestamp: subHours(new Date(), 8).toISOString(),
    notes: 'Quick lunch walk',
  },
  {
    id: 'activity-5',
    userName: 'Sarah Johnson',
    userInitials: 'SJ',
    distance: 5000, // 5km
    duration: 3600, // 1 hour
    timestamp: subHours(new Date(), 24).toISOString(),
    notes: 'Evening stroll by the river',
  },
];

// Mock dashboard stats
export const mockDashboardStats = {
  totalDistance: 125000, // 125km all time
  weekDistance: 22500, // 22.5km this week
  bestDay: {
    date: 'Monday',
    distance: 6700, // 6.7km
  },
};

// Mock team members data for leaderboard
export const mockTeamMembers: Record<string, Array<{
  userId: string;
  name: string;
  totalDistance: number;
  weekDistance: number;
  rank: number;
  isCurrentUser: boolean;
}>> = {
  'team-1': [
    { userId: 'user-123', name: 'Sarah', totalDistance: 12500, weekDistance: 12500, rank: 1, isCurrentUser: true },
    { userId: 'user-456', name: 'Mike', totalDistance: 10200, weekDistance: 10200, rank: 2, isCurrentUser: false },
    { userId: 'user-789', name: 'Lisa', totalDistance: 8300, weekDistance: 8300, rank: 3, isCurrentUser: false },
    { userId: 'user-012', name: 'Tom', totalDistance: 6000, weekDistance: 6000, rank: 4, isCurrentUser: false },
  ],
  'team-2': [
    { userId: 'user-123', name: 'Sarah', totalDistance: 15000, weekDistance: 15000, rank: 1, isCurrentUser: true },
    { userId: 'user-345', name: 'Alex', totalDistance: 12000, weekDistance: 12000, rank: 2, isCurrentUser: false },
    { userId: 'user-678', name: 'Emma', totalDistance: 9000, weekDistance: 9000, rank: 3, isCurrentUser: false },
    { userId: 'user-901', name: 'James', totalDistance: 5000, weekDistance: 5000, rank: 4, isCurrentUser: false },
    { userId: 'user-234', name: 'Olivia', totalDistance: 3000, weekDistance: 3000, rank: 5, isCurrentUser: false },
    { userId: 'user-567', name: 'Noah', totalDistance: 1000, weekDistance: 1000, rank: 6, isCurrentUser: false },
  ],
};

// Helper to get mock data with delays (simulating API calls)
export async function getMockDataWithDelay<T>(data: T, delay = 500): Promise<T> {
  await new Promise(resolve => setTimeout(resolve, delay));
  return data;
}