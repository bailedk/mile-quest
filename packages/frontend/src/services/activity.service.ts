/**
 * Activity Service for API calls
 */

import { apiClient } from './api-client';
import {
  Activity,
  ActivityCreateInput,
  ActivityUpdateInput,
  ActivityListItem,
  ActivityStats,
  ActivityFilters,
  TeamGoalProgress,
  ActivitySummaryItem,
} from '@/types/activity.types';
import { dashboardService } from './dashboard.service';


export const activityService = {
  /**
   * Create a new activity
   */
  async createActivity(data: {
    distance: number;
    duration: number;
    timestamp: string;
    notes?: string;
    isPrivate?: boolean;
  }): Promise<Activity> {
    const response = await apiClient.post<Activity>('/activities', data);
    
    // Clear dashboard cache after creating an activity
    // so the new activity appears immediately
    dashboardService.clearCache();
    
    return response.data;
  },

  /**
   * Get user's activities with optional filters
   */
  async getUserActivities(filters?: ActivityFilters): Promise<ActivityListItem[]> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    const queryString = params.toString();
    const url = `/users/me/activities${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<{ items: ActivityListItem[]; nextCursor: string | null; hasMore: boolean }>(url);
    return response.data.items || [];
  },

  /**
   * Get team activities
   */
  async getTeamActivities(teamId: string, filters?: ActivityFilters): Promise<ActivityListItem[]> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    const queryString = params.toString();
    const url = `/teams/${teamId}/activities${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<ActivityListItem[]>(url);
    return response.data;
  },

  /**
   * Get a single activity by ID
   */
  async getActivity(id: string): Promise<Activity> {
    const response = await apiClient.get<Activity>(`/activities/${id}`);
    return response.data;
  },

  /**
   * Update an activity
   */
  async updateActivity(id: string, data: ActivityUpdateInput): Promise<Activity> {
    const response = await apiClient.patch<Activity>(`/activities/${id}`, data);
    
    // Clear dashboard cache after updating an activity
    dashboardService.clearCache();
    
    return response.data;
  },

  /**
   * Delete an activity
   */
  async deleteActivity(id: string): Promise<void> {
    await apiClient.delete(`/activities/${id}`);
    
    // Clear dashboard cache after deleting an activity
    dashboardService.clearCache();
  },

  /**
   * Get user activity statistics
   */
  async getUserStats(): Promise<ActivityStats> {
    const response = await apiClient.get<ActivityStats>('/users/me/stats');
    return response.data;
  },

  /**
   * Get team activity statistics
   */
  async getTeamStats(teamId: string): Promise<ActivityStats> {
    const response = await apiClient.get<ActivityStats>(`/teams/${teamId}/stats`);
    return response.data;
  },

  /**
   * Get team progress towards a specific goal
   */
  async getTeamGoalProgress(teamId: string, goalId: string): Promise<TeamGoalProgress> {
    const response = await apiClient.get<TeamGoalProgress>(`/teams/${teamId}/goals/${goalId}/progress`);
    return response.data;
  },

  /**
   * Get activity summary by period for chart data
   */
  async getActivitySummary(options?: {
    period?: 'daily' | 'weekly' | 'monthly';
    startDate?: string;
    endDate?: string;
    teamId?: string;
    limit?: number;
  }): Promise<ActivitySummaryItem[]> {
    const params = new URLSearchParams();
    
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    const queryString = params.toString();
    const url = `/activities/summary${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<{ summaries: ActivitySummaryItem[] }>(url);
    return response.data.summaries;
  },
};

// Utility functions for activity data

/**
 * Convert meters to miles or kilometers based on user preference
 */
export function formatDistance(meters: number, unit: 'miles' | 'kilometers' = 'miles'): string {
  if (unit === 'miles') {
    const miles = meters * 0.000621371;
    return `${miles.toFixed(2)} mi`;
  } else {
    const km = meters / 1000;
    return `${km.toFixed(2)} km`;
  }
}

/**
 * Convert seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Calculate pace (min/mile or min/km)
 */
export function calculatePace(meters: number, seconds: number, unit: 'miles' | 'kilometers' = 'miles'): string {
  if (seconds === 0) return '0:00';
  
  const distance = unit === 'miles' ? meters * 0.000621371 : meters / 1000;
  const minutesPerUnit = seconds / 60 / distance;
  
  const paceMinutes = Math.floor(minutesPerUnit);
  const paceSeconds = Math.round((minutesPerUnit - paceMinutes) * 60);
  
  return `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`;
}

/**
 * Validate activity distance (in meters)
 */
export function validateDistance(meters: number): string | null {
  if (meters <= 0) {
    return 'Distance must be greater than 0';
  }
  if (meters > 100000) { // 100km
    return 'Distance seems too high. Please check your input.';
  }
  return null;
}

/**
 * Validate activity duration (in seconds)
 */
export function validateDuration(seconds: number): string | null {
  if (seconds <= 0) {
    return 'Duration must be greater than 0';
  }
  if (seconds > 86400) { // 24 hours
    return 'Duration cannot exceed 24 hours';
  }
  return null;
}