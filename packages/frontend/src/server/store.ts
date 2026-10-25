export type TeamRoleName = 'ADMIN' | 'MEMBER';
export type GoalStatusName = 'ACTIVE' | 'PASSED' | 'FAILED';
export type ActivitySourceName = 'MANUAL' | 'STRAVA' | 'APPLE_HEALTH' | 'GOOGLE_FIT';
export type InviteStatusName = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface LocationJson {
  lat: number;
  lng: number;
  address?: string;
}

export interface StoredWaypoint {
  id?: string;
  position?: { lat: number; lng: number };
  lat?: number;
  lng?: number;
  address?: string;
  order?: number;
  isLocked?: boolean;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  cognitoId: string | null;
  passwordHash: string | null;
  verificationCodeHash: string | null;
  verificationCodeExpiresAt: Date | null;
  preferredUnits: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface UserPatch {
  emailVerified?: boolean;
  verificationCodeHash?: string | null;
  verificationCodeExpiresAt?: Date | null;
  name?: string;
  avatarUrl?: string | null;
  preferredUnits?: string;
  timezone?: string;
  passwordHash?: string;
}

export interface RefreshRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface TeamRecord {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  isPublic: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TeamPatch {
  name?: string;
  description?: string | null;
  avatarUrl?: string | null;
  isPublic?: boolean;
}

export interface MemberRecord {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRoleName;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface MemberWithUser extends MemberRecord {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface MembershipView {
  member: MemberRecord;
  team: TeamRecord;
  memberCount: number;
}

export interface InviteRecord {
  id: string;
  teamId: string;
  code: string;
  status: InviteStatusName;
  expiresAt: Date;
  email: string | null;
}

export interface GoalRecord {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
  targetDistance: number;
  targetDate: Date | null;
  startDate: Date;
  endDate: Date;
  startLocation: LocationJson;
  endLocation: LocationJson;
  waypoints: StoredWaypoint[];
  routePolyline: string;
  routeData: unknown;
  status: GoalStatusName;
  createdById: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalWrite {
  teamId: string;
  name: string;
  description: string | null;
  targetDistance: number;
  targetDate: Date | null;
  startDate: Date;
  endDate: Date;
  startLocation: LocationJson;
  endLocation: LocationJson;
  waypoints: StoredWaypoint[];
  routePolyline: string;
  routeData: unknown;
  status?: GoalStatusName;
  createdById: string;
}

export interface ActivityRecord {
  id: string;
  userId: string;
  distance: number;
  duration: number;
  timestamp: Date;
  notes: string | null;
  source: ActivitySourceName;
  externalId: string | null;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
  userName?: string;
}

export interface ActivityWrite {
  userId: string;
  distance: number;
  duration: number;
  timestamp: Date;
  notes: string | null;
  isPrivate: boolean;
}

export interface ActivityPatch {
  notes?: string | null;
  isPrivate?: boolean;
}

export interface ActivityFilter {
  userIds?: string[];
  start?: Date;
  end?: Date;
  source?: ActivitySourceName;
  isPrivate?: boolean;
  minDistance?: number;
  maxDistance?: number;
  before?: { timestamp: Date; id: string };
  limit?: number;
}

export interface ActivityAggregate {
  distance: number;
  duration: number;
  count: number;
  lastTimestamp: Date | null;
}

export interface UserActivityStamp {
  timestamp: Date;
  distance: number;
  duration: number;
}

export interface UserStatsWrite {
  totalDistance: number;
  totalActivities: number;
  totalDuration: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityAt: Date | null;
}

export interface ProgressWrite {
  totalDistance: number;
  totalActivities: number;
  totalDuration: number;
  lastActivityAt: Date | null;
}

export interface Store {
  createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
    preferredUnits: string;
    timezone: string;
    verificationCodeHash: string;
    verificationCodeExpiresAt: Date;
  }): Promise<UserRecord>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  updateUser(id: string, patch: UserPatch): Promise<UserRecord>;

  saveRefreshToken(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshRecord | null>;
  revokeRefreshToken(id: string): Promise<void>;
  revokeRefreshTokens(userId: string): Promise<void>;

  createTeam(input: {
    name: string;
    description: string | null;
    avatarUrl: string | null;
    isPublic: boolean;
    createdById: string;
  }): Promise<TeamRecord>;
  findTeamById(id: string): Promise<TeamRecord | null>;
  findTeamByName(name: string): Promise<TeamRecord | null>;
  updateTeam(id: string, patch: TeamPatch): Promise<TeamRecord>;
  softDeleteTeam(id: string): Promise<void>;

  addMember(input: { teamId: string; userId: string; role: TeamRoleName }): Promise<MemberRecord>;
  findActiveMember(teamId: string, userId: string): Promise<MemberRecord | null>;
  listActiveMembers(teamId: string): Promise<MemberWithUser[]>;
  listMemberships(userId: string): Promise<MembershipView[]>;
  setMemberRole(memberId: string, role: TeamRoleName): Promise<void>;
  markMemberLeft(memberId: string): Promise<void>;

  findInviteByCode(code: string): Promise<InviteRecord | null>;
  markInviteAccepted(id: string, userId: string): Promise<void>;

  createGoal(input: GoalWrite): Promise<GoalRecord>;
  listGoals(teamId: string): Promise<GoalRecord[]>;
  findGoal(teamId: string, goalId: string): Promise<GoalRecord | null>;
  updateGoal(id: string, patch: Partial<GoalWrite> & { status?: GoalStatusName; completedAt?: Date | null }): Promise<GoalRecord>;
  deleteGoal(id: string): Promise<void>;
  upsertProgress(goalId: string, progress: ProgressWrite): Promise<void>;

  createActivity(input: ActivityWrite): Promise<ActivityRecord>;
  findActivity(id: string): Promise<ActivityRecord | null>;
  updateActivity(id: string, patch: ActivityPatch): Promise<ActivityRecord>;
  deleteActivity(id: string): Promise<void>;
  queryActivities(filter: ActivityFilter): Promise<ActivityRecord[]>;
  aggregateActivities(filter: ActivityFilter): Promise<ActivityAggregate>;
  listActivityStamps(userId: string): Promise<UserActivityStamp[]>;
  upsertUserStats(userId: string, stats: UserStatsWrite): Promise<void>;
}
