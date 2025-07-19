import { PrismaClient } from '@prisma/client';
import { AchievementService } from '../achievement.service';
import { ACHIEVEMENT_DEFINITIONS } from '../types';

// Mock Prisma
const mockPrisma = {
  achievement: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  userAchievement: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  userStats: {
    findUnique: jest.fn(),
  },
  teamMember: {
    count: jest.fn(),
  },
  activity: {
    count: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('AchievementService', () => {
  let achievementService: AchievementService;

  beforeEach(() => {
    achievementService = new AchievementService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('initializeAchievements', () => {
    it('should create all predefined achievements', async () => {
      (mockPrisma.achievement.upsert as jest.Mock).mockResolvedValue({});

      await achievementService.initializeAchievements();

      expect(mockPrisma.achievement.upsert).toHaveBeenCalledTimes(ACHIEVEMENT_DEFINITIONS.length);
      
      // Check first achievement
      expect(mockPrisma.achievement.upsert).toHaveBeenCalledWith({
        where: { key: 'first_walk' },
        create: expect.objectContaining({
          key: 'first_walk',
          name: 'First Walk',
          category: 'DISTANCE',
          points: 10,
        }),
        update: expect.objectContaining({
          name: 'First Walk',
          category: 'DISTANCE',
          points: 10,
        }),
      });
    });
  });

  describe('checkDistanceAchievement', () => {
    it('should award first walk achievement when user has activities', async () => {
      const userId = 'user-1';
      const firstWalkAchievement = {
        id: 'achievement-1',
        key: 'first_walk',
        criteria: {
          type: 'count',
          condition: {
            operator: 'gte',
            value: 1,
            unit: 'count',
          },
        },
      };

      // Mock user has 1 activity
      (mockPrisma.activity.count as jest.Mock).mockResolvedValue(1);

      const result = await (achievementService as any).checkSingleAchievement(
        userId,
        firstWalkAchievement
      );

      expect(result).toBe(true);
      expect(mockPrisma.activity.count).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('should not award distance achievement if target not met', async () => {
      const userId = 'user-1';
      const tenMileAchievement = {
        id: 'achievement-2',
        key: '10_mile_club',
        criteria: {
          type: 'distance',
          condition: {
            operator: 'gte',
            value: 16093.44, // 10 miles in meters
            unit: 'meters',
          },
        },
      };

      // Mock user has only walked 5 miles
      (mockPrisma.userStats.findUnique as jest.Mock).mockResolvedValue({
        totalDistance: 8046.72, // 5 miles in meters
      });

      const result = await (achievementService as any).checkSingleAchievement(
        userId,
        tenMileAchievement
      );

      expect(result).toBe(false);
    });
  });

  describe('checkStreakAchievement', () => {
    it('should award streak achievement when target met', async () => {
      const userId = 'user-1';
      const sevenDayStreakAchievement = {
        id: 'achievement-3',
        key: '7_day_streak',
        criteria: {
          type: 'streak',
          condition: {
            operator: 'gte',
            value: 7,
            unit: 'days',
          },
        },
      };

      // Mock user has 7+ day streak
      (mockPrisma.userStats.findUnique as jest.Mock).mockResolvedValue({
        currentStreak: 8,
      });

      const result = await (achievementService as any).checkSingleAchievement(
        userId,
        sevenDayStreakAchievement
      );

      expect(result).toBe(true);
    });
  });

  describe('checkTeamAchievement', () => {
    it('should award team achievement when user joins first team', async () => {
      const userId = 'user-1';
      const teamPlayerAchievement = {
        id: 'achievement-4',
        key: 'team_player',
        criteria: {
          type: 'team',
          condition: {
            operator: 'gte',
            value: 1,
            unit: 'count',
          },
        },
      };

      // Mock user has 1 team membership
      (mockPrisma.teamMember.count as jest.Mock).mockResolvedValue(1);

      const result = await (achievementService as any).checkSingleAchievement(
        userId,
        teamPlayerAchievement
      );

      expect(result).toBe(true);
      expect(mockPrisma.teamMember.count).toHaveBeenCalledWith({
        where: {
          userId,
          leftAt: null,
        },
      });
    });
  });

  describe('checkTimeAchievement', () => {
    it('should award early bird achievement for activity before 7 AM', async () => {
      const userId = 'user-1';
      const earlyBirdAchievement = {
        id: 'achievement-5',
        key: 'early_bird',
        criteria: {
          type: 'time',
          condition: {
            operator: 'lt',
            value: 7,
            unit: 'hour',
          },
        },
      };

      const earlyActivity = {
        id: 'activity-1',
        startTime: new Date('2024-01-01T06:30:00Z'), // 6:30 AM
        userId,
      };

      const result = await (achievementService as any).checkSingleAchievement(
        userId,
        earlyBirdAchievement,
        earlyActivity
      );

      expect(result).toBe(true);
    });

    it('should not award early bird achievement for activity after 7 AM', async () => {
      const userId = 'user-1';
      const earlyBirdAchievement = {
        id: 'achievement-5',
        key: 'early_bird',
        criteria: {
          type: 'time',
          condition: {
            operator: 'lt',
            value: 7,
            unit: 'hour',
          },
        },
      };

      const lateActivity = {
        id: 'activity-1',
        startTime: new Date('2024-01-01T08:30:00Z'), // 8:30 AM
        userId,
      };

      const result = await (achievementService as any).checkSingleAchievement(
        userId,
        earlyBirdAchievement,
        lateActivity
      );

      expect(result).toBe(false);
    });
  });
});