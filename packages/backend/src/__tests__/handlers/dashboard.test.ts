/**
 * Comprehensive tests for dashboard handler
 * Tests dashboard aggregation logic and user statistics
 */
import { handler } from '../../handlers/dashboard';
import { TeamService } from '../../services/team/team.service';
import { ActivityService } from '../../services/activity/activity.service';
import { ProgressService } from '../../services/progress/progress.service';
import { 
  createMockEvent,
  createMockContext,
  createMockPrisma,
  mockUsers,
  mockTeams,
  mockTeamGoals,
  createMockTeamWithMembers,
  createMockActivityWithTeams,
  createMockUserStats,
  createMockTeamProgress,
  resetAllMocks,
} from '../utils/test-helpers';

// Mock external dependencies
jest.mock('../../lib/database', () => ({
  prisma: createMockPrisma(),
}));

jest.mock('../../services/team/team.service');
jest.mock('../../services/activity/activity.service');
jest.mock('../../services/progress/progress.service');
jest.mock('../../services/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock cache
jest.mock('../../utils/cache', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    clear: jest.fn(),
  },
  cacheKeys: {
    dashboard: (userId: string) => `dashboard:${userId}`,
  },
  cacheTTL: {
    short: 300,
    medium: 3600,
    long: 86400,
  },
}));

describe('Dashboard Handler', () => {
  let mockTeamService: jest.Mocked<TeamService>;
  let mockActivityService: jest.Mocked<ActivityService>;
  let mockProgressService: jest.Mocked<ProgressService>;
  const mockContext = createMockContext();

  beforeEach(() => {
    resetAllMocks();

    // Reset service mocks
    mockTeamService = {
      getUserTeams: jest.fn(),
      getTeamById: jest.fn(),
      createTeam: jest.fn(),
      updateTeam: jest.fn(),
      joinTeam: jest.fn(),
      leaveTeam: jest.fn(),
      getTeamMembers: jest.fn(),
      getTeamLeaderboard: jest.fn(),
    } as any;

    mockActivityService = {
      getActivities: jest.fn(),
      getUserStats: jest.fn(),
      createActivity: jest.fn(),
      updateActivity: jest.fn(),
      deleteActivity: jest.fn(),
      getActivitySummary: jest.fn(),
    } as any;

    mockProgressService = {
      calculateTeamProgress: jest.fn(),
      updateProgressAndCheckMilestones: jest.fn(),
      getTeamProgressHistory: jest.fn(),
      scheduleProgressUpdate: jest.fn(),
    } as any;

    (TeamService as jest.Mock).mockImplementation(() => mockTeamService);
    (ActivityService as jest.Mock).mockImplementation(() => mockActivityService);
    (ProgressService as jest.Mock).mockImplementation(() => mockProgressService);
  });

  describe('GET /dashboard', () => {
    it('should return comprehensive dashboard data', async () => {
      const userId = mockUsers.user1.id;
      
      // Mock user teams with progress
      const mockUserTeams = [
        {
          ...mockTeams.team1,
          goals: [mockTeamGoals.goal1],
          memberCount: 5,
        },
        {
          ...mockTeams.team2,
          goals: [mockTeamGoals.goal2],
          memberCount: 3,
        },
      ];

      mockTeamService.getUserTeams.mockResolvedValue(mockUserTeams);

      // Mock team progress for each team
      const mockTeamProgress = [
        {
          ...createMockTeamProgress(mockTeams.team1.id),
          teamGoalId: mockTeamGoals.goal1.id,
          totalDistance: 50000,
          currentProgress: 25,
        },
        {
          ...createMockTeamProgress(mockTeams.team2.id),
          teamGoalId: mockTeamGoals.goal2.id,
          totalDistance: 30000,
          currentProgress: 30,
        },
      ];

      mockProgressService.calculateTeamProgress
        .mockResolvedValueOnce(mockTeamProgress[0])
        .mockResolvedValueOnce(mockTeamProgress[1]);

      // Mock recent activities
      const mockRecentActivities = {
        items: [
          {
            ...createMockActivityWithTeams('activity-1'),
            user: { id: userId, name: mockUsers.user1.name },
            teams: [{ id: mockTeams.team1.id, name: mockTeams.team1.name }],
          },
          {
            ...createMockActivityWithTeams('activity-2'),
            user: { id: mockUsers.user2.id, name: mockUsers.user2.name },
            teams: [{ id: mockTeams.team1.id, name: mockTeams.team1.name }],
          },
        ],
        hasMore: false,
        nextCursor: null,
      };

      mockActivityService.getActivities.mockResolvedValue(mockRecentActivities);

      // Mock user stats
      const mockUserStats = createMockUserStats(userId);
      mockActivityService.getUserStats.mockResolvedValue(mockUserStats);

      // Mock team leaderboards
      const mockTeamLeaderboards = [
        {
          teamId: mockTeams.team1.id,
          teamName: mockTeams.team1.name,
          members: [
            {
              userId: mockUsers.user1.id,
              name: mockUsers.user1.name,
              totalDistance: 25000,
              rank: 1,
            },
            {
              userId: mockUsers.user2.id,
              name: mockUsers.user2.name,
              totalDistance: 20000,
              rank: 2,
            },
          ],
        },
        {
          teamId: mockTeams.team2.id,
          teamName: mockTeams.team2.name,
          members: [
            {
              userId: mockUsers.user1.id,
              name: mockUsers.user1.name,
              totalDistance: 15000,
              rank: 1,
            },
          ],
        },
      ];

      mockTeamService.getTeamLeaderboard
        .mockResolvedValueOnce({ members: mockTeamLeaderboards[0].members })
        .mockResolvedValueOnce({ members: mockTeamLeaderboards[1].members });

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/dashboard',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody).toMatchObject({
        success: true,
        data: {
          user: {
            teams: expect.arrayContaining([
              expect.objectContaining({
                id: mockTeams.team1.id,
                name: mockTeams.team1.name,
                progress: expect.objectContaining({
                  currentDistance: 50000,
                  targetDistance: mockTeamGoals.goal1.targetDistance,
                  percentComplete: 25,
                }),
              }),
              expect.objectContaining({
                id: mockTeams.team2.id,
                name: mockTeams.team2.name,
                progress: expect.objectContaining({
                  currentDistance: 30000,
                  targetDistance: mockTeamGoals.goal2.targetDistance,
                  percentComplete: 30,
                }),
              }),
            ]),
            recentActivities: expect.arrayContaining([
              expect.objectContaining({
                id: 'activity-1',
                user: expect.objectContaining({
                  name: mockUsers.user1.name,
                }),
              }),
            ]),
            stats: expect.objectContaining({
              totalDistance: mockUserStats.totalDistance,
              totalActivities: mockUserStats.totalActivities,
              currentStreak: mockUserStats.currentStreak,
            }),
            leaderboards: expect.arrayContaining([
              expect.objectContaining({
                teamId: mockTeams.team1.id,
                teamName: mockTeams.team1.name,
                topMembers: expect.arrayContaining([
                  expect.objectContaining({
                    userId: mockUsers.user1.id,
                    rank: 1,
                    totalDistance: 25000,
                  }),
                ]),
              }),
            ]),
          },
        },
      });

      // Verify service calls
      expect(mockTeamService.getUserTeams).toHaveBeenCalledWith(userId);
      expect(mockProgressService.calculateTeamProgress).toHaveBeenCalledTimes(2);
      expect(mockActivityService.getActivities).toHaveBeenCalledWith(userId, {
        limit: 10,
        includeTeamActivities: true,
      });
      expect(mockActivityService.getUserStats).toHaveBeenCalledWith(userId);
      expect(mockTeamService.getTeamLeaderboard).toHaveBeenCalledTimes(2);
    });

    it('should handle user with no teams', async () => {
      const userId = mockUsers.user1.id;

      mockTeamService.getUserTeams.mockResolvedValue([]);
      mockActivityService.getActivities.mockResolvedValue({
        items: [],
        hasMore: false,
        nextCursor: null,
      });
      mockActivityService.getUserStats.mockResolvedValue({
        ...createMockUserStats(userId),
        totalDistance: 0,
        totalActivities: 0,
        currentStreak: 0,
      });

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/dashboard',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody).toMatchObject({
        success: true,
        data: {
          user: {
            teams: [],
            recentActivities: [],
            stats: expect.objectContaining({
              totalDistance: 0,
              totalActivities: 0,
              currentStreak: 0,
            }),
            leaderboards: [],
          },
        },
      });

      expect(mockProgressService.calculateTeamProgress).not.toHaveBeenCalled();
      expect(mockTeamService.getTeamLeaderboard).not.toHaveBeenCalled();
    });

    it('should handle teams without active goals', async () => {
      const userId = mockUsers.user1.id;

      // Mock team without goals
      const teamWithoutGoals = {
        ...mockTeams.team1,
        goals: [], // No active goals
        memberCount: 3,
      };

      mockTeamService.getUserTeams.mockResolvedValue([teamWithoutGoals]);
      mockActivityService.getActivities.mockResolvedValue({
        items: [],
        hasMore: false,
        nextCursor: null,
      });
      mockActivityService.getUserStats.mockResolvedValue(createMockUserStats(userId));
      mockTeamService.getTeamLeaderboard.mockResolvedValue({ members: [] });

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/dashboard',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.data.user.teams).toHaveLength(1);
      expect(responseBody.data.user.teams[0]).toMatchObject({
        id: mockTeams.team1.id,
        progress: null, // No progress without goals
      });

      expect(mockProgressService.calculateTeamProgress).not.toHaveBeenCalled();
    });

    it('should handle progress calculation errors gracefully', async () => {
      const userId = mockUsers.user1.id;

      const mockUserTeams = [
        {
          ...mockTeams.team1,
          goals: [mockTeamGoals.goal1],
          memberCount: 5,
        },
      ];

      mockTeamService.getUserTeams.mockResolvedValue(mockUserTeams);
      
      // Mock progress service to throw error
      mockProgressService.calculateTeamProgress.mockRejectedValue(
        new Error('Progress calculation failed')
      );

      mockActivityService.getActivities.mockResolvedValue({
        items: [],
        hasMore: false,
        nextCursor: null,
      });
      mockActivityService.getUserStats.mockResolvedValue(createMockUserStats(userId));
      mockTeamService.getTeamLeaderboard.mockResolvedValue({ members: [] });

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/dashboard',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.data.user.teams[0]).toMatchObject({
        id: mockTeams.team1.id,
        progress: null, // Progress should be null when calculation fails
      });
    });

    it('should handle leaderboard calculation errors gracefully', async () => {
      const userId = mockUsers.user1.id;

      const mockUserTeams = [
        {
          ...mockTeams.team1,
          goals: [mockTeamGoals.goal1],
          memberCount: 5,
        },
      ];

      mockTeamService.getUserTeams.mockResolvedValue(mockUserTeams);
      mockProgressService.calculateTeamProgress.mockResolvedValue(
        createMockTeamProgress(mockTeams.team1.id)
      );
      mockActivityService.getActivities.mockResolvedValue({
        items: [],
        hasMore: false,
        nextCursor: null,
      });
      mockActivityService.getUserStats.mockResolvedValue(createMockUserStats(userId));
      
      // Mock leaderboard service to throw error
      mockTeamService.getTeamLeaderboard.mockRejectedValue(
        new Error('Leaderboard calculation failed')
      );

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/dashboard',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.data.user.leaderboards).toEqual([]);
    });

    it('should handle unauthorized requests', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/dashboard',
        headers: {}, // No auth header
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    });

    it('should respect privacy flags in recent activities', async () => {
      const userId = mockUsers.user1.id;

      mockTeamService.getUserTeams.mockResolvedValue([]);
      mockActivityService.getUserStats.mockResolvedValue(createMockUserStats(userId));

      // Mock activities with privacy considerations
      const mockActivitiesWithPrivacy = {
        items: [
          {
            id: 'public-activity',
            distance: 5000,
            isPrivate: false,
            user: { id: userId, name: mockUsers.user1.name },
            teams: [{ id: mockTeams.team1.id, name: mockTeams.team1.name }],
          },
          {
            id: 'private-activity',
            distance: 3000,
            isPrivate: true,
            user: { id: userId, name: mockUsers.user1.name },
            teams: [{ id: mockTeams.team1.id, name: mockTeams.team1.name }],
          },
        ],
        hasMore: false,
        nextCursor: null,
      };

      mockActivityService.getActivities.mockResolvedValue(mockActivitiesWithPrivacy);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/dashboard',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      
      // Both activities should appear in recent activities
      // (privacy is handled by the activity service)
      expect(responseBody.data.user.recentActivities).toHaveLength(2);
      expect(responseBody.data.user.recentActivities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'public-activity' }),
          expect.objectContaining({ id: 'private-activity' }),
        ])
      );
    });

    it('should handle service errors and return internal server error', async () => {
      mockTeamService.getUserTeams.mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/dashboard',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load dashboard',
        },
      });
    });

    it('should limit recent activities and leaderboard entries', async () => {
      const userId = mockUsers.user1.id;

      mockTeamService.getUserTeams.mockResolvedValue([
        {
          ...mockTeams.team1,
          goals: [mockTeamGoals.goal1],
          memberCount: 10,
        },
      ]);

      mockProgressService.calculateTeamProgress.mockResolvedValue(
        createMockTeamProgress(mockTeams.team1.id)
      );

      mockActivityService.getUserStats.mockResolvedValue(createMockUserStats(userId));

      // Verify activity service is called with correct limit
      mockActivityService.getActivities.mockResolvedValue({
        items: [],
        hasMore: false,
        nextCursor: null,
      });

      // Verify leaderboard service is called with correct limit
      mockTeamService.getTeamLeaderboard.mockResolvedValue({
        members: Array.from({ length: 5 }, (_, i) => ({
          userId: `user-${i}`,
          name: `User ${i}`,
          totalDistance: 10000 - i * 1000,
          rank: i + 1,
        })),
      });

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/dashboard',
      });

      await handler(event, mockContext);

      expect(mockActivityService.getActivities).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          limit: 10, // Should limit recent activities
        })
      );

      expect(mockTeamService.getTeamLeaderboard).toHaveBeenCalledWith(
        mockTeams.team1.id,
        expect.objectContaining({
          limit: 5, // Should limit leaderboard entries
        })
      );
    });
  });

  describe('Performance and Caching', () => {
    it('should make efficient database calls', async () => {
      const userId = mockUsers.user1.id;

      const mockUserTeams = [
        {
          ...mockTeams.team1,
          goals: [mockTeamGoals.goal1],
          memberCount: 5,
        },
      ];

      mockTeamService.getUserTeams.mockResolvedValue(mockUserTeams);
      mockProgressService.calculateTeamProgress.mockResolvedValue(
        createMockTeamProgress(mockTeams.team1.id)
      );
      mockActivityService.getActivities.mockResolvedValue({
        items: [],
        hasMore: false,
        nextCursor: null,
      });
      mockActivityService.getUserStats.mockResolvedValue(createMockUserStats(userId));
      mockTeamService.getTeamLeaderboard.mockResolvedValue({ members: [] });

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/dashboard',
      });

      await handler(event, mockContext);

      // Verify minimal service calls
      expect(mockTeamService.getUserTeams).toHaveBeenCalledTimes(1);
      expect(mockProgressService.calculateTeamProgress).toHaveBeenCalledTimes(1);
      expect(mockActivityService.getActivities).toHaveBeenCalledTimes(1);
      expect(mockActivityService.getUserStats).toHaveBeenCalledTimes(1);
      expect(mockTeamService.getTeamLeaderboard).toHaveBeenCalledTimes(1);
    });
  });
});