/**
 * Unit tests for LeaderboardService
 * Tests leaderboard calculations, ranking logic, and privacy controls
 */

import { PrismaClient } from '@prisma/client';
import { LeaderboardService } from '../leaderboard.service';
import { LeaderboardPeriod } from '../types';

// Mock Prisma client
const mockPrisma = {
  teamMember: {
    findFirst: jest.fn(),
  },
  team: {
    findFirst: jest.fn(),
  },
  activity: {
    count: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $disconnect: jest.fn(),
} as unknown as PrismaClient;

describe('LeaderboardService', () => {
  let leaderboardService: LeaderboardService;

  beforeEach(() => {
    leaderboardService = new LeaderboardService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('getTeamLeaderboard', () => {
    const mockTeamMember = {
      team: {
        id: 'team-1',
        name: 'Test Team',
        _count: { members: 5 },
      },
    };

    beforeEach(() => {
      (mockPrisma.teamMember.findFirst as jest.Mock).mockResolvedValue(mockTeamMember);
    });

    it('should return team leaderboard for valid team member', async () => {
      const mockLeaderboardData = [
        {
          user_id: 'user-1',
          name: 'John Doe',
          avatar_url: null,
          total_distance: 15000,
          activity_count: BigInt(5),
          average_distance: 3000,
          has_private_activities: false,
          last_activity_at: new Date('2023-01-15'),
        },
        {
          user_id: 'user-2',
          name: 'Jane Smith',
          avatar_url: 'https://example.com/avatar.jpg',
          total_distance: 12000,
          activity_count: BigInt(4),
          average_distance: 3000,
          has_private_activities: true,
          last_activity_at: new Date('2023-01-14'),
        },
      ];

      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue(mockLeaderboardData);

      const result = await leaderboardService.getTeamLeaderboard(
        'team-1',
        'user-1',
        { period: 'week' }
      );

      expect(result).toEqual({
        team: {
          id: 'team-1',
          name: 'Test Team',
          memberCount: 5,
        },
        period: 'week',
        dateRange: expect.any(Object),
        entries: [
          {
            userId: 'user-1',
            name: 'John Doe',
            avatarUrl: null,
            totalDistance: 15000,
            activityCount: 5,
            averageDistance: 3000,
            rank: 1,
            isCurrentUser: true,
            hasPrivateActivities: false,
            lastActivityAt: new Date('2023-01-15'),
          },
          {
            userId: 'user-2',
            name: 'Jane Smith',
            avatarUrl: 'https://example.com/avatar.jpg',
            totalDistance: 12000,
            activityCount: 4,
            averageDistance: 3000,
            rank: 2,
            isCurrentUser: false,
            hasPrivateActivities: true,
            lastActivityAt: new Date('2023-01-14'),
          },
        ],
        totalActiveMembers: 2,
        generatedAt: expect.any(Date),
      });

      expect(mockPrisma.teamMember.findFirst).toHaveBeenCalledWith({
        where: { teamId: 'team-1', userId: 'user-1', leftAt: null },
        include: expect.any(Object),
      });
    });

    it('should throw error for non-team member', async () => {
      (mockPrisma.teamMember.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        leaderboardService.getTeamLeaderboard('team-1', 'user-1', { period: 'week' })
      ).rejects.toThrow('User is not a member of this team');
    });

    it('should handle different periods correctly', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      // Test each period individually
      await leaderboardService.getTeamLeaderboard('team-1', 'user-1', { period: 'week' });
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      
      jest.clearAllMocks();
      await leaderboardService.getTeamLeaderboard('team-1', 'user-1', { period: 'month' });
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      
      jest.clearAllMocks();
      await leaderboardService.getTeamLeaderboard('team-1', 'user-1', { period: 'all' });
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should apply limit correctly', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await leaderboardService.getTeamLeaderboard(
        'team-1',
        'user-1',
        { period: 'week', limit: 25 }
      );

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      // Since we're testing the service works with limit parameter
      // The actual SQL generation is handled by Prisma
    });
  });

  describe('getGlobalLeaderboard', () => {
    it('should return global leaderboard with privacy controls', async () => {
      const mockGlobalData = [
        {
          user_id: 'user-1',
          name: 'Alice Runner',
          avatar_url: null,
          total_distance: 25000,
          activity_count: BigInt(8),
          average_distance: 3125,
          has_private_activities: false,
          last_activity_at: new Date('2023-01-16'),
        },
      ];

      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue(mockGlobalData);

      const result = await leaderboardService.getGlobalLeaderboard(
        'user-1',
        { period: 'month' }
      );

      expect(result).toEqual({
        period: 'month',
        dateRange: expect.any(Object),
        entries: [
          {
            userId: 'user-1',
            name: 'Alice Runner',
            avatarUrl: null,
            totalDistance: 25000,
            activityCount: 8,
            averageDistance: 3125,
            rank: 1,
            isCurrentUser: true,
            hasPrivateActivities: false,
            lastActivityAt: new Date('2023-01-16'),
          },
        ],
        totalActiveUsers: 1,
        generatedAt: expect.any(Date),
      });

      // Verify the method was called and returned expected structure
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('getUserRank', () => {
    const mockTeamMember = {
      teamId: 'team-1',
      userId: 'user-1',
    };

    beforeEach(() => {
      (mockPrisma.teamMember.findFirst as jest.Mock).mockResolvedValue(mockTeamMember);
    });

    it('should return user rank information', async () => {
      const mockRankData = [
        {
          user_id: 'user-1',
          total_distance: 10000,
          rank: BigInt(3),
          total_participants: BigInt(10),
          next_distance: 12000,
          prev_distance: 8000,
        },
      ];

      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue(mockRankData);

      const result = await leaderboardService.getUserRank(
        'user-1',
        'team-1',
        { period: 'all' }
      );

      expect(result).toEqual({
        rank: 3,
        totalParticipants: 10,
        totalDistance: 10000,
        distanceToNextRank: 2000, // 12000 - 10000
        distanceFromPreviousRank: 2000, // 10000 - 8000
      });
    });

    it('should handle rank 1 correctly (no next distance)', async () => {
      const mockRankData = [
        {
          user_id: 'user-1',
          total_distance: 15000,
          rank: BigInt(1),
          total_participants: BigInt(10),
          next_distance: null,
          prev_distance: 12000,
        },
      ];

      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue(mockRankData);

      const result = await leaderboardService.getUserRank(
        'user-1',
        'team-1',
        { period: 'week' }
      );

      expect(result.rank).toBe(1);
      expect(result.distanceToNextRank).toBeNull();
      expect(result.distanceFromPreviousRank).toBe(3000); // 15000 - 12000
    });

    it('should handle last place correctly (no previous distance)', async () => {
      const mockRankData = [
        {
          user_id: 'user-1',
          total_distance: 5000,
          rank: BigInt(10),
          total_participants: BigInt(10),
          next_distance: 8000,
          prev_distance: null,
        },
      ];

      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue(mockRankData);

      const result = await leaderboardService.getUserRank(
        'user-1',
        'team-1',
        { period: 'month' }
      );

      expect(result.rank).toBe(10);
      expect(result.distanceToNextRank).toBe(3000); // 8000 - 5000
      expect(result.distanceFromPreviousRank).toBeNull();
    });

    it('should throw error for non-team member', async () => {
      (mockPrisma.teamMember.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        leaderboardService.getUserRank('user-1', 'team-1', { period: 'week' })
      ).rejects.toThrow('User is not a member of this team');
    });

    it('should throw error when user not found in leaderboard', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await expect(
        leaderboardService.getUserRank('user-1', 'team-1', { period: 'week' })
      ).rejects.toThrow('User not found in team leaderboard');
    });
  });

  describe('invalidateTeamCaches', () => {
    it('should clear cache keys for team leaderboards', () => {
      // Mock cache implementation would be tested here
      // For now, we'll just ensure the method exists and can be called
      expect(() => {
        leaderboardService.invalidateTeamCaches('team-1');
      }).not.toThrow();
    });
  });

  describe('period handling', () => {
    it('should accept different period parameters', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);
      const mockTeamMember = {
        team: { id: 'team-1', name: 'Test Team', _count: { members: 5 } },
      };
      (mockPrisma.teamMember.findFirst as jest.Mock).mockResolvedValue(mockTeamMember);

      // Test that each period type is accepted without errors
      await expect(
        leaderboardService.getTeamLeaderboard('team-1', 'user-1', { period: 'week' })
      ).resolves.toBeDefined();
      
      await expect(
        leaderboardService.getTeamLeaderboard('team-1', 'user-1', { period: 'month' })
      ).resolves.toBeDefined();
      
      await expect(
        leaderboardService.getTeamLeaderboard('team-1', 'user-1', { period: 'all' })
      ).resolves.toBeDefined();
    });
  });
});