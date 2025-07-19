import { PrismaClient, Activity, UserStats, TeamMember, Achievement, UserAchievement } from '@prisma/client';
import {
  AchievementDefinition,
  AchievementWithUser,
  AchievementCheckResult,
  UserAchievementProgress,
  ACHIEVEMENT_DEFINITIONS,
  AchievementCriteria,
} from './types';

export class AchievementService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Initialize achievements in the database
   * This should be called on application startup
   */
  async initializeAchievements(): Promise<void> {
    for (const definition of ACHIEVEMENT_DEFINITIONS) {
      await this.prisma.achievement.upsert({
        where: { key: definition.key },
        create: {
          key: definition.key,
          name: definition.name,
          description: definition.description,
          iconUrl: definition.iconUrl,
          category: definition.category,
          points: definition.points,
          criteria: definition.criteria as any,
        },
        update: {
          name: definition.name,
          description: definition.description,
          iconUrl: definition.iconUrl,
          category: definition.category,
          points: definition.points,
          criteria: definition.criteria as any,
        },
      });
    }
  }

  /**
   * Check all achievements for a user
   * This can be called manually or as part of periodic maintenance
   */
  async checkUserAchievements(userId: string): Promise<AchievementCheckResult> {
    const newAchievements: AchievementWithUser[] = [];
    const checkedAchievements: string[] = [];

    // Get all achievements
    const achievements = await this.prisma.achievement.findMany();
    
    // Get user's current achievements
    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    });
    
    const earnedAchievementIds = new Set(userAchievements.map(ua => ua.achievementId));

    for (const achievement of achievements) {
      checkedAchievements.push(achievement.key);
      
      // Skip if already earned
      if (earnedAchievementIds.has(achievement.id)) {
        continue;
      }

      const earned = await this.checkSingleAchievement(userId, achievement);
      if (earned) {
        const userAchievement = await this.awardAchievement(userId, achievement.id);
        newAchievements.push({
          ...userAchievement,
          achievement,
        });
      }
    }

    return {
      newAchievements,
      checkedAchievements,
    };
  }

  /**
   * Detect and award new achievements after an activity is created
   * This is called from the activity creation flow
   */
  async detectNewAchievements(userId: string, activity: Activity): Promise<AchievementWithUser[]> {
    const newAchievements: AchievementWithUser[] = [];

    // Get all achievements that haven't been earned yet
    const achievements = await this.prisma.achievement.findMany({
      where: {
        userAchievements: {
          none: {
            userId,
          },
        },
      },
    });

    for (const achievement of achievements) {
      const earned = await this.checkSingleAchievement(userId, achievement, activity);
      if (earned) {
        const userAchievement = await this.awardAchievement(
          userId, 
          achievement.id, 
          activity.teamId, 
          activity.id
        );
        newAchievements.push({
          ...userAchievement,
          achievement,
        });
      }
    }

    return newAchievements;
  }

  /**
   * Get user's achievements with progress information
   */
  async getUserAchievements(userId: string): Promise<UserAchievementProgress[]> {
    const achievements = await this.prisma.achievement.findMany({
      orderBy: [
        { category: 'asc' },
        { points: 'asc' },
      ],
    });

    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
    });

    const earnedMap = new Map(
      userAchievements.map(ua => [ua.achievementId, ua])
    );

    const result: UserAchievementProgress[] = [];

    for (const achievement of achievements) {
      const earned = earnedMap.get(achievement.id);
      
      if (earned) {
        result.push({
          achievement,
          earned: true,
          earnedAt: earned.earnedAt,
        });
      } else {
        // Calculate progress for unearned achievements
        const progress = await this.calculateAchievementProgress(userId, achievement);
        result.push({
          achievement,
          earned: false,
          progress,
        });
      }
    }

    return result;
  }

  /**
   * Check if a single achievement should be awarded
   */
  private async checkSingleAchievement(
    userId: string, 
    achievement: Achievement, 
    triggeringActivity?: Activity
  ): Promise<boolean> {
    const criteria = achievement.criteria as unknown as AchievementCriteria;

    switch (criteria.type) {
      case 'distance':
        return this.checkDistanceAchievement(userId, criteria);
      
      case 'streak':
        return this.checkStreakAchievement(userId, criteria);
      
      case 'team':
        return this.checkTeamAchievement(userId, criteria);
      
      case 'time':
        return this.checkTimeAchievement(userId, criteria, triggeringActivity);
      
      case 'count':
        return this.checkCountAchievement(userId, criteria);
      
      default:
        return false;
    }
  }

  /**
   * Check distance-based achievements
   */
  private async checkDistanceAchievement(userId: string, criteria: AchievementCriteria): Promise<boolean> {
    const userStats = await this.prisma.userStats.findUnique({
      where: { userId },
    });

    if (!userStats) return false;

    const currentDistance = userStats.totalDistance;
    const targetDistance = criteria.condition.value;

    switch (criteria.condition.operator) {
      case 'gte':
        return currentDistance >= targetDistance;
      case 'gt':
        return currentDistance > targetDistance;
      case 'eq':
        return currentDistance === targetDistance;
      case 'lt':
        return currentDistance < targetDistance;
      default:
        return false;
    }
  }

  /**
   * Check streak-based achievements
   */
  private async checkStreakAchievement(userId: string, criteria: AchievementCriteria): Promise<boolean> {
    const userStats = await this.prisma.userStats.findUnique({
      where: { userId },
    });

    if (!userStats) return false;

    const currentStreak = userStats.currentStreak;
    const targetStreak = criteria.condition.value;

    switch (criteria.condition.operator) {
      case 'gte':
        return currentStreak >= targetStreak;
      case 'gt':
        return currentStreak > targetStreak;
      case 'eq':
        return currentStreak === targetStreak;
      default:
        return false;
    }
  }

  /**
   * Check team-based achievements
   */
  private async checkTeamAchievement(userId: string, criteria: AchievementCriteria): Promise<boolean> {
    const teamCount = await this.prisma.teamMember.count({
      where: {
        userId,
        leftAt: null,
      },
    });

    const targetCount = criteria.condition.value;

    switch (criteria.condition.operator) {
      case 'gte':
        return teamCount >= targetCount;
      case 'gt':
        return teamCount > targetCount;
      case 'eq':
        return teamCount === targetCount;
      default:
        return false;
    }
  }

  /**
   * Check time-based achievements (e.g., early bird)
   */
  private async checkTimeAchievement(
    userId: string, 
    criteria: AchievementCriteria, 
    triggeringActivity?: Activity
  ): Promise<boolean> {
    if (!triggeringActivity) {
      // Check if user has any activity that meets the time criteria
      const activity = await this.prisma.activity.findFirst({
        where: {
          userId,
        },
        orderBy: {
          startTime: 'desc',
        },
      });

      if (!activity) return false;
      triggeringActivity = activity;
    }

    const activityHour = triggeringActivity.startTime.getHours();
    const targetHour = criteria.condition.value;

    switch (criteria.condition.operator) {
      case 'lt':
        return activityHour < targetHour;
      case 'gt':
        return activityHour > targetHour;
      case 'eq':
        return activityHour === targetHour;
      case 'gte':
        return activityHour >= targetHour;
      default:
        return false;
    }
  }

  /**
   * Check count-based achievements (e.g., first walk)
   */
  private async checkCountAchievement(userId: string, criteria: AchievementCriteria): Promise<boolean> {
    const activityCount = await this.prisma.activity.count({
      where: { userId },
    });

    const targetCount = criteria.condition.value;

    switch (criteria.condition.operator) {
      case 'gte':
        return activityCount >= targetCount;
      case 'gt':
        return activityCount > targetCount;
      case 'eq':
        return activityCount === targetCount;
      default:
        return false;
    }
  }

  /**
   * Award an achievement to a user
   */
  private async awardAchievement(
    userId: string,
    achievementId: string,
    teamId?: string,
    activityId?: string
  ): Promise<UserAchievement> {
    return this.prisma.userAchievement.create({
      data: {
        userId,
        achievementId,
        teamId,
        activityId,
        earnedAt: new Date(),
      },
    });
  }

  /**
   * Calculate progress towards an unearned achievement
   */
  private async calculateAchievementProgress(
    userId: string,
    achievement: Achievement
  ): Promise<{ current: number; target: number; percentage: number } | undefined> {
    const criteria = achievement.criteria as unknown as AchievementCriteria;

    let current = 0;
    const target = criteria.condition.value;

    switch (criteria.type) {
      case 'distance': {
        const userStats = await this.prisma.userStats.findUnique({
          where: { userId },
        });
        current = userStats?.totalDistance || 0;
        break;
      }
      
      case 'streak': {
        const userStats = await this.prisma.userStats.findUnique({
          where: { userId },
        });
        current = userStats?.currentStreak || 0;
        break;
      }
      
      case 'team': {
        current = await this.prisma.teamMember.count({
          where: {
            userId,
            leftAt: null,
          },
        });
        break;
      }
      
      case 'count': {
        current = await this.prisma.activity.count({
          where: { userId },
        });
        break;
      }
      
      default:
        return undefined;
    }

    const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;

    return {
      current,
      target,
      percentage,
    };
  }
}