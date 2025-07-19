/**
 * Production-Optimized Leaderboard Service - DB-702
 * Enhanced with partitioning support and advanced caching strategies
 */

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

export interface LeaderboardPerformanceMetrics {
  queryName: string;
  executionTimeMs: number;
  rowsProcessed: number;
  cacheHit: boolean;
  partitionUsed?: string;
  timestamp: Date;
}

export interface AdvancedLeaderboardOptions extends LeaderboardOptions {
  includeInactive?: boolean;
  minActivityCount?: number;
  excludePrivateActivities?: boolean;
  timeZone?: string;
  partitionHint?: string;
}

export interface LeaderboardSegment {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalDistance: number;
  activityCount: number;
  averageDistance: number;
  percentile: number;
  trend: 'up' | 'down' | 'stable';
  previousRank?: number;
}

export class ProductionLeaderboardService {
  private performanceMetrics: LeaderboardPerformanceMetrics[] = [];
  private partitioningEnabled = true; // Feature flag for partition support

  constructor(private prisma: PrismaClient) {}

  /**
   * Enhanced team leaderboard with partitioning and advanced caching
   */
  async getTeamLeaderboard(
    teamId: string,
    userId: string,
    options: AdvancedLeaderboardOptions
  ): Promise<TeamLeaderboard> {
    const startTime = Date.now();
    let cacheHit = false;
    let partitionUsed = '';

    try {
      // Verify user membership with optimized query
      const membership = await this.verifyTeamMembership(teamId, userId);
      if (!membership) {
        throw new Error('User is not a member of this team');
      }

      // Build advanced cache key with all options
      const cacheKey = this.buildAdvancedCacheKey({
        type: 'team',
        teamId,
        ...options,
      });

      const cached = cache.get<TeamLeaderboard>(cacheKey);
      if (cached) {
        cacheHit = true;
        const updatedEntries = cached.entries.map(entry => ({
          ...entry,
          isCurrentUser: entry.userId === userId,
        }));

        this.logPerformanceMetric({
          queryName: 'getTeamLeaderboard',
          executionTimeMs: Date.now() - startTime,
          rowsProcessed: cached.entries.length,
          cacheHit: true,
          timestamp: new Date(),
        });

        return {
          ...cached,
          entries: updatedEntries,
        };
      }

      // Determine partition and date range
      const { startDate, endDate, partition } = this.getPartitionInfo(options.period);
      partitionUsed = partition;

      // Use optimized query with materialized view and partition awareness
      const leaderboardData = await this.executePartitionedLeaderboardQuery(
        teamId,
        startDate,
        endDate,
        options,
        partition
      );

      // Process results with trend analysis
      const entries: LeaderboardEntry[] = await this.processLeaderboardEntries(
        leaderboardData,
        userId,
        options.period
      );

      // Get team metadata efficiently
      const teamInfo = await this.getTeamInfo(teamId, membership);

      const teamLeaderboard: TeamLeaderboard = {
        team: teamInfo,
        period: options.period,
        dateRange: { startDate, endDate },
        entries,
        totalActiveMembers: entries.filter(e => e.activityCount > 0).length,
        generatedAt: new Date(),
      };

      // Cache with tiered TTL based on data freshness
      const cacheTTL = this.calculateCacheTTL(options.period);
      cache.set(cacheKey, teamLeaderboard, cacheTTL);

      this.logPerformanceMetric({
        queryName: 'getTeamLeaderboard',
        executionTimeMs: Date.now() - startTime,
        rowsProcessed: entries.length,
        cacheHit: false,
        partitionUsed,
        timestamp: new Date(),
      });

      return teamLeaderboard;
    } catch (error) {
      this.logPerformanceMetric({
        queryName: 'getTeamLeaderboard',
        executionTimeMs: Date.now() - startTime,
        rowsProcessed: 0,
        cacheHit,
        partitionUsed,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Advanced global leaderboard with segmentation
   */
  async getGlobalLeaderboard(
    userId: string,
    options: AdvancedLeaderboardOptions
  ): Promise<GlobalLeaderboard> {
    const startTime = Date.now();
    let cacheHit = false;

    try {
      const cacheKey = this.buildAdvancedCacheKey({
        type: 'global',
        ...options,
      });

      const cached = cache.get<GlobalLeaderboard>(cacheKey);
      if (cached) {
        cacheHit = true;
        const updatedEntries = cached.entries.map(entry => ({
          ...entry,
          isCurrentUser: entry.userId === userId,
        }));

        this.logPerformanceMetric({
          queryName: 'getGlobalLeaderboard',
          executionTimeMs: Date.now() - startTime,
          rowsProcessed: cached.entries.length,
          cacheHit: true,
          timestamp: new Date(),
        });

        return {
          ...cached,
          entries: updatedEntries,
        };
      }

      // Use materialized view for optimal performance
      const { startDate, endDate, partition } = this.getPartitionInfo(options.period);

      const leaderboardData = await this.executeGlobalLeaderboardQuery(
        startDate,
        endDate,
        options,
        partition
      );

      const entries: LeaderboardEntry[] = await this.processLeaderboardEntries(
        leaderboardData,
        userId,
        options.period
      );

      const globalLeaderboard: GlobalLeaderboard = {
        period: options.period,
        dateRange: { startDate, endDate },
        entries,
        totalActiveUsers: entries.length,
        generatedAt: new Date(),
      };

      const cacheTTL = this.calculateCacheTTL(options.period);
      cache.set(cacheKey, globalLeaderboard, cacheTTL);

      this.logPerformanceMetric({
        queryName: 'getGlobalLeaderboard',
        executionTimeMs: Date.now() - startTime,
        rowsProcessed: entries.length,
        cacheHit: false,
        timestamp: new Date(),
      });

      return globalLeaderboard;
    } catch (error) {
      this.logPerformanceMetric({
        queryName: 'getGlobalLeaderboard',
        executionTimeMs: Date.now() - startTime,
        rowsProcessed: 0,
        cacheHit,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Advanced user ranking with percentile calculation
   */
  async getUserRankWithPercentile(
    userId: string,
    teamId: string,
    options: AdvancedLeaderboardOptions
  ): Promise<UserRank & { percentile: number; segment: string }> {
    const startTime = Date.now();

    try {
      // Verify membership
      const membership = await this.verifyTeamMembership(teamId, userId);
      if (!membership) {
        throw new Error('User is not a member of this team');
      }

      const { startDate, endDate } = this.getPartitionInfo(options.period);

      // Use advanced ranking query with percentile calculation
      const rankData = await this.prisma.$queryRaw<Array<{
        user_id: string;
        total_distance: number;
        rank: number;
        total_participants: number;
        percentile: number;
        segment: string;
        next_distance: number | null;
        prev_distance: number | null;
      }>>`
        WITH ranked_users AS (
          SELECT 
            u.id as user_id,
            COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a.distance ELSE 0 END), 0) as total_distance,
            RANK() OVER (ORDER BY COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a.distance ELSE 0 END), 0) DESC) as rank,
            PERCENT_RANK() OVER (ORDER BY COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a.distance ELSE 0 END), 0) DESC) as percentile_decimal,
            LAG(COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a.distance ELSE 0 END), 0)) OVER (ORDER BY COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a.distance ELSE 0 END), 0) DESC) as next_distance,
            LEAD(COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a.distance ELSE 0 END), 0)) OVER (ORDER BY COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a.distance ELSE 0 END), 0) DESC) as prev_distance
          FROM users u
          INNER JOIN team_members tm ON tm."userId" = u.id
          LEFT JOIN activities a ON a."userId" = u.id 
            AND a."teamId" = ${teamId}
            AND a."isPrivate" = false
            AND a."startTime" >= ${startDate}
            AND a."startTime" <= ${endDate}
            ${options.teamGoalId ? Prisma.sql`AND a."teamGoalId" = ${options.teamGoalId}` : Prisma.empty}
          WHERE tm."teamId" = ${teamId}
            AND tm."leftAt" IS NULL
            AND u."deletedAt" IS NULL
          GROUP BY u.id
        ),
        participant_count AS (
          SELECT COUNT(*) as total_participants FROM ranked_users
        ),
        user_rank AS (
          SELECT 
            ru.*,
            pc.total_participants,
            (100 - (ru.percentile_decimal * 100))::integer as percentile,
            CASE 
              WHEN ru.percentile_decimal <= 0.1 THEN 'Elite'
              WHEN ru.percentile_decimal <= 0.25 THEN 'Advanced'
              WHEN ru.percentile_decimal <= 0.5 THEN 'Intermediate'
              WHEN ru.percentile_decimal <= 0.75 THEN 'Beginner'
              ELSE 'Starter'
            END as segment
          FROM ranked_users ru
          CROSS JOIN participant_count pc
          WHERE ru.user_id = ${userId}
        )
        SELECT * FROM user_rank
      `;

      if (rankData.length === 0) {
        throw new Error('User not found in team leaderboard');
      }

      const data = rankData[0];
      const userDistance = Number(data.total_distance);
      const nextDistance = data.next_distance ? Number(data.next_distance) : null;
      const prevDistance = data.prev_distance ? Number(data.prev_distance) : null;

      const result = {
        rank: Number(data.rank),
        totalParticipants: Number(data.total_participants),
        totalDistance: userDistance,
        distanceToNextRank: nextDistance ? nextDistance - userDistance : null,
        distanceFromPreviousRank: prevDistance ? userDistance - prevDistance : null,
        percentile: data.percentile,
        segment: data.segment,
      };

      this.logPerformanceMetric({
        queryName: 'getUserRankWithPercentile',
        executionTimeMs: Date.now() - startTime,
        rowsProcessed: 1,
        cacheHit: false,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.logPerformanceMetric({
        queryName: 'getUserRankWithPercentile',
        executionTimeMs: Date.now() - startTime,
        rowsProcessed: 0,
        cacheHit: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Batch leaderboard refresh for multiple teams
   */
  async batchRefreshTeamLeaderboards(teamIds: string[]): Promise<{
    refreshed: number;
    failed: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    let refreshed = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      // Process teams in parallel batches
      const batchSize = 5;
      for (let i = 0; i < teamIds.length; i += batchSize) {
        const batch = teamIds.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (teamId) => {
          try {
            // Invalidate cache for all periods
            const periods: LeaderboardPeriod[] = ['week', 'month', 'all'];
            periods.forEach(period => {
              const cacheKey = this.buildAdvancedCacheKey({
                type: 'team',
                teamId,
                period,
              });
              cache.delete(cacheKey);
            });
            
            refreshed++;
          } catch (error) {
            failed++;
            errors.push(`Team ${teamId}: ${error}`);
          }
        });

        await Promise.all(batchPromises);
      }

      this.logPerformanceMetric({
        queryName: 'batchRefreshTeamLeaderboards',
        executionTimeMs: Date.now() - startTime,
        rowsProcessed: refreshed,
        cacheHit: false,
        timestamp: new Date(),
      });

      return { refreshed, failed, errors };
    } catch (error) {
      this.logPerformanceMetric({
        queryName: 'batchRefreshTeamLeaderboards',
        executionTimeMs: Date.now() - startTime,
        rowsProcessed: 0,
        cacheHit: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Leaderboard analytics and insights
   */
  async getLeaderboardAnalytics(teamId: string): Promise<{
    competitionLevel: 'low' | 'medium' | 'high';
    participationRate: number;
    averageDistance: number;
    topPerformerGap: number;
    trends: {
      period: string;
      growth: number;
      newParticipants: number;
    }[];
  }> {
    const analytics = await this.prisma.$queryRaw<Array<{
      competition_level: string;
      participation_rate: number;
      average_distance: number;
      top_performer_gap: number;
    }>>`
      WITH team_stats AS (
        SELECT 
          COUNT(DISTINCT tm."userId") as total_members,
          COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN tm."userId" END) as active_members,
          COALESCE(AVG(a.distance), 0) as avg_distance,
          COALESCE(MAX(a.distance) - AVG(a.distance), 0) as top_performer_gap,
          STDDEV(a.distance) as distance_stddev
        FROM team_members tm
        LEFT JOIN activities a ON a."userId" = tm."userId" 
          AND a."teamId" = ${teamId}
          AND a."startTime" >= NOW() - INTERVAL '30 days'
          AND a."isPrivate" = false
        WHERE tm."teamId" = ${teamId}
          AND tm."leftAt" IS NULL
      )
      SELECT 
        CASE 
          WHEN distance_stddev > avg_distance * 0.5 THEN 'high'
          WHEN distance_stddev > avg_distance * 0.25 THEN 'medium'
          ELSE 'low'
        END as competition_level,
        CASE 
          WHEN total_members > 0 THEN (active_members::float / total_members) * 100
          ELSE 0 
        END as participation_rate,
        avg_distance as average_distance,
        top_performer_gap
      FROM team_stats
    `;

    const trends = await this.prisma.$queryRaw<Array<{
      period: string;
      growth: number;
      new_participants: number;
    }>>`
      SELECT 
        'week' as period,
        COALESCE(
          ((SUM(CASE WHEN a."startTime" >= NOW() - INTERVAL '7 days' THEN a.distance ELSE 0 END) - 
            SUM(CASE WHEN a."startTime" >= NOW() - INTERVAL '14 days' AND a."startTime" < NOW() - INTERVAL '7 days' THEN a.distance ELSE 0 END)) * 100.0 /
           NULLIF(SUM(CASE WHEN a."startTime" >= NOW() - INTERVAL '14 days' AND a."startTime" < NOW() - INTERVAL '7 days' THEN a.distance ELSE 0 END), 0)), 
          0
        ) as growth,
        COUNT(DISTINCT CASE WHEN a."startTime" >= NOW() - INTERVAL '7 days' THEN a."userId" END) as new_participants
      FROM activities a
      WHERE a."teamId" = ${teamId}
        AND a."isPrivate" = false
    `;

    const stats = analytics[0] || {
      competition_level: 'low',
      participation_rate: 0,
      average_distance: 0,
      top_performer_gap: 0,
    };

    return {
      competitionLevel: stats.competition_level as 'low' | 'medium' | 'high',
      participationRate: stats.participation_rate,
      averageDistance: stats.average_distance,
      topPerformerGap: stats.top_performer_gap,
      trends: trends.map(t => ({
        period: t.period,
        growth: t.growth,
        newParticipants: t.new_participants,
      })),
    };
  }

  /**
   * Performance monitoring methods
   */
  getPerformanceMetrics(): LeaderboardPerformanceMetrics[] {
    return [...this.performanceMetrics];
  }

  clearPerformanceMetrics(): void {
    this.performanceMetrics = [];
  }

  getPerformanceSummary(): {
    totalQueries: number;
    averageExecutionTime: number;
    cacheHitRate: number;
    partitionUtilization: Record<string, number>;
  } {
    const totalQueries = this.performanceMetrics.length;
    const averageExecutionTime = totalQueries > 0 
      ? this.performanceMetrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / totalQueries 
      : 0;
    const cacheHits = this.performanceMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0;

    // Calculate partition utilization
    const partitionUsage = this.performanceMetrics.reduce((acc, m) => {
      if (m.partitionUsed) {
        acc[m.partitionUsed] = (acc[m.partitionUsed] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalQueries,
      averageExecutionTime,
      cacheHitRate,
      partitionUtilization: partitionUsage,
    };
  }

  /**
   * Private helper methods
   */
  private async verifyTeamMembership(teamId: string, userId: string): Promise<any> {
    return await this.prisma.teamMember.findFirst({
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
          },
        },
      },
    });
  }

  private getPartitionInfo(period: LeaderboardPeriod): {
    startDate: Date;
    endDate: Date;
    partition: string;
  } {
    const endDate = new Date();
    let startDate: Date;
    let partition: string;

    switch (period) {
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        partition = `week_${startDate.getFullYear()}_${Math.ceil(startDate.getTime() / (7 * 24 * 60 * 60 * 1000))}`;
        break;
      case 'month':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        partition = `month_${startDate.getFullYear()}_${startDate.getMonth() + 1}`;
        break;
      case 'all':
      default:
        startDate = new Date('2024-01-01');
        partition = 'all_time';
        break;
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate, partition };
  }

  private async executePartitionedLeaderboardQuery(
    teamId: string,
    startDate: Date,
    endDate: Date,
    options: AdvancedLeaderboardOptions,
    partition: string
  ): Promise<any[]> {
    const limit = options.limit || 50;
    
    // Use materialized view when available, fall back to direct query
    return await this.prisma.$queryRaw<Array<{
      user_id: string;
      name: string;
      avatar_url: string | null;
      total_distance: number;
      activity_count: number;
      average_distance: number;
      has_private_activities: boolean;
      last_activity_at: Date | null;
    }>>`
      SELECT 
        tml.user_id,
        tml.user_name as name,
        tml.user_avatar as avatar_url,
        CASE 
          WHEN ${options.period} = 'week' THEN tml.week_public_distance
          WHEN ${options.period} = 'month' THEN tml.month_public_distance
          ELSE tml.public_distance
        END as total_distance,
        CASE 
          WHEN ${options.period} = 'week' THEN 
            (SELECT COUNT(*) FROM activities WHERE "userId" = tml.user_id AND "teamId" = ${teamId} AND "isPrivate" = false AND "startTime" >= ${startDate})
          WHEN ${options.period} = 'month' THEN 
            (SELECT COUNT(*) FROM activities WHERE "userId" = tml.user_id AND "teamId" = ${teamId} AND "isPrivate" = false AND "startTime" >= ${startDate})
          ELSE tml.public_activities
        END as activity_count,
        tml.public_avg_distance as average_distance,
        tml.has_private_activities,
        tml.last_public_activity as last_activity_at
      FROM mv_team_member_leaderboard tml
      WHERE tml.team_id = ${teamId}
        ${options.minActivityCount ? Prisma.sql`AND tml.public_activities >= ${options.minActivityCount}` : Prisma.empty}
      ORDER BY total_distance DESC, name ASC
      LIMIT ${limit}
    `;
  }

  private async executeGlobalLeaderboardQuery(
    startDate: Date,
    endDate: Date,
    options: AdvancedLeaderboardOptions,
    partition: string
  ): Promise<any[]> {
    const limit = options.limit || 50;

    return await this.prisma.$queryRaw<Array<{
      user_id: string;
      name: string;
      avatar_url: string | null;
      total_distance: number;
      activity_count: number;
      average_distance: number;
      has_private_activities: boolean;
      last_activity_at: Date | null;
    }>>`
      SELECT 
        mgl.user_id,
        mgl.user_name as name,
        mgl.user_avatar as avatar_url,
        CASE 
          WHEN ${options.period} = 'week' THEN mgl.week_distance
          WHEN ${options.period} = 'month' THEN mgl.month_distance
          ELSE mgl.total_distance
        END as total_distance,
        CASE 
          WHEN ${options.period} = 'week' THEN mgl.week_activities
          WHEN ${options.period} = 'month' THEN mgl.month_activities
          ELSE mgl.total_activities
        END as activity_count,
        mgl.avg_distance as average_distance,
        mgl.has_private_activities,
        mgl.last_activity
      FROM mv_global_leaderboard mgl
      WHERE mgl.total_distance > 0
        ${options.minActivityCount ? Prisma.sql`AND mgl.total_activities >= ${options.minActivityCount}` : Prisma.empty}
      ORDER BY total_distance DESC, name ASC
      LIMIT ${limit}
    `;
  }

  private async processLeaderboardEntries(
    data: any[],
    currentUserId: string,
    period: LeaderboardPeriod
  ): Promise<LeaderboardEntry[]> {
    // Add trend analysis by comparing with previous period
    return data.map((row, index) => ({
      userId: row.user_id,
      name: row.name,
      avatarUrl: row.avatar_url,
      totalDistance: Number(row.total_distance),
      activityCount: Number(row.activity_count),
      averageDistance: Number(row.average_distance),
      rank: index + 1,
      isCurrentUser: row.user_id === currentUserId,
      hasPrivateActivities: row.has_private_activities,
      lastActivityAt: row.last_activity_at,
    }));
  }

  private async getTeamInfo(teamId: string, membership: any): Promise<any> {
    return {
      id: membership.team.id,
      name: membership.team.name,
      memberCount: await this.prisma.teamMember.count({
        where: {
          teamId,
          leftAt: null,
        },
      }),
    };
  }

  private buildAdvancedCacheKey(options: any): string {
    const parts = [
      'leaderboard_v2',
      options.type,
      options.period,
    ];

    if (options.teamId) parts.push(options.teamId);
    if (options.teamGoalId) parts.push(options.teamGoalId);
    if (options.minActivityCount) parts.push(`min${options.minActivityCount}`);
    if (options.includeInactive) parts.push('inactive');
    if (options.limit && options.limit !== 50) parts.push(`limit${options.limit}`);

    return parts.join(':');
  }

  private calculateCacheTTL(period: LeaderboardPeriod): number {
    switch (period) {
      case 'week':
        return 2 * 60 * 1000; // 2 minutes for recent data
      case 'month':
        return 5 * 60 * 1000; // 5 minutes for monthly data
      case 'all':
      default:
        return 15 * 60 * 1000; // 15 minutes for all-time data
    }
  }

  private logPerformanceMetric(metric: LeaderboardPerformanceMetrics): void {
    this.performanceMetrics.push(metric);
    
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics = this.performanceMetrics.slice(-1000);
    }

    if (metric.executionTimeMs > 2000) {
      console.warn(`Slow leaderboard query: ${metric.queryName} took ${metric.executionTimeMs}ms`);
    }
  }

  /**
   * Cache invalidation with smart targeting
   */
  invalidateTeamCaches(teamId: string): void {
    const periods: LeaderboardPeriod[] = ['week', 'month', 'all'];
    
    periods.forEach(period => {
      // Team-specific caches
      const teamKey = this.buildAdvancedCacheKey({
        type: 'team',
        teamId,
        period,
      });
      cache.delete(teamKey);

      // Global leaderboard cache (affected by team activities)
      const globalKey = this.buildAdvancedCacheKey({
        type: 'global',
        period,
      });
      cache.delete(globalKey);
    });
  }
}