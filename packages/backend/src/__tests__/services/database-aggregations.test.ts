/**
 * Comprehensive tests for database services and aggregation functions
 * Tests complex queries, materialized views, and performance optimizations
 */
import { PrismaClient } from '@prisma/client';
import { ActivityService } from '../../services/activity/activity.service';
import { TeamService } from '../../services/team/team.service';
import { LeaderboardService } from '../../services/leaderboard/leaderboard.service';
import { 
  createMockPrisma,
  mockUsers,
  mockTeams,
  mockTeamGoals,
  mockActivities,
  createMockUserStats,
  resetAllMocks,
} from '../utils/test-helpers';

describe('Database Services and Aggregations', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let activityService: ActivityService;
  let teamService: TeamService;
  let leaderboardService: LeaderboardService;

  beforeEach(() => {
    resetAllMocks();
    prisma = createMockPrisma();
    activityService = new ActivityService(prisma as any);
    teamService = new TeamService(prisma as any);
    leaderboardService = new LeaderboardService(prisma as any);
  });

  describe('ActivityService Aggregations', () => {
    describe('getUserStats', () => {
      const userId = mockUsers.user1.id;

      it('should calculate comprehensive user statistics', async () => {
        // Mock aggregate queries
        prisma.activity.aggregate.mockResolvedValue({
          _sum: {
            distance: 75000, // 75km total
            duration: 36000, // 10 hours total
          },
          _count: {
            id: 15, // 15 activities
          },
          _avg: {
            pace: 8.0, // 8 min/km average pace
            distance: 5000, // 5km average distance
          },
        } as any);

        // Mock streak calculation query
        prisma.$queryRaw.mockResolvedValueOnce([
          { currentStreak: 7, longestStreak: 14 }
        ]);

        // Mock last activity date
        prisma.activity.findFirst.mockResolvedValue({
          ...mockActivities.activity1,
          activityDate: new Date('2025-01-18'),
        } as any);

        // Mock weekly stats
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);
        
        prisma.activity.aggregate.mockResolvedValueOnce({
          _sum: { distance: 15000, duration: 7200 },
          _count: { id: 3 },
        } as any);

        // Mock monthly stats
        const monthStart = new Date();
        monthStart.setDate(monthStart.getDate() - 30);
        
        prisma.activity.aggregate.mockResolvedValueOnce({
          _sum: { distance: 75000, duration: 36000 },
          _count: { id: 15 },
        } as any);

        const result = await activityService.getUserStats(userId);

        expect(result).toMatchObject({
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
        });

        // Verify queries were made with correct filters
        expect(prisma.activity.aggregate).toHaveBeenCalledWith({
          where: { userId },
          _sum: { distance: true, duration: true },
          _count: { id: true },
          _avg: { pace: true, distance: true },
        });

        expect(prisma.$queryRaw).toHaveBeenCalledWith(
          expect.any(Object),
          userId
        );
      });

      it('should handle users with no activities', async () => {
        prisma.activity.aggregate.mockResolvedValue({
          _sum: { distance: null, duration: null },
          _count: { id: 0 },
          _avg: { pace: null, distance: null },
        } as any);

        prisma.$queryRaw.mockResolvedValue([
          { currentStreak: 0, longestStreak: 0 }
        ]);

        prisma.activity.findFirst.mockResolvedValue(null);

        // Mock empty weekly/monthly stats
        prisma.activity.aggregate
          .mockResolvedValueOnce({
            _sum: { distance: null, duration: null },
            _count: { id: 0 },
          } as any)
          .mockResolvedValueOnce({
            _sum: { distance: null, duration: null },
            _count: { id: 0 },
          } as any);

        const result = await activityService.getUserStats(userId);

        expect(result).toMatchObject({
          totalDistance: 0,
          totalDuration: 0,
          totalActivities: 0,
          averagePace: 0,
          averageDistance: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: null,
          weeklyStats: {
            distance: 0,
            duration: 0,
            activities: 0,
          },
          monthlyStats: {
            distance: 0,
            duration: 0,
            activities: 0,
          },
        });
      });

      it('should calculate streaks correctly', async () => {
        // Mock basic stats
        prisma.activity.aggregate.mockResolvedValue({
          _sum: { distance: 50000, duration: 24000 },
          _count: { id: 10 },
          _avg: { pace: 8.0, distance: 5000 },
        } as any);

        // Mock complex streak calculation
        prisma.$queryRaw.mockResolvedValue([
          { currentStreak: 12, longestStreak: 25 }
        ]);

        prisma.activity.findFirst.mockResolvedValue({
          activityDate: new Date('2025-01-19'),
        } as any);

        // Mock weekly/monthly stats
        prisma.activity.aggregate
          .mockResolvedValueOnce({
            _sum: { distance: 20000, duration: 9600 },
            _count: { id: 4 },
          } as any)
          .mockResolvedValueOnce({
            _sum: { distance: 50000, duration: 24000 },
            _count: { id: 10 },
          } as any);

        const result = await activityService.getUserStats(userId);

        expect(result.currentStreak).toBe(12);
        expect(result.longestStreak).toBe(25);

        // Verify streak query includes proper date logic
        expect(prisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringMatching(/WITH RECURSIVE/i), // Should use recursive CTE for streaks
          userId
        );
      });
    });

    describe('getActivitySummary', () => {
      const userId = mockUsers.user1.id;

      it('should return weekly activity summaries', async () => {
        const mockSummaries = [
          {
            period_start: new Date('2025-01-06'),
            period_end: new Date('2025-01-12'),
            total_distance: 25000,
            total_duration: 12000,
            activity_count: 5,
            avg_pace: 8.0,
            avg_distance: 5000,
            active_days: 5,
          },
          {
            period_start: new Date('2025-01-13'),
            period_end: new Date('2025-01-19'),
            total_distance: 30000,
            total_duration: 14400,
            activity_count: 6,
            avg_pace: 8.0,
            avg_distance: 5000,
            active_days: 6,
          },
        ];

        prisma.$queryRaw.mockResolvedValue(mockSummaries);

        const result = await activityService.getActivitySummary(userId, {
          period: 'weekly',
          startDate: '2025-01-01T00:00:00Z',
          endDate: '2025-01-31T23:59:59Z',
        });

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
          startDate: new Date('2025-01-06'),
          endDate: new Date('2025-01-12'),
          totalDistance: 25000,
          totalDuration: 12000,
          totalActivities: 5,
          averagePace: 8.0,
          averageDistance: 5000,
          activeDays: 5,
        });

        expect(prisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringMatching(/date_trunc\('week'/i),
          userId,
          new Date('2025-01-01T00:00:00Z'),
          new Date('2025-01-31T23:59:59Z')
        );
      });

      it('should return daily activity summaries', async () => {
        const mockDailySummaries = [
          {
            period_start: new Date('2025-01-18'),
            period_end: new Date('2025-01-18'),
            total_distance: 5000,
            total_duration: 2400,
            activity_count: 1,
            avg_pace: 8.0,
            avg_distance: 5000,
            active_days: 1,
          },
        ];

        prisma.$queryRaw.mockResolvedValue(mockDailySummaries);

        const result = await activityService.getActivitySummary(userId, {
          period: 'daily',
          startDate: '2025-01-18T00:00:00Z',
          endDate: '2025-01-18T23:59:59Z',
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          startDate: new Date('2025-01-18'),
          endDate: new Date('2025-01-18'),
          totalDistance: 5000,
          totalActivities: 1,
        });

        expect(prisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringMatching(/date_trunc\('day'/i),
          userId,
          new Date('2025-01-18T00:00:00Z'),
          new Date('2025-01-18T23:59:59Z')
        );
      });

      it('should filter by team when specified', async () => {
        prisma.$queryRaw.mockResolvedValue([]);

        await activityService.getActivitySummary(userId, {
          period: 'weekly',
          teamId: mockTeams.team1.id,
        });

        expect(prisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringMatching(/team_activities/i),
          userId,
          expect.any(Date),
          expect.any(Date),
          mockTeams.team1.id
        );
      });

      it('should respect limit parameter', async () => {
        prisma.$queryRaw.mockResolvedValue([]);

        await activityService.getActivitySummary(userId, {
          period: 'weekly',
          limit: 4,
        });

        expect(prisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringMatching(/LIMIT/i),
          userId,
          expect.any(Date),
          expect.any(Date),
          4
        );
      });
    });
  });

  describe('LeaderboardService Aggregations', () => {
    describe('getTeamLeaderboard', () => {
      const teamId = mockTeams.team1.id;

      it('should calculate team member rankings', async () => {
        const mockLeaderboardData = [
          {
            userId: mockUsers.user1.id,
            name: mockUsers.user1.name,
            totalDistance: 25000,
            totalDuration: 12000,
            activityCount: 5,
            avgPace: 8.0,
            lastActivityDate: new Date('2025-01-18'),
          },
          {
            userId: mockUsers.user2.id,
            name: mockUsers.user2.name,
            totalDistance: 20000,
            totalDuration: 9600,
            activityCount: 4,
            avgPace: 8.0,
            lastActivityDate: new Date('2025-01-17'),
          },
        ];

        prisma.$queryRaw.mockResolvedValue(mockLeaderboardData);

        const result = await leaderboardService.getTeamLeaderboard(teamId, {
          period: 'all',
          limit: 10,
        });

        expect(result.members).toHaveLength(2);
        expect(result.members[0]).toMatchObject({
          userId: mockUsers.user1.id,
          name: mockUsers.user1.name,
          totalDistance: 25000,
          rank: 1, // Should be added by service
        });

        expect(result.members[1]).toMatchObject({
          userId: mockUsers.user2.id,
          name: mockUsers.user2.name,
          totalDistance: 20000,
          rank: 2,
        });

        // Verify query respects privacy (isPrivate = false)
        expect(prisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringMatching(/isPrivate = false/i),
          teamId,
          10
        );
      });

      it('should filter by time period', async () => {
        prisma.$queryRaw.mockResolvedValue([]);

        await leaderboardService.getTeamLeaderboard(teamId, {
          period: 'week',
          limit: 5,
        });

        expect(prisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringMatching(/activity_date >= /i),
          teamId,
          5
        );
      });

      it('should exclude private activities from rankings', async () => {
        const mockDataWithPrivate = [
          {
            userId: mockUsers.user1.id,
            name: mockUsers.user1.name,
            totalDistance: 15000, // Less because private activities excluded
            totalDuration: 7200,
            activityCount: 3,
            avgPace: 8.0,
            lastActivityDate: new Date('2025-01-18'),
          },
        ];

        prisma.$queryRaw.mockResolvedValue(mockDataWithPrivate);

        const result = await leaderboardService.getTeamLeaderboard(teamId);

        expect(result.members[0].totalDistance).toBe(15000);

        // Verify private activities are excluded
        expect(prisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringMatching(/isPrivate = false/),
          teamId,
          expect.any(Number)
        );
      });

      it('should handle empty leaderboard', async () => {
        prisma.$queryRaw.mockResolvedValue([]);

        const result = await leaderboardService.getTeamLeaderboard(teamId);

        expect(result.members).toEqual([]);
        expect(result.teamId).toBe(teamId);
      });
    });

    describe('getGlobalLeaderboard', () => {
      it('should calculate global user rankings', async () => {
        const mockGlobalData = [
          {
            userId: mockUsers.user1.id,
            name: mockUsers.user1.name,
            totalDistance: 50000,
            totalDuration: 24000,
            activityCount: 10,
            avgPace: 8.0,
            teamCount: 2,
          },
          {
            userId: mockUsers.user2.id,
            name: mockUsers.user2.name,
            totalDistance: 45000,
            totalDuration: 21600,
            activityCount: 9,
            avgPace: 8.0,
            teamCount: 1,
          },
        ];

        prisma.$queryRaw.mockResolvedValue(mockGlobalData);

        const result = await leaderboardService.getGlobalLeaderboard({
          period: 'all',
          limit: 10,
        });

        expect(result.members).toHaveLength(2);
        expect(result.members[0]).toMatchObject({
          userId: mockUsers.user1.id,
          totalDistance: 50000,
          rank: 1,
        });

        expect(result.members[1]).toMatchObject({
          userId: mockUsers.user2.id,
          totalDistance: 45000,
          rank: 2,
        });

        expect(prisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringMatching(/GROUP BY.*u\.id/i),
          10
        );
      });

      it('should filter global leaderboard by period', async () => {
        prisma.$queryRaw.mockResolvedValue([]);

        await leaderboardService.getGlobalLeaderboard({
          period: 'month',
          limit: 20,
        });

        expect(prisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringMatching(/activity_date >= /i),
          20
        );
      });
    });

    describe('getUserRankInTeam', () => {
      const teamId = mockTeams.team1.id;
      const userId = mockUsers.user1.id;

      it('should return user rank in team', async () => {
        prisma.$queryRaw.mockResolvedValue([
          {
            userId,
            rank: 3,
            totalDistance: 15000,
            outOf: 8,
          },
        ]);

        const result = await leaderboardService.getUserRankInTeam(teamId, userId);

        expect(result).toMatchObject({
          userId,
          rank: 3,
          totalDistance: 15000,
          outOf: 8,
        });

        expect(prisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringMatching(/RANK\(\)/i),
          teamId,
          userId
        );
      });

      it('should handle user not found in team', async () => {
        prisma.$queryRaw.mockResolvedValue([]);

        const result = await leaderboardService.getUserRankInTeam(teamId, userId);

        expect(result).toBeNull();
      });
    });
  });

  describe('TeamService Aggregations', () => {
    describe('getTeamStats', () => {
      const teamId = mockTeams.team1.id;

      it('should calculate comprehensive team statistics', async () => {
        // Mock team member count
        prisma.teamMember.count.mockResolvedValue(5);

        // Mock team activity aggregates
        prisma.activity.aggregate.mockResolvedValue({
          _sum: {
            distance: 125000, // 125km total
            duration: 60000, // ~16.7 hours
          },
          _count: { id: 25 },
          _avg: {
            distance: 5000, // 5km average
            pace: 8.0,
          },
        } as any);

        // Mock most recent activity
        prisma.activity.findFirst.mockResolvedValue({
          ...mockActivities.activity1,
          activityDate: new Date('2025-01-18'),
          user: mockUsers.user1,
        } as any);

        // Mock active members (with recent activity)
        prisma.$queryRaw.mockResolvedValue([
          { activeMembers: 4 }, // 4 out of 5 members active in last 7 days
        ]);

        const result = await teamService.getTeamStats(teamId);

        expect(result).toMatchObject({
          teamId,
          memberCount: 5,
          totalDistance: 125000,
          totalDuration: 60000,
          totalActivities: 25,
          averageDistance: 5000,
          averagePace: 8.0,
          lastActivityDate: new Date('2025-01-18'),
          activeMemberCount: 4,
        });

        expect(prisma.teamMember.count).toHaveBeenCalledWith({
          where: { teamId, leftAt: null },
        });

        expect(prisma.activity.aggregate).toHaveBeenCalledWith({
          where: {
            teamActivities: { some: { teamId } },
          },
          _sum: { distance: true, duration: true },
          _count: { id: true },
          _avg: { distance: true, pace: true },
        });
      });

      it('should handle teams with no activities', async () => {
        prisma.teamMember.count.mockResolvedValue(3);
        
        prisma.activity.aggregate.mockResolvedValue({
          _sum: { distance: null, duration: null },
          _count: { id: 0 },
          _avg: { distance: null, pace: null },
        } as any);

        prisma.activity.findFirst.mockResolvedValue(null);
        prisma.$queryRaw.mockResolvedValue([{ activeMembers: 0 }]);

        const result = await teamService.getTeamStats(teamId);

        expect(result).toMatchObject({
          teamId,
          memberCount: 3,
          totalDistance: 0,
          totalDuration: 0,
          totalActivities: 0,
          averageDistance: 0,
          averagePace: 0,
          lastActivityDate: null,
          activeMemberCount: 0,
        });
      });
    });
  });

  describe('Performance and Optimization', () => {
    it('should use efficient queries for large datasets', async () => {
      // Test that services use proper indexing and query optimization
      const userId = mockUsers.user1.id;

      prisma.activity.aggregate.mockResolvedValue({
        _sum: { distance: 100000, duration: 48000 },
        _count: { id: 20 },
        _avg: { pace: 8.0, distance: 5000 },
      } as any);

      prisma.$queryRaw.mockResolvedValue([
        { currentStreak: 5, longestStreak: 12 }
      ]);

      prisma.activity.findFirst.mockResolvedValue({
        activityDate: new Date('2025-01-18'),
      } as any);

      // Mock weekly/monthly stats
      prisma.activity.aggregate
        .mockResolvedValueOnce({
          _sum: { distance: 20000, duration: 9600 },
          _count: { id: 4 },
        } as any)
        .mockResolvedValueOnce({
          _sum: { distance: 100000, duration: 48000 },
          _count: { id: 20 },
        } as any);

      await activityService.getUserStats(userId);

      // Verify indexed queries are used
      expect(prisma.activity.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId }, // Should use userId index
        })
      );

      expect(prisma.activity.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          orderBy: { activityDate: 'desc' },
          take: 1, // Efficient single record fetch
        })
      );
    });

    it('should handle concurrent aggregation requests efficiently', async () => {
      const teamId = mockTeams.team1.id;
      
      prisma.$queryRaw.mockResolvedValue([
        { userId: mockUsers.user1.id, totalDistance: 25000, rank: 1 },
        { userId: mockUsers.user2.id, totalDistance: 20000, rank: 2 },
      ]);

      // Execute multiple leaderboard requests concurrently
      const promises = Array.from({ length: 3 }, () =>
        leaderboardService.getTeamLeaderboard(teamId)
      );

      await Promise.all(promises);

      // Should handle concurrent requests without conflicts
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    });

    it('should use proper date indexing for time-based queries', async () => {
      const userId = mockUsers.user1.id;

      prisma.$queryRaw.mockResolvedValue([]);

      await activityService.getActivitySummary(userId, {
        period: 'weekly',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      });

      // Verify date range queries are properly indexed
      expect(prisma.$queryRaw).toHaveBeenCalledWith(
        expect.stringMatching(/activity_date.*BETWEEN/i),
        userId,
        expect.any(Date),
        expect.any(Date)
      );
    });
  });

  describe('Error Handling in Aggregations', () => {
    it('should handle database timeouts gracefully', async () => {
      const userId = mockUsers.user1.id;

      prisma.activity.aggregate.mockRejectedValue(
        new Error('Query timeout')
      );

      await expect(
        activityService.getUserStats(userId)
      ).rejects.toThrow('Query timeout');
    });

    it('should handle malformed query results', async () => {
      const userId = mockUsers.user1.id;

      // Mock malformed aggregate result
      prisma.activity.aggregate.mockResolvedValue({
        _sum: { distance: 'invalid' }, // Invalid data type
        _count: { id: null },
      } as any);

      await expect(
        activityService.getUserStats(userId)
      ).rejects.toThrow();
    });

    it('should handle empty team aggregations', async () => {
      const teamId = 'non-existent-team';

      prisma.$queryRaw.mockResolvedValue([]);

      const result = await leaderboardService.getTeamLeaderboard(teamId);

      expect(result).toMatchObject({
        teamId,
        members: [],
      });
    });
  });
});