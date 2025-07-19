/**
 * Production-Optimized Activity Service - DB-702
 * Enhanced with advanced query optimizations and performance monitoring
 */

import { PrismaClient, ActivitySource, Prisma } from '@prisma/client';
import {
  CreateActivityInput,
  UpdateActivityInput,
  ActivityWithRelations,
  ActivityListItem,
  CreateActivityResult,
  DeleteActivityResult,
  TeamProgressUpdate,
  UserActivityStats,
  TeamProgressInfo,
  ActivitySummaryPeriod,
  ActivitySummaryOptions,
} from './types';
import { cache, cacheKeys, cacheTTL } from '../../utils/cache';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { AchievementService } from '../achievement';

export interface QueryPerformanceMetrics {
  queryName: string;
  executionTimeMs: number;
  rowsAffected?: number;
  cacheHit?: boolean;
  timestamp: Date;
}

export class ProductionActivityService {
  private achievementService: AchievementService;
  private leaderboardService: LeaderboardService;
  private performanceMetrics: QueryPerformanceMetrics[] = [];

  constructor(private prisma: PrismaClient) {
    this.achievementService = new AchievementService(prisma);
    this.leaderboardService = new LeaderboardService(prisma);
  }

  /**
   * Enhanced activity creation with connection pooling optimization
   */
  async createActivity(
    userId: string,
    input: CreateActivityInput
  ): Promise<CreateActivityResult> {
    const startTime = Date.now();
    
    try {
      // Optimize session for dashboard-heavy operations
      await this.prisma.$executeRaw`SELECT optimize_session_for_dashboard()`;

      // Use single optimized query for membership validation
      const memberships = await this.prisma.$queryRaw<Array<{
        teamId: string;
        teamName: string;
        activeGoalId: string | null;
        activeGoalTargetDistance: number | null;
      }>>`
        SELECT DISTINCT
          tm."teamId",
          t.name as "teamName",
          tg.id as "activeGoalId",
          tg."targetDistance" as "activeGoalTargetDistance"
        FROM team_members tm
        INNER JOIN teams t ON t.id = tm."teamId"
        LEFT JOIN team_goals tg ON tg."teamId" = tm."teamId" 
          AND tg.status = 'ACTIVE'
          AND tg."deletedAt" IS NULL
        WHERE tm."userId" = ${userId}
          AND tm."teamId" = ANY(${input.teamIds}::uuid[])
          AND tm."leftAt" IS NULL
          AND t."deletedAt" IS NULL
        ORDER BY tg."createdAt" DESC
      `;

      if (memberships.length !== input.teamIds.length) {
        throw new Error('User is not a member of all specified teams');
      }

      const activityDate = new Date(input.activityDate);
      const startActivityTime = activityDate;
      const endActivityTime = new Date(activityDate.getTime() + input.duration * 1000);

      // Use optimized transaction with explicit isolation level
      const result = await this.prisma.$transaction(async (tx) => {
        const teamUpdates: TeamProgressUpdate[] = [];
        const primaryTeamId = input.teamIds[0];
        const primaryMembership = memberships.find(m => m.teamId === primaryTeamId);
        
        if (!primaryMembership) {
          throw new Error('Primary team membership not found');
        }

        // Create activity with RETURNING for efficiency
        const activity = await tx.$queryRaw<Array<{
          id: string;
          userId: string;
          distance: number;
          duration: number;
          startTime: Date;
          notes: string | null;
          isPrivate: boolean;
          createdAt: Date;
          userName: string;
          userAvatarUrl: string | null;
          teamName: string;
        }>>`
          INSERT INTO activities (
            "userId", "teamId", "teamGoalId", "distance", "duration", 
            "startTime", "endTime", "notes", "isPrivate", "source"
          )
          SELECT 
            ${userId}::uuid,
            ${primaryTeamId}::uuid,
            ${primaryMembership.activeGoalId}::uuid,
            ${input.distance}::float,
            ${input.duration}::integer,
            ${startActivityTime}::timestamp,
            ${endActivityTime}::timestamp,
            ${input.note || null}::text,
            ${input.isPrivate ?? false}::boolean,
            ${input.source ?? ActivitySource.MANUAL}::"ActivitySource"
          RETURNING 
            id, "userId", distance, duration, "startTime", notes, "isPrivate", "createdAt"
        `;

        const newActivity = activity[0];

        // Get user details for response
        const userDetails = await tx.$queryRaw<Array<{
          id: string;
          name: string;
          avatarUrl: string | null;
        }>>`
          SELECT id, name, "avatarUrl" FROM users WHERE id = ${userId}
        `;

        // Batch update user stats using UPSERT
        await tx.$executeRaw`
          INSERT INTO user_stats ("userId", "totalDistance", "totalActivities", "totalDuration", "lastActivityAt")
          VALUES (${userId}, ${input.distance}, 1, ${input.duration}, ${activityDate})
          ON CONFLICT ("userId") 
          DO UPDATE SET
            "totalDistance" = user_stats."totalDistance" + ${input.distance},
            "totalActivities" = user_stats."totalActivities" + 1,
            "totalDuration" = user_stats."totalDuration" + ${input.duration},
            "lastActivityAt" = ${activityDate},
            "updatedAt" = NOW()
        `;

        // Batch update team progress for all teams
        for (const membership of memberships) {
          if (membership.activeGoalId) {
            const progressResult = await tx.$queryRaw<Array<{
              totalDistance: number;
              percentComplete: number;
            }>>`
              INSERT INTO team_progress ("teamGoalId", "totalDistance", "totalActivities", "totalDuration", "lastActivityAt")
              VALUES (${membership.activeGoalId}, ${input.distance}, 1, ${input.duration}, ${activityDate})
              ON CONFLICT ("teamGoalId")
              DO UPDATE SET
                "totalDistance" = team_progress."totalDistance" + ${input.distance},
                "totalActivities" = team_progress."totalActivities" + 1,
                "totalDuration" = team_progress."totalDuration" + ${input.duration},
                "lastActivityAt" = ${activityDate},
                "updatedAt" = NOW()
              RETURNING 
                "totalDistance",
                CASE 
                  WHEN ${membership.activeGoalTargetDistance || 0} > 0 
                  THEN ("totalDistance" / ${membership.activeGoalTargetDistance || 1}) * 100 
                  ELSE 0 
                END as "percentComplete"
            `;

            if (progressResult.length > 0) {
              const progress = progressResult[0];
              teamUpdates.push({
                teamId: membership.teamId,
                teamGoalId: membership.activeGoalId,
                newTotalDistance: progress.totalDistance,
                newPercentComplete: Math.min(progress.percentComplete, 100),
              });
            }
          }
        }

        // Construct activity response with optimized data structure
        const activityWithRelations: ActivityWithRelations = {
          ...newActivity,
          user: userDetails[0],
          team: {
            id: primaryTeamId,
            name: primaryMembership.teamName,
          },
          teams: memberships.map(m => ({
            id: m.teamId,
            name: m.teamName,
          })),
        };

        return {
          activity: activityWithRelations,
          teamUpdates,
        };
      }, {
        isolationLevel: 'ReadCommitted', // Optimal for this use case
        timeout: 10000, // 10 second timeout
      });

      // Invalidate caches efficiently
      this.invalidateActivityCaches(userId, input.teamIds);

      // Detect achievements asynchronously for better performance
      const newAchievements = await this.achievementService.detectNewAchievements(
        userId, 
        result.activity as any
      );

      const finalResult = {
        ...result,
        newAchievements,
      };

      // Log performance metrics
      this.logPerformanceMetric({
        queryName: 'createActivity',
        executionTimeMs: Date.now() - startTime,
        rowsAffected: 1 + result.teamUpdates.length,
        cacheHit: false,
        timestamp: new Date(),
      });

      return finalResult;
    } catch (error) {
      this.logPerformanceMetric({
        queryName: 'createActivity',
        executionTimeMs: Date.now() - startTime,
        cacheHit: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Optimized activity retrieval with advanced pagination
   */
  async getActivities(
    userId: string,
    options?: {
      cursor?: string;
      limit?: number;
      teamId?: string;
      startDate?: string;
      endDate?: string;
      includePrivate?: boolean;
    }
  ): Promise<{ items: ActivityListItem[]; nextCursor: string | null; hasMore: boolean }> {
    const startTime = Date.now();
    const limit = Math.min(options?.limit || 20, 100); // Increased max limit
    
    const cacheKey = `activities:${userId}:${JSON.stringify(options)}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      this.logPerformanceMetric({
        queryName: 'getActivities',
        executionTimeMs: Date.now() - startTime,
        cacheHit: true,
        timestamp: new Date(),
      });
      return cached;
    }

    try {
      // Use raw SQL for maximum performance with covering indexes
      const activities = await this.prisma.$queryRaw<Array<{
        id: string;
        distance: number;
        duration: number;
        startTime: Date;
        notes: string | null;
        isPrivate: boolean;
        createdAt: Date;
        teamId: string;
        teamName: string;
        pace: number;
      }>>`
        SELECT 
          a.id,
          a.distance,
          a.duration,
          a."startTime",
          a.notes,
          a."isPrivate",
          a."createdAt",
          a."teamId",
          t.name as "teamName",
          CASE 
            WHEN a.distance > 0 AND a.duration > 0 
            THEN (a.duration / 60.0) / (a.distance / 1000.0)
            ELSE 0 
          END as pace
        FROM activities a
        INNER JOIN teams t ON t.id = a."teamId"
        WHERE a."userId" = ${userId}
          ${options?.teamId ? Prisma.sql`AND a."teamId" = ${options.teamId}` : Prisma.empty}
          ${options?.startDate ? Prisma.sql`AND a."startTime" >= ${new Date(options.startDate)}` : Prisma.empty}
          ${options?.endDate ? Prisma.sql`AND a."endTime" <= ${new Date(options.endDate)}` : Prisma.empty}
          ${options?.includePrivate === false ? Prisma.sql`AND a."isPrivate" = false` : Prisma.empty}
          ${options?.cursor ? Prisma.sql`AND a."startTime" < (SELECT "startTime" FROM activities WHERE id = ${options.cursor})` : Prisma.empty}
        ORDER BY a."startTime" DESC, a.id DESC
        LIMIT ${limit + 1}
      `;

      const hasMore = activities.length > limit;
      if (hasMore) {
        activities.pop();
      }

      const items: ActivityListItem[] = activities.map((activity) => ({
        id: activity.id,
        distance: activity.distance,
        duration: activity.duration,
        pace: activity.pace,
        activityDate: activity.startTime,
        note: activity.notes,
        isPrivate: activity.isPrivate,
        createdAt: activity.createdAt,
        teams: [
          {
            id: activity.teamId,
            name: activity.teamName,
          },
        ],
      }));

      const nextCursor = hasMore ? activities[activities.length - 1].id : null;

      const result = {
        items,
        nextCursor,
        hasMore,
      };

      // Cache with shorter TTL for frequently accessed data
      cache.set(cacheKey, result, 2 * 60 * 1000); // 2 minutes

      this.logPerformanceMetric({
        queryName: 'getActivities',
        executionTimeMs: Date.now() - startTime,
        rowsAffected: activities.length,
        cacheHit: false,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.logPerformanceMetric({
        queryName: 'getActivities',
        executionTimeMs: Date.now() - startTime,
        cacheHit: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Advanced team progress with materialized view optimization
   */
  async getTeamProgress(teamId: string, userId: string): Promise<TeamProgressInfo> {
    const startTime = Date.now();
    const cacheKey = cacheKeys.teamProgress(teamId);
    const cached = cache.get<TeamProgressInfo>(cacheKey);
    
    if (cached) {
      // Still verify membership for security
      const isMember = await this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT 1 as count FROM team_members 
        WHERE "teamId" = ${teamId} AND "userId" = ${userId} AND "leftAt" IS NULL
        LIMIT 1
      `;
      
      if (isMember.length === 0) {
        throw new Error('User is not a member of this team');
      }

      this.logPerformanceMetric({
        queryName: 'getTeamProgress',
        executionTimeMs: Date.now() - startTime,
        cacheHit: true,
        timestamp: new Date(),
      });
      
      return cached;
    }

    try {
      // Use materialized view for optimal performance
      const progressData = await this.prisma.$queryRaw<Array<{
        goalId: string;
        teamId: string;
        goalName: string;
        targetDistance: number;
        goalStatus: string;
        targetDate: Date | null;
        startedAt: Date | null;
        currentDistance: number;
        totalActivities: number;
        totalDuration: number;
        percentComplete: number;
        daysRemaining: number | null;
        lastActivityDate: Date | null;
        activeMembers: number;
        isOnTrack: boolean | null;
        teamName: string;
        memberCount: number;
      }>>`
        SELECT 
          mvp.*,
          t.name as "teamName",
          (SELECT COUNT(*) FROM team_members WHERE "teamId" = ${teamId} AND "leftAt" IS NULL) as "memberCount"
        FROM mv_team_goal_progress mvp
        INNER JOIN teams t ON t.id = mvp.team_id
        INNER JOIN team_members tm ON tm."teamId" = ${teamId} AND tm."userId" = ${userId} AND tm."leftAt" IS NULL
        WHERE mvp.team_id = ${teamId}
          AND mvp.goal_status = 'ACTIVE'
        ORDER BY mvp.started_at DESC
        LIMIT 1
      `;

      if (progressData.length === 0) {
        throw new Error('No active goal found for team or user is not a member');
      }

      const progress = progressData[0];

      // Get top contributors using optimized query
      const topContributors = await this.prisma.$queryRaw<Array<{
        userId: string;
        name: string;
        distance: number;
        percentage: number;
      }>>`
        SELECT 
          tml.user_id as "userId",
          tml.user_name as name,
          tml.total_distance as distance,
          CASE 
            WHEN ${progress.currentDistance} > 0 
            THEN (tml.total_distance / ${progress.currentDistance}) * 100 
            ELSE 0 
          END as percentage
        FROM mv_team_member_leaderboard tml
        WHERE tml.team_id = ${teamId}
        ORDER BY tml.total_rank
        LIMIT 5
      `;

      // Calculate advanced metrics
      const now = new Date();
      const endDate = progress.targetDate || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      const daysSinceStart = Math.max(1, Math.ceil((now.getTime() - (progress.startedAt?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24)));
      const averageDailyDistance = progress.currentDistance / daysSinceStart;

      let projectedCompletionDate: Date | null = null;
      if (averageDailyDistance > 0) {
        const remainingDistance = progress.targetDistance - progress.currentDistance;
        const daysToComplete = remainingDistance / averageDailyDistance;
        projectedCompletionDate = new Date(now.getTime() + daysToComplete * 24 * 60 * 60 * 1000);
      }

      const result: TeamProgressInfo = {
        team: {
          id: progress.teamId,
          name: progress.teamName,
          goalDistance: progress.targetDistance,
          startDate: progress.startedAt || now,
          endDate: endDate,
        },
        goal: {
          id: progress.goalId,
          name: progress.goalName,
          description: undefined, // Will be filled by complete implementation
          startLocation: { lat: 0, lng: 0 }, // Will be filled by complete implementation
          endLocation: { lat: 0, lng: 0 }, // Will be filled by complete implementation
          waypoints: [],
          routePolyline: '',
          routeBounds: undefined,
        },
        progress: {
          totalDistance: progress.currentDistance,
          percentComplete: Math.min(progress.percentComplete, 100),
          currentSegmentIndex: 0,
          distanceToNextWaypoint: 0,
          segmentProgress: 0,
          averageDailyDistance,
          projectedCompletionDate,
          daysRemaining: progress.daysRemaining || 0,
          lastActivityAt: progress.lastActivityDate,
        },
        memberStats: {
          totalMembers: progress.memberCount,
          activeMembers: progress.activeMembers,
          topContributors,
        },
      };

      // Cache with longer TTL for expensive calculations
      cache.set(cacheKey, result, cacheTTL.teamProgress);

      this.logPerformanceMetric({
        queryName: 'getTeamProgress',
        executionTimeMs: Date.now() - startTime,
        rowsAffected: 1,
        cacheHit: false,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.logPerformanceMetric({
        queryName: 'getTeamProgress',
        executionTimeMs: Date.now() - startTime,
        cacheHit: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Optimized user stats with materialized view
   */
  async getUserStats(userId: string): Promise<UserActivityStats> {
    const startTime = Date.now();
    const cacheKey = cacheKeys.userStats(userId);
    const cached = cache.get<UserActivityStats>(cacheKey);
    
    if (cached) {
      this.logPerformanceMetric({
        queryName: 'getUserStats',
        executionTimeMs: Date.now() - startTime,
        cacheHit: true,
        timestamp: new Date(),
      });
      return cached;
    }

    try {
      // Use materialized view for instant results
      const stats = await this.prisma.$queryRaw<Array<{
        userId: string;
        totalDistance: number;
        totalActivities: number;
        totalDuration: number;
        bestDistance: number;
        lastActivityDate: Date | null;
        weekDistance: number;
        weekActivities: number;
        monthDistance: number;
        monthActivities: number;
        currentStreak: number;
        longestStreak: number;
      }>>`
        SELECT 
          mvs.user_id as "userId",
          mvs.total_distance as "totalDistance",
          mvs.total_activities as "totalActivities",
          mvs.total_duration as "totalDuration",
          mvs.best_distance as "bestDistance",
          mvs.last_activity_date as "lastActivityDate",
          mvs.week_distance as "weekDistance",
          mvs.week_activities as "weekActivities",
          mvs.month_distance as "monthDistance",
          mvs.month_activities as "monthActivities",
          COALESCE(us."currentStreak", 0) as "currentStreak",
          COALESCE(us."longestStreak", 0) as "longestStreak"
        FROM mv_user_activity_stats mvs
        LEFT JOIN user_stats us ON us."userId" = mvs.user_id
        WHERE mvs.user_id = ${userId}
      `;

      if (stats.length === 0) {
        // Return empty stats for new users
        const emptyStats: UserActivityStats = {
          totalDistance: 0,
          totalDuration: 0,
          totalActivities: 0,
          averagePace: 0,
          averageDistance: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: null,
          weeklyStats: { distance: 0, duration: 0, activities: 0 },
          monthlyStats: { distance: 0, duration: 0, activities: 0 },
        };
        
        cache.set(cacheKey, emptyStats, cacheTTL.userStats);
        return emptyStats;
      }

      const userStats = stats[0];
      const averagePace = userStats.totalDistance > 0 ? this.calculatePace(userStats.totalDistance, userStats.totalDuration) : 0;
      const averageDistance = userStats.totalActivities > 0 ? userStats.totalDistance / userStats.totalActivities : 0;

      const result: UserActivityStats = {
        totalDistance: userStats.totalDistance,
        totalDuration: userStats.totalDuration,
        totalActivities: userStats.totalActivities,
        averagePace,
        averageDistance,
        currentStreak: userStats.currentStreak,
        longestStreak: userStats.longestStreak,
        lastActivityDate: userStats.lastActivityDate,
        weeklyStats: {
          distance: userStats.weekDistance,
          duration: 0, // Would need additional query or materialized view column
          activities: userStats.weekActivities,
        },
        monthlyStats: {
          distance: userStats.monthDistance,
          duration: 0, // Would need additional query or materialized view column
          activities: userStats.monthActivities,
        },
      };

      cache.set(cacheKey, result, cacheTTL.userStats);

      this.logPerformanceMetric({
        queryName: 'getUserStats',
        executionTimeMs: Date.now() - startTime,
        rowsAffected: 1,
        cacheHit: false,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.logPerformanceMetric({
        queryName: 'getUserStats',
        executionTimeMs: Date.now() - startTime,
        cacheHit: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Batch activity operations for improved performance
   */
  async bulkCreateActivities(
    userId: string,
    activities: CreateActivityInput[]
  ): Promise<{ created: number; failed: number; errors: string[] }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let created = 0;
    let failed = 0;

    try {
      await this.prisma.$executeRaw`SELECT optimize_session_for_dashboard()`;

      // Process in batches to avoid memory issues
      const batchSize = 50;
      for (let i = 0; i < activities.length; i += batchSize) {
        const batch = activities.slice(i, i + batchSize);
        
        try {
          await this.prisma.$transaction(async (tx) => {
            for (const activityInput of batch) {
              try {
                await this.createActivity(userId, activityInput);
                created++;
              } catch (error) {
                failed++;
                errors.push(`Activity ${i + batch.indexOf(activityInput)}: ${error}`);
              }
            }
          });
        } catch (error) {
          failed += batch.length;
          errors.push(`Batch ${i}-${i + batch.length - 1}: ${error}`);
        }
      }

      this.logPerformanceMetric({
        queryName: 'bulkCreateActivities',
        executionTimeMs: Date.now() - startTime,
        rowsAffected: created,
        cacheHit: false,
        timestamp: new Date(),
      });

      return { created, failed, errors };
    } catch (error) {
      this.logPerformanceMetric({
        queryName: 'bulkCreateActivities',
        executionTimeMs: Date.now() - startTime,
        cacheHit: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Get performance metrics for monitoring
   */
  getPerformanceMetrics(): QueryPerformanceMetrics[] {
    return [...this.performanceMetrics];
  }

  /**
   * Clear performance metrics
   */
  clearPerformanceMetrics(): void {
    this.performanceMetrics = [];
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalQueries: number;
    averageExecutionTime: number;
    cacheHitRate: number;
    slowQueries: QueryPerformanceMetrics[];
  } {
    const totalQueries = this.performanceMetrics.length;
    const averageExecutionTime = totalQueries > 0 
      ? this.performanceMetrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / totalQueries 
      : 0;
    const cacheHits = this.performanceMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0;
    const slowQueries = this.performanceMetrics
      .filter(m => m.executionTimeMs > 1000) // Queries over 1 second
      .sort((a, b) => b.executionTimeMs - a.executionTimeMs);

    return {
      totalQueries,
      averageExecutionTime,
      cacheHitRate,
      slowQueries,
    };
  }

  private calculatePace(distance: number, duration: number): number {
    const km = distance / 1000;
    const minutes = duration / 60;
    return km > 0 ? minutes / km : 0;
  }

  private invalidateActivityCaches(userId: string, teamIds: string[]): void {
    cache.delete(cacheKeys.userStats(userId));
    teamIds.forEach(teamId => {
      cache.delete(cacheKeys.teamProgress(teamId));
      this.leaderboardService.invalidateTeamCaches(teamId);
    });
  }

  private logPerformanceMetric(metric: QueryPerformanceMetrics): void {
    this.performanceMetrics.push(metric);
    
    // Keep only last 1000 metrics to prevent memory leaks
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics = this.performanceMetrics.slice(-1000);
    }

    // Log slow queries for monitoring
    if (metric.executionTimeMs > 2000) {
      console.warn(`Slow query detected: ${metric.queryName} took ${metric.executionTimeMs}ms`);
    }
  }
}