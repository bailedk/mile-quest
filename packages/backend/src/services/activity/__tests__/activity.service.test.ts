import { PrismaClient, ActivitySource } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ActivityService } from '../activity.service';
import { CreateActivityInput } from '../types';

// Mock the cache module
jest.mock('../../../utils/cache', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    clear: jest.fn(),
  },
  cacheKeys: {
    teamProgress: (teamId: string) => `team-progress:${teamId}`,
    userStats: (userId: string) => `user-stats:${userId}`,
    activities: {
      byTeam: (teamId: string) => `activities:team:${teamId}`,
      byUser: (userId: string) => `activities:user:${userId}`,
    },
  },
  cacheTTL: {
    short: 300,
    medium: 3600,
    long: 86400,
  },
}));

describe('ActivityService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let activityService: ActivityService;

  const mockUserId = 'user-123';
  const mockTeamId = 'team-456';
  const mockActivityId = 'activity-789';

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    activityService = new ActivityService(prisma);
    jest.clearAllMocks();
  });

  describe('createActivity', () => {
    const createActivityInput: CreateActivityInput = {
      teamIds: [mockTeamId],
      distance: 5000, // 5km
      duration: 1800, // 30 minutes
      activityDate: '2025-01-19T10:00:00Z',
      isPrivate: false,
      source: ActivitySource.MANUAL,
    };

    it('should create an activity successfully', async () => {
      // Mock team membership check
      prisma.teamMember.findMany.mockResolvedValue([
        {
          id: 'member-1',
          teamId: mockTeamId,
          userId: mockUserId,
          role: 'MEMBER',
          joinedAt: new Date(),
          leftAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          team: {
            id: mockTeamId,
            name: 'Test Team',
            createdBy: 'owner-123',
            createdAt: new Date(),
            updatedAt: new Date(),
            goals: [
              {
                id: 'goal-1',
                teamId: mockTeamId,
                name: 'Test Goal',
                startPoint: { lat: 0, lng: 0 },
                endPoint: { lat: 1, lng: 1 },
                targetDistance: 100000,
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          },
        },
      ] as any);

      // Mock activity creation
      const mockCreatedActivity = {
        id: mockActivityId,
        userId: mockUserId,
        ...createActivityInput,
        createdAt: new Date(),
        updatedAt: new Date(),
        teamActivities: [
          {
            teamId: mockTeamId,
            team: {
              id: mockTeamId,
              name: 'Test Team',
            },
          },
        ],
        user: {
          id: mockUserId,
          name: 'Test User',
        },
      };

      prisma.activity.create.mockResolvedValue(mockCreatedActivity as any);

      // Mock team progress calculation
      prisma.$transaction.mockResolvedValue([
        {
          teamId: mockTeamId,
          totalDistance: 15000,
          currentProgress: 15,
          remainingDistance: 85000,
          estimatedCompletionDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
          paceStatus: 'ON_TRACK',
          lastUpdated: new Date(),
        },
      ]);

      const result = await activityService.createActivity(mockUserId, createActivityInput);

      expect(result).toMatchObject({
        activity: expect.objectContaining({
          id: mockActivityId,
          userId: mockUserId,
          distance: createActivityInput.distance,
        }),
        teamUpdates: expect.arrayContaining([
          expect.objectContaining({
            teamId: mockTeamId,
            newTotalDistance: 15000,
            newPercentComplete: 15,
          }),
        ]),
      });

      expect(prisma.teamMember.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          teamId: { in: [mockTeamId] },
          leftAt: null,
        },
        include: expect.any(Object),
      });

      expect(prisma.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          ...createActivityInput,
          teamActivities: {
            create: [{ teamId: mockTeamId }],
          },
        }),
        include: expect.any(Object),
      });
    });

    it('should throw error if user is not a member of specified teams', async () => {
      // Mock empty membership result
      prisma.teamMember.findMany.mockResolvedValue([]);

      await expect(
        activityService.createActivity(mockUserId, createActivityInput)
      ).rejects.toThrow('User is not a member of all specified teams');

      expect(prisma.activity.create).not.toHaveBeenCalled();
    });

    it('should handle invalid distance', async () => {
      const invalidInput = {
        ...createActivityInput,
        distance: -100, // Negative distance
      };

      // Mock team membership as valid
      prisma.teamMember.findMany.mockResolvedValue([
        { teamId: mockTeamId } as any,
      ]);

      await expect(
        activityService.createActivity(mockUserId, invalidInput)
      ).rejects.toThrow();
    });
  });

  describe('getActivities', () => {
    it('should retrieve activities for a team', async () => {
      const mockActivities = [
        {
          id: 'activity-1',
          userId: 'user-1',
          activityType: 'WALK',
          distance: 3000,
          duration: 1200,
          startTime: new Date(),
          user: { id: 'user-1', name: 'User 1' },
          teamActivities: [{ teamId: mockTeamId }],
        },
        {
          id: 'activity-2',
          userId: 'user-2',
          activityType: 'RUN',
          distance: 5000,
          duration: 1800,
          startTime: new Date(),
          user: { id: 'user-2', name: 'User 2' },
          teamActivities: [{ teamId: mockTeamId }],
        },
      ];

      prisma.activity.findMany.mockResolvedValue(mockActivities as any);
      prisma.activity.count.mockResolvedValue(2);

      const result = await activityService.getActivities(mockUserId, {
        teamId: mockTeamId,
        limit: 10,
      });

      expect(result).toMatchObject({
        items: expect.arrayContaining([
          expect.objectContaining({ id: 'activity-1' }),
          expect.objectContaining({ id: 'activity-2' }),
        ]),
        hasMore: false,
      });

      expect(prisma.activity.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          teamActivities: {
            some: { teamId: mockTeamId },
          },
        }),
        include: expect.any(Object),
        orderBy: expect.any(Object),
        take: 11,
      });
    });

    it('should filter activities by date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      prisma.activity.findMany.mockResolvedValue([]);
      prisma.activity.count.mockResolvedValue(0);

      await activityService.getActivities(mockUserId, {
        teamId: mockTeamId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 10,
      });

      expect(prisma.activity.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          teamActivities: {
            some: { teamId: mockTeamId },
          },
          activityDate: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        }),
        include: expect.any(Object),
        orderBy: expect.any(Object),
        take: 11,
      });
    });
  });

  describe('deleteActivity', () => {
    it('should delete an activity successfully', async () => {
      // Mock finding the activity
      prisma.activity.findUnique.mockResolvedValue({
        id: mockActivityId,
        userId: mockUserId,
        distance: 5000,
        teamActivities: [
          {
            teamId: mockTeamId,
            team: {
              id: mockTeamId,
              goals: [
                {
                  id: 'goal-1',
                  status: 'ACTIVE',
                  targetDistance: 100000,
                },
              ],
            },
          },
        ],
      } as any);

      // Mock deletion
      prisma.activity.delete.mockResolvedValue({
        id: mockActivityId,
      } as any);

      // Mock progress recalculation
      prisma.$transaction.mockResolvedValue([
        {
          teamId: mockTeamId,
          totalDistance: 10000,
          currentProgress: 10,
          remainingDistance: 90000,
          estimatedCompletionDate: new Date(),
          paceStatus: 'ON_TRACK',
          lastUpdated: new Date(),
        },
      ]);

      const result = await activityService.deleteActivity(mockUserId, mockActivityId);

      expect(result).toMatchObject({
        deleted: true,
        teamUpdates: expect.arrayContaining([
          expect.objectContaining({
            teamId: mockTeamId,
            newTotalDistance: 10000,
          }),
        ]),
      });

      expect(prisma.activity.delete).toHaveBeenCalledWith({
        where: { id: mockActivityId },
      });
    });

    it('should throw error if activity not found', async () => {
      prisma.activity.findUnique.mockResolvedValue(null);

      await expect(
        activityService.deleteActivity(mockUserId, mockActivityId)
      ).rejects.toThrow('Activity not found');

      expect(prisma.activity.delete).not.toHaveBeenCalled();
    });

    it('should throw error if user is not the owner', async () => {
      prisma.activity.findUnique.mockResolvedValue({
        id: mockActivityId,
        userId: 'other-user',
      } as any);

      await expect(
        activityService.deleteActivity(mockUserId, mockActivityId)
      ).rejects.toThrow('You can only delete your own activities');

      expect(prisma.activity.delete).not.toHaveBeenCalled();
    });
  });
});