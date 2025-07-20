// Mile Quest API TypeScript Type Definitions
// Version: 1.0
// Generated from api-contracts-mvp.md

// ============================================
// Base Types
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    nextCursor: string | null;
    prevCursor?: string | null;
    hasMore: boolean;
    total?: number;
  };
}

// ============================================
// Auth Types
// ============================================

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  provider: 'email' | 'google';
}

export interface RegisterResponse {
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
  };
  requiresVerification: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface VerifyEmailResponse {
  verified: boolean;
}

// ============================================
// User Types
// ============================================

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  profilePictureUrl: string | null;
}

export interface UserProfile extends AuthUser {
  timezone: string;
  preferredUnits: 'METRIC' | 'IMPERIAL';
  /** ISO 8601 date-time string in UTC (e.g., "2025-01-20T14:30:00.000Z") */
  createdAt: string;
}

export interface UserStats {
  totalDistance: number;
  totalActivities: number;
  currentStreak: number;
  longestStreak: number;
  /** ISO 8601 date-time string in UTC of last activity, null if no activities */
  lastActivityDate: string | null;
}

export interface UserProfileResponse {
  user: UserProfile;
  stats: UserStats;
}

export interface UpdateProfileRequest {
  name?: string;
  timezone?: string;
  preferredUnits?: 'METRIC' | 'IMPERIAL';
}

// ============================================
// Team Types
// ============================================

export interface Team {
  id: string;
  name: string;
  inviteCode: string;
  goalDistance: number;
  /** ISO 8601 date string (YYYY-MM-DD) for team start date */
  startDate: string;
  /** ISO 8601 date string (YYYY-MM-DD) for team end date */
  endDate: string;
  description: string | null;
  /** ISO 8601 date-time string in UTC (e.g., "2025-01-20T14:30:00.000Z") */
  createdAt: string;
}

export interface TeamProgress {
  totalDistance: number;
  percentComplete: number;
  currentSegmentIndex: number;
  distanceToNextWaypoint?: number;
  daysRemaining?: number;
  /** ISO 8601 date-time string in UTC of last team activity, null if no activities */
  lastActivityAt?: string | null;
}

export interface TeamMember {
  userId: string;
  teamId: string;
  role: 'ADMIN' | 'MEMBER';
  /** ISO 8601 date-time string in UTC when member joined the team */
  joinedAt: string;
}

export interface CreateTeamRequest {
  name: string;
  goalDistance: number;
  /** ISO 8601 date string (YYYY-MM-DD) for team start date */
  startDate: string;
  /** ISO 8601 date string (YYYY-MM-DD) for team end date */
  endDate: string;
  description?: string;
}

export interface CreateTeamResponse {
  team: Team;
  member: TeamMember;
}

export interface TeamListItem {
  team: Pick<Team, 'id' | 'name' | 'inviteCode' | 'goalDistance' | 'startDate' | 'endDate'> & {
    memberCount: number;
  };
  progress: TeamProgress;
  userRole: 'ADMIN' | 'MEMBER';
}

export interface TeamDetailsResponse {
  team: Team;
  progress: TeamProgress;
  members: {
    count: number;
    activeToday: number;
    activeThisWeek: number;
  };
  userMember: {
    role: 'ADMIN' | 'MEMBER';
    /** ISO 8601 date-time string in UTC when user joined the team */
    joinedAt: string;
  };
}

export interface JoinTeamRequest {
  inviteCode: string;
}

export interface JoinTeamResponse {
  team: Team;
  member: TeamMember;
}

export interface TeamMemberWithStats {
  user: {
    id: string;
    name: string;
    profilePictureUrl: string | null;
  };
  member: {
    role: 'ADMIN' | 'MEMBER';
    /** ISO 8601 date-time string in UTC when member joined the team */
    joinedAt: string;
  };
  stats: {
    totalDistance: number;
    activityCount: number;
    /** ISO 8601 date-time string in UTC of member's last activity, null if no activities */
    lastActivityAt: string | null;
  };
}

// ============================================
// Activity Types
// ============================================

export interface Activity {
  id: string;
  userId: string;
  distance: number;
  duration: number;
  pace: number;
  /** ISO 8601 date-time string in UTC when the activity occurred */
  timestamp: string;
  note: string | null;
  isPrivate: boolean;
  /** ISO 8601 date-time string in UTC when the record was created */
  createdAt: string;
}

export interface ActivityWithTeams extends Activity {
  teams: Array<{
    id: string;
    name: string;
  }>;
}

export interface CreateActivityRequest {
  teamIds: string[];
  distance: number;
  duration: number;
  /** ISO 8601 date-time string in UTC when the activity occurred */
  timestamp: string;
  note?: string;
  isPrivate: boolean;
}

export interface CreateActivityResponse {
  activity: Activity;
  teamUpdates: Array<{
    teamId: string;
    newTotalDistance: number;
    newPercentComplete: number;
  }>;
}

export interface UpdateActivityRequest {
  note?: string;
  isPrivate?: boolean;
}

export interface DeleteActivityResponse {
  deleted: boolean;
  teamUpdates: Array<{
    teamId: string;
    newTotalDistance: number;
    newPercentComplete: number;
  }>;
}

// ============================================
// Dashboard Types
// ============================================

export interface DashboardData {
  user: {
    id: string;
    name: string;
    profilePictureUrl: string | null;
    stats: {
      totalDistance: number;
      currentStreak: number;
      weeklyDistance: number;
    };
  };
  teams: Array<{
    team: {
      id: string;
      name: string;
      goalDistance: number;
    };
    progress: {
      totalDistance: number;
      percentComplete: number;
      rank: number;
    };
  }>;
  recentActivities: Array<{
    id: string;
    distance: number;
    /** ISO 8601 date-time string in UTC when the activity occurred */
    timestamp: string;
    teams: Array<{
      id: string;
      name: string;
    }>;
  }>;
  teamActivity: Array<{
    teamId: string;
    teamName: string;
    user: {
      id: string;
      name: string;
    };
    activity: {
      distance: number;
      timestamp: string;
    };
  }>;
}

// ============================================
// WebSocket Event Types
// ============================================

export interface WebSocketEvent<T = any> {
  event: string;
  data: T;
}

export interface ActivityCreatedEvent {
  user: {
    id: string;
    name: string;
  };
  activity: {
    distance: number;
    timestamp: string;
  };
  teamProgress: {
    totalDistance: number;
    percentComplete: number;
  };
}

export interface MemberJoinedEvent {
  user: {
    id: string;
    name: string;
  };
  /** ISO 8601 date-time string in UTC when user joined the team */
  joinedAt: string;
  memberCount: number;
}

export interface ProgressUpdatedEvent {
  totalDistance: number;
  percentComplete: number;
  currentSegmentIndex: number;
}

export interface GoalCompletedEvent {
  completedAt: string;
  finalDistance: number;
  topContributors: Array<{
    userId: string;
    name: string;
    distance: number;
  }>;
}

// ============================================
// Error Codes
// ============================================

export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TEAM_FULL = 'TEAM_FULL',
  ALREADY_MEMBER = 'ALREADY_MEMBER',
  INVALID_INVITE_CODE = 'INVALID_INVITE_CODE',
  RATE_LIMITED = 'RATE_LIMITED',
}

// ============================================
// API Client Interface
// ============================================

export interface MileQuestAPI {
  // Auth
  auth: {
    register(data: RegisterRequest): Promise<ApiResponse<RegisterResponse>>;
    login(data: LoginRequest): Promise<ApiResponse<LoginResponse>>;
    refresh(data: RefreshTokenRequest): Promise<ApiResponse<RefreshTokenResponse>>;
    logout(): Promise<ApiResponse<{}>>;
    verifyEmail(data: VerifyEmailRequest): Promise<ApiResponse<VerifyEmailResponse>>;
  };
  
  // User
  user: {
    getProfile(): Promise<ApiResponse<UserProfileResponse>>;
    updateProfile(data: UpdateProfileRequest): Promise<ApiResponse<{ user: UserProfile }>>;
  };
  
  // Teams
  teams: {
    create(data: CreateTeamRequest): Promise<ApiResponse<CreateTeamResponse>>;
    list(params?: { cursor?: string; limit?: number }): Promise<ApiResponse<PaginatedResponse<TeamListItem>>>;
    get(teamId: string): Promise<ApiResponse<TeamDetailsResponse>>;
    join(data: JoinTeamRequest): Promise<ApiResponse<JoinTeamResponse>>;
    getMembers(teamId: string, params?: { cursor?: string; limit?: number }): Promise<ApiResponse<PaginatedResponse<TeamMemberWithStats>>>;
  };
  
  // Activities
  activities: {
    create(data: CreateActivityRequest): Promise<ApiResponse<CreateActivityResponse>>;
    list(params?: {
      cursor?: string;
      limit?: number;
      teamId?: string;
      startDate?: string;
      endDate?: string;
    }): Promise<ApiResponse<PaginatedResponse<ActivityWithTeams>>>;
    update(activityId: string, data: UpdateActivityRequest): Promise<ApiResponse<{ activity: Activity }>>;
    delete(activityId: string): Promise<ApiResponse<DeleteActivityResponse>>;
  };
  
  // Dashboard
  dashboard: {
    get(): Promise<ApiResponse<DashboardData>>;
  };
}

// ============================================
// Utility Types
// ============================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type AsyncReturnType<T extends (...args: any) => Promise<any>> = 
  T extends (...args: any) => Promise<infer R> ? R : never;