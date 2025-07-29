/**
 * Dashboard service for fetching dashboard data from API
 */

import { apiClient } from './api-client';
import { 
  DashboardResponse, 
  DashboardData, 
  DashboardError 
} from '@/types/dashboard';

export class DashboardService {
  private static instance: DashboardService;
  private cache: DashboardData | null = null;
  private cacheExpiry: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  /**
   * Get dashboard data with caching
   */
  async getDashboardData(options: { 
    useCache?: boolean; 
    signal?: AbortSignal 
  } = {}): Promise<DashboardData> {
    const { useCache = true } = options;

    // Check cache first
    if (useCache && this.cache && this.cacheExpiry && new Date() < this.cacheExpiry) {
      return this.cache;
    }

    try {
      console.log('Fetching dashboard data...');
      const response = await apiClient.get<DashboardResponse>('/dashboard');
      console.log('Dashboard API response:', response);
      
      // Check if response data exists
      if (!response || !response.data) {
        console.error('Invalid dashboard response:', response);
        throw new Error('No data received from dashboard API');
      }
      
      // Parse dates from string format with null checks
      const parsedData: DashboardData = {
        teams: (response.data.teams || []).map(team => ({
          ...team,
          progress: team.progress ? {
            ...team.progress,
            startDate: team.progress.startDate ? new Date(team.progress.startDate) : null,
            endDate: team.progress.endDate ? new Date(team.progress.endDate) : null,
          } : null,
        })),
        recentActivities: (response.data.recentActivities || []).map(activity => ({
          ...activity,
          timestamp: new Date(activity.timestamp),
        })),
        personalStats: response.data.personalStats ? {
          ...response.data.personalStats,
          bestDay: {
            ...response.data.personalStats.bestDay,
            date: response.data.personalStats.bestDay.date 
              ? new Date(response.data.personalStats.bestDay.date) 
              : null,
          },
        } : {
          totalDistance: 0,
          totalActivities: 0,
          currentStreak: 0,
          bestDay: { date: null, distance: 0 },
          thisWeek: { distance: 0, activities: 0 },
          thisMonth: { distance: 0, activities: 0 },
        },
        teamLeaderboards: response.data.teamLeaderboards || [],
        lastUpdated: new Date(),
      };

      // Update cache
      this.cache = parsedData;
      this.cacheExpiry = new Date(Date.now() + this.CACHE_DURATION);

      return parsedData;
    } catch (error) {
      console.error('Dashboard service error:', error);
      
      // If we have cached data and the request fails, return cached data
      if (this.cache) {
        console.warn('Using cached dashboard data due to API error');
        return this.cache;
      }
      
      throw this.handleError(error);
    }
  }

  /**
   * Refresh dashboard data (bypass cache)
   */
  async refreshDashboardData(signal?: AbortSignal): Promise<DashboardData> {
    this.clearCache();
    return this.getDashboardData({ useCache: false, signal });
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache = null;
    this.cacheExpiry = null;
  }

  /**
   * Get cached data if available
   */
  getCachedData(): DashboardData | null {
    if (this.cache && this.cacheExpiry && new Date() < this.cacheExpiry) {
      return this.cache;
    }
    return null;
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(): boolean {
    return this.cache !== null && 
           this.cacheExpiry !== null && 
           new Date() < this.cacheExpiry;
  }

  /**
   * Handle and format errors
   */
  private handleError(error: unknown): DashboardError {
    // Type guard to check if error has properties we need
    const isErrorWithName = (err: unknown): err is { name: string } => 
      typeof err === 'object' && err !== null && 'name' in err;
      
    const isErrorWithMessage = (err: unknown): err is { message: string } => 
      typeof err === 'object' && err !== null && 'message' in err;
      
    const isErrorWithDetails = (err: unknown): err is { details: string } => 
      typeof err === 'object' && err !== null && 'details' in err;

    if (isErrorWithName(error) && error.name === 'AbortError') {
      return {
        message: 'Request was cancelled',
        code: 'CANCELLED',
      };
    }

    const message = isErrorWithMessage(error) ? error.message : 'An unexpected error occurred';

    if (message.includes('fetch')) {
      return {
        message: 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR',
      };
    }

    if (message.includes('401') || message.includes('unauthorized')) {
      return {
        message: 'Authentication error. Please sign in again.',
        code: 'AUTH_ERROR',
      };
    }

    if (message.includes('500')) {
      return {
        message: 'Server error. Please try again later.',
        code: 'SERVER_ERROR',
      };
    }

    return {
      message,
      code: 'UNKNOWN_ERROR',
      details: isErrorWithDetails(error) ? error.details : String(error),
    };
  }
}

// Export singleton instance
export const dashboardService = DashboardService.getInstance();