/**
 * Comprehensive tests for ProgressService
 * Tests team progress tracking, milestone detection, and WebSocket integration
 */
import { PrismaClient } from '@prisma/client';
import { ProgressService } from '../../services/progress/progress.service';
import { 
  createMockPrisma,
  mockTeams,
  mockTeamGoals,
  mockUsers,
  mockActivities,
  createMockTeamProgress,
  resetAllMocks,
} from '../utils/test-helpers';

describe('ProgressService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let progressService: ProgressService;

  beforeEach(() => {
    resetAllMocks();
    prisma = createMockPrisma();
    progressService = new ProgressService(prisma as any);
  });

  describe('calculateTeamProgress', () => {
    const teamGoalId = mockTeamGoals.goal1.id;

    it('should calculate team progress correctly', async () => {
      // Mock team goal with target distance
      prisma.teamGoal.findUnique.mockResolvedValue({
        ...mockTeamGoals.goal1,
        targetDistance: 200000, // 200km
        team: {
          ...mockTeams.team1,
          members: [
            { userId: mockUsers.user1.id, leftAt: null },
            { userId: mockUsers.user2.id, leftAt: null },
          ],
        },
      } as any);

      // Mock aggregated activity data
      prisma.activity.aggregate.mockResolvedValue({
        _sum: { distance: 50000 }, // 50km total
        _count: { id: 10 },
      } as any);

      // Mock latest activity
      prisma.activity.findFirst.mockResolvedValue({
        ...mockActivities.activity1,
        createdAt: new Date('2025-01-19T10:00:00Z'),
      } as any);

      // Mock top contributors
      prisma.$queryRaw.mockResolvedValue([
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
      ]);

      const result = await progressService.calculateTeamProgress(teamGoalId, {
        includeContributors: true,
        contributorLimit: 5,
      });

      expect(result).toMatchObject({
        teamGoalId,
        totalDistance: 50000,
        targetDistance: 200000,
        percentComplete: 25, // 50km / 200km * 100
        remainingDistance: 150000,
        isCompleted: false,
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
      });

      expect(prisma.teamGoal.findUnique).toHaveBeenCalledWith({
        where: { id: teamGoalId },
        include: {
          team: {
            include: {
              members: {
                where: { leftAt: null },
                select: { userId: true },
              },
            },
          },
        },
      });

      expect(prisma.activity.aggregate).toHaveBeenCalledWith({
        where: {
          teamActivities: {
            some: { teamId: mockTeams.team1.id },
          },
          isPrivate: false, // Only public activities count toward progress
        },
        _sum: { distance: true },
        _count: { id: true },
      });
    });

    it('should handle completed goals', async () => {
      prisma.teamGoal.findUnique.mockResolvedValue({
        ...mockTeamGoals.goal1,
        targetDistance: 100000, // 100km
        team: {
          ...mockTeams.team1,
          members: [{ userId: mockUsers.user1.id, leftAt: null }],
        },
      } as any);

      // Mock progress that exceeds target
      prisma.activity.aggregate.mockResolvedValue({
        _sum: { distance: 120000 }, // 120km (exceeds 100km target)
        _count: { id: 12 },
      } as any);

      prisma.activity.findFirst.mockResolvedValue(mockActivities.activity1 as any);
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await progressService.calculateTeamProgress(teamGoalId);

      expect(result).toMatchObject({
        totalDistance: 120000,
        targetDistance: 100000,
        percentComplete: 100, // Capped at 100%
        remainingDistance: 0,
        isCompleted: true,
      });
    });

    it('should handle goal not found', async () => {
      prisma.teamGoal.findUnique.mockResolvedValue(null);

      await expect(
        progressService.calculateTeamProgress('non-existent-goal')
      ).rejects.toThrow('Team goal not found');
    });

    it('should exclude private activities from progress calculation', async () => {
      prisma.teamGoal.findUnique.mockResolvedValue({
        ...mockTeamGoals.goal1,
        team: {
          ...mockTeams.team1,
          members: [{ userId: mockUsers.user1.id, leftAt: null }],
        },
      } as any);

      // Mock aggregate that only includes public activities
      prisma.activity.aggregate.mockResolvedValue({
        _sum: { distance: 40000 }, // Only public activities
        _count: { id: 8 },
      } as any);

      prisma.activity.findFirst.mockResolvedValue(mockActivities.activity1 as any);
      prisma.$queryRaw.mockResolvedValue([]);

      await progressService.calculateTeamProgress(teamGoalId);

      // Verify the query excludes private activities
      expect(prisma.activity.aggregate).toHaveBeenCalledWith({
        where: {
          teamActivities: {
            some: { teamId: mockTeams.team1.id },
          },
          isPrivate: false, // Should exclude private activities
        },
        _sum: { distance: true },
        _count: { id: true },
      });
    });

    it('should calculate estimated completion date', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-03-01'); // 59 days later

      prisma.teamGoal.findUnique.mockResolvedValue({
        ...mockTeamGoals.goal1,
        targetDistance: 200000,
        startDate,
        endDate,
        team: {
          ...mockTeams.team1,
          members: [{ userId: mockUsers.user1.id, leftAt: null }],
        },
      } as any);

      prisma.activity.aggregate.mockResolvedValue({
        _sum: { distance: 50000 }, // 25% complete after some time
        _count: { id: 10 },
      } as any);

      // Mock activities that started 15 days ago
      const firstActivityDate = new Date('2025-01-05'); // 5 days after start
      prisma.activity.findFirst.mockResolvedValue({
        ...mockActivities.activity1,
        createdAt: firstActivityDate,
      } as any);

      prisma.$queryRaw.mockResolvedValue([]);

      const result = await progressService.calculateTeamProgress(teamGoalId);

      expect(result).toMatchObject({
        percentComplete: 25,
        estimatedCompletionDate: expect.any(Date),
        paceStatus: expect.stringMatching(/^(AHEAD|ON_TRACK|BEHIND)$/),
      });
    });

    it('should include top contributors when requested', async () => {
      prisma.teamGoal.findUnique.mockResolvedValue({
        ...mockTeamGoals.goal1,
        team: {
          ...mockTeams.team1,
          members: [
            { userId: mockUsers.user1.id, leftAt: null },
            { userId: mockUsers.user2.id, leftAt: null },
          ],
        },
      } as any);

      prisma.activity.aggregate.mockResolvedValue({
        _sum: { distance: 50000 },
        _count: { id: 10 },
      } as any);

      prisma.activity.findFirst.mockResolvedValue(mockActivities.activity1 as any);

      // Mock top contributors query
      const mockContributors = [
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
      ];

      prisma.$queryRaw.mockResolvedValue(mockContributors);

      const result = await progressService.calculateTeamProgress(teamGoalId, {
        includeContributors: true,
        contributorLimit: 2,
      });

      expect(result.topContributors).toEqual(mockContributors);
      expect(prisma.$queryRaw).toHaveBeenCalledWith(
        expect.any(Object),
        mockTeams.team1.id,
        2
      );
    });

    it('should not include contributors when not requested', async () => {
      prisma.teamGoal.findUnique.mockResolvedValue({
        ...mockTeamGoals.goal1,
        team: { ...mockTeams.team1, members: [] },
      } as any);

      prisma.activity.aggregate.mockResolvedValue({
        _sum: { distance: 50000 },
        _count: { id: 10 },
      } as any);

      prisma.activity.findFirst.mockResolvedValue(mockActivities.activity1 as any);

      const result = await progressService.calculateTeamProgress(teamGoalId, {
        includeContributors: false,
      });

      expect(result.topContributors).toBeUndefined();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('updateProgressAndCheckMilestones', () => {
    const teamGoalId = mockTeamGoals.goal1.id;
    const distanceAdded = 5000; // 5km
    const activitiesAdded = 1;
    const durationAdded = 3600; // 1 hour

    beforeEach(() => {
      // Mock team goal
      prisma.teamGoal.findUnique.mockResolvedValue({
        ...mockTeamGoals.goal1,
        targetDistance: 200000,
      } as any);
    });

    it('should update progress and detect distance milestone', async () => {
      // Mock current progress before update
      prisma.activity.aggregate.mockResolvedValueOnce({
        _sum: { distance: 45000 }, // Current: 45km
        _count: { id: 9 },
      } as any);

      // Mock progress after update
      prisma.activity.aggregate.mockResolvedValueOnce({
        _sum: { distance: 50000 }, // After: 50km (milestone!)
        _count: { id: 10 },
      } as any);

      const result = await progressService.updateProgressAndCheckMilestones(
        teamGoalId,
        distanceAdded,
        activitiesAdded,
        durationAdded
      );

      expect(result).toMatchObject({
        progressUpdated: true,
        milestoneReached: {
          type: 'DISTANCE',
          value: 50000,
          description: expect.stringContaining('50'),
          previousValue: 45000,
          newValue: 50000,
        },
      });
    });

    it('should detect percentage milestone', async () => {
      // Mock progress that crosses 25% threshold
      prisma.activity.aggregate.mockResolvedValueOnce({
        _sum: { distance: 48000 }, // 24% of 200km
        _count: { id: 9 },
      } as any);

      prisma.activity.aggregate.mockResolvedValueOnce({
        _sum: { distance: 53000 }, // 26.5% of 200km (crosses 25% milestone)
        _count: { id: 10 },
      } as any);

      const result = await progressService.updateProgressAndCheckMilestones(
        teamGoalId,
        distanceAdded,
        activitiesAdded,
        durationAdded
      );

      expect(result).toMatchObject({
        progressUpdated: true,
        milestoneReached: {
          type: 'PERCENTAGE',
          value: 25,
          description: expect.stringContaining('25%'),
          previousValue: 24,
          newValue: 26.5,
        },
      });
    });

    it('should detect activity count milestone', async () => {
      prisma.activity.aggregate.mockResolvedValueOnce({
        _sum: { distance: 95000 },
        _count: { id: 99 }, // Just before 100 activities
      } as any);

      prisma.activity.aggregate.mockResolvedValueOnce({
        _sum: { distance: 100000 },
        _count: { id: 100 }, // Milestone: 100 activities!
      } as any);

      const result = await progressService.updateProgressAndCheckMilestones(
        teamGoalId,
        distanceAdded,
        activitiesAdded,
        durationAdded
      );

      expect(result).toMatchObject({
        progressUpdated: true,
        milestoneReached: {
          type: 'ACTIVITY_COUNT',
          value: 100,
          description: expect.stringContaining('100'),
          previousValue: 99,
          newValue: 100,
        },
      });
    });

    it('should detect goal completion', async () => {
      prisma.activity.aggregate.mockResolvedValueOnce({
        _sum: { distance: 195000 }, // 97.5% complete
        _count: { id: 39 },
      } as any);

      prisma.activity.aggregate.mockResolvedValueOnce({
        _sum: { distance: 200000 }, // 100% complete!
        _count: { id: 40 },
      } as any);

      const result = await progressService.updateProgressAndCheckMilestones(
        teamGoalId,
        distanceAdded,
        activitiesAdded,
        durationAdded
      );

      expect(result).toMatchObject({
        progressUpdated: true,
        milestoneReached: {
          type: 'GOAL_COMPLETION',
          value: 100,
          description: expect.stringContaining('goal completed'),
          previousValue: 97.5,
          newValue: 100,
        },
      });
    });

    it('should return no milestone when none reached', async () => {
      prisma.activity.aggregate.mockResolvedValueOnce({
        _sum: { distance: 35000 },
        _count: { id: 7 },
      } as any);

      prisma.activity.aggregate.mockResolvedValueOnce({
        _sum: { distance: 40000 },
        _count: { id: 8 },
      } as any);

      const result = await progressService.updateProgressAndCheckMilestones(
        teamGoalId,
        distanceAdded,
        activitiesAdded,
        durationAdded
      );

      expect(result).toMatchObject({
        progressUpdated: true,
        milestoneReached: null,
      });
    });

    it('should handle goal not found', async () => {
      prisma.teamGoal.findUnique.mockResolvedValue(null);

      await expect(
        progressService.updateProgressAndCheckMilestones(
          'non-existent-goal',
          distanceAdded,
          activitiesAdded,
          durationAdded
        )
      ).rejects.toThrow('Team goal not found');
    });

    it('should prioritize goal completion over other milestones', async () => {
      // Setup scenario where multiple milestones could be reached
      prisma.activity.aggregate.mockResolvedValueOnce({
        _sum: { distance: 195000 }, // 97.5% (near completion)
        _count: { id: 49 }, // Near 50 activity milestone
      } as any);

      prisma.activity.aggregate.mockResolvedValueOnce({
        _sum: { distance: 200000 }, // 100% (completion + 50 activities)
        _count: { id: 50 },
      } as any);

      const result = await progressService.updateProgressAndCheckMilestones(
        teamGoalId,
        distanceAdded,
        activitiesAdded,
        durationAdded
      );

      // Should prioritize goal completion
      expect(result.milestoneReached?.type).toBe('GOAL_COMPLETION');
    });
  });

  describe('getTeamProgressHistory', () => {
    const teamGoalId = mockTeamGoals.goal1.id;

    it('should return progress history', async () => {
      const mockHistoryData = [
        {
          date: new Date('2025-01-15'),
          cumulativeDistance: 25000,
          dailyDistance: 5000,
          activityCount: 5,
          percentComplete: 12.5,
        },
        {
          date: new Date('2025-01-16'),
          cumulativeDistance: 30000,
          dailyDistance: 5000,
          activityCount: 6,
          percentComplete: 15.0,
        },
      ];

      prisma.$queryRaw.mockResolvedValue(mockHistoryData);

      const result = await progressService.getTeamProgressHistory(
        teamGoalId,
        {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-31'),
          granularity: 'daily',
        }
      );

      expect(result).toEqual(mockHistoryData);
      expect(prisma.$queryRaw).toHaveBeenCalledWith(
        expect.any(Object),
        teamGoalId,
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );
    });

    it('should handle empty history', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await progressService.getTeamProgressHistory(teamGoalId);

      expect(result).toEqual([]);
    });
  });

  describe('scheduleProgressUpdate', () => {
    it('should schedule progress update job', async () => {
      const mockScheduledJob = {
        id: 'job-123',
        teamGoalId: mockTeamGoals.goal1.id,
        scheduledAt: new Date(),
        status: 'PENDING',
      };

      prisma.scheduledProgressJob.create.mockResolvedValue(mockScheduledJob as any);

      const result = await progressService.scheduleProgressUpdate(
        mockTeamGoals.goal1.id,
        new Date()
      );

      expect(result).toEqual(mockScheduledJob);
      expect(prisma.scheduledProgressJob.create).toHaveBeenCalledWith({
        data: {
          teamGoalId: mockTeamGoals.goal1.id,
          scheduledAt: expect.any(Date),
          status: 'PENDING',
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      prisma.teamGoal.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        progressService.calculateTeamProgress(mockTeamGoals.goal1.id)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle invalid team goal ID', async () => {
      await expect(
        progressService.calculateTeamProgress('')
      ).rejects.toThrow();
    });

    it('should handle malformed query results', async () => {
      prisma.teamGoal.findUnique.mockResolvedValue({
        ...mockTeamGoals.goal1,
        team: null, // Invalid team reference
      } as any);

      await expect(
        progressService.calculateTeamProgress(mockTeamGoals.goal1.id)
      ).rejects.toThrow();
    });
  });
});