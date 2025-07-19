'use client';

import { useState, useEffect } from 'react';
import { formatDistance } from '@/services/activity.service';
import { useRealtimeLeaderboard, LeaderboardEntry, LeaderboardUpdate } from '@/hooks/useRealtimeLeaderboard';
import { ConnectionStatus } from '@/components/ConnectionStatus';

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
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());

  const { isConnected, connectionState, error, refreshLeaderboard } = useRealtimeLeaderboard(teamId, {
    refreshInterval,
    enableLogging: false,
    onLeaderboardUpdate: (update: LeaderboardUpdate) => {
      handleLeaderboardUpdate(update);
    },
    onError: (error) => {
      console.error('Leaderboard real-time error:', error);
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
        </div>
      </div>
    );
  }

  return (
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
            onClick={refreshLeaderboard}
            className="text-xs text-gray-500 hover:text-gray-700 focus:outline-none"
            title="Refresh leaderboard"
          >
            🔄
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
  );
}