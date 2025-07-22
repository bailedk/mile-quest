// Shared types for Mile Quest
import { z } from 'zod';

// Database enums
export const TeamRole = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;

export const GoalStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const ActivitySource = {
  MANUAL: 'MANUAL',
  STRAVA: 'STRAVA',
  APPLE_HEALTH: 'APPLE_HEALTH',
  GOOGLE_FIT: 'GOOGLE_FIT',
} as const;

export const InviteStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
} as const;

export const AchievementCategory = {
  DISTANCE: 'DISTANCE',
  STREAK: 'STREAK',
  SPEED: 'SPEED',
  TEAM: 'TEAM',
  SPECIAL: 'SPECIAL',
} as const;

// Zod schemas for validation
export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  cognitoId: z.string(),
});

export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(true),
  maxMembers: z.number().int().min(2).max(100).default(50),
});

export const CreateActivitySchema = z.object({
  teamId: z.string().uuid(),
  teamGoalId: z.string().uuid().optional(),
  distance: z.number().positive(),
  duration: z.number().int().positive(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  notes: z.string().max(500).optional(),
  source: z.enum(['MANUAL', 'STRAVA', 'APPLE_HEALTH', 'GOOGLE_FIT']).default('MANUAL'),
  isPrivate: z.boolean().default(false),
});

export const CreateTeamGoalSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  targetDate: z.string().datetime().optional(),
  waypoints: z.array(z.object({
    name: z.string(),
    address: z.string(),
    coordinates: z.object({
      lat: z.number(),
      lng: z.number(),
    }),
    order: z.number(),
  })),
  routeData: z.object({
    waypoints: z.array(z.object({
      name: z.string(),
      address: z.string(),
      coordinates: z.object({
        lat: z.number(),
        lng: z.number(),
      }),
      order: z.number(),
    })),
    segments: z.array(z.object({
      from: z.number(),
      to: z.number(),
      distance: z.number(),
      duration: z.number().optional(),
    })),
    geometry: z.any().optional(),
    totalDistance: z.number().optional(),
    totalDuration: z.number().optional(),
  }),
});

// API Response types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Route data types
export interface Waypoint {
  name: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  order: number;
}

export interface RouteSegment {
  from: number; // waypoint index
  to: number;   // waypoint index
  distance: number; // miles
  duration?: number; // seconds
}

export interface RouteData {
  waypoints: Waypoint[];
  segments: RouteSegment[];
  geometry?: any; // GeoJSON LineString
  totalDistance?: number;
  totalDuration?: number;
}

// TeamGoal type
export interface TeamGoal {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  targetDate?: string;
  status: typeof GoalStatus[keyof typeof GoalStatus];
  waypoints: Waypoint[];
  routeData: RouteData;
  totalDistance: number;
  currentDistance: number;
  createdAt: string;
  updatedAt: string;
}

// Statistics types
export interface UserStatsData {
  totalDistance: number;
  totalActivities: number;
  totalDuration: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityAt?: Date;
}

export interface TeamProgressData {
  totalDistance: number;
  totalActivities: number;
  totalDuration: number;
  currentSegmentIndex: number;
  segmentProgress: number;
  lastActivityAt?: Date;
}

// Leaderboard types
export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl?: string;
  totalDistance: number;
  activityCount: number;
  rank: number;
}

// Dashboard types
export interface DashboardData {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    stats: UserStatsData;
  };
  teams: Array<{
    id: string;
    name: string;
    memberCount: number;
    currentGoal?: {
      id: string;
      name: string;
      targetDistance: number;
      progress: TeamProgressData;
    };
  }>;
  recentActivities: Array<{
    id: string;
    distance: number;
    duration: number;
    startTime: Date;
    teamName: string;
  }>;
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    iconUrl: string;
    earnedAt: Date;
  }>;
}

// Error types
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Authentication types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
  preferredUnits?: 'miles' | 'kilometers';
  timezone?: string;
  createdAt: string;
  updatedAt: string;
}

// Auth request/response schemas
export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100),
  preferredUnits: z.enum(['miles', 'kilometers']).optional().default('miles'),
  timezone: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const VerifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const ResetPasswordSchema = z.object({
  email: z.string().email(),
});

export const ConfirmPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string(),
  newPassword: z.string().min(8).max(100),
});

// Auth response types
export interface RegisterResponse {
  user: AuthUser;
  message: string;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface RefreshResponse {
  tokens: AuthTokens;
}

export interface LogoutResponse {
  message: string;
}

export interface VerifyEmailResponse {
  message: string;
}

// Type exports for Prisma generated types (when available)
// export type { User, Team, Activity, TeamGoal } from '@prisma/client';