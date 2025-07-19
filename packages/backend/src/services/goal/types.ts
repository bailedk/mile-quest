/**
 * Goal service types and interfaces
 */

import { Position, Route, Waypoint } from '../map/types';

export interface CreateGoalInput {
  name: string;
  description?: string;
  startLocation: Position & { address?: string };
  endLocation: Position & { address?: string };
  waypoints?: Waypoint[];
  targetDate?: Date;
}

export interface UpdateGoalInput {
  name?: string;
  description?: string;
  startLocation?: Position & { address?: string };
  endLocation?: Position & { address?: string };
  waypoints?: Waypoint[];
  targetDate?: Date;
  status?: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
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