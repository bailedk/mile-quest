import { randomUUID } from 'node:crypto';
import type {
  ActivityAggregate,
  ActivityFilter,
  ActivityPatch,
  ActivityRecord,
  ActivityWrite,
  GoalRecord,
  GoalWrite,
  InviteRecord,
  MemberRecord,
  MemberWithUser,
  MembershipView,
  ProgressWrite,
  RefreshRecord,
  Store,
  TeamPatch,
  TeamRecord,
  TeamRoleName,
  UserActivityStamp,
  UserPatch,
  UserRecord,
  UserStatsWrite,
} from './store';

function matchesActivity(activity: ActivityRecord, filter: ActivityFilter): boolean {
  if (filter.userIds && !filter.userIds.includes(activity.userId)) return false;
  if (filter.start && activity.timestamp < filter.start) return false;
  if (filter.end && activity.timestamp > filter.end) return false;
  if (filter.source && activity.source !== filter.source) return false;
  if (filter.isPrivate !== undefined && activity.isPrivate !== filter.isPrivate) return false;
  if (filter.minDistance !== undefined && activity.distance < filter.minDistance) return false;
  if (filter.maxDistance !== undefined && activity.distance > filter.maxDistance) return false;
  if (filter.before) {
    const time = activity.timestamp.getTime();
    const cursor = filter.before.timestamp.getTime();
    if (time > cursor) return false;
    if (time === cursor && activity.id >= filter.before.id) return false;
  }
  return true;
}

function sortActivities(activities: ActivityRecord[]): ActivityRecord[] {
  return [...activities].sort((left, right) => {
    const byTime = right.timestamp.getTime() - left.timestamp.getTime();
    if (byTime !== 0) return byTime;
    if (left.id < right.id) return 1;
    if (left.id > right.id) return -1;
    return 0;
  });
}

export class MemoryStore implements Store {
  private users: UserRecord[] = [];
  private refreshTokens: RefreshRecord[] = [];
  private teams: TeamRecord[] = [];
  private members: MemberRecord[] = [];
  private invites: InviteRecord[] = [];
  private goals: GoalRecord[] = [];
  private activities: ActivityRecord[] = [];

  async createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
    preferredUnits: string;
    timezone: string;
    verificationCodeHash: string;
    verificationCodeExpiresAt: Date;
  }): Promise<UserRecord> {
    const now = new Date();
    const user: UserRecord = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      avatarUrl: null,
      emailVerified: false,
      cognitoId: null,
      passwordHash: input.passwordHash,
      verificationCodeHash: input.verificationCodeHash,
      verificationCodeExpiresAt: input.verificationCodeExpiresAt,
      preferredUnits: input.preferredUnits,
      timezone: input.timezone,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.users.push(user);
    return user;
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async updateUser(id: string, patch: UserPatch): Promise<UserRecord> {
    const user = this.users.find((item) => item.id === id);
    if (!user) throw new Error('User not found');
    Object.assign(user, patch, { updatedAt: new Date() });
    return user;
  }

  async saveRefreshToken(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    this.refreshTokens.push({
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
    });
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshRecord | null> {
    return this.refreshTokens.find((token) => token.tokenHash === tokenHash) ?? null;
  }

  async revokeRefreshToken(id: string): Promise<void> {
    const token = this.refreshTokens.find((item) => item.id === id);
    if (token) token.revokedAt = new Date();
  }

  async revokeRefreshTokens(userId: string): Promise<void> {
    const now = new Date();
    for (const token of this.refreshTokens) {
      if (token.userId === userId && !token.revokedAt) token.revokedAt = now;
    }
  }

  async createTeam(input: {
    name: string;
    description: string | null;
    avatarUrl: string | null;
    isPublic: boolean;
    createdById: string;
  }): Promise<TeamRecord> {
    const now = new Date();
    const team: TeamRecord = {
      id: randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.teams.push(team);
    return team;
  }

  async findTeamById(id: string): Promise<TeamRecord | null> {
    return this.teams.find((team) => team.id === id) ?? null;
  }

  async findTeamByName(name: string): Promise<TeamRecord | null> {
    return this.teams.find((team) => team.name === name) ?? null;
  }

  async updateTeam(id: string, patch: TeamPatch): Promise<TeamRecord> {
    const team = this.teams.find((item) => item.id === id);
    if (!team) throw new Error('Team not found');
    Object.assign(team, patch, { updatedAt: new Date() });
    return team;
  }

  async softDeleteTeam(id: string): Promise<void> {
    const team = this.teams.find((item) => item.id === id);
    if (team) {
      team.deletedAt = new Date();
      team.updatedAt = new Date();
    }
  }

  async addMember(input: { teamId: string; userId: string; role: TeamRoleName }): Promise<MemberRecord> {
    const member: MemberRecord = {
      id: randomUUID(),
      teamId: input.teamId,
      userId: input.userId,
      role: input.role,
      joinedAt: new Date(),
      leftAt: null,
    };
    this.members.push(member);
    return member;
  }

  async findActiveMember(teamId: string, userId: string): Promise<MemberRecord | null> {
    return this.members.find((member) => member.teamId === teamId && member.userId === userId && !member.leftAt) ?? null;
  }

  async listActiveMembers(teamId: string): Promise<MemberWithUser[]> {
    return this.members
      .filter((member) => member.teamId === teamId && !member.leftAt)
      .sort((left, right) => left.joinedAt.getTime() - right.joinedAt.getTime())
      .map((member) => {
        const user = this.users.find((item) => item.id === member.userId);
        return {
          ...member,
          user: {
            id: member.userId,
            name: user?.name ?? 'Unknown',
            email: user?.email ?? '',
            avatarUrl: user?.avatarUrl ?? null,
          },
        };
      });
  }

  async listMemberships(userId: string): Promise<MembershipView[]> {
    const views: MembershipView[] = [];
    for (const member of this.members) {
      if (member.userId !== userId || member.leftAt) continue;
      const team = this.teams.find((item) => item.id === member.teamId);
      if (!team || team.deletedAt) continue;
      views.push({
        member,
        team,
        memberCount: this.members.filter((item) => item.teamId === team.id && !item.leftAt).length,
      });
    }
    return views;
  }

  async setMemberRole(memberId: string, role: TeamRoleName): Promise<void> {
    const member = this.members.find((item) => item.id === memberId);
    if (member) member.role = role;
  }

  async markMemberLeft(memberId: string): Promise<void> {
    const member = this.members.find((item) => item.id === memberId);
    if (member) member.leftAt = new Date();
  }

  async findInviteByCode(code: string): Promise<InviteRecord | null> {
    return this.invites.find((invite) => invite.code === code) ?? null;
  }

  async markInviteAccepted(id: string, _userId: string): Promise<void> {
    const invite = this.invites.find((item) => item.id === id);
    if (invite) invite.status = 'ACCEPTED';
  }

  addInvite(invite: InviteRecord): void {
    this.invites.push(invite);
  }

  async createGoal(input: GoalWrite): Promise<GoalRecord> {
    const now = new Date();
    const goal: GoalRecord = {
      id: randomUUID(),
      teamId: input.teamId,
      name: input.name,
      description: input.description,
      targetDistance: input.targetDistance,
      targetDate: input.targetDate,
      startDate: input.startDate,
      endDate: input.endDate,
      startLocation: input.startLocation,
      endLocation: input.endLocation,
      waypoints: input.waypoints,
      routePolyline: input.routePolyline,
      routeData: input.routeData,
      status: input.status ?? 'ACTIVE',
      createdById: input.createdById,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.goals.push(goal);
    return goal;
  }

  async listGoals(teamId: string): Promise<GoalRecord[]> {
    return this.goals
      .filter((goal) => goal.teamId === teamId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async findGoal(teamId: string, goalId: string): Promise<GoalRecord | null> {
    return this.goals.find((goal) => goal.teamId === teamId && goal.id === goalId) ?? null;
  }

  async updateGoal(id: string, patch: Partial<GoalWrite> & { status?: GoalRecord['status']; completedAt?: Date | null }): Promise<GoalRecord> {
    const goal = this.goals.find((item) => item.id === id);
    if (!goal) throw new Error('Goal not found');
    Object.assign(goal, patch, { updatedAt: new Date() });
    return goal;
  }

  async deleteGoal(id: string): Promise<void> {
    this.goals = this.goals.filter((goal) => goal.id !== id);
  }

  async upsertProgress(_goalId: string, _progress: ProgressWrite): Promise<void> {
    return undefined;
  }

  async createActivity(input: ActivityWrite): Promise<ActivityRecord> {
    const now = new Date();
    const user = this.users.find((item) => item.id === input.userId);
    const activity: ActivityRecord = {
      id: randomUUID(),
      userId: input.userId,
      distance: input.distance,
      duration: input.duration,
      timestamp: input.timestamp,
      notes: input.notes,
      source: 'MANUAL',
      externalId: null,
      isPrivate: input.isPrivate,
      createdAt: now,
      updatedAt: now,
      userName: user?.name,
    };
    this.activities.push(activity);
    return activity;
  }

  async findActivity(id: string): Promise<ActivityRecord | null> {
    return this.activities.find((activity) => activity.id === id) ?? null;
  }

  async updateActivity(id: string, patch: ActivityPatch): Promise<ActivityRecord> {
    const activity = this.activities.find((item) => item.id === id);
    if (!activity) throw new Error('Activity not found');
    Object.assign(activity, patch, { updatedAt: new Date() });
    return activity;
  }

  async deleteActivity(id: string): Promise<void> {
    this.activities = this.activities.filter((activity) => activity.id !== id);
  }

  async queryActivities(filter: ActivityFilter): Promise<ActivityRecord[]> {
    const matched = sortActivities(this.activities.filter((activity) => matchesActivity(activity, filter)));
    return filter.limit ? matched.slice(0, filter.limit) : matched;
  }

  async aggregateActivities(filter: ActivityFilter): Promise<ActivityAggregate> {
    const matched = this.activities.filter((activity) => matchesActivity(activity, {
      ...filter,
      before: undefined,
      limit: undefined,
    }));
    return matched.reduce<ActivityAggregate>((aggregate, activity) => {
      aggregate.distance += activity.distance;
      aggregate.duration += activity.duration;
      aggregate.count += 1;
      if (!aggregate.lastTimestamp || activity.timestamp > aggregate.lastTimestamp) {
        aggregate.lastTimestamp = activity.timestamp;
      }
      return aggregate;
    }, { distance: 0, duration: 0, count: 0, lastTimestamp: null });
  }

  async listActivityStamps(userId: string): Promise<UserActivityStamp[]> {
    return this.activities
      .filter((activity) => activity.userId === userId)
      .map((activity) => ({
        timestamp: activity.timestamp,
        distance: activity.distance,
        duration: activity.duration,
      }));
  }

  async upsertUserStats(_userId: string, _stats: UserStatsWrite): Promise<void> {
    return undefined;
  }
}
