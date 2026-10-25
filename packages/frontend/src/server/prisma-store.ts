import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './db';
import type {
  ActivityAggregate,
  ActivityFilter,
  ActivityPatch,
  ActivityRecord,
  ActivityWrite,
  GoalRecord,
  GoalWrite,
  InviteRecord,
  LocationJson,
  MemberRecord,
  MemberWithUser,
  MembershipView,
  ProgressWrite,
  RefreshRecord,
  Store,
  StoredWaypoint,
  TeamPatch,
  TeamRecord,
  TeamRoleName,
  UserActivityStamp,
  UserPatch,
  UserRecord,
  UserStatsWrite,
} from './store';

type ActivityRow = Prisma.ActivityGetPayload<{ include: { user: { select: { name: true } } } }>;
type GoalRow = Prisma.TeamGoalGetPayload<Record<string, never>>;
type UserRow = Prisma.UserGetPayload<Record<string, never>>;

function asLocation(value: Prisma.JsonValue): LocationJson {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'lat' in value && 'lng' in value) {
    const record = value as { lat?: unknown; lng?: unknown; address?: unknown };
    return {
      lat: typeof record.lat === 'number' ? record.lat : 0,
      lng: typeof record.lng === 'number' ? record.lng : 0,
      address: typeof record.address === 'string' ? record.address : undefined,
    };
  }
  return { lat: 0, lng: 0 };
}

function asWaypoints(value: Prisma.JsonValue[]): StoredWaypoint[] {
  return value.map((item) => (item && typeof item === 'object' ? item as StoredWaypoint : {}));
}

function mapUser(user: UserRow): UserRecord {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    cognitoId: user.cognitoId,
    passwordHash: user.passwordHash,
    verificationCodeHash: user.verificationCodeHash,
    verificationCodeExpiresAt: user.verificationCodeExpiresAt,
    preferredUnits: user.preferredUnits,
    timezone: user.timezone,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt,
  };
}

function mapTeam(team: Prisma.TeamGetPayload<Record<string, never>>): TeamRecord {
  return team;
}

function mapGoal(goal: GoalRow): GoalRecord {
  return {
    id: goal.id,
    teamId: goal.teamId,
    name: goal.name,
    description: goal.description,
    targetDistance: goal.targetDistance,
    targetDate: goal.targetDate,
    startDate: goal.startDate,
    endDate: goal.endDate,
    startLocation: asLocation(goal.startLocation),
    endLocation: asLocation(goal.endLocation),
    waypoints: asWaypoints(goal.waypoints),
    routePolyline: goal.routePolyline,
    routeData: goal.routeData,
    status: goal.status,
    createdById: goal.createdById,
    completedAt: goal.completedAt,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

function mapActivity(activity: ActivityRow): ActivityRecord {
  return {
    id: activity.id,
    userId: activity.userId,
    distance: activity.distance,
    duration: activity.duration,
    timestamp: activity.timestamp,
    notes: activity.notes,
    source: activity.source,
    externalId: activity.externalId,
    isPrivate: activity.isPrivate,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
    userName: activity.user?.name,
  };
}

function activityWhere(filter: ActivityFilter): Prisma.ActivityWhereInput {
  const and: Prisma.ActivityWhereInput[] = [];
  if (filter.userIds) and.push({ userId: { in: filter.userIds } });
  if (filter.source) and.push({ source: filter.source });
  if (filter.isPrivate !== undefined) and.push({ isPrivate: filter.isPrivate });
  if (filter.minDistance !== undefined) and.push({ distance: { gte: filter.minDistance } });
  if (filter.maxDistance !== undefined) and.push({ distance: { lte: filter.maxDistance } });
  if (filter.start) and.push({ timestamp: { gte: filter.start } });
  if (filter.end) and.push({ timestamp: { lte: filter.end } });
  if (filter.before) {
    and.push({
      OR: [
        { timestamp: { lt: filter.before.timestamp } },
        { AND: [{ timestamp: filter.before.timestamp }, { id: { lt: filter.before.id } }] },
      ],
    });
  }
  return and.length > 0 ? { AND: and } : {};
}

const activityInclude = { user: { select: { name: true } } } as const;

export class PrismaStore implements Store {
  constructor(private readonly db: PrismaClient = prisma) {}

  async createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
    preferredUnits: string;
    timezone: string;
    verificationCodeHash: string;
    verificationCodeExpiresAt: Date;
  }): Promise<UserRecord> {
    return mapUser(await this.db.user.create({ data: input }));
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const user = await this.db.user.findUnique({ where: { email } });
    return user ? mapUser(user) : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const user = await this.db.user.findUnique({ where: { id } });
    return user ? mapUser(user) : null;
  }

  async updateUser(id: string, patch: UserPatch): Promise<UserRecord> {
    return mapUser(await this.db.user.update({ where: { id }, data: patch }));
  }

  async saveRefreshToken(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.db.refreshToken.create({ data: input });
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshRecord | null> {
    return this.db.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await this.db.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async revokeRefreshTokens(userId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async createTeam(input: {
    name: string;
    description: string | null;
    avatarUrl: string | null;
    isPublic: boolean;
    createdById: string;
  }): Promise<TeamRecord> {
    return mapTeam(await this.db.team.create({ data: input }));
  }

  async findTeamById(id: string): Promise<TeamRecord | null> {
    return this.db.team.findUnique({ where: { id } });
  }

  async findTeamByName(name: string): Promise<TeamRecord | null> {
    return this.db.team.findUnique({ where: { name } });
  }

  async updateTeam(id: string, patch: TeamPatch): Promise<TeamRecord> {
    return mapTeam(await this.db.team.update({ where: { id }, data: patch }));
  }

  async softDeleteTeam(id: string): Promise<void> {
    await this.db.team.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addMember(input: { teamId: string; userId: string; role: TeamRoleName }): Promise<MemberRecord> {
    return this.db.teamMember.create({ data: input });
  }

  async findActiveMember(teamId: string, userId: string): Promise<MemberRecord | null> {
    return this.db.teamMember.findFirst({ where: { teamId, userId, leftAt: null } });
  }

  async listActiveMembers(teamId: string): Promise<MemberWithUser[]> {
    const members = await this.db.teamMember.findMany({
      where: { teamId, leftAt: null },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return members.map((member) => ({
      id: member.id,
      teamId: member.teamId,
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
      leftAt: member.leftAt,
      user: member.user,
    }));
  }

  async listMemberships(userId: string): Promise<MembershipView[]> {
    const memberships = await this.db.teamMember.findMany({
      where: { userId, leftAt: null, team: { deletedAt: null } },
      include: { team: true },
    });
    if (memberships.length === 0) return [];
    const counts = await this.db.teamMember.groupBy({
      by: ['teamId'],
      where: { teamId: { in: memberships.map((membership) => membership.teamId) }, leftAt: null },
      _count: { _all: true },
    });
    const countByTeam = new Map(counts.map((count) => [count.teamId, count._count._all]));
    return memberships.map((membership) => ({
      member: {
        id: membership.id,
        teamId: membership.teamId,
        userId: membership.userId,
        role: membership.role,
        joinedAt: membership.joinedAt,
        leftAt: membership.leftAt,
      },
      team: membership.team,
      memberCount: countByTeam.get(membership.teamId) ?? 0,
    }));
  }

  async setMemberRole(memberId: string, role: TeamRoleName): Promise<void> {
    await this.db.teamMember.update({ where: { id: memberId }, data: { role } });
  }

  async markMemberLeft(memberId: string): Promise<void> {
    await this.db.teamMember.update({ where: { id: memberId }, data: { leftAt: new Date() } });
  }

  async findInviteByCode(code: string): Promise<InviteRecord | null> {
    const invite = await this.db.teamInvite.findUnique({ where: { code } });
    if (!invite) return null;
    return {
      id: invite.id,
      teamId: invite.teamId,
      code: invite.code,
      status: invite.status,
      expiresAt: invite.expiresAt,
      email: invite.email,
    };
  }

  async markInviteAccepted(id: string, userId: string): Promise<void> {
    await this.db.teamInvite.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedAt: new Date(), userId },
    });
  }

  async createGoal(input: GoalWrite): Promise<GoalRecord> {
    const goal = await this.db.teamGoal.create({
      data: {
        teamId: input.teamId,
        name: input.name,
        description: input.description,
        targetDistance: input.targetDistance,
        targetDate: input.targetDate,
        startDate: input.startDate,
        endDate: input.endDate,
        startLocation: input.startLocation as unknown as Prisma.InputJsonValue,
        endLocation: input.endLocation as unknown as Prisma.InputJsonValue,
        waypoints: input.waypoints as unknown as Prisma.InputJsonValue[],
        routePolyline: input.routePolyline,
        routeData: input.routeData as Prisma.InputJsonValue,
        status: input.status,
        createdById: input.createdById,
      },
    });
    return mapGoal(goal);
  }

  async listGoals(teamId: string): Promise<GoalRecord[]> {
    const goals = await this.db.teamGoal.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
    });
    return goals.map(mapGoal);
  }

  async findGoal(teamId: string, goalId: string): Promise<GoalRecord | null> {
    const goal = await this.db.teamGoal.findFirst({ where: { id: goalId, teamId } });
    return goal ? mapGoal(goal) : null;
  }

  async updateGoal(id: string, patch: Partial<GoalWrite> & { status?: GoalRecord['status']; completedAt?: Date | null }): Promise<GoalRecord> {
    const data: Prisma.TeamGoalUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.targetDistance !== undefined) data.targetDistance = patch.targetDistance;
    if (patch.targetDate !== undefined) data.targetDate = patch.targetDate;
    if (patch.startDate !== undefined) data.startDate = patch.startDate;
    if (patch.endDate !== undefined) data.endDate = patch.endDate;
    if (patch.startLocation !== undefined) data.startLocation = patch.startLocation as unknown as Prisma.InputJsonValue;
    if (patch.endLocation !== undefined) data.endLocation = patch.endLocation as unknown as Prisma.InputJsonValue;
    if (patch.waypoints !== undefined) data.waypoints = patch.waypoints as unknown as Prisma.InputJsonValue[];
    if (patch.routePolyline !== undefined) data.routePolyline = patch.routePolyline;
    if (patch.routeData !== undefined) data.routeData = patch.routeData as Prisma.InputJsonValue;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.completedAt !== undefined) data.completedAt = patch.completedAt;
    return mapGoal(await this.db.teamGoal.update({ where: { id }, data }));
  }

  async deleteGoal(id: string): Promise<void> {
    await this.db.teamGoal.delete({ where: { id } });
  }

  async upsertProgress(goalId: string, progress: ProgressWrite): Promise<void> {
    await this.db.teamProgress.upsert({
      where: { teamGoalId: goalId },
      create: { teamGoalId: goalId, ...progress },
      update: progress,
    });
  }

  async createActivity(input: ActivityWrite): Promise<ActivityRecord> {
    const activity = await this.db.activity.create({
      data: input,
      include: activityInclude,
    });
    return mapActivity(activity);
  }

  async findActivity(id: string): Promise<ActivityRecord | null> {
    const activity = await this.db.activity.findUnique({ where: { id }, include: activityInclude });
    return activity ? mapActivity(activity) : null;
  }

  async updateActivity(id: string, patch: ActivityPatch): Promise<ActivityRecord> {
    const activity = await this.db.activity.update({
      where: { id },
      data: patch,
      include: activityInclude,
    });
    return mapActivity(activity);
  }

  async deleteActivity(id: string): Promise<void> {
    await this.db.activity.delete({ where: { id } });
  }

  async queryActivities(filter: ActivityFilter): Promise<ActivityRecord[]> {
    const rows = await this.db.activity.findMany({
      where: activityWhere(filter),
      include: activityInclude,
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      ...(filter.limit ? { take: filter.limit } : {}),
    });
    return rows.map(mapActivity);
  }

  async aggregateActivities(filter: ActivityFilter): Promise<ActivityAggregate> {
    const aggregate = await this.db.activity.aggregate({
      where: activityWhere({ ...filter, before: undefined, limit: undefined }),
      _sum: { distance: true, duration: true },
      _count: { _all: true },
      _max: { timestamp: true },
    });
    return {
      distance: aggregate._sum.distance ?? 0,
      duration: aggregate._sum.duration ?? 0,
      count: aggregate._count._all,
      lastTimestamp: aggregate._max.timestamp,
    };
  }

  async listActivityStamps(userId: string): Promise<UserActivityStamp[]> {
    return this.db.activity.findMany({
      where: { userId },
      select: { timestamp: true, distance: true, duration: true },
    });
  }

  async upsertUserStats(userId: string, stats: UserStatsWrite): Promise<void> {
    await this.db.userStats.upsert({
      where: { userId },
      create: { userId, ...stats },
      update: stats,
    });
  }
}
