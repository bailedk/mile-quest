/**
 * React hook for managing dashboard data
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { dashboardService } from '@/services/dashboard.service';
import { DashboardData, DashboardError, DashboardState } from '@/types/dashboard';
import { useAuthStore } from '@/store/auth.store';

interface UseDashboardOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  onError?: (error: DashboardError) => void;
  onSuccess?: (data: DashboardData) => void;
}

export function useDashboard(options: UseDashboardOptions = {}) {
  const {
    autoRefresh = false,
    refreshInterval = 5 * 60 * 1000, // 5 minutes
    onError,
    onSuccess,
  } = options;

  const [state, setState] = useState<DashboardState>({
    data: null,
    isLoading: false,
    error: null,
    lastRefresh: null,
  });

  const { user, isAuthenticated } = useAuthStore();
  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load dashboard data
  const loadDashboard = useCallback(async (useCache = true) => {
    if (!isAuthenticated) {
      setState(prev => ({
        ...prev,
        data: null,
        isLoading: false,
        error: { message: 'Not authenticated', code: 'AUTH_ERROR' },
      }));
      return;
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const data = await dashboardService.getDashboardData({
        useCache,
        signal: abortControllerRef.current.signal,
      });

      setState(prev => ({
        ...prev,
        data,
        isLoading: false,
        error: null,
        lastRefresh: new Date(),
      }));

      onSuccess?.(data);
    } catch (error: any) {
      // Don't set error state if request was cancelled
      if (error.code !== 'CANCELLED') {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error as DashboardError,
        }));
        onError?.(error as DashboardError);
      }
    }
  }, [isAuthenticated, onError, onSuccess]);

  // Refresh dashboard data (bypass cache)
  const refresh = useCallback(async () => {
    return loadDashboard(false);
  }, [loadDashboard]);

  // Manual error clearing
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  // Setup auto-refresh
  useEffect(() => {
    if (autoRefresh && state.data && !state.isLoading) {
      refreshTimeoutRef.current = setTimeout(() => {
        loadDashboard(true);
      }, refreshInterval);
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, state.data, state.isLoading, loadDashboard]);

  // Initial load when component mounts or user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      loadDashboard(true);
    } else {
      // Clear data when user logs out
      setState({
        data: null,
        isLoading: false,
        error: null,
        lastRefresh: null,
      });
    }

    // Cleanup on unmount or user change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [isAuthenticated, user?.id, loadDashboard]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    lastRefresh: state.lastRefresh,
    
    // Computed states
    hasData: !!state.data,
    isEmpty: !state.isLoading && !state.error && !state.data,
    isStale: state.data && state.lastRefresh && 
             (Date.now() - state.lastRefresh.getTime()) > refreshInterval,
    
    // Actions
    refresh,
    clearError,
    retry: () => loadDashboard(false),
  };
}