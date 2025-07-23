'use client';

import { useState, useEffect } from 'react';
import { formatDistance } from '@/services/activity.service';
import { useRealtimeLeaderboard, LeaderboardEntry, LeaderboardUpdate } from '@/hooks/useRealtimeLeaderboard';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { GracefulFeature, NetworkAware } from '@/components/graceful/GracefulDegradation';
import { ErrorState, LoadingError, ListSkeleton } from '@/components/LoadingSpinner';
import { useErrorHandler } from '@/hooks/useErrorHandler';

interface RealtimeLeaderboardProps {
  initialEntries: LeaderboardEntry[];
  teamId: string | null;
  userPreferredUnits?: 'miles' | 'kilometers';
  showRankings?: boolean;
  showConnectionStatus?: boolean;
  maxEntries?: number;
  enableAnimation?: boolean;
  refreshInterval?: number;
}

export function RealtimeLeaderboard({
  initialEntries,
  teamId,
  userPreferredUnits = 'miles',
  showRankings = true,
  showConnectionStatus = false,
  maxEntries = 10,
  enableAnimation = true,
  refreshInterval = 30000, // 30 seconds
}: RealtimeLeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initialEntries);
  const [updatedEntries, setUpdatedEntries] = useState<Set<string>>(new Set());
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const errorHandler = useErrorHandler({
    enableRetry: true,
    maxRetries: 3,
    onError: (error) => {
      console.error('Leaderboard error:', error);
    }
  });

  const { isConnected, connectionState, error, refreshLeaderboard } = useRealtimeLeaderboard(teamId, {
    refreshInterval,
    enableLogging: false,
    onLeaderboardUpdate: (update: LeaderboardUpdate) => {
      handleLeaderboardUpdate(update);
    },
    onError: (error) => {
      errorHandler.handleError(error, 'RealtimeLeaderboard');
    },
  });

  const handleLeaderboardUpdate = (update: LeaderboardUpdate) => {
    setEntries(update.entries.slice(0, maxEntries));
    setLastUpdateTime(Date.now());

    // Highlight changed entries
    if (update.changedUserId && enableAnimation) {
      setUpdatedEntries(prev => new Set(prev).add(update.changedUserId!));
      
      // Clear highlight after animation
      setTimeout(() => {
        setUpdatedEntries(prev => {
          const newSet = new Set(prev);
          newSet.delete(update.changedUserId!);
          return newSet;
        });
      }, 2000);
    }
  };

  // Update entries when props change
  useEffect(() => {
    setEntries(initialEntries.slice(0, maxEntries));
  }, [initialEntries, maxEntries]);

  // Initialize time after hydration
  useEffect(() => {
    setLastUpdateTime(Date.now());
  }, []);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const getRankChangeIcon = (change?: 'up' | 'down' | 'same' | 'new') => {
    switch (change) {
      case 'up':
        return <span className="text-green-500 text-xs">↗</span>;
      case 'down':
        return <span className="text-red-500 text-xs">↘</span>;
      case 'new':
        return <span className="text-blue-500 text-xs">NEW</span>;
      case 'same':
      default:
        return null;
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await refreshLeaderboard();
      errorHandler.clearError();
    } catch (err) {
      errorHandler.handleError(err, 'LeaderboardRetry');
    } finally {
      setIsRetrying(false);
    }
  };

  // Show error state if there's a persistent error
  if (errorHandler.error && !errorHandler.canRetry && entries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <ErrorState
          title="Leaderboard Unavailable"
          message="Unable to load the leaderboard at the moment. Please try again later."
          icon="📊"
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
      <div className="bg-white rounded-lg shadow p-6">
        <LoadingError
          resource="leaderboard"
          onRetry={handleRetry}
        />
      </div>
    );
  }

  // Show skeleton while loading initially
  if (entries.length === 0 && errorHandler.isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Leaderboard</h3>
        </div>
        <ListSkeleton items={5} hasAvatar={false} />
      </div>
    );
  }

  // Show empty state
  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Leaderboard</h3>
          {showConnectionStatus && (
            <ConnectionStatus 
              connectionState={connectionState}
              error={error}
              size="sm"
              showText={!isConnected}
            />
          )}
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">No leaderboard data available yet.</p>
          <button
            onClick={handleRetry}
            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            disabled={isRetrying}
          >
            {isRetrying ? 'Loading...' : 'Load Leaderboard'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <NetworkAware
      offlineFallback={
        <div className="bg-white rounded-lg shadow p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <span className="text-yellow-600 mr-2">🌐</span>
              <div>
                <h4 className="text-sm font-medium text-yellow-800">You're offline</h4>
                <p className="text-sm text-yellow-700">Showing last known leaderboard data</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            {entries.map((entry, index) => (
              <div key={entry.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold">
                    {showRankings ? getRankIcon(entry.rank) : index + 1}
                  </div>
                  <span className="font-medium text-gray-700">{entry.userName}</span>
                </div>
                <span className="text-sm text-gray-600">
                  {formatDistance(entry.totalDistance, userPreferredUnits)}
                </span>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Leaderboard</h3>
          
          <div className="flex items-center space-x-2">
            {isConnected && (
              <span className="text-xs text-green-600 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                Live
              </span>
            )}
            
            {showConnectionStatus && (
              <ConnectionStatus 
                connectionState={connectionState}
                error={error}
                size="sm"
                showText={!isConnected}
              />
            )}
            
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="text-xs text-gray-500 hover:text-gray-700 focus:outline-none disabled:opacity-50"
              title="Refresh leaderboard"
            >
              {isRetrying ? '⏳' : '🔄'}
            </button>
          </div>
        </div>

      <div className="space-y-3">
        {entries.map((entry, index) => {
          const isUpdated = updatedEntries.has(entry.userId);
          const isTopThree = entry.rank <= 3;
          
          return (
            <div
              key={entry.userId}
              className={`
                flex items-center justify-between p-3 rounded-lg transition-all duration-300
                ${isUpdated && enableAnimation
                  ? 'bg-blue-50 border-l-4 border-blue-400 shadow-md scale-105'
                  : 'hover:bg-gray-50'
                }
                ${isTopThree ? 'bg-gradient-to-r from-yellow-50 to-yellow-100' : ''}
              `}
            >
              <div className="flex items-center space-x-3">
                {/* Rank */}
                <div className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                  ${isTopThree 
                    ? 'bg-yellow-200 text-yellow-800' 
                    : 'bg-gray-100 text-gray-600'
                  }
                `}>
                  {showRankings ? getRankIcon(entry.rank) : index + 1}
                </div>

                {/* User info */}
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-900">
                      {entry.userName}
                    </h4>
                    {getRankChangeIcon(entry.change)}
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>
                      {formatDistance(entry.totalDistance, userPreferredUnits)}
                    </span>
                    <span>
                      {entry.activityCount} activities
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress indicator for top entries */}
              {isTopThree && entries[0] && (
                <div className="w-20">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${(entry.totalDistance / entries[0].totalDistance) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer info */}
      <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
        <span>
          Last updated: {new Date(lastUpdateTime).toLocaleTimeString()}
        </span>
        
        {entries.length >= maxEntries && (
          <span>
            Showing top {maxEntries} members
          </span>
        )}
      </div>
    </div>
    </NetworkAware>
  );
}

// Enhanced version with graceful degradation wrapper
export function GracefulRealtimeLeaderboard(props: RealtimeLeaderboardProps) {
  return (
    <GracefulFeature
      feature="realtime-leaderboard"
      errorMessage="The live leaderboard feature is temporarily unavailable. You can still view basic team statistics."
      retryable={true}
      timeout={15000}
      fallback={
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Statistics</h3>
          <div className="space-y-3">
            {props.initialEntries.slice(0, props.maxEntries || 10).map((entry, index) => (
              <div key={entry.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold">
                    #{entry.rank}
                  </div>
                  <span className="font-medium text-gray-700">{entry.userName}</span>
                </div>
                <span className="text-sm text-gray-600">
                  {formatDistance(entry.totalDistance, props.userPreferredUnits || 'miles')}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">Refresh the page to try loading live updates</p>
          </div>
        </div>
      }
    >
      <RealtimeLeaderboard {...props} />
    </GracefulFeature>
  );
}