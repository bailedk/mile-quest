/**
 * Goal service types and interfaces
 */

import { Position, Route, Waypoint } from '../map/types';

// Validation constants
export const GOAL_VALIDATION = {
  MIN_WAYPOINTS: 2, // Start + End minimum (always required)
  MIN_INTERMEDIATE_WAYPOINTS: 0, // Minimum intermediate waypoints (between start/end)
  MAX_WAYPOINTS: 10, // Maximum allowed waypoints (including start/end)
  MAX_DISTANCE_KM: 50000, // Maximum reasonable distance in kilometers
  MIN_COORDINATE: -180,
  MAX_COORDINATE: 180,
  MIN_LATITUDE: -90,
  MAX_LATITUDE: 90,
} as const;

export interface CreateGoalInput {
  name: string;
  description?: string;
  startLocation: Position & { address?: string };
  endLocation: Position & { address?: string };
  waypoints?: Waypoint[];
  startDate?: Date;
  targetDate?: Date;
  // Status is always ACTIVE when creating
}

export interface UpdateGoalInput {
  name?: string;
  description?: string;
  startLocation?: Position & { address?: string };
  endLocation?: Position & { address?: string };
  waypoints?: Waypoint[];
  targetDate?: Date;
  status?: 'ACTIVE' | 'PASSED' | 'FAILED';
}

export interface GoalProgressInfo {
  goalId: string;
  teamId: string;
  goalName: string;
  description?: string;
  startLocation: Position & { address?: string };
  endLocation: Position & { address?: string };
  waypoints: Waypoint[];
  totalDistance: number; // meters
  targetDate?: Date;
  status: string;
  
  // Progress tracking
  teamTotalDistance: number; // meters
  progressPercentage: number; // 0-100
  currentSegmentIndex: number;
  segmentProgress: number; // 0-1
  
  // Additional metadata
  totalActivities: number;
  totalDuration: number; // seconds
  lastActivityAt?: Date;
  
  // Route visualization data
  routePolyline: string;
  routeBounds?: {
    southwest: Position;
    northeast: Position;
  };
}

export interface GoalWithProgress {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  targetDistance: number;
  targetDate?: Date;
  startLocation: Position & { address?: string };
  endLocation: Position & { address?: string };
  waypoints: Waypoint[];
  routePolyline: string;
  routeData: any;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  progress?: {
    totalDistance: number;
    totalActivities: number;
    totalDuration: number;
    currentSegmentIndex: number;
    segmentProgress: number;
    lastActivityAt?: Date;
    progressPercentage: number;
  };
}

export interface RouteCalculationResult {
  route: Route;
  totalDistance: number;
  encodedPolyline: string;
  waypoints: Waypoint[];
}

// Goal service specific errors
export class GoalServiceError extends Error {
  constructor(
    message: string,
    public code: GoalErrorCode,
    public details?: any
  ) {
    super(message);
    this.name = 'GoalServiceError';
  }
}

export enum GoalErrorCode {
  // Validation errors
  INVALID_NAME = 'INVALID_NAME',
  INVALID_COORDINATES = 'INVALID_COORDINATES',
  INVALID_WAYPOINT_COUNT = 'INVALID_WAYPOINT_COUNT',
  TOO_FEW_WAYPOINTS = 'TOO_FEW_WAYPOINTS',
  TOO_MANY_WAYPOINTS = 'TOO_MANY_WAYPOINTS',
  DISTANCE_TOO_LONG = 'DISTANCE_TOO_LONG',
  INVALID_TARGET_DATE = 'INVALID_TARGET_DATE',
  INVALID_STATUS = 'INVALID_STATUS',
  DUPLICATE_WAYPOINT = 'DUPLICATE_WAYPOINT',
  
  // Permission errors
  TEAM_NOT_FOUND = 'TEAM_NOT_FOUND',
  USER_NOT_MEMBER = 'USER_NOT_MEMBER',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Goal state errors
  GOAL_NOT_FOUND = 'GOAL_NOT_FOUND',
  GOAL_ALREADY_ACTIVE = 'GOAL_ALREADY_ACTIVE',
  GOAL_COMPLETED = 'GOAL_COMPLETED',
  TEAM_HAS_ACTIVE_GOAL = 'TEAM_HAS_ACTIVE_GOAL',
  
  // Route calculation errors
  ROUTE_CALCULATION_FAILED = 'ROUTE_CALCULATION_FAILED',
  NO_ROUTE_FOUND = 'NO_ROUTE_FOUND',
  
  // Other errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}