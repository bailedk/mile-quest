/**
 * Production-Optimized Team Service - DB-702
 * Enhanced with advanced query optimizations and caching strategies
 */

import { PrismaClient, TeamRole, InviteStatus, Prisma } from '@prisma/client';
import { 
  CreateTeamInput, 
  UpdateTeamInput, 
  JoinTeamInput, 
  TeamWithMembers,
  TeamListItem
} from './types';
import { cache, cacheKeys, cacheTTL } from '../../utils/cache';

export interface TeamPerformanceMetrics {
  queryName: string;
  executionTimeMs: number;
  rowsAffected?: number;
  cacheHit?: boolean;
  timestamp: Date;
}

export interface TeamAggregateStats {
  memberCount: number;
  adminCount: number;
  recentActivityCount: number;
  totalDistance: number;
  avgMemberActivity: number;
  teamHealthScore: number;
}

export class ProductionTeamService {
  private performanceMetrics: TeamPerformanceMetrics[] = [];

  constructor(private prisma: PrismaClient) {}

  /**
   * Optimized getUserTeams with materialized view integration
   */
  async getUserTeams(userId: string): Promise<TeamListItem[]> {
    const startTime = Date.now();
    const cacheKey = `user_teams:${userId}`;
    const cached = cache.get<TeamListItem[]>(cacheKey);
    
    if (cached) {
      this.logPerformanceMetric({
        queryName: 'getUserTeams',
        executionTimeMs: Date.now() - startTime,
        cacheHit: true,
        timestamp: new Date(),
      });
      return cached;
    }

    try {
      // Use single optimized query with materialized view data
      const teams = await this.prisma.$queryRaw<Array<{
        id: string;
        name: string;
        description: string | null;
        avatarUrl: string | null;
        role: string;
        joinedAt: Date;
        memberCount: number;
        recentActivityCount: number;
        totalDistance: number;
      }>>`
        SELECT 
          t.id,
          t.name,
          t.description,
          t."avatarUrl",
          tm.role,
          tm."joinedAt",
          COALESCE(mtas.active_member_count, 0) as "memberCount",
          COALESCE(mtas.week_activities, 0) as "recentActivityCount",
          COALESCE(mtas.total_distance, 0) as "totalDistance"
        FROM team_members tm
        INNER JOIN teams t ON t.id = tm."teamId"
        LEFT JOIN mv_team_activity_stats mtas ON mtas.team_id = t.id
        WHERE tm."userId" = ${userId}
          AND tm."leftAt" IS NULL
          AND t."deletedAt" IS NULL
        ORDER BY tm."joinedAt" DESC
      `;

      const result: TeamListItem[] = teams.map(team => ({
        id: team.id,
        name: team.name,
        description: team.description,
        avatarUrl: team.avatarUrl,
        memberCount: team.memberCount,
        role: team.role as TeamRole,
        joinedAt: team.joinedAt,
      }));

      // Cache for 5 minutes with shorter TTL for frequently accessed data
      cache.set(cacheKey, result, 5 * 60 * 1000);

      this.logPerformanceMetric({
        queryName: 'getUserTeams',
        executionTimeMs: Date.now() - startTime,
        rowsAffected: teams.length,
        cacheHit: false,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.logPerformanceMetric({
        queryName: 'getUserTeams',
        executionTimeMs: Date.now() - startTime,
        cacheHit: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Optimized getTeamById with selective loading and caching
   */
  async getTeamById(teamId: string, userId?: string): Promise<TeamWithMembers | null> {
    const startTime = Date.now();
    const cacheKey = `team_detail:${teamId}:${userId || 'public'}`;
    const cached = cache.get<TeamWithMembers>(cacheKey);
    
    if (cached) {
      this.logPerformanceMetric({
        queryName: 'getTeamById',
        executionTimeMs: Date.now() - startTime,
        cacheHit: true,
        timestamp: new Date(),
      });
      return cached;
    }

    try {
      // First check access permissions efficiently
      const accessCheck = await this.prisma.$queryRaw<Array<{
        teamId: string;
        isPublic: boolean;
        isMember: boolean;
      }>>`
        SELECT 
          t.id as "teamId",
          t."isPublic",
          EXISTS(
            SELECT 1 FROM team_members tm 
            WHERE tm."teamId" = t.id 
              AND tm."userId" = ${userId || null}
              AND tm."leftAt" IS NULL
          ) as "isMember"
        FROM teams t
        WHERE t.id = ${teamId} AND t."deletedAt" IS NULL
      `;

      if (accessCheck.length === 0) {
        return null;
      }

      const access = accessCheck[0];
      if (!access.isPublic && userId && !access.isMember) {
        return null;
      }

      // Get complete team data with optimized query
      const teamData = await this.prisma.$queryRaw<Array<{
        id: string;
        name: string;
        description: string | null;
        avatarUrl: string | null;
        isPublic: boolean;
        maxMembers: number;
        createdById: string;
        createdAt: Date;
        updatedAt: Date;
        memberCount: number;
      }>>`
        SELECT 
          t.*,
          COALESCE(mtas.active_member_count, 0) as "memberCount"
        FROM teams t
        LEFT JOIN mv_team_activity_stats mtas ON mtas.team_id = t.id
        WHERE t.id = ${teamId}
      `;

      if (teamData.length === 0) {
        return null;
      }

      const team = teamData[0];

      // Get team members with efficient query
      const members = await this.prisma.$queryRaw<Array<{
        id: string;
        role: string;
        joinedAt: Date;
        userId: string;
        userName: string;
        userEmail: string;
        userAvatarUrl: string | null;
      }>>`
        SELECT 
          tm.id,
          tm.role,
          tm."joinedAt",
          tm."userId",
          u.name as "userName",
          u.email as "userEmail",
          u."avatarUrl" as "userAvatarUrl"
        FROM team_members tm
        INNER JOIN users u ON u.id = tm."userId"
        WHERE tm."teamId" = ${teamId}
          AND tm."leftAt" IS NULL
          AND u."deletedAt" IS NULL
        ORDER BY 
          CASE tm.role WHEN 'ADMIN' THEN 0 ELSE 1 END,
          tm."joinedAt" ASC
      `;

      const result: TeamWithMembers = {
        ...team,
        members: members.map(member => ({
          id: member.id,
          role: member.role as TeamRole,
          joinedAt: member.joinedAt,
          userId: member.userId,
          user: {
            id: member.userId,
            name: member.userName,
            email: member.userEmail,
            avatarUrl: member.userAvatarUrl,
          },
        })),
        _count: {
          members: team.memberCount,
        },
      };

      // Cache for 3 minutes
      cache.set(cacheKey, result, 3 * 60 * 1000);

      this.logPerformanceMetric({
        queryName: 'getTeamById',
        executionTimeMs: Date.now() - startTime,
        rowsAffected: 1 + members.length,
        cacheHit: false,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.logPerformanceMetric({
        queryName: 'getTeamById',
        executionTimeMs: Date.now() - startTime,
        cacheHit: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Advanced team search with full-text search optimization
   */
  async searchTeams(
    query: string, 
    options?: {
      limit?: number;
      userId?: string;
      includePrivate?: boolean;
    }
  ): Promise<TeamListItem[]> {
    const startTime = Date.now();
    const limit = Math.min(options?.limit || 20, 100);
    
    const cacheKey = `team_search:${query}:${JSON.stringify(options)}`;
    const cached = cache.get<TeamListItem[]>(cacheKey);
    
    if (cached) {
      this.logPerformanceMetric({
        queryName: 'searchTeams',
        executionTimeMs: Date.now() - startTime,
        cacheHit: true,
        timestamp: new Date(),
      });
      return cached;
    }

    try {
      // Use advanced text search with ranking
      const teams = await this.prisma.$queryRaw<Array<{
        id: string;
        name: string;
        description: string | null;
        avatarUrl: string | null;
        memberCount: number;
        searchRank: number;
        isMember: boolean;
      }>>`
        SELECT 
          t.id,
          t.name,
          t.description,
          t."avatarUrl",
          COALESCE(mtas.active_member_count, 0) as "memberCount",
          (
            CASE WHEN t.name ILIKE ${`%${query}%`} THEN 3 ELSE 0 END +
            CASE WHEN t.description ILIKE ${`%${query}%`} THEN 2 ELSE 0 END +
            CASE WHEN t.name ILIKE ${`${query}%`} THEN 1 ELSE 0 END
          ) as "searchRank",
          ${options?.userId ? Prisma.sql`EXISTS(
            SELECT 1 FROM team_members tm 
            WHERE tm."teamId" = t.id 
              AND tm."userId" = ${options.userId}
              AND tm."leftAt" IS NULL
          )` : Prisma.sql`false`} as "isMember"
        FROM teams t
        LEFT JOIN mv_team_activity_stats mtas ON mtas.team_id = t.id
        WHERE t."deletedAt" IS NULL
          ${!options?.includePrivate ? Prisma.sql`AND t."isPublic" = true` : Prisma.empty}
          AND (
            t.name ILIKE ${`%${query}%`} OR 
            t.description ILIKE ${`%${query}%`}
          )
        ORDER BY "searchRank" DESC, mtas.active_member_count DESC, t."createdAt" DESC
        LIMIT ${limit}
      `;

      const result: TeamListItem[] = teams.map(team => ({
        id: team.id,
        name: team.name,
        description: team.description,
        avatarUrl: team.avatarUrl,
        memberCount: team.memberCount,
        role: TeamRole.MEMBER, // Default role for search results
        joinedAt: new Date(), // Not relevant for search results
      }));

      // Cache search results for 10 minutes
      cache.set(cacheKey, result, 10 * 60 * 1000);

      this.logPerformanceMetric({
        queryName: 'searchTeams',
        executionTimeMs: Date.now() - startTime,
        rowsAffected: teams.length,
        cacheHit: false,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.logPerformanceMetric({
        queryName: 'searchTeams',
        executionTimeMs: Date.now() - startTime,
        cacheHit: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Enhanced team creation with optimized validation
   */
  async createTeam(userId: string, input: CreateTeamInput): Promise<TeamWithMembers> {
    const startTime = Date.now();
    
    try {
      // Optimize session for transaction-heavy operations
      await this.prisma.$executeRaw`SELECT optimize_session_for_dashboard()`;

      const result = await this.prisma.$transaction(async (tx) => {
        // Check name uniqueness with efficient query
        const existingTeam = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM teams 
          WHERE name = ${input.name} AND "deletedAt" IS NULL
          LIMIT 1
        `;

        if (existingTeam.length > 0) {
          throw new Error('Team name already exists');
        }

        // Create team and admin membership in single operation
        const teamData = await tx.$queryRaw<Array<{
          id: string;
          name: string;
          description: string | null;
          avatarUrl: string | null;
          isPublic: boolean;
          maxMembers: number;
          createdById: string;
          createdAt: Date;
          updatedAt: Date;
        }>>`
          WITH new_team AS (
            INSERT INTO teams (name, description, "avatarUrl", "isPublic", "maxMembers", "createdById")
            VALUES (${input.name}, ${input.description || null}, ${input.avatarUrl || null}, 
                   ${input.isPublic ?? true}, ${input.maxMembers || 50}, ${userId})
            RETURNING *
          ),
          new_membership AS (
            INSERT INTO team_members ("teamId", "userId", role)
            SELECT id, ${userId}, 'ADMIN'
            FROM new_team
            RETURNING *
          )
          SELECT nt.* FROM new_team nt
        `;

        if (teamData.length === 0) {
          throw new Error('Failed to create team');
        }

        const team = teamData[0];

        // Get creator user details
        const creator = await tx.$queryRaw<Array<{
          id: string;
          name: string;
          email: string;
          avatarUrl: string | null;
        }>>`
          SELECT id, name, email, "avatarUrl" FROM users WHERE id = ${userId}
        `;

        const result: TeamWithMembers = {
          ...team,
          members: [{
            id: '', // Membership ID not critical for response
            role: TeamRole.ADMIN,
            joinedAt: team.createdAt,
            userId,
            user: creator[0],
          }],
          _count: {
            members: 1,
          },
        };

        return result;
      }, {
        isolationLevel: 'ReadCommitted',
        timeout: 5000,
      });

      // Invalidate relevant caches
      this.invalidateUserTeamCaches(userId);

      this.logPerformanceMetric({
        queryName: 'createTeam',
        executionTimeMs: Date.now() - startTime,
        rowsAffected: 2, // Team + membership
        cacheHit: false,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.logPerformanceMetric({
        queryName: 'createTeam',
        executionTimeMs: Date.now() - startTime,
        cacheHit: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Optimized batch team operations
   */
  async getTeamsByIds(teamIds: string[]): Promise<Map<string, TeamListItem>> {
    const startTime = Date.now();
    
    if (teamIds.length === 0) {
      return new Map();
    }

    const cacheKey = `teams_batch:${teamIds.sort().join(',')}`;
    const cached = cache.get<Map<string, TeamListItem>>(cacheKey);
    
    if (cached) {
      this.logPerformanceMetric({
        queryName: 'getTeamsByIds',
        executionTimeMs: Date.now() - startTime,
        cacheHit: true,
        timestamp: new Date(),
      });
      return cached;
    }

    try {
      const teams = await this.prisma.$queryRaw<Array<{
        id: string;
        name: string;
        description: string | null;
        avatarUrl: string | null;
        memberCount: number;
      }>>`
        SELECT 
          t.id,
          t.name,
          t.description,
          t."avatarUrl",
          COALESCE(mtas.active_member_count, 0) as "memberCount"
        FROM teams t
        LEFT JOIN mv_team_activity_stats mtas ON mtas.team_id = t.id
        WHERE t.id = ANY(${teamIds}::uuid[])
          AND t."deletedAt" IS NULL
      `;

      const teamMap = new Map<string, TeamListItem>();
      teams.forEach(team => {
        teamMap.set(team.id, {
          id: team.id,
          name: team.name,
          description: team.description,
          avatarUrl: team.avatarUrl,
          memberCount: team.memberCount,
          role: TeamRole.MEMBER, // Will be overridden by caller
          joinedAt: new Date(), // Will be overridden by caller
        });
      });

      // Cache for 5 minutes
      cache.set(cacheKey, teamMap, 5 * 60 * 1000);

      this.logPerformanceMetric({
        queryName: 'getTeamsByIds',
        executionTimeMs: Date.now() - startTime,
        rowsAffected: teams.length,
        cacheHit: false,
        timestamp: new Date(),
      });

      return teamMap;
    } catch (error) {
      this.logPerformanceMetric({
        queryName: 'getTeamsByIds',
        executionTimeMs: Date.now() - startTime,
        cacheHit: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Advanced team analytics and health metrics
   */
  async getTeamAnalytics(teamId: string, userId: string): Promise<TeamAggregateStats> {
    const startTime = Date.now();
    
    // Verify user is team member
    const isMember = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT 1 as count FROM team_members 
      WHERE "teamId" = ${teamId} AND "userId" = ${userId} AND "leftAt" IS NULL
      LIMIT 1
    `;
    
    if (isMember.length === 0) {
      throw new Error('User is not a member of this team');
    }

    const cacheKey = `team_analytics:${teamId}`;
    const cached = cache.get<TeamAggregateStats>(cacheKey);
    
    if (cached) {
      this.logPerformanceMetric({
        queryName: 'getTeamAnalytics',
        executionTimeMs: Date.now() - startTime,
        cacheHit: true,
        timestamp: new Date(),
      });
      return cached;
    }

    try {
      const analytics = await this.prisma.$queryRaw<Array<{
        memberCount: number;
        adminCount: number;
        recentActivityCount: number;
        totalDistance: number;
        avgMemberActivity: number;
        teamHealthScore: number;
      }>>`
        WITH team_metrics AS (
          SELECT 
            COUNT(DISTINCT CASE WHEN tm."leftAt" IS NULL THEN tm."userId" END) as member_count,
            COUNT(DISTINCT CASE WHEN tm."leftAt" IS NULL AND tm.role = 'ADMIN' THEN tm."userId" END) as admin_count,
            COALESCE(SUM(CASE WHEN a."startTime" >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END), 0) as recent_activity_count,
            COALESCE(SUM(a.distance), 0) as total_distance,
            CASE 
              WHEN COUNT(DISTINCT CASE WHEN tm."leftAt" IS NULL THEN tm."userId" END) > 0
              THEN COALESCE(SUM(a.distance), 0) / COUNT(DISTINCT CASE WHEN tm."leftAt" IS NULL THEN tm."userId" END)
              ELSE 0 
            END as avg_member_activity
          FROM teams t
          LEFT JOIN team_members tm ON tm."teamId" = t.id
          LEFT JOIN activities a ON a."teamId" = t.id AND a."startTime" >= NOW() - INTERVAL '30 days'
          WHERE t.id = ${teamId}
          GROUP BY t.id
        )
        SELECT 
          *,
          CASE 
            WHEN member_count = 0 THEN 0
            WHEN recent_activity_count = 0 THEN 20
            WHEN avg_member_activity = 0 THEN 40
            WHEN avg_member_activity < 1000 THEN 60
            WHEN avg_member_activity < 5000 THEN 80
            ELSE 100
          END as team_health_score
        FROM team_metrics
      `;

      if (analytics.length === 0) {
        throw new Error('Team not found');
      }

      const result: TeamAggregateStats = {
        memberCount: analytics[0].memberCount,
        adminCount: analytics[0].adminCount,
        recentActivityCount: analytics[0].recentActivityCount,
        totalDistance: analytics[0].totalDistance,
        avgMemberActivity: analytics[0].avgMemberActivity,
        teamHealthScore: analytics[0].teamHealthScore,
      };

      // Cache for 15 minutes
      cache.set(cacheKey, result, 15 * 60 * 1000);

      this.logPerformanceMetric({
        queryName: 'getTeamAnalytics',
        executionTimeMs: Date.now() - startTime,
        rowsAffected: 1,
        cacheHit: false,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.logPerformanceMetric({
        queryName: 'getTeamAnalytics',
        executionTimeMs: Date.now() - startTime,
        cacheHit: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Performance monitoring methods
   */
  getPerformanceMetrics(): TeamPerformanceMetrics[] {
    return [...this.performanceMetrics];
  }

  clearPerformanceMetrics(): void {
    this.performanceMetrics = [];
  }

  getPerformanceSummary(): {
    totalQueries: number;
    averageExecutionTime: number;
    cacheHitRate: number;
    slowQueries: TeamPerformanceMetrics[];
  } {
    const totalQueries = this.performanceMetrics.length;
    const averageExecutionTime = totalQueries > 0 
      ? this.performanceMetrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / totalQueries 
      : 0;
    const cacheHits = this.performanceMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0;
    const slowQueries = this.performanceMetrics
      .filter(m => m.executionTimeMs > 500) // Queries over 500ms
      .sort((a, b) => b.executionTimeMs - a.executionTimeMs);

    return {
      totalQueries,
      averageExecutionTime,
      cacheHitRate,
      slowQueries,
    };
  }

  private invalidateUserTeamCaches(userId: string): void {
    cache.delete(`user_teams:${userId}`);
    // Could implement pattern-based cache invalidation here
  }

  private logPerformanceMetric(metric: TeamPerformanceMetrics): void {
    this.performanceMetrics.push(metric);
    
    // Keep only last 1000 metrics
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics = this.performanceMetrics.slice(-1000);
    }

    // Log slow queries
    if (metric.executionTimeMs > 1000) {
      console.warn(`Slow team query detected: ${metric.queryName} took ${metric.executionTimeMs}ms`);
    }
  }
}