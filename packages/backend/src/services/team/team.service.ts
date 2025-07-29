import { PrismaClient, TeamRole, InviteStatus } from '@prisma/client';
import { 
  CreateTeamInput, 
  UpdateTeamInput, 
  JoinTeamInput, 
  TeamWithMembers,
  TeamListItem
} from './types';
import { GoalService } from '../goal/goal.service';

export class TeamService {
  private goalService: GoalService;

  constructor(private prisma: PrismaClient) {
    this.goalService = new GoalService(prisma);
  }

  /**
   * Soft delete a team (admin only)
   * BE-204: Delete team endpoint implementation
   */
  async deleteTeam(teamId: string, userId: string): Promise<void> {
    // Check if team exists and user is an admin
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        leftAt: null,
        team: {
          deletedAt: null,
        },
      },
      include: {
        team: true,
      },
    });

    if (!teamMember) {
      throw new Error('Team not found or user is not a member');
    }

    if (teamMember.role !== TeamRole.ADMIN) {
      throw new Error('Only team admins can delete teams');
    }

    // Soft delete the team
    await this.prisma.team.update({
      where: { id: teamId },
      data: { deletedAt: new Date() },
    });

    // Note: We don't update member records as they retain historical data
    // The deletedAt check in queries will exclude this team from results
  }

  async getUserTeams(userId: string): Promise<TeamListItem[]> {
    const memberships = await this.prisma.teamMember.findMany({
      where: {
        userId,
        leftAt: null,
        team: {
          deletedAt: null,
        },
      },
      include: {
        team: {
          include: {
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

  async getTeamById(teamId: string, userId?: string): Promise<TeamWithMembers | null> {
    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        deletedAt: null,
      },
      include: {
        members: {
          where: {
            leftAt: null,
          },
          include: {
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

    if (!team) {
      return null;
    }

    // Check if team is private and user is not a member
    if (!team.isPublic && userId) {
      const isMember = team.members.some((member) => member.userId === userId);
      if (!isMember) {
        return null;
      }
    }

    return team;
  }

  async createTeam(userId: string, input: CreateTeamInput): Promise<TeamWithMembers> {
    // Check if team name already exists
    const existingTeam = await this.prisma.team.findFirst({
      where: {
        name: input.name,
        deletedAt: null,
      },
    });

    if (existingTeam) {
      throw new Error('Team name already exists');
    }

    // Extract goal from input
    const { goal, ...teamInput } = input;

    // Create team and add creator as admin
    const team = await this.prisma.team.create({
      data: {
        ...teamInput,
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
          include: {
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

    // Create goal if provided
    if (goal) {
      try {
        await this.goalService.createTeamGoal(team.id, userId, {
          name: goal.name,
          description: goal.description,
          startLocation: goal.startLocation,
          endLocation: goal.endLocation,
          waypoints: goal.waypoints,
          targetDate: goal.targetDate,
        });
      } catch (error) {
        // If goal creation fails, we should still return the team
        // but log the error for debugging
        console.error('Failed to create goal during team creation:', error);
      }
    }

    return team;
  }

  async updateTeam(
    teamId: string,
    userId: string,
    input: UpdateTeamInput
  ): Promise<TeamWithMembers> {
    // Check if user is team admin
    const membership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: TeamRole.ADMIN,
        leftAt: null,
      },
    });

    if (!membership) {
      throw new Error('Unauthorized: Only team admins can update team details');
    }

    // Check if new name already exists (if name is being changed)
    if (input.name) {
      const existingTeam = await this.prisma.team.findFirst({
        where: {
          name: input.name,
          id: { not: teamId },
          deletedAt: null,
        },
      });

      if (existingTeam) {
        throw new Error('Team name already exists');
      }
    }

    const team = await this.prisma.team.update({
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
          include: {
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

  async joinTeam(userId: string, input: JoinTeamInput): Promise<TeamWithMembers> {
    let teamId: string;

    if (input.inviteCode) {
      // Join by invite code
      const invite = await this.prisma.teamInvite.findFirst({
        where: {
          code: input.inviteCode,
          status: InviteStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
      });

      if (!invite) {
        throw new Error('Invalid or expired invite code');
      }

      // Update invite status
      await this.prisma.teamInvite.update({
        where: { id: invite.id },
        data: {
          status: InviteStatus.ACCEPTED,
          acceptedAt: new Date(),
          userId,
        },
      });

      teamId = invite.teamId;
    } else if (input.teamId) {
      // Direct join (only for public teams)
      const team = await this.prisma.team.findFirst({
        where: {
          id: input.teamId,
          isPublic: true,
          deletedAt: null,
        },
      });

      if (!team) {
        throw new Error('Team not found or is not public');
      }

      teamId = team.id;
    } else {
      throw new Error('Either teamId or inviteCode must be provided');
    }

    // Check if user is already a member
    const existingMembership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        leftAt: null,
      },
    });

    if (existingMembership) {
      throw new Error('User is already a member of this team');
    }


    // Add user to team
    await this.prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: TeamRole.MEMBER,
      },
    });

    // Return updated team
    return this.getTeamById(teamId, userId) as Promise<TeamWithMembers>;
  }

  async leaveTeam(teamId: string, userId: string): Promise<void> {
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

    // Check if user is the only admin
    if (membership.role === TeamRole.ADMIN) {
      const adminCount = await this.prisma.teamMember.count({
        where: {
          teamId,
          role: TeamRole.ADMIN,
          leftAt: null,
        },
      });

      if (adminCount === 1) {
        throw new Error('Cannot leave team: You are the only admin. Promote another member first.');
      }
    }

    // Mark as left
    await this.prisma.teamMember.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });
  }

  async removeMember(teamId: string, adminUserId: string, memberUserId: string): Promise<void> {
    // Check if admin has permission
    const adminMembership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: adminUserId,
        role: TeamRole.ADMIN,
        leftAt: null,
      },
    });

    if (!adminMembership) {
      throw new Error('Unauthorized: Only team admins can remove members');
    }

    // Cannot remove yourself
    if (adminUserId === memberUserId) {
      throw new Error('Cannot remove yourself. Use leave team instead.');
    }

    const memberToRemove = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: memberUserId,
        leftAt: null,
      },
    });

    if (!memberToRemove) {
      throw new Error('User is not a member of this team');
    }

    // Mark as left
    await this.prisma.teamMember.update({
      where: { id: memberToRemove.id },
      data: { leftAt: new Date() },
    });
  }

  async updateMemberRole(
    teamId: string,
    adminUserId: string,
    memberUserId: string,
    newRole: TeamRole
  ): Promise<void> {
    // Check if admin has permission
    const adminMembership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: adminUserId,
        role: TeamRole.ADMIN,
        leftAt: null,
      },
    });

    if (!adminMembership) {
      throw new Error('Unauthorized: Only team admins can update member roles');
    }

    const memberToUpdate = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: memberUserId,
        leftAt: null,
      },
    });

    if (!memberToUpdate) {
      throw new Error('User is not a member of this team');
    }

    // If demoting an admin, check if they're the last admin
    if (memberToUpdate.role === TeamRole.ADMIN && newRole !== TeamRole.ADMIN) {
      const adminCount = await this.prisma.teamMember.count({
        where: {
          teamId,
          role: TeamRole.ADMIN,
          leftAt: null,
        },
      });

      if (adminCount === 1) {
        throw new Error('Cannot demote the only admin in the team');
      }
    }

    await this.prisma.teamMember.update({
      where: { id: memberToUpdate.id },
      data: { role: newRole },
    });
  }
}