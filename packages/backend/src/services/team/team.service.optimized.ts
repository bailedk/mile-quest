import { PrismaClient, TeamRole, InviteStatus, Prisma } from '@prisma/client';
import { 
  CreateTeamInput, 
  UpdateTeamInput, 
  JoinTeamInput, 
  TeamWithMembers,
  TeamListItem
} from './types';

export class OptimizedTeamService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Optimized getUserTeams with better index usage
   * Uses compound index on (userId, leftAt, joinedAt DESC)
   */
  async getUserTeams(userId: string): Promise<TeamListItem[]> {
    // Use select to minimize data transfer
    const memberships = await this.prisma.teamMember.findMany({
      where: {
        userId,
        leftAt: null,
        team: {
          deletedAt: null,
        },
      },
      select: {
        joinedAt: true,
        role: true,
        team: {
          select: {
            id: true,
            name: true,
            description: true,
            avatarUrl: true,
            _count: {
              select: {
                members: {
                  where: {
                    leftAt: null,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return memberships.map((membership) => ({
      id: membership.team.id,
      name: membership.team.name,
      description: membership.team.description,
      avatarUrl: membership.team.avatarUrl,
      memberCount: membership.team._count.members,
      role: membership.role,
      joinedAt: membership.joinedAt,
    }));
  }

  /**
   * Optimized getTeamById with selective loading
   */
  async getTeamById(teamId: string, userId?: string): Promise<TeamWithMembers | null> {
    // First, check if team exists and if user has access (lighter query)
    const teamAccess = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        deletedAt: null,
      },
      select: {
        id: true,
        isPublic: true,
        members: userId ? {
          where: {
            userId,
            leftAt: null,
          },
          select: {
            id: true,
          },
        } : undefined,
      },
    });

    if (!teamAccess) {
      return null;
    }

    // Check access for private teams
    if (!teamAccess.isPublic && userId) {
      const isMember = teamAccess.members && teamAccess.members.length > 0;
      if (!isMember) {
        return null;
      }
    }

    // Now fetch full team data
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          where: {
            leftAt: null,
          },
          select: {
            id: true,
            role: true,
            joinedAt: true,
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: [
            { role: 'asc' },
            { joinedAt: 'asc' },
          ],
        },
        _count: {
          select: {
            members: {
              where: {
                leftAt: null,
              },
            },
          },
        },
      },
    });

    return team;
  }

  /**
   * Optimized createTeam with single transaction
   */
  async createTeam(userId: string, input: CreateTeamInput): Promise<TeamWithMembers> {
    // Use transaction for atomicity
    return await this.prisma.$transaction(async (tx) => {
      // Check if team name already exists (uses name index)
      const existingTeam = await tx.team.findFirst({
        where: {
          name: input.name,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (existingTeam) {
        throw new Error('Team name already exists');
      }

      // Create team and add creator as admin in one query
      const team = await tx.team.create({
        data: {
          ...input,
          createdById: userId,
          members: {
            create: {
              userId,
              role: TeamRole.ADMIN,
            },
          },
        },
        include: {
          members: {
            where: {
              leftAt: null,
            },
            select: {
              id: true,
              role: true,
              joinedAt: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          },
          _count: {
            select: {
              members: true,
            },
          },
        },
      });

      return team;
    });
  }

  /**
   * Optimized member role check using compound index
   */
  async isTeamAdmin(teamId: string, userId: string): Promise<boolean> {
    const admin = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: TeamRole.ADMIN,
        leftAt: null,
      },
      select: { id: true },
    });

    return !!admin;
  }

  /**
   * Optimized updateTeam with permission check
   */
  async updateTeam(
    teamId: string,
    userId: string,
    input: UpdateTeamInput
  ): Promise<TeamWithMembers> {
    return await this.prisma.$transaction(async (tx) => {
      // Check admin permission (uses compound index)
      const isAdmin = await this.isTeamAdmin(teamId, userId);
      if (!isAdmin) {
        throw new Error('Unauthorized: Only team admins can update team details');
      }

      // Check name uniqueness if name is changing
      if (input.name) {
        const existingTeam = await tx.team.findFirst({
          where: {
            name: input.name,
            id: { not: teamId },
            deletedAt: null,
          },
          select: { id: true },
        });

        if (existingTeam) {
          throw new Error('Team name already exists');
        }
      }

      // Update team
      const team = await tx.team.update({
        where: { id: teamId },
        data: {
          ...input,
          updatedAt: new Date(),
        },
        include: {
          members: {
            where: {
              leftAt: null,
            },
            select: {
              id: true,
              role: true,
              joinedAt: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: [
              { role: 'asc' },
              { joinedAt: 'asc' },
            ],
          },
          _count: {
            select: {
              members: {
                where: {
                  leftAt: null,
                },
              },
            },
          },
        },
      });

      return team;
    });
  }

  /**
   * Optimized joinTeam with better index usage
   */
  async joinTeam(userId: string, input: JoinTeamInput): Promise<TeamWithMembers> {
    return await this.prisma.$transaction(async (tx) => {
      let teamId: string;

      if (input.inviteCode) {
        // Use compound index on (code, status, expiresAt)
        const invite = await tx.teamInvite.findFirst({
          where: {
            code: input.inviteCode,
            status: InviteStatus.PENDING,
            expiresAt: { gt: new Date() },
          },
          select: {
            id: true,
            teamId: true,
          },
        });

        if (!invite) {
          throw new Error('Invalid or expired invite code');
        }

        // Update invite status
        await tx.teamInvite.update({
          where: { id: invite.id },
          data: {
            status: InviteStatus.ACCEPTED,
            acceptedAt: new Date(),
            userId,
          },
        });

        teamId = invite.teamId;
      } else if (input.teamId) {
        // Check if team is public
        const team = await tx.team.findFirst({
          where: {
            id: input.teamId,
            isPublic: true,
            deletedAt: null,
          },
          select: { id: true, maxMembers: true },
        });

        if (!team) {
          throw new Error('Team not found or is not public');
        }

        teamId = team.id;
      } else {
        throw new Error('Either teamId or inviteCode must be provided');
      }

      // Check existing membership (uses compound index)
      const existingMembership = await tx.teamMember.findFirst({
        where: {
          teamId,
          userId,
          leftAt: null,
        },
        select: { id: true },
      });

      if (existingMembership) {
        throw new Error('User is already a member of this team');
      }

      // Check team member limit
      const memberCount = await tx.teamMember.count({
        where: {
          teamId,
          leftAt: null,
        },
      });

      const team = await tx.team.findUnique({
        where: { id: teamId },
        select: { maxMembers: true },
      });

      if (team && memberCount >= team.maxMembers) {
        throw new Error('Team has reached maximum member limit');
      }

      // Add user to team
      await tx.teamMember.create({
        data: {
          teamId,
          userId,
          role: TeamRole.MEMBER,
        },
      });

      // Return updated team
      return this.getTeamById(teamId, userId) as Promise<TeamWithMembers>;
    });
  }

  /**
   * Batch operation for getting multiple teams
   */
  async getTeamsByIds(teamIds: string[]): Promise<Map<string, TeamListItem>> {
    const teams = await this.prisma.team.findMany({
      where: {
        id: { in: teamIds },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        avatarUrl: true,
        _count: {
          select: {
            members: {
              where: {
                leftAt: null,
              },
            },
          },
        },
      },
    });

    const teamMap = new Map<string, TeamListItem>();
    teams.forEach(team => {
      teamMap.set(team.id, {
        id: team.id,
        name: team.name,
        description: team.description,
        avatarUrl: team.avatarUrl,
        memberCount: team._count.members,
        role: TeamRole.MEMBER, // Will be overridden by caller
        joinedAt: new Date(), // Will be overridden by caller
      });
    });

    return teamMap;
  }

  /**
   * Search teams with optimized query
   */
  async searchTeams(query: string, limit: number = 10): Promise<TeamListItem[]> {
    const teams = await this.prisma.team.findMany({
      where: {
        AND: [
          { deletedAt: null },
          { isPublic: true },
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        avatarUrl: true,
        _count: {
          select: {
            members: {
              where: {
                leftAt: null,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return teams.map(team => ({
      id: team.id,
      name: team.name,
      description: team.description,
      avatarUrl: team.avatarUrl,
      memberCount: team._count.members,
      role: TeamRole.MEMBER,
      joinedAt: new Date(),
    }));
  }

  /**
   * Get team statistics using raw SQL for performance
   */
  async getTeamStats(teamId: string): Promise<{
    memberCount: number;
    adminCount: number;
    totalDistance: number;
    totalActivities: number;
    lastActivityAt: Date | null;
  }> {
    const stats = await this.prisma.$queryRaw<Array<{
      member_count: bigint;
      admin_count: bigint;
      total_distance: number;
      total_activities: bigint;
      last_activity_at: Date | null;
    }>>`
      SELECT 
        COUNT(DISTINCT CASE WHEN tm."leftAt" IS NULL THEN tm."userId" END) as member_count,
        COUNT(DISTINCT CASE WHEN tm."leftAt" IS NULL AND tm."role" = 'ADMIN' THEN tm."userId" END) as admin_count,
        COALESCE(SUM(a."distance"), 0) as total_distance,
        COUNT(DISTINCT a."id") as total_activities,
        MAX(a."startTime") as last_activity_at
      FROM "teams" t
      LEFT JOIN "team_members" tm ON t."id" = tm."teamId"
      LEFT JOIN "activities" a ON t."id" = a."teamId" AND a."startTime" >= NOW() - INTERVAL '30 days'
      WHERE t."id" = ${teamId}
      GROUP BY t."id"
    `;

    if (stats.length === 0) {
      return {
        memberCount: 0,
        adminCount: 0,
        totalDistance: 0,
        totalActivities: 0,
        lastActivityAt: null,
      };
    }

    const stat = stats[0];
    return {
      memberCount: Number(stat.member_count),
      adminCount: Number(stat.admin_count),
      totalDistance: stat.total_distance,
      totalActivities: Number(stat.total_activities),
      lastActivityAt: stat.last_activity_at,
    };
  }
}