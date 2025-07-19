/**
 * Comprehensive tests for activity handlers
 * Tests all CRUD endpoints: POST, GET, PATCH, DELETE /activities
 */
import { handler } from '../../handlers/activities';
import { ActivityService } from '../../services/activity/activity.service';
import { ProgressService } from '../../services/progress';
import { createWebSocketService } from '../../services/websocket';
import { 
  createMockEvent, 
  createMockContext, 
  createMockPrisma,
  mockUsers,
  mockTeams,
  mockActivities,
  createMockActivityWithTeams,
  createMockTeamProgress,
  createMockToken,
  resetAllMocks,
} from '../utils/test-helpers';
import { CreateActivityInput, UpdateActivityInput } from '../../services/activity/types';

// Mock external dependencies
jest.mock('../../lib/database', () => ({
  prisma: createMockPrisma(),
}));

jest.mock('../../services/activity/activity.service');
jest.mock('../../services/progress');
jest.mock('../../services/websocket');
jest.mock('../../services/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock the progress websocket integration
const mockProgressWebSocket = {
  broadcastProgressUpdate: jest.fn().mockResolvedValue(undefined),
  broadcastActivityAdded: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../services/progress', () => ({
  ProgressService: jest.fn().mockImplementation(() => ({
    calculateTeamProgress: jest.fn().mockResolvedValue(createMockTeamProgress()),
    updateProgressAndCheckMilestones: jest.fn().mockResolvedValue({
      progressUpdated: true,
      milestoneReached: null,
    }),
  })),
  ProgressWebSocketIntegration: jest.fn().mockImplementation(() => mockProgressWebSocket),
}));

describe('Activities Handler', () => {
  let mockActivityService: jest.Mocked<ActivityService>;
  let mockProgressService: any;
  let mockWebSocketService: any;
  const mockContext = createMockContext();

  beforeEach(() => {
    resetAllMocks();
    
    // Reset activity service mocks
    mockActivityService = {
      createActivity: jest.fn(),
      getActivities: jest.fn(),
      updateActivity: jest.fn(),
      deleteActivity: jest.fn(),
      getUserStats: jest.fn(),
      getActivitySummary: jest.fn(),
    } as any;

    (ActivityService as jest.Mock).mockImplementation(() => mockActivityService);
    
    // Reset progress service mocks
    mockProgressService = {
      calculateTeamProgress: jest.fn().mockResolvedValue(createMockTeamProgress()),
      updateProgressAndCheckMilestones: jest.fn().mockResolvedValue({
        progressUpdated: true,
        milestoneReached: null,
      }),
    };
    (ProgressService as jest.Mock).mockImplementation(() => mockProgressService);

    // Reset websocket service mocks
    mockWebSocketService = {
      connect: jest.fn(),
      publish: jest.fn(),
    };
    (createWebSocketService as jest.Mock).mockReturnValue(mockWebSocketService);

    // Reset progress websocket mocks
    mockProgressWebSocket.broadcastProgressUpdate.mockResolvedValue(undefined);
    mockProgressWebSocket.broadcastActivityAdded.mockResolvedValue(undefined);
  });

  describe('POST /activities - Create Activity', () => {
    const validCreateInput: CreateActivityInput = {
      teamIds: [mockTeams.team1.id],
      distance: 5000,
      duration: 3600,
      activityDate: '2025-01-19T10:00:00Z',
      isPrivate: false,
      source: 'MANUAL' as const,
    };

    it('should create activity successfully', async () => {
      const mockCreatedActivity = createMockActivityWithTeams();
      const mockResult = {
        activity: mockCreatedActivity,
        teamUpdates: [
          {
            teamId: mockTeams.team1.id,
            teamGoalId: 'goal-123',
            newTotalDistance: 50000,
            newPercentComplete: 25,
          },
        ],
      };

      mockActivityService.createActivity.mockResolvedValue(mockResult);

      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/api/v1/activities',
        body: JSON.stringify(validCreateInput),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        data: {
          activity: expect.objectContaining({
            id: mockCreatedActivity.id,
            distance: validCreateInput.distance,
            duration: validCreateInput.duration,
          }),
          teamUpdates: expect.arrayContaining([
            expect.objectContaining({
              teamId: mockTeams.team1.id,
              newTotalDistance: 50000,
            }),
          ]),
        },
      });

      expect(mockActivityService.createActivity).toHaveBeenCalledWith(
        mockUsers.user1.id,
        validCreateInput
      );

      // Verify WebSocket updates were attempted
      expect(mockProgressService.calculateTeamProgress).toHaveBeenCalled();
      expect(mockProgressWebSocket.broadcastProgressUpdate).toHaveBeenCalled();
      expect(mockProgressWebSocket.broadcastActivityAdded).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const invalidInputs = [
        { ...validCreateInput, teamIds: [] }, // Empty team IDs
        { ...validCreateInput, distance: -100 }, // Negative distance
        { ...validCreateInput, duration: 0 }, // Zero duration
        { ...validCreateInput, activityDate: '' }, // Empty activity date
      ];

      for (const invalidInput of invalidInputs) {
        const event = createMockEvent({
          httpMethod: 'POST',
          path: '/api/v1/activities',
          body: JSON.stringify(invalidInput),
        });

        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toMatchObject({
          error: expect.any(String),
        });
      }

      expect(mockActivityService.createActivity).not.toHaveBeenCalled();
    });

    it('should handle unauthorized requests', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/api/v1/activities',
        headers: {}, // No auth header
        body: JSON.stringify(validCreateInput),
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

    it('should handle team membership validation errors', async () => {
      mockActivityService.createActivity.mockRejectedValue(
        new Error('User is not a member of all specified teams')
      );

      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/api/v1/activities',
        body: JSON.stringify(validCreateInput),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(403);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'User is not a member of all specified teams',
        },
      });
    });

    it('should continue when WebSocket updates fail', async () => {
      const mockCreatedActivity = createMockActivityWithTeams();
      const mockResult = {
        activity: mockCreatedActivity,
        teamUpdates: [
          {
            teamId: mockTeams.team1.id,
            teamGoalId: 'goal-123',
            newTotalDistance: 50000,
            newPercentComplete: 25,
          },
        ],
      };

      mockActivityService.createActivity.mockResolvedValue(mockResult);
      mockProgressWebSocket.broadcastProgressUpdate.mockRejectedValue(
        new Error('WebSocket error')
      );

      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/api/v1/activities',
        body: JSON.stringify(validCreateInput),
      });

      const result = await handler(event, mockContext);

      // Should still succeed even if WebSocket fails
      expect(result.statusCode).toBe(201);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        data: expect.objectContaining({
          activity: expect.objectContaining({
            id: mockCreatedActivity.id,
          }),
        }),
      });
    });
  });

  describe('GET /activities - List Activities', () => {
    it('should list activities successfully', async () => {
      const mockActivitiesResult = {
        items: [
          {
            id: mockActivities.activity1.id,
            distance: mockActivities.activity1.distance,
            duration: mockActivities.activity1.duration,
            pace: mockActivities.activity1.pace,
            activityDate: mockActivities.activity1.activityDate,
            note: mockActivities.activity1.notes,
            isPrivate: mockActivities.activity1.isPrivate,
            createdAt: mockActivities.activity1.createdAt,
            teams: [{ id: mockTeams.team1.id, name: mockTeams.team1.name }],
          },
        ],
        nextCursor: null,
        hasMore: false,
      };

      mockActivityService.getActivities.mockResolvedValue(mockActivitiesResult);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/activities',
        queryStringParameters: {
          teamId: mockTeams.team1.id,
          limit: '10',
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        data: {
          items: expect.arrayContaining([
            expect.objectContaining({
              id: mockActivities.activity1.id,
              distance: mockActivities.activity1.distance,
            }),
          ]),
          hasMore: false,
        },
      });

      expect(mockActivityService.getActivities).toHaveBeenCalledWith(
        mockUsers.user1.id,
        {
          cursor: undefined,
          limit: 10,
          teamId: mockTeams.team1.id,
          startDate: undefined,
          endDate: undefined,
        }
      );
    });

    it('should handle date range filtering', async () => {
      mockActivityService.getActivities.mockResolvedValue({
        items: [],
        nextCursor: null,
        hasMore: false,
      });

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/activities',
        queryStringParameters: {
          startDate: '2025-01-01T00:00:00Z',
          endDate: '2025-01-31T23:59:59Z',
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockActivityService.getActivities).toHaveBeenCalledWith(
        mockUsers.user1.id,
        {
          cursor: undefined,
          limit: undefined,
          teamId: undefined,
          startDate: '2025-01-01T00:00:00Z',
          endDate: '2025-01-31T23:59:59Z',
        }
      );
    });

    it('should handle pagination with cursor', async () => {
      mockActivityService.getActivities.mockResolvedValue({
        items: [],
        nextCursor: 'next-cursor',
        hasMore: true,
      });

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/activities',
        queryStringParameters: {
          cursor: 'current-cursor',
          limit: '5',
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        data: {
          nextCursor: 'next-cursor',
          hasMore: true,
        },
      });

      expect(mockActivityService.getActivities).toHaveBeenCalledWith(
        mockUsers.user1.id,
        {
          cursor: 'current-cursor',
          limit: 5,
          teamId: undefined,
          startDate: undefined,
          endDate: undefined,
        }
      );
    });
  });

  describe('PATCH /activities/:id - Update Activity', () => {
    const activityId = mockActivities.activity1.id;
    const updateInput: UpdateActivityInput = {
      distance: 6000,
      duration: 4000,
      notes: 'Updated notes',
    };

    it('should update activity successfully', async () => {
      const updatedActivity = {
        ...mockActivities.activity1,
        ...updateInput,
      };

      mockActivityService.updateActivity.mockResolvedValue(updatedActivity);

      const event = createMockEvent({
        httpMethod: 'PATCH',
        path: `/api/v1/activities/${activityId}`,
        pathParameters: { id: activityId },
        body: JSON.stringify(updateInput),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        data: {
          activity: expect.objectContaining({
            id: activityId,
            distance: updateInput.distance,
            duration: updateInput.duration,
          }),
        },
      });

      expect(mockActivityService.updateActivity).toHaveBeenCalledWith(
        activityId,
        mockUsers.user1.id,
        updateInput
      );
    });

    it('should handle activity not found', async () => {
      mockActivityService.updateActivity.mockRejectedValue(
        new Error('Activity not found or access denied')
      );

      const event = createMockEvent({
        httpMethod: 'PATCH',
        path: `/api/v1/activities/${activityId}`,
        pathParameters: { id: activityId },
        body: JSON.stringify(updateInput),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Activity not found or access denied',
        },
      });
    });
  });

  describe('DELETE /activities/:id - Delete Activity', () => {
    const activityId = mockActivities.activity1.id;

    it('should delete activity successfully', async () => {
      const deleteResult = {
        deleted: true,
        teamUpdates: [
          {
            teamId: mockTeams.team1.id,
            teamGoalId: 'goal-123',
            newTotalDistance: 40000,
            newPercentComplete: 20,
          },
        ],
      };

      mockActivityService.deleteActivity.mockResolvedValue(deleteResult);

      const event = createMockEvent({
        httpMethod: 'DELETE',
        path: `/api/v1/activities/${activityId}`,
        pathParameters: { id: activityId },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        data: deleteResult,
      });

      expect(mockActivityService.deleteActivity).toHaveBeenCalledWith(
        activityId,
        mockUsers.user1.id
      );

      // Verify WebSocket updates for progress decrease
      expect(mockProgressService.calculateTeamProgress).toHaveBeenCalled();
      expect(mockProgressWebSocket.broadcastProgressUpdate).toHaveBeenCalled();
    });

    it('should handle activity not found for deletion', async () => {
      mockActivityService.deleteActivity.mockRejectedValue(
        new Error('Activity not found or access denied')
      );

      const event = createMockEvent({
        httpMethod: 'DELETE',
        path: `/api/v1/activities/${activityId}`,
        pathParameters: { id: activityId },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Activity not found or access denied',
        },
      });
    });
  });

  describe('GET /activities/stats - User Stats', () => {
    it('should return user statistics', async () => {
      const mockStats = {
        totalDistance: 75000,
        totalDuration: 36000,
        totalActivities: 15,
        averagePace: 8.0,
        averageDistance: 5000,
        currentStreak: 7,
        longestStreak: 14,
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

      mockActivityService.getUserStats.mockResolvedValue(mockStats);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/activities/stats',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        data: {
          stats: expect.objectContaining({
            totalDistance: 75000,
            totalActivities: 15,
            currentStreak: 7,
            weeklyStats: expect.objectContaining({
              distance: 15000,
              activities: 3,
            }),
          }),
        },
      });

      expect(mockActivityService.getUserStats).toHaveBeenCalledWith(mockUsers.user1.id);
    });
  });

  describe('GET /activities/summary - Activity Summary', () => {
    it('should return activity summaries by period', async () => {
      const mockSummaries = [
        {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-07'),
          totalDistance: 25000,
          totalDuration: 12000,
          totalActivities: 5,
          averagePace: 8.0,
          averageDistance: 5000,
          activeDays: 5,
        },
        {
          startDate: new Date('2025-01-08'),
          endDate: new Date('2025-01-14'),
          totalDistance: 30000,
          totalDuration: 14400,
          totalActivities: 6,
          averagePace: 8.0,
          averageDistance: 5000,
          activeDays: 6,
        },
      ];

      mockActivityService.getActivitySummary.mockResolvedValue(mockSummaries);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/activities/summary',
        queryStringParameters: {
          period: 'weekly',
          startDate: '2025-01-01T00:00:00Z',
          endDate: '2025-01-31T23:59:59Z',
          teamId: mockTeams.team1.id,
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        data: {
          summaries: expect.arrayContaining([
            expect.objectContaining({
              totalDistance: 25000,
              totalActivities: 5,
              activeDays: 5,
            }),
            expect.objectContaining({
              totalDistance: 30000,
              totalActivities: 6,
              activeDays: 6,
            }),
          ]),
        },
      });

      expect(mockActivityService.getActivitySummary).toHaveBeenCalledWith(
        mockUsers.user1.id,
        {
          period: 'weekly',
          startDate: '2025-01-01T00:00:00Z',
          endDate: '2025-01-31T23:59:59Z',
          teamId: mockTeams.team1.id,
          limit: undefined,
        }
      );
    });

    it('should validate period parameter', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/activities/summary',
        queryStringParameters: {
          period: 'invalid',
        },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid period. Must be daily, weekly, or monthly',
        },
      });

      expect(mockActivityService.getActivitySummary).not.toHaveBeenCalled();
    });

    it('should use default period when not specified', async () => {
      mockActivityService.getActivitySummary.mockResolvedValue([]);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/api/v1/activities/summary',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockActivityService.getActivitySummary).toHaveBeenCalledWith(
        mockUsers.user1.id,
        expect.objectContaining({
          period: 'weekly', // Default period
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors', async () => {
      mockActivityService.createActivity.mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/api/v1/activities',
        body: JSON.stringify({
          teamIds: [mockTeams.team1.id],
          distance: 5000,
          duration: 3600,
          activityDate: '2025-01-19T10:00:00Z',
          isPrivate: false,
          source: 'MANUAL',
        }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create activity',
        },
      });
    });

    it('should handle missing request body', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/api/v1/activities',
        body: null,
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(mockActivityService.createActivity).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON in request body', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/api/v1/activities',
        body: 'invalid json',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      expect(mockActivityService.createActivity).not.toHaveBeenCalled();
    });
  });
});