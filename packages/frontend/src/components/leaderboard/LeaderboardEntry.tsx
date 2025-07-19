'use client';

import React from 'react';
import { formatDistance } from '@/services/activity.service';
import { LeaderboardMember } from './LiveLeaderboard';

interface LeaderboardEntryProps {
  member: LeaderboardMember;
  position: number;
  isAnimating?: boolean;
  showRecentActivity?: boolean;
  showGoalProgress?: boolean;
  userPreferredUnits?: 'miles' | 'kilometers';
  enableAnimations?: boolean;
  viewType?: 'team' | 'individual' | 'goals';
}

export function LeaderboardEntry({
  member,
  position,
  isAnimating = false,
  showRecentActivity = true,
  showGoalProgress = true,
  userPreferredUnits = 'miles',
  enableAnimations = true,
  viewType = 'team',
}: LeaderboardEntryProps) {
  
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-bold text-sm shadow-lg">
            👑
          </div>
        );
      case 2:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-gray-300 to-gray-500 text-white font-bold text-sm shadow-lg">
            🥈
          </div>
        );
      case 3:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 text-white font-bold text-sm shadow-lg">
            🥉
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold text-sm">
            #{rank}
          </div>
        );
    }
  };

  const getRankChangeIcon = (change?: 'up' | 'down' | 'same' | 'new') => {
    switch (change) {
      case 'up':
        return (
          <span className="text-green-500 text-xs flex items-center" title="Moved up">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04L10.75 5.612V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
            </svg>
            ↗
          </span>
        );
      case 'down':
        return (
          <span className="text-red-500 text-xs flex items-center" title="Moved down">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04L9.25 14.388V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
            </svg>
            ↘
          </span>
        );
      case 'new':
        return (
          <span className="text-blue-500 text-xs font-semibold px-1 py-0.5 bg-blue-100 rounded" title="New entry">
            NEW
          </span>
        );
      case 'same':
      default:
        return null;
    }
  };

  const getUserAvatar = () => {
    if (member.avatarUrl) {
      return (
        <img
          src={member.avatarUrl}
          alt={`${member.userName} avatar`}
          className="w-10 h-10 rounded-full object-cover bg-gray-200"
          onError={(e) => {
            // Fallback to initials if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
      );
    }
    
    // Generate initials from username
    const initials = member.userName
      .split(' ')
      .map(name => name.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
    
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
        {initials}
      </div>
    );
  };

  const getProgressBar = () => {
    if (!showGoalProgress || typeof member.goalProgress !== 'number') {
      return null;
    }

    return (
      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
        <div
          className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(member.goalProgress, 100)}%` }}
        />
      </div>
    );
  };

  const getRecentActivityBadge = () => {
    if (!showRecentActivity || !member.recentActivity) {
      return null;
    }

    const { timestamp, distance, type } = member.recentActivity;
    const timeDiff = Date.now() - timestamp.getTime();
    const isRecent = timeDiff < 60 * 60 * 1000; // Within last hour

    if (!isRecent) return null;

    return (
      <div className="flex items-center text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1 animate-pulse"></span>
        <span>
          {formatDistance(distance, userPreferredUnits)} {type} • {Math.round(timeDiff / 60000)}m ago
        </span>
      </div>
    );
  };

  const isTopThree = position <= 3;
  const baseClasses = "flex items-center p-4 rounded-lg transition-all duration-300";
  const animationClasses = isAnimating && enableAnimations
    ? "bg-blue-50 border-l-4 border-blue-400 shadow-lg scale-[1.02] transform"
    : "hover:bg-gray-50";
  const topThreeClasses = isTopThree 
    ? "bg-gradient-to-r from-yellow-50 via-yellow-50 to-transparent border border-yellow-200" 
    : "";

  return (
    <div className={`${baseClasses} ${animationClasses} ${topThreeClasses}`}>
      {/* Rank and Avatar */}
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        {/* Rank */}
        {getRankIcon(position)}

        {/* Avatar */}
        <div className="relative">
          {getUserAvatar()}
          {/* Online indicator */}
          {member.isOnline && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
          )}
        </div>

        {/* User Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h4 className="font-semibold text-gray-900 truncate">
              {member.userName}
            </h4>
            {getRankChangeIcon(member.change)}
          </div>
          
          {/* Stats */}
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span className="font-medium">
              {formatDistance(member.totalDistance, userPreferredUnits)}
            </span>
            <span>
              {member.activityCount} activities
            </span>
            {member.totalDuration > 0 && (
              <span>
                {Math.round(member.totalDuration / 60)}min
              </span>
            )}
            {viewType === 'goals' && (member as any).goalName && (
              <span className="text-blue-600 font-medium">
                {(member as any).goalName}
              </span>
            )}
          </div>

          {/* Goal Progress */}
          {showGoalProgress && typeof member.goalProgress === 'number' && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Goal Progress</span>
                <span>{member.goalProgress.toFixed(1)}%</span>
              </div>
              {getProgressBar()}
            </div>
          )}

          {/* Recent Activity Badge */}
          <div className="mt-2">
            {getRecentActivityBadge()}
          </div>
        </div>
      </div>

      {/* Position indicator for top 3 */}
      {isTopThree && (
        <div className="flex-shrink-0 ml-4">
          <div className="text-right">
            <div className="text-lg font-bold text-yellow-600">
              #{position}
            </div>
            {position === 1 && (
              <div className="text-xs text-yellow-600 font-medium">
                Leader
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}