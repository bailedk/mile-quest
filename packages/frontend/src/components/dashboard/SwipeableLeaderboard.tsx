'use client';

import React, { useState, useCallback } from 'react';
import { useAdvancedSwipeGesture, TouchCard } from '@/components/mobile/TouchInteractions';
import { formatDistance } from '@/services/activity.service';

interface LeaderboardMember {
  userId: string;
  name: string;
  weekDistance: number;
  totalDistance: number;
  rank: number;
  isCurrentUser: boolean;
  avatarUrl?: string;
  streakDays?: number;
}

interface SwipeableLeaderboardProps {
  teamMembers: LeaderboardMember[];
  userPreferredUnits: 'miles' | 'kilometers';
  className?: string;
  onMemberSelect?: (member: LeaderboardMember) => void;
}

type LeaderboardView = 'week' | 'total' | 'streaks';

export function SwipeableLeaderboard({
  teamMembers,
  userPreferredUnits,
  className = '',
  onMemberSelect
}: SwipeableLeaderboardProps) {
  const [currentView, setCurrentView] = useState<LeaderboardView>('week');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const changeView = useCallback((newView: LeaderboardView) => {
    if (isTransitioning || newView === currentView) return;
    
    setIsTransitioning(true);
    setCurrentView(newView);
    
    setTimeout(() => setIsTransitioning(false), 300);
  }, [currentView, isTransitioning]);

  const nextView = useCallback(() => {
    const views: LeaderboardView[] = ['week', 'total', 'streaks'];
    const currentIndex = views.indexOf(currentView);
    const nextIndex = (currentIndex + 1) % views.length;
    changeView(views[nextIndex]);
  }, [currentView, changeView]);

  const previousView = useCallback(() => {
    const views: LeaderboardView[] = ['week', 'total', 'streaks'];
    const currentIndex = views.indexOf(currentView);
    const previousIndex = currentIndex === 0 ? views.length - 1 : currentIndex - 1;
    changeView(views[previousIndex]);
  }, [currentView, changeView]);

  const swipeGestures = useAdvancedSwipeGesture(
    nextView,     // Swipe left - next view
    previousView, // Swipe right - previous view
    undefined,    // No up swipe
    undefined,    // No down swipe
    {
      threshold: 60,
      velocityThreshold: 0.4,
      preventScroll: true,
      enableDiagonal: false
    }
  );

  // Sort members based on current view
  const sortedMembers = React.useMemo(() => {
    const sorted = [...teamMembers];
    
    switch (currentView) {
      case 'week':
        return sorted.sort((a, b) => b.weekDistance - a.weekDistance);
      case 'total':
        return sorted.sort((a, b) => b.totalDistance - a.totalDistance);
      case 'streaks':
        return sorted.sort((a, b) => (b.streakDays || 0) - (a.streakDays || 0));
      default:
        return sorted;
    }
  }, [teamMembers, currentView]);

  const getViewTitle = (view: LeaderboardView) => {
    switch (view) {
      case 'week': return 'This Week';
      case 'total': return 'All Time';
      case 'streaks': return 'Streaks';
    }
  };

  const getViewSubtitle = (view: LeaderboardView) => {
    switch (view) {
      case 'week': return 'Weekly distance leaders';
      case 'total': return 'Total distance leaders';
      case 'streaks': return 'Consecutive days active';
    }
  };

  const getMemberValue = (member: LeaderboardMember, view: LeaderboardView) => {
    switch (view) {
      case 'week':
        return formatDistance(member.weekDistance, userPreferredUnits);
      case 'total':
        return formatDistance(member.totalDistance, userPreferredUnits);
      case 'streaks':
        return `${member.streakDays || 0} days`;
    }
  };

  return (
    <TouchCard className={`bg-white rounded-lg shadow-sm ${className}`}>
      <div className="p-6">
        {/* Header with swipe indicators */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {getViewTitle(currentView)}
            </h3>
            <p className="text-sm text-gray-600">
              {getViewSubtitle(currentView)}
            </p>
          </div>
          
          {/* View indicators */}
          <div className="flex space-x-1">
            {(['week', 'total', 'streaks'] as LeaderboardView[]).map((view) => (
              <button
                key={view}
                onClick={() => changeView(view)}
                disabled={isTransitioning}
                className={`w-2 h-2 rounded-full transition-all duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center ${
                  currentView === view
                    ? 'bg-blue-600 scale-125'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`View ${getViewTitle(view)} leaderboard`}
              >
                <span className="sr-only">{getViewTitle(view)}</span>
                <div className={`w-2 h-2 rounded-full ${
                  currentView === view ? 'bg-white' : 'bg-current'
                }`} />
              </button>
            ))}
          </div>
        </div>

        {/* Swipeable leaderboard content */}
        <div 
          className="relative overflow-hidden"
          {...swipeGestures}
        >
          <div 
            className={`transition-opacity duration-300 ${
              isTransitioning ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="space-y-3">
              {sortedMembers.map((member, index) => (
                <TouchCard
                  key={`${member.userId}-${currentView}`}
                  onClick={() => onMemberSelect?.(member)}
                  className="flex items-center justify-between py-3 px-2 hover:bg-gray-50 rounded-lg transition-colors"
                  hapticFeedback="light"
                >
                  <div className="flex items-center space-x-3">
                    {/* Rank badge */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index === 0 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : index === 1 
                        ? 'bg-gray-100 text-gray-600'
                        : index === 2
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      {index + 1}
                    </div>
                    
                    {/* Member info */}
                    <div>
                      <span className={`font-medium ${
                        member.isCurrentUser ? 'text-blue-600' : 'text-gray-900'
                      }`}>
                        {member.isCurrentUser ? `${member.name} (You)` : member.name}
                      </span>
                      
                      {/* Additional context for current view */}
                      {currentView === 'streaks' && member.streakDays && member.streakDays > 0 && (
                        <div className="text-xs text-gray-500">
                          🔥 {member.streakDays} day streak!
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Value display */}
                  <div className="text-right">
                    <span className="text-gray-900 font-medium">
                      {getMemberValue(member, currentView)}
                    </span>
                    
                    {/* Progress indicator for current user */}
                    {member.isCurrentUser && (
                      <div className="text-xs text-blue-600">
                        Your {currentView === 'streaks' ? 'streak' : 'progress'}
                      </div>
                    )}
                  </div>
                </TouchCard>
              ))}
            </div>
          </div>
        </div>

        {/* Swipe hint */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            ← Swipe to view different leaderboards →
          </p>
        </div>
      </div>
    </TouchCard>
  );
}

// Simplified leaderboard item for use in other components
export function LeaderboardItem({ 
  member, 
  userPreferredUnits, 
  showTotal = false,
  onClick 
}: { 
  member: LeaderboardMember; 
  userPreferredUnits: 'miles' | 'kilometers';
  showTotal?: boolean;
  onClick?: () => void;
}) {
  return (
    <TouchCard
      onClick={onClick}
      className="flex items-center justify-between py-2 hover:bg-gray-50 rounded-lg transition-colors"
      hapticFeedback="light"
    >
      <div className="flex items-center space-x-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          member.rank === 1 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
        }`}>
          {member.rank}
        </div>
        <span className={`font-medium ${
          member.isCurrentUser ? 'text-blue-600' : 'text-gray-900'
        }`}>
          {member.isCurrentUser ? `${member.name} (You)` : member.name}
        </span>
      </div>
      <span className="text-gray-600 text-sm">
        {formatDistance(showTotal ? member.totalDistance : member.weekDistance, userPreferredUnits)}
      </span>
    </TouchCard>
  );
}