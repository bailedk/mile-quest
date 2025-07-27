/**
 * Optimized data fetching patterns and utilities
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

// Request deduplication and batching
class RequestBatcher {
  private static instance: RequestBatcher;
  private batchedRequests: Map<string, {
    requests: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void; }>;
    timeout: NodeJS.Timeout;
  }> = new Map();

  static getInstance(): RequestBatcher {
    if (!RequestBatcher.instance) {
      RequestBatcher.instance = new RequestBatcher();
    }
    return RequestBatcher.instance;
  }

  async batchRequest<T>(key: string, fetchFn: () => Promise<T>, batchDelay = 50): Promise<T> {
    return new Promise((resolve, reject) => {
      const existingBatch = this.batchedRequests.get(key);
      
      if (existingBatch) {
        // Add to existing batch
        existingBatch.requests.push({ resolve, reject });
      } else {
        // Create new batch
        const timeout = setTimeout(async () => {
          const batch = this.batchedRequests.get(key);
          if (!batch) return;
          
          this.batchedRequests.delete(key);
          
          try {
            const result = await fetchFn();
            batch.requests.forEach(req => req.resolve(result));
          } catch (error) {
            batch.requests.forEach(req => req.reject(error));
          }
        }, batchDelay);
        
        this.batchedRequests.set(key, {
          requests: [{ resolve, reject }],
          timeout,
        });
      }
    });
  }
}

// Optimized fetch with automatic retries and caching
export async function optimizedFetch<T>(
  url: string,
  options: RequestInit & {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    cache?: 'default' | 'no-cache' | 'reload' | 'force-cache' | 'only-if-cached';
  } = {}
): Promise<T> {
  const {
    timeout = 10000,
    retries = 2,
    retryDelay = 1000,
    headers = {},
    ...fetchOptions
  } = options;

  // Get auth token from localStorage if available
  let authHeaders = { ...headers };
  if (typeof window !== 'undefined') {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authData = JSON.parse(authStorage);
        if (authData?.state?.tokens?.accessToken) {
          authHeaders['Authorization'] = `Bearer ${authData.state.tokens.accessToken}`;
        }
      }
    } catch (error) {
      console.error('Failed to get auth token:', error);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: authHeaders,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (retries > 0 && error instanceof Error && !error.name.includes('AbortError')) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return optimizedFetch(url, { ...options, retries: retries - 1 });
    }

    throw error;
  }
}

// Query key factory for consistent caching
export const queryKeys = {
  all: ['mile-quest'] as const,
  users: () => [...queryKeys.all, 'users'] as const,
  user: (id: string) => [...queryKeys.users(), id] as const,
  userProfile: () => [...queryKeys.users(), 'profile'] as const,
  
  teams: () => [...queryKeys.all, 'teams'] as const,
  team: (id: string) => [...queryKeys.teams(), id] as const,
  teamMembers: (id: string) => [...queryKeys.team(id), 'members'] as const,
  teamActivities: (id: string) => [...queryKeys.team(id), 'activities'] as const,
  teamStats: (id: string) => [...queryKeys.team(id), 'stats'] as const,
  
  activities: () => [...queryKeys.all, 'activities'] as const,
  activity: (id: string) => [...queryKeys.activities(), id] as const,
  userActivities: (userId: string) => [...queryKeys.activities(), 'user', userId] as const,
  
  leaderboards: () => [...queryKeys.all, 'leaderboards'] as const,
  teamLeaderboard: (teamId: string) => [...queryKeys.leaderboards(), 'team', teamId] as const,
} as const;

// Optimized useQuery hook with performance defaults
export function useOptimizedQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> & {
    batch?: boolean;
    batchDelay?: number;
  } = {}
) {
  const { batch = false, batchDelay = 50, ...queryOptions } = options;
  
  const batcher = RequestBatcher.getInstance();
  
  const optimizedQueryFn = useCallback(async () => {
    const key = JSON.stringify(queryKey);
    
    if (batch) {
      return batcher.batchRequest(key, queryFn, batchDelay);
    }
    
    return queryFn();
  }, [queryKey, queryFn, batch, batchDelay, batcher]);

  return useQuery({
    queryKey,
    queryFn: optimizedQueryFn,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...queryOptions,
  });
}

// Prefetch utilities
export function usePrefetch() {
  const queryClient = useQueryClient();

  const prefetchQuery = useCallback(
    <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) => {
      queryClient.prefetchQuery({
        queryKey,
        queryFn,
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );

  const prefetchUserProfile = useCallback(() => {
    prefetchQuery(queryKeys.userProfile(), () =>
      optimizedFetch('/api/users/me')
    );
  }, [prefetchQuery]);

  const prefetchTeam = useCallback((teamId: string) => {
    prefetchQuery(queryKeys.team(teamId), () =>
      optimizedFetch(`/api/teams/${teamId}`)
    );
  }, [prefetchQuery]);

  const prefetchTeamActivities = useCallback((teamId: string) => {
    prefetchQuery(queryKeys.teamActivities(teamId), () =>
      optimizedFetch(`/api/teams/${teamId}/activities`)
    );
  }, [prefetchQuery]);

  return {
    prefetchQuery,
    prefetchUserProfile,
    prefetchTeam,
    prefetchTeamActivities,
  };
}

// Optimized mutation hook with automatic cache updates
export function useOptimizedMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
    invalidateQueries?: readonly unknown[][];
    updateQueries?: Array<{
      queryKey: readonly unknown[];
      updater: (oldData: any, newData: TData, variables: TVariables) => any;
    }>;
  } = {}
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      // Invalidate specified queries
      options.invalidateQueries?.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });

      // Update specific queries
      options.updateQueries?.forEach(({ queryKey, updater }) => {
        queryClient.setQueryData(queryKey, (oldData: any) => 
          updater(oldData, data, variables)
        );
      });

      options.onSuccess?.(data, variables);
    },
    onError: options.onError,
  });
}

// Infinite query optimization
export function useOptimizedInfiniteQuery<T>(
  queryKey: readonly unknown[],
  queryFn: ({ pageParam }: { pageParam: number }) => Promise<{
    data: T[];
    nextPage?: number;
    hasMore: boolean;
  }>,
  options: {
    initialPageParam?: number;
    getNextPageParam?: (lastPage: any) => number | undefined;
    pageSize?: number;
  } = {}
) {
  const { initialPageParam = 1, pageSize = 20 } = options;

  return useQuery({
    queryKey: [...queryKey, 'infinite'],
    queryFn: async () => {
      const results = [];
      let page = initialPageParam;
      let hasMore = true;

      while (hasMore && results.length < pageSize * 3) { // Load 3 pages initially
        const pageData = await queryFn({ pageParam: page });
        results.push(...pageData.data);
        hasMore = pageData.hasMore;
        page = pageData.nextPage || page + 1;
      }

      return {
        data: results,
        hasMore,
        nextPage: page,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for lists
    gcTime: 5 * 60 * 1000,
  });
}

// Data transformer utilities
export function createDataTransformer<TInput, TOutput>(
  transform: (input: TInput) => TOutput
) {
  const cache = new Map<string, TOutput>();

  return (input: TInput): TOutput => {
    const key = JSON.stringify(input);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = transform(input);
    cache.set(key, result);
    
    // Limit cache size
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  };
}

// Optimized data hooks for common entities
export const useUser = (userId?: string) => {
  return useOptimizedQuery(
    queryKeys.user(userId || 'current'),
    () => optimizedFetch(`/api/users/${userId || 'me'}`),
    {
      enabled: !!userId || typeof userId === 'undefined',
      staleTime: 10 * 60 * 1000, // User data changes less frequently
    }
  );
};

export const useTeam = (teamId: string, options: { prefetchActivities?: boolean } = {}) => {
  const { prefetchActivities = false } = options;
  const { prefetchTeamActivities } = usePrefetch();

  const query = useOptimizedQuery(
    queryKeys.team(teamId),
    () => optimizedFetch(`/api/teams/${teamId}`),
    {
      enabled: !!teamId,
      staleTime: 2 * 60 * 1000,
    }
  );

  // Prefetch activities if requested
  useMemo(() => {
    if (prefetchActivities && teamId && query.isSuccess) {
      prefetchTeamActivities(teamId);
    }
  }, [prefetchActivities, teamId, query.isSuccess, prefetchTeamActivities]);

  return query;
};

export const useTeamActivities = (teamId: string, options: { limit?: number } = {}) => {
  const { limit = 50 } = options;
  
  return useOptimizedQuery(
    [...queryKeys.teamActivities(teamId), limit],
    () => optimizedFetch(`/api/teams/${teamId}/activities?limit=${limit}`),
    {
      enabled: !!teamId,
      staleTime: 1 * 60 * 1000, // Activities change more frequently
    }
  );
};

export const useUserActivities = (userId?: string, options: { limit?: number } = {}) => {
  const { limit = 50 } = options;
  
  return useOptimizedQuery(
    [...queryKeys.userActivities(userId || 'current'), limit],
    () => optimizedFetch(`/api/users/${userId || 'current'}/activities?limit=${limit}`),
    {
      enabled: !!userId || typeof userId === 'undefined',
      staleTime: 1 * 60 * 1000,
    }
  );
};

// Background refresh utilities
export function useBackgroundRefresh(queryKeys: readonly unknown[][], interval = 30000) {
  const queryClient = useQueryClient();

  useMemo(() => {
    const intervalId = setInterval(() => {
      queryKeys.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });
    }, interval);

    return () => clearInterval(intervalId);
  }, [queryClient, queryKeys, interval]);
}