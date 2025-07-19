'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { formatDistance } from '@/services/activity.service';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { useLiveLeaderboard } from './useLiveLeaderboard';
import { LeaderboardEntry } from './LeaderboardEntry';
import { LeaderboardFilters, FilterOptions } from './LeaderboardFilters';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { ErrorState, LoadingError, ListSkeleton } from '@/components/LoadingSpinner';
import { useErrorHandler } from '@/hooks/useErrorHandler';

export interface LeaderboardMember {
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  totalDistance: number;
  totalDuration: number;
  activityCount: number;
  rank: number;
  change?: 'up' | 'down' | 'same' | 'new';
  goalProgress?: number; // percentage of goal completed
  recentActivity?: {
    timestamp: Date;
    distance: number;
    type: string;
  };
  isOnline?: boolean;
}

export interface LeaderboardData {
  team: LeaderboardMember[];
  individual: LeaderboardMember[];
  goals: Array<{
    goalId: string;
    goalName: string;
    members: LeaderboardMember[];
  }>;
  lastUpdated: Date;
}

export interface LiveLeaderboardProps {
  teamId: string | null;
  initialData?: LeaderboardData;
  view?: 'team' | 'individual' | 'goals';
  timePeriod?: 'daily' | 'weekly' | 'monthly' | 'all-time';
  maxEntries?: number;
  showFilters?: boolean;
  showConnectionStatus?: boolean;
  showRecentActivity?: boolean;
  showGoalProgress?: boolean;
  enableAnimations?: boolean;
  autoRefreshInterval?: number;
  userPreferredUnits?: 'miles' | 'kilometers';
  className?: string;
}

export function LiveLeaderboard({
  teamId,
  initialData,
  view = 'team',
  timePeriod = 'all-time',
  maxEntries = 10,
  showFilters = true,
  showConnectionStatus = true,
  showRecentActivity = true,
  showGoalProgress = true,
  enableAnimations = true,
  autoRefreshInterval = 30000,
  userPreferredUnits = 'miles',
  className = '',
}: LiveLeaderboardProps) {
  const [currentView, setCurrentView] = useState(view);
  const [currentTimePeriod, setCurrentTimePeriod] = useState(timePeriod);
  const [animatingMembers, setAnimatingMembers] = useState<Set<string>>(new Set());
  const [isStale, setIsStale] = useState(false);
  
  const { isConnected, connectionState } = useWebSocketContext();
  
  const errorHandler = useErrorHandler({
    enableRetry: true,
    maxRetries: 3,
  });

  const {
    data: leaderboardData,
    isLoading,
    error,
    lastUpdate,
    positionChanges,
    refreshLeaderboard,
    isRefreshing,
  } = useLiveLeaderboard(teamId, {
    view: currentView,
    timePeriod: currentTimePeriod,
    maxEntries,
    autoRefreshInterval,
    onPositionChange: (userId: string) => {
      if (enableAnimations) {
        setAnimatingMembers(prev => new Set(prev).add(userId));
        setTimeout(() => {
          setAnimatingMembers(prev => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
          });
        }, 2000);
      }
    },
    onError: (err) => {
      errorHandler.handleError(err, 'LiveLeaderboard');
    },
  });

  // Check if data is stale
  useEffect(() => {
    if (!lastUpdate) return;
    
    const staleThreshold = autoRefreshInterval * 2;
    const checkStale = () => {
      const timeSinceUpdate = Date.now() - lastUpdate.getTime();
      setIsStale(timeSinceUpdate > staleThreshold);
    };
    
    checkStale();
    const interval = setInterval(checkStale, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [lastUpdate, autoRefreshInterval]);

  // Get current leaderboard based on view
  const currentLeaderboard = useMemo(() => {
    if (!leaderboardData) return [];
    
    switch (currentView) {
      case 'individual':
        return leaderboardData.individual || [];
      case 'goals':
        // For goals view, flatten all goal members into one list
        return leaderboardData.goals?.flatMap(goal => 
          goal.members.map(member => ({
            ...member,
            goalName: goal.goalName,
          }))
        ) || [];
      case 'team':
      default:
        return leaderboardData.team || [];
    }
  }, [leaderboardData, currentView]);

  const handleFilterChange = (filters: FilterOptions) => {
    setCurrentView(filters.view);
    setCurrentTimePeriod(filters.timePeriod);
  };

  const handleRetry = async () => {
    try {
      await refreshLeaderboard();
      errorHandler.clearError();
    } catch (err) {
      errorHandler.handleError(err, 'LeaderboardRetry');
    }
  };

  // Show error state for persistent errors
  if (errorHandler.error && !errorHandler.canRetry && currentLeaderboard.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <ErrorState
          title="Leaderboard Unavailable"
          message="Unable to load the leaderboard at the moment. Please try again later."
          icon="🏆"
          action={{
            label: 'Reload',
            onClick: () => window.location.reload()
          }}
        />
      </div>
    );
  }

  // Show loading error with retry option
  if (errorHandler.error && errorHandler.canRetry) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <LoadingError
          resource="leaderboard"
          onRetry={handleRetry}
        />
      </div>
    );
  }

  // Show skeleton while loading initially
  if (isLoading && currentLeaderboard.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Leaderboard</h3>
          {showFilters && <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />}
        </div>
        <ListSkeleton items={maxEntries} hasAvatar={true} />
      </div>
    );
  }

  const getViewTitle = () => {
    switch (currentView) {
      case 'individual':
        return 'Individual Rankings';
      case 'goals':
        return 'Goal Progress';
      case 'team':
      default:
        return 'Team Leaderboard';
    }
  };

  const getTimePeriodLabel = () => {
    switch (currentTimePeriod) {
      case 'daily':
        return 'Today';
      case 'weekly':
        return 'This Week';
      case 'monthly':
        return 'This Month';
      case 'all-time':
      default:
        return 'All Time';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {getViewTitle()}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {getTimePeriodLabel()} • {currentLeaderboard.length} members
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Live indicator */}
            {isConnected && !isStale && (
              <span className="text-xs text-green-600 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                Live
              </span>
            )}
            
            {/* Stale indicator */}
            {isStale && (
              <span className="text-xs text-yellow-600 flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>
                Stale
              </span>
            )}
            
            {/* Connection status */}
            {showConnectionStatus && (
              <ConnectionStatus 
                connectionState={connectionState}
                error={error}
                size="sm"
                showText={!isConnected}
              />
            )}
            
            {/* Refresh button */}
            <button
              onClick={handleRetry}
              disabled={isRefreshing}
              className="text-xs text-gray-500 hover:text-gray-700 focus:outline-none disabled:opacity-50 transition-colors"
              title="Refresh leaderboard"
            >
              {isRefreshing ? (
                <span className="animate-spin">⟳</span>
              ) : (
                '🔄'
              )}
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <LeaderboardFilters
            currentView={currentView}
            currentTimePeriod={currentTimePeriod}
            onChange={handleFilterChange}
            disabled={isLoading}
          />
        )}
      </div>

      {/* Leaderboard content */}
      <div className="p-6">
        {currentLeaderboard.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🏆</div>
            <p className="text-gray-500 mb-4">
              No leaderboard data available for {getTimePeriodLabel().toLowerCase()}.
            </p>
            <button
              onClick={handleRetry}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {currentLeaderboard.slice(0, maxEntries).map((member, index) => (
              <LeaderboardEntry
                key={member.userId}
                member={member}
                position={index + 1}
                isAnimating={animatingMembers.has(member.userId)}
                showRecentActivity={showRecentActivity}
                showGoalProgress={showGoalProgress}
                userPreferredUnits={userPreferredUnits}
                enableAnimations={enableAnimations}
                viewType={currentView}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        {currentLeaderboard.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                {lastUpdate ? (
                  `Last updated: ${lastUpdate.toLocaleTimeString()}`
                ) : (
                  'Loading...'
                )}
              </span>
              
              {currentLeaderboard.length >= maxEntries && (
                <span>
                  Showing top {maxEntries} of {currentLeaderboard.length}
                </span>
              )}
            </div>
            
            {/* Position changes summary */}
            {positionChanges.length > 0 && (
              <div className="mt-2 text-xs text-gray-600">
                <span className="font-medium">Recent changes:</span>
                {positionChanges.slice(0, 3).map((change, idx) => (
                  <span key={idx} className="ml-2">
                    {change.userName} 
                    {change.direction === 'up' && ' ↗'}
                    {change.direction === 'down' && ' ↘'}
                  </span>
                ))}
                {positionChanges.length > 3 && (
                  <span className="ml-2">+{positionChanges.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Export with default props for common usage scenarios
export function TeamLeaderboard(props: Omit<LiveLeaderboardProps, 'view'>) {
  return <LiveLeaderboard {...props} view="team" />;
}

export function IndividualLeaderboard(props: Omit<LiveLeaderboardProps, 'view'>) {
  return <LiveLeaderboard {...props} view="individual" />;
}

export function GoalLeaderboard(props: Omit<LiveLeaderboardProps, 'view'>) {
  return <LiveLeaderboard {...props} view="goals" />;
}