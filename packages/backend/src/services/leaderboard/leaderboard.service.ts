import { PrismaClient, Prisma } from '@prisma/client';
import {
  LeaderboardPeriod,
  LeaderboardEntry,
  TeamLeaderboard,
  GlobalLeaderboard,
  UserRank,
  LeaderboardOptions,
  LeaderboardCacheKey,
} from './types';
import { cache, cacheKeys, cacheTTL } from '../../utils/cache';

export class LeaderboardService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get team leaderboard with rankings within a team
   */
  async getTeamLeaderboard(
    teamId: string,
    userId: string,
    options: LeaderboardOptions
  ): Promise<TeamLeaderboard> {
    // Verify user is a member of the team
    const membership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        leftAt: null,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                members: {
                  where: { leftAt: null },
                },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new Error('User is not a member of this team');
    }

    // Check cache first
    const cacheKey = this.buildCacheKey({
      type: 'team',
      teamId,
      period: options.period,
      teamGoalId: options.teamGoalId,
    });
    const cached = cache.get<TeamLeaderboard>(cacheKey);
    if (cached) {
      // Update isCurrentUser flags for the requesting user
      const updatedEntries = cached.entries.map(entry => ({
        ...entry,
        isCurrentUser: entry.userId === userId,
      }));
      return {
        ...cached,
        entries: updatedEntries,
      };
    }

    const { startDate, endDate } = this.getDateRange(options.period);
    const limit = options.limit || 50;

    // Get team leaderboard data using raw SQL for efficiency
    const leaderboardData = await this.prisma.$queryRaw<
      Array<{
        user_id: string;
        name: string;
        avatar_url: string | null;
        total_distance: number;
        activity_count: bigint;
        average_distance: number;
        has_private_activities: boolean;
        last_activity_at: Date | null;
      }>
    >`
      SELECT 
        u."id" as user_id,
        u."name",
        u."avatarUrl" as avatar_url,
        COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a."distance" ELSE 0 END), 0) as total_distance,
        COUNT(CASE WHEN a."isPrivate" = false THEN a."id" END) as activity_count,
        CASE 
          WHEN COUNT(CASE WHEN a."isPrivate" = false THEN a."id" END) > 0 
          THEN COALESCE(AVG(CASE WHEN a."isPrivate" = false THEN a."distance" END), 0)
          ELSE 0 
        END as average_distance,
        EXISTS(
          SELECT 1 FROM "activities" 
          WHERE "userId" = u."id" 
            AND "teamId" = ${teamId}
            AND "isPrivate" = true
            AND "startTime" >= ${startDate}
            AND "startTime" <= ${endDate}
            ${options.teamGoalId ? Prisma.sql`AND "teamGoalId" = ${options.teamGoalId}` : Prisma.empty}
        ) as has_private_activities,
        MAX(CASE WHEN a."isPrivate" = false THEN a."startTime" END) as last_activity_at
      FROM "users" u
      INNER JOIN "team_members" tm ON tm."userId" = u."id"
      LEFT JOIN "activities" a ON a."userId" = u."id" 
        AND a."teamId" = ${teamId}
        AND a."isPrivate" = false
        AND a."startTime" >= ${startDate}
        AND a."startTime" <= ${endDate}
        ${options.teamGoalId ? Prisma.sql`AND a."teamGoalId" = ${options.teamGoalId}` : Prisma.empty}
      WHERE tm."teamId" = ${teamId}
        AND tm."leftAt" IS NULL
        AND u."deletedAt" IS NULL
      GROUP BY u."id", u."name", u."avatarUrl"
      ORDER BY total_distance DESC, u."name" ASC
      LIMIT ${limit}
    `;

    // Convert to leaderboard entries with rankings
    const entries: LeaderboardEntry[] = leaderboardData.map((row, index) => ({
      userId: row.user_id,
      name: row.name,
      avatarUrl: row.avatar_url,
      totalDistance: Number(row.total_distance),
      activityCount: Number(row.activity_count),
      averageDistance: Number(row.average_distance),
      rank: index + 1,
      isCurrentUser: row.user_id === userId,
      hasPrivateActivities: row.has_private_activities,
      lastActivityAt: row.last_activity_at,
    }));

    // Count total active members (members with at least one public activity)
    const totalActiveMembers = entries.filter(entry => entry.activityCount > 0).length;

    const teamLeaderboard: TeamLeaderboard = {
      team: {
        id: membership.team.id,
        name: membership.team.name,
        memberCount: membership.team._count.members,
      },
      period: options.period,
      dateRange: { startDate, endDate },
      entries,
      totalActiveMembers,
      generatedAt: new Date(),
    };

    // Cache the result (without user-specific flags)
    const cacheableResult = {
      ...teamLeaderboard,
      entries: entries.map(entry => ({ ...entry, isCurrentUser: false })),
    };
    cache.set(cacheKey, cacheableResult, cacheTTL.leaderboard);

    return teamLeaderboard;
  }

  /**
   * Get global leaderboard with public activities only
   */
  async getGlobalLeaderboard(
    userId: string,
    options: LeaderboardOptions
  ): Promise<GlobalLeaderboard> {
    // Check cache first
    const cacheKey = this.buildCacheKey({
      type: 'global',
      period: options.period,
    });
    const cached = cache.get<GlobalLeaderboard>(cacheKey);
    if (cached) {
      // Update isCurrentUser flags for the requesting user
      const updatedEntries = cached.entries.map(entry => ({
        ...entry,
        isCurrentUser: entry.userId === userId,
      }));
      return {
        ...cached,
        entries: updatedEntries,
      };
    }

    const { startDate, endDate } = this.getDateRange(options.period);
    const limit = options.limit || 50;

    // Get global leaderboard data using raw SQL for efficiency
    const leaderboardData = await this.prisma.$queryRaw<
      Array<{
        user_id: string;
        name: string;
        avatar_url: string | null;
        total_distance: number;
        activity_count: bigint;
        average_distance: number;
        has_private_activities: boolean;
        last_activity_at: Date | null;
      }>
    >`
      SELECT 
        u."id" as user_id,
        u."name",
        u."avatarUrl" as avatar_url,
        COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a."distance" ELSE 0 END), 0) as total_distance,
        COUNT(CASE WHEN a."isPrivate" = false THEN a."id" END) as activity_count,
        CASE 
          WHEN COUNT(CASE WHEN a."isPrivate" = false THEN a."id" END) > 0 
          THEN COALESCE(AVG(CASE WHEN a."isPrivate" = false THEN a."distance" END), 0)
          ELSE 0 
        END as average_distance,
        EXISTS(
          SELECT 1 FROM "activities" 
          WHERE "userId" = u."id" 
            AND "isPrivate" = true
            AND "startTime" >= ${startDate}
            AND "startTime" <= ${endDate}
        ) as has_private_activities,
        MAX(CASE WHEN a."isPrivate" = false THEN a."startTime" END) as last_activity_at
      FROM "users" u
      LEFT JOIN "activities" a ON a."userId" = u."id" 
        AND a."isPrivate" = false
        AND a."startTime" >= ${startDate}
        AND a."startTime" <= ${endDate}
      WHERE u."deletedAt" IS NULL
        AND EXISTS(
          SELECT 1 FROM "activities" 
          WHERE "userId" = u."id" 
            AND "isPrivate" = false
            AND "startTime" >= ${startDate}
            AND "startTime" <= ${endDate}
        )
      GROUP BY u."id", u."name", u."avatarUrl"
      ORDER BY total_distance DESC, u."name" ASC
      LIMIT ${limit}
    `;

    // Convert to leaderboard entries with rankings
    const entries: LeaderboardEntry[] = leaderboardData.map((row, index) => ({
      userId: row.user_id,
      name: row.name,
      avatarUrl: row.avatar_url,
      totalDistance: Number(row.total_distance),
      activityCount: Number(row.activity_count),
      averageDistance: Number(row.average_distance),
      rank: index + 1,
      isCurrentUser: row.user_id === userId,
      hasPrivateActivities: row.has_private_activities,
      lastActivityAt: row.last_activity_at,
    }));

    const globalLeaderboard: GlobalLeaderboard = {
      period: options.period,
      dateRange: { startDate, endDate },
      entries,
      totalActiveUsers: entries.length,
      generatedAt: new Date(),
    };

    // Cache the result (without user-specific flags)
    const cacheableResult = {
      ...globalLeaderboard,
      entries: entries.map(entry => ({ ...entry, isCurrentUser: false })),
    };
    cache.set(cacheKey, cacheableResult, cacheTTL.leaderboard);

    return globalLeaderboard;
  }

  /**
   * Get specific user's rank in team leaderboard
   */
  async getUserRank(
    userId: string,
    teamId: string,
    options: LeaderboardOptions
  ): Promise<UserRank> {
    // Verify user is a member of the team
    const membership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        leftAt: null,
      },
    });

    if (!membership) {
      throw new Error('User is not a member of this team');
    }

    const { startDate, endDate } = this.getDateRange(options.period);

    // Get user's rank using window function
    const rankData = await this.prisma.$queryRaw<
      Array<{
        user_id: string;
        total_distance: number;
        rank: bigint;
        total_participants: bigint;
        next_distance: number | null;
        prev_distance: number | null;
      }>
    >`
      WITH ranked_users AS (
        SELECT 
          u."id" as user_id,
          COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a."distance" ELSE 0 END), 0) as total_distance,
          RANK() OVER (ORDER BY COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a."distance" ELSE 0 END), 0) DESC) as rank,
          LAG(COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a."distance" ELSE 0 END), 0)) OVER (ORDER BY COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a."distance" ELSE 0 END), 0) DESC) as next_distance,
          LEAD(COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a."distance" ELSE 0 END), 0)) OVER (ORDER BY COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a."distance" ELSE 0 END), 0) DESC) as prev_distance
        FROM "users" u
        INNER JOIN "team_members" tm ON tm."userId" = u."id"
        LEFT JOIN "activities" a ON a."userId" = u."id" 
          AND a."teamId" = ${teamId}
          AND a."isPrivate" = false
          AND a."startTime" >= ${startDate}
          AND a."startTime" <= ${endDate}
          ${options.teamGoalId ? Prisma.sql`AND a."teamGoalId" = ${options.teamGoalId}` : Prisma.empty}
        WHERE tm."teamId" = ${teamId}
          AND tm."leftAt" IS NULL
          AND u."deletedAt" IS NULL
        GROUP BY u."id"
      ),
      participant_count AS (
        SELECT COUNT(*) as total_participants FROM ranked_users
      )
      SELECT 
        ru.user_id,
        ru.total_distance,
        ru.rank,
        pc.total_participants,
        ru.next_distance,
        ru.prev_distance
      FROM ranked_users ru
      CROSS JOIN participant_count pc
      WHERE ru.user_id = ${userId}
    `;

    if (rankData.length === 0) {
      throw new Error('User not found in team leaderboard');
    }

    const data = rankData[0];
    const userDistance = Number(data.total_distance);
    const nextDistance = data.next_distance ? Number(data.next_distance) : null;
    const prevDistance = data.prev_distance ? Number(data.prev_distance) : null;

    return {
      rank: Number(data.rank),
      totalParticipants: Number(data.total_participants),
      totalDistance: userDistance,
      distanceToNextRank: nextDistance ? nextDistance - userDistance : null,
      distanceFromPreviousRank: prevDistance ? userDistance - prevDistance : null,
    };
  }

  /**
   * Get date range for leaderboard period
   */
  private getDateRange(period: LeaderboardPeriod): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'all':
      default:
        startDate = new Date('2024-01-01'); // Project start date
        break;
    }

    // Set times for clean date boundaries
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }

  /**
   * Build cache key for leaderboard data
   */
  private buildCacheKey(options: LeaderboardCacheKey): string {
    const parts = [
      'leaderboard',
      options.type,
      options.period,
    ];

    if (options.teamId) {
      parts.push(options.teamId);
    }

    if (options.teamGoalId) {
      parts.push(options.teamGoalId);
    }

    return parts.join(':');
  }

  /**
   * Invalidate leaderboard caches for a team (called after activity changes)
   */
  invalidateTeamCaches(teamId: string): void {
    const periods: LeaderboardPeriod[] = ['week', 'month', 'all'];
    
    periods.forEach(period => {
      // Team leaderboard
      const teamKey = this.buildCacheKey({
        type: 'team',
        teamId,
        period,
      });
      cache.delete(teamKey);

      // Global leaderboard
      const globalKey = this.buildCacheKey({
        type: 'global',
        period,
      });
      cache.delete(globalKey);
    });
  }
}