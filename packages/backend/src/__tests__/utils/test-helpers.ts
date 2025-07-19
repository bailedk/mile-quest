/**
 * Test helper utilities for backend testing
 */
import { PrismaClient, User, Team, Activity, TeamMember, TeamGoal } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import jwt from 'jsonwebtoken';

export type MockPrisma = DeepMockProxy<PrismaClient>;

/**
 * Create a mock Prisma client for testing
 */
export function createMockPrisma(): MockPrisma {
  return mockDeep<PrismaClient>();
}

/**
 * Mock user data for testing
 */
export const mockUsers = {
  user1: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  } as User,
  user2: {
    id: 'user-456',
    email: 'john@example.com',
    name: 'John Doe',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  } as User,
  user3: {
    id: 'user-789',
    email: 'jane@example.com',
    name: 'Jane Smith',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  } as User,
};

/**
 * Mock team data for testing
 */
export const mockTeams = {
  team1: {
    id: 'team-123',
    name: 'Test Team',
    createdBy: mockUsers.user1.id,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  } as Team,
  team2: {
    id: 'team-456',
    name: 'Walking Group',
    createdBy: mockUsers.user2.id,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  } as Team,
};

/**
 * Mock team member data for testing
 */
export const mockTeamMembers = {
  user1InTeam1: {
    id: 'member-1',
    teamId: mockTeams.team1.id,
    userId: mockUsers.user1.id,
    role: 'ADMIN' as const,
    joinedAt: new Date('2025-01-01'),
    leftAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  } as TeamMember,
  user2InTeam1: {
    id: 'member-2',
    teamId: mockTeams.team1.id,
    userId: mockUsers.user2.id,
    role: 'MEMBER' as const,
    joinedAt: new Date('2025-01-01'),
    leftAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  } as TeamMember,
  user1InTeam2: {
    id: 'member-3',
    teamId: mockTeams.team2.id,
    userId: mockUsers.user1.id,
    role: 'MEMBER' as const,
    joinedAt: new Date('2025-01-01'),
    leftAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  } as TeamMember,
};

/**
 * Mock team goal data for testing
 */
export const mockTeamGoals = {
  goal1: {
    id: 'goal-123',
    teamId: mockTeams.team1.id,
    name: 'Walk to NYC',
    startPoint: { lat: 42.3601, lng: -71.0589 }, // Boston
    endPoint: { lat: 40.7128, lng: -74.0060 }, // NYC
    targetDistance: 200000, // 200km
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-03-01'),
    status: 'ACTIVE' as const,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  } as TeamGoal,
  goal2: {
    id: 'goal-456',
    teamId: mockTeams.team2.id,
    name: 'Monthly Challenge',
    startPoint: { lat: 37.7749, lng: -122.4194 }, // SF
    endPoint: { lat: 34.0522, lng: -118.2437 }, // LA
    targetDistance: 100000, // 100km
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-02-01'),
    status: 'ACTIVE' as const,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  } as TeamGoal,
};

/**
 * Mock activity data for testing
 */
export const mockActivities = {
  activity1: {
    id: 'activity-123',
    userId: mockUsers.user1.id,
    activityType: 'WALK' as const,
    distance: 5000, // 5km
    duration: 3600, // 1 hour
    pace: 12.0, // 12 min/km
    startTime: new Date('2025-01-15T10:00:00Z'),
    activityDate: new Date('2025-01-15'),
    notes: 'Morning walk',
    isPrivate: false,
    source: 'MANUAL' as const,
    createdAt: new Date('2025-01-15T10:00:00Z'),
    updatedAt: new Date('2025-01-15T10:00:00Z'),
  } as Activity,
  activity2: {
    id: 'activity-456',
    userId: mockUsers.user2.id,
    activityType: 'RUN' as const,
    distance: 10000, // 10km
    duration: 2700, // 45 minutes
    pace: 4.5, // 4.5 min/km
    startTime: new Date('2025-01-16T07:00:00Z'),
    activityDate: new Date('2025-01-16'),
    notes: 'Morning run',
    isPrivate: false,
    source: 'MANUAL' as const,
    createdAt: new Date('2025-01-16T07:00:00Z'),
    updatedAt: new Date('2025-01-16T07:00:00Z'),
  } as Activity,
  privateActivity: {
    id: 'activity-789',
    userId: mockUsers.user3.id,
    activityType: 'WALK' as const,
    distance: 3000, // 3km
    duration: 1800, // 30 minutes
    pace: 10.0, // 10 min/km
    startTime: new Date('2025-01-17T19:00:00Z'),
    activityDate: new Date('2025-01-17'),
    notes: 'Evening walk',
    isPrivate: true, // Private activity
    source: 'MANUAL' as const,
    createdAt: new Date('2025-01-17T19:00:00Z'),
    updatedAt: new Date('2025-01-17T19:00:00Z'),
  } as Activity,
};

/**
 * Create a mock JWT token for testing
 */
export function createMockToken(userId: string = mockUsers.user1.id): string {
  return jwt.sign(
    {
      sub: userId,
      email: mockUsers.user1.email,
      'cognito:username': userId,
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

/**
 * Create a mock API Gateway event for testing
 */
export function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  const token = createMockToken();
  
  return {
    resource: '/api/v1/test',
    path: '/api/v1/test',
    httpMethod: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      path: '/test/api/v1/test',
      stage: 'test',
      requestId: 'test-request-id',
      requestTime: '01/Jan/2025:00:00:00 +0000',
      requestTimeEpoch: 1640995200000,
      resourceId: 'test-resource',
      resourcePath: '/api/v1/test',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
      authorizer: null,
    },
    body: null,
    isBase64Encoded: false,
    ...overrides,
  };
}

/**
 * Create a mock Lambda context for testing
 */
export function createMockContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2025/01/19/[$LATEST]test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };
}

/**
 * Create mock team with members for testing
 */
export function createMockTeamWithMembers() {
  return {
    ...mockTeams.team1,
    members: [
      {
        ...mockTeamMembers.user1InTeam1,
        user: mockUsers.user1,
      },
      {
        ...mockTeamMembers.user2InTeam1,
        user: mockUsers.user2,
      },
    ],
    goals: [mockTeamGoals.goal1],
  };
}

/**
 * Create mock activity with team relations for testing
 */
export function createMockActivityWithTeams(activityId: string = mockActivities.activity1.id) {
  return {
    ...mockActivities.activity1,
    id: activityId,
    user: mockUsers.user1,
    teamActivities: [
      {
        id: 'team-activity-1',
        activityId,
        teamId: mockTeams.team1.id,
        team: mockTeams.team1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };
}

/**
 * Create mock team progress data for testing
 */
export function createMockTeamProgress(teamId: string = mockTeams.team1.id) {
  return {
    teamId,
    teamGoalId: mockTeamGoals.goal1.id,
    totalDistance: 45000, // 45km
    currentProgress: 22.5, // 22.5%
    remainingDistance: 155000, // 155km
    estimatedCompletionDate: new Date('2025-02-15'),
    paceStatus: 'ON_TRACK' as const,
    lastUpdated: new Date(),
    topContributors: [
      {
        userId: mockUsers.user1.id,
        name: mockUsers.user1.name,
        distance: 25000,
        activityCount: 5,
      },
      {
        userId: mockUsers.user2.id,
        name: mockUsers.user2.name,
        distance: 20000,
        activityCount: 4,
      },
    ],
  };
}

/**
 * Create mock user stats for testing
 */
export function createMockUserStats(userId: string = mockUsers.user1.id) {
  return {
    userId,
    totalDistance: 75000, // 75km
    totalDuration: 36000, // 10 hours
    totalActivities: 15,
    averagePace: 8.0, // 8 min/km
    averageDistance: 5000, // 5km per activity
    currentStreak: 7, // 7 days
    longestStreak: 14, // 14 days
    lastActivityDate: new Date('2025-01-18'),
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
}

/**
 * Create mock dashboard data for testing
 */
export function createMockDashboardData(userId: string = mockUsers.user1.id) {
  return {
    user: {
      teams: [
        {
          ...mockTeams.team1,
          progress: {
            currentDistance: 45000,
            targetDistance: 200000,
            percentComplete: 22.5,
          },
        },
        {
          ...mockTeams.team2,
          progress: {
            currentDistance: 30000,
            targetDistance: 100000,
            percentComplete: 30.0,
          },
        },
      ],
      recentActivities: [
        createMockActivityWithTeams('activity-recent-1'),
        createMockActivityWithTeams('activity-recent-2'),
      ],
      stats: createMockUserStats(userId),
      leaderboards: [
        {
          teamId: mockTeams.team1.id,
          teamName: mockTeams.team1.name,
          topMembers: [
            {
              userId: mockUsers.user1.id,
              name: mockUsers.user1.name,
              distance: 25000,
              rank: 1,
            },
            {
              userId: mockUsers.user2.id,
              name: mockUsers.user2.name,
              distance: 20000,
              rank: 2,
            },
          ],
        },
      ],
    },
  };
}

/**
 * Mock WebSocket service for testing
 */
export const mockWebSocketService = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(undefined),
  unsubscribe: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockResolvedValue(undefined),
  isConnected: jest.fn().mockReturnValue(true),
  getConnectionState: jest.fn().mockReturnValue('connected'),
};

/**
 * Mock progress service for testing
 */
export const mockProgressService = {
  calculateTeamProgress: jest.fn().mockResolvedValue(createMockTeamProgress()),
  updateProgressAndCheckMilestones: jest.fn().mockResolvedValue({
    progressUpdated: true,
    milestoneReached: null,
  }),
  getTeamProgressHistory: jest.fn().mockResolvedValue([]),
  scheduleProgressUpdate: jest.fn().mockResolvedValue(undefined),
};

/**
 * Mock achievement service for testing
 */
export const mockAchievementService = {
  checkAchievements: jest.fn().mockResolvedValue([]),
  getUserAchievements: jest.fn().mockResolvedValue([]),
  getAchievementProgress: jest.fn().mockResolvedValue({}),
};

/**
 * Mock logger for testing
 */
export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

/**
 * Reset all mocks
 */
export function resetAllMocks() {
  jest.clearAllMocks();
  
  // Reset mock implementations
  mockWebSocketService.connect.mockResolvedValue(undefined);
  mockWebSocketService.disconnect.mockResolvedValue(undefined);
  mockWebSocketService.subscribe.mockResolvedValue(undefined);
  mockWebSocketService.unsubscribe.mockResolvedValue(undefined);
  mockWebSocketService.publish.mockResolvedValue(undefined);
  mockWebSocketService.isConnected.mockReturnValue(true);
  mockWebSocketService.getConnectionState.mockReturnValue('connected');
  
  mockProgressService.calculateTeamProgress.mockResolvedValue(createMockTeamProgress());
  mockProgressService.updateProgressAndCheckMilestones.mockResolvedValue({
    progressUpdated: true,
    milestoneReached: null,
  });
  mockProgressService.getTeamProgressHistory.mockResolvedValue([]);
  mockProgressService.scheduleProgressUpdate.mockResolvedValue(undefined);
  
  mockAchievementService.checkAchievements.mockResolvedValue([]);
  mockAchievementService.getUserAchievements.mockResolvedValue([]);
  mockAchievementService.getAchievementProgress.mockResolvedValue({});
}