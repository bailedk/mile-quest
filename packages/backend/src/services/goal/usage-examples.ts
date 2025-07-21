/**
 * Goal Service Usage Examples
 * 
 * This file demonstrates how to use the enhanced goal service with waypoint support,
 * validation, and error handling.
 */

import { GoalService } from './goal.service';
import { CreateGoalInput, GoalServiceError, GoalErrorCode } from './types';

// Example 1: Create a simple goal (start and end only)
const simpleGoalInput: CreateGoalInput = {
  name: 'Walk to Central Park',
  description: 'A nice walk from Times Square to Central Park',
  startLocation: {
    lat: 40.7580,
    lng: -73.9855,
    address: 'Times Square, New York, NY',
  },
  endLocation: {
    lat: 40.7829,
    lng: -73.9654,
    address: 'Central Park, New York, NY',
  },
  targetDate: new Date('2024-12-31'),
  status: 'DRAFT', // Optional, defaults to DRAFT
};

// Example 2: Create a goal with multiple waypoints
const multiStopGoalInput: CreateGoalInput = {
  name: 'NYC Tourist Route',
  description: 'Visit major NYC landmarks',
  startLocation: {
    lat: 40.7580,
    lng: -73.9855,
    address: 'Times Square, NYC',
  },
  endLocation: {
    lat: 40.6892,
    lng: -74.0445,
    address: 'Statue of Liberty',
  },
  waypoints: [
    {
      id: 'empire-state',
      position: { lat: 40.7484, lng: -73.9857 },
      address: 'Empire State Building',
      order: 1,
      isLocked: true, // This waypoint cannot be reordered
    },
    {
      id: 'brooklyn-bridge',
      position: { lat: 40.7061, lng: -74.0087 },
      address: 'Brooklyn Bridge',
      order: 2,
      isLocked: false, // This waypoint can be reordered by route optimization
    },
    {
      id: 'wall-street',
      position: { lat: 40.7074, lng: -74.0113 },
      address: 'Wall Street',
      order: 3,
    },
  ],
  targetDate: new Date('2024-12-31'),
  status: 'ACTIVE', // Create as active immediately
};

// Example 3: Error handling
async function createGoalWithErrorHandling(
  goalService: GoalService,
  teamId: string,
  userId: string,
  input: CreateGoalInput
) {
  try {
    const goal = await goalService.createTeamGoal(teamId, userId, input);
    console.log('Goal created successfully:', goal.id);
    return goal;
  } catch (error) {
    if (error instanceof GoalServiceError) {
      switch (error.code) {
        case GoalErrorCode.INVALID_NAME:
          console.error('Invalid goal name:', error.message);
          break;
        case GoalErrorCode.INVALID_COORDINATES:
          console.error('Invalid coordinates:', error.message, error.details);
          break;
        case GoalErrorCode.INVALID_WAYPOINT_COUNT:
          console.error('Too many waypoints:', error.message, error.details);
          break;
        case GoalErrorCode.DUPLICATE_WAYPOINT:
          console.error('Duplicate waypoint found:', error.message, error.details);
          break;
        case GoalErrorCode.DISTANCE_TOO_LONG:
          console.error('Route is too long:', error.message, error.details);
          break;
        case GoalErrorCode.INVALID_TARGET_DATE:
          console.error('Invalid target date:', error.message, error.details);
          break;
        case GoalErrorCode.NO_ROUTE_FOUND:
          console.error('No route found between locations:', error.message);
          break;
        case GoalErrorCode.USER_NOT_MEMBER:
          console.error('User is not a member of the team:', error.message);
          break;
        default:
          console.error('Goal creation failed:', error.message);
      }
    } else {
      console.error('Unexpected error:', error);
    }
    throw error;
  }
}

// Example 4: Update goal with new waypoints
const updateGoalInput = {
  name: 'Updated NYC Tour',
  waypoints: [
    {
      id: 'central-park',
      position: { lat: 40.7829, lng: -73.9654 },
      address: 'Central Park',
      order: 1,
    },
    {
      id: 'met-museum',
      position: { lat: 40.7794, lng: -73.9632 },
      address: 'Metropolitan Museum of Art',
      order: 2,
    },
  ],
  status: 'ACTIVE' as const, // Activate a draft goal
};

// Example 5: Validation limits
const validationExamples = {
  // Maximum 10 waypoints total (including start and end)
  maxWaypoints: 8, // 8 intermediate waypoints + start + end = 10 total
  
  // Maximum distance: 50,000 km
  maxDistanceKm: 50000,
  
  // Valid coordinate ranges
  validLatitude: { min: -90, max: 90 },
  validLongitude: { min: -180, max: 180 },
  
  // Goal name requirements
  nameRequirements: {
    minLength: 1,
    mustNotBeEmpty: true,
    trimmed: true, // Leading/trailing spaces are removed
  },
};

// Example 6: Working with goal progress
async function checkGoalProgress(
  goalService: GoalService,
  goalId: string,
  userId: string
) {
  try {
    const progress = await goalService.getGoalProgress(goalId, userId);
    
    console.log(`Goal: ${progress.goalName}`);
    console.log(`Progress: ${progress.progressPercentage.toFixed(1)}%`);
    console.log(`Distance covered: ${(progress.teamTotalDistance / 1000).toFixed(1)} km`);
    console.log(`Total distance: ${(progress.totalDistance / 1000).toFixed(1)} km`);
    
    if (progress.currentSegmentIndex !== undefined && progress.waypoints.length > 0) {
      const currentWaypoint = progress.waypoints[progress.currentSegmentIndex];
      console.log(`Currently heading to: ${currentWaypoint.address || 'Waypoint ' + (progress.currentSegmentIndex + 1)}`);
      console.log(`Segment progress: ${(progress.segmentProgress * 100).toFixed(1)}%`);
    }
    
    return progress;
  } catch (error) {
    if (error instanceof GoalServiceError && error.code === GoalErrorCode.GOAL_NOT_FOUND) {
      console.error('Goal not found or access denied');
    }
    throw error;
  }
}