'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useResponsive } from '@/utils/responsiveUtils';
import { ProgressLineChart, GoalProgressChart, ActivityBarChart, SwipeableChart } from '@/components/charts';
import { SwipeableLeaderboard } from '@/components/dashboard/SwipeableLeaderboard';
import { formatDistance } from '@/services/activity.service';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PullToRefresh, TouchCard, TouchButton } from '@/components/mobile/TouchInteractions';
import { ConnectionStatus, ConnectionStatusBanner } from '@/components/ConnectionStatus';
import { AchievementNotificationManager } from '@/components/AchievementNotification';
import { useWebSocketContext, useWebSocketStatus } from '@/contexts/WebSocketContext';
import { useRealtimeActivities } from '@/hooks/useRealtimeActivities';
import { useRealtimeUpdates, Achievement } from '@/hooks/useRealtimeUpdates';
import { useDashboard } from '@/hooks/useDashboard';
import { useAuthStore } from '@/store/auth.store';
import { 
  generateDailyProgressData, 
  generateWeeklyProgressData, 
  generateActivityBreakdownData 
} from '@/utils/chartMockData';

// Helper function to get relative time
function getRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return then.toLocaleDateString();
}

// Helper to format date for best day display
function formatBestDayDate(date: Date | null): string {
  if (!date) return 'No activities yet';
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
}

export default function DashboardPage() {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [chartView, setChartView] = useState<'daily' | 'weekly'>('daily');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  
  // Responsive detection
  const viewport = useResponsive();
  
  // Auth state
  const { user, isAuthenticated } = useAuthStore();
  
  // Dashboard data from API
  const {
    data: dashboardData,
    isLoading,
    error: dashboardError,
    refresh,
    clearError,
    retry,
    hasData,
  } = useDashboard({
    autoRefresh: true,
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    onError: (error) => {
      console.error('Dashboard error:', error);
    },
    onSuccess: (data) => {
      // Set default team if not already selected
      if (!selectedTeamId && data.teams.length > 0) {
        setSelectedTeamId(data.teams[0].id);
      }
    },
  });
  
  // Extract data with fallbacks  
  const teams = useMemo(() => dashboardData?.teams || [], [dashboardData?.teams]);
  const recentActivities = useMemo(() => dashboardData?.recentActivities || [], [dashboardData?.recentActivities]);
  const personalStats = dashboardData?.personalStats;
  const teamLeaderboards = useMemo(() => dashboardData?.teamLeaderboards || [], [dashboardData?.teamLeaderboards]);

  // WebSocket connection for real-time updates
  const { connect } = useWebSocketContext();
  const { isConnected, connectionState, error, isOnline, wasOffline } = useWebSocketStatus();

  // Real-time activity updates for the selected team
  useRealtimeActivities(selectedTeamId, {
    onActivity: (update) => {
      console.log('Dashboard received activity update:', update);
      // Refresh dashboard data when new activities arrive
      refresh();
    },
    onError: (error) => {
      console.error('Realtime activity error:', error);
    },
    enableLogging: process.env.NODE_ENV === 'development',
  });

  // Real-time updates for general events
  useRealtimeUpdates({
    channels: selectedTeamId && user ? [
      `team-${selectedTeamId}`,
      `user-${user.id}`,
      'global-achievements'
    ] : user ? [`user-${user.id}`, 'global-achievements'] : [],
    onAchievement: (achievement) => {
      setAchievements(prev => [...prev, achievement]);
    },
    onError: (error) => {
      console.error('Realtime updates error:', error);
    },
    enableLogging: process.env.NODE_ENV === 'development',
  });
  
  // Generate chart data (using mock data for now, will be replaced with real data later)
  const dailyProgressData = generateDailyProgressData();
  const weeklyProgressData = generateWeeklyProgressData();
  const activityBreakdownData = generateActivityBreakdownData();
  
  // Selected team data
  const selectedTeam = useMemo(() => {
    return teams.find(team => team.id === selectedTeamId) || null;
  }, [teams, selectedTeamId]);
  
  // Selected team leaderboard
  const selectedTeamLeaderboard = useMemo(() => {
    return teamLeaderboards.find(board => board.teamId === selectedTeamId);
  }, [teamLeaderboards, selectedTeamId]);
  
  // User preferences fallback
  const userPreferredUnits = user?.preferredUnits || 'metric';

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    try {
      // Refresh dashboard data
      await refresh();
      
      // Try to reconnect WebSocket if disconnected
      if (!isConnected && error) {
        try {
          await connect();
        } catch (err) {
          console.error('Failed to reconnect during refresh:', err);
        }
      }
    } catch (err) {
      console.error('Failed to refresh dashboard:', err);
    }
  };

  // Handle achievement dismissal
  const handleAchievementDismiss = (achievementId: string) => {
    setAchievements(prev => prev.filter(a => a.id !== achievementId));
  };

  // Handle connection retry
  const handleConnectionRetry = async () => {
    try {
      await connect();
    } catch (err) {
      console.error('Manual connection retry failed:', err);
    }
  };

  // Show auth error if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <MobileLayout title="Dashboard">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Please Sign In
            </h2>
            <p className="text-gray-600 mb-6">
              You need to be signed in to view your dashboard.
            </p>
            <Link
              href="/auth/login"
              className="inline-block px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Sign In
            </Link>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <MobileLayout title="Dashboard">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // Show error state with retry option
  if (dashboardError && !hasData) {
    return (
      <MobileLayout title="Dashboard">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="w-16 h-16 mx-auto mb-4 text-red-500">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Unable to Load Dashboard
            </h2>
            <p className="text-gray-600 mb-6">
              {dashboardError.message}
            </p>
            <div className="space-y-3">
              <TouchButton
                onClick={retry}
                variant="primary"
                size="md"
                className="w-full"
              >
                Try Again
              </TouchButton>
              <TouchButton
                onClick={clearError}
                variant="secondary"
                size="md"
                className="w-full"
              >
                Dismiss
              </TouchButton>
            </div>
          </div>
        </div>
      </MobileLayout>
    );
  }

  const hasTeams = teams.length > 0;

  return (
    <MobileLayout 
      title="Dashboard"
      headerActions={
        <ConnectionStatus 
          connectionState={connectionState}
          error={error}
          size="sm"
          className="mr-2"
        />
      }
    >
      <PullToRefresh onRefresh={handleRefresh} className="bg-gray-50 scroll-optimized">
        <div className={`max-w-md mx-auto px-4 py-6 ${viewport.isMobile ? 'momentum-scroll-list' : ''}`}>
          {/* Connection Status Banner */}
          <ConnectionStatusBanner
            connectionState={connectionState}
            error={error}
            onRetry={handleConnectionRetry}
          />

          {/* Offline Status Banner */}
          {!isOnline && (
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full" />
                <span className="text-sm font-medium">
                  You&apos;re currently offline. Data will sync when you reconnect.
                </span>
              </div>
            </div>
          )}

          {/* Reconnection Success Banner */}
          {isOnline && wasOffline && isConnected && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm font-medium">
                  Back online! Live updates restored.
                </span>
              </div>
            </div>
          )}

          {/* Achievement Notifications */}
          <AchievementNotificationManager
            achievements={achievements}
            onDismiss={handleAchievementDismiss}
          />
        {/* Error banner for dashboard errors (when we have cached data) */}
        {dashboardError && hasData && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-5 h-5 text-yellow-600 mr-2">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.888-.833-2.598 0L3.732 19c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <span className="text-sm text-yellow-800">
                  {dashboardError.message}
                </span>
              </div>
              <TouchButton
                onClick={clearError}
                variant="ghost"
                size="sm"
                className="text-yellow-600 hover:text-yellow-800"
              >
                ×
              </TouchButton>
            </div>
          </div>
        )}

        {!hasTeams ? (
          // No teams state
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Welcome to Mile Quest!
            </h2>
            <p className="text-gray-600 mb-8">
              Join a team or create your own to start tracking your walking goals.
            </p>
            <div className="space-y-3">
              <Link
                href="/teams/new"
                className="block w-full px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Create a Team
              </Link>
              <Link
                href="/teams/join"
                className="block w-full px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Join a Team
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Team selector for multiple teams */}
            {teams.length > 1 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Select Team</p>
                <div className="grid grid-cols-1 gap-2">
                  {teams.map((team) => (
                    <TouchButton
                      key={team.id}
                      onClick={() => setSelectedTeamId(team.id)}
                      variant={selectedTeamId === team.id ? 'primary' : 'secondary'}
                      size="md"
                      className="w-full justify-center"
                      hapticFeedback
                    >
                      {team.name}
                      {selectedTeamId === team.id && (
                        <svg className="ml-2 w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </TouchButton>
                  ))}
                </div>
              </div>
            )}

            {/* Team Progress Card - Following wireframe */}
            {selectedTeam && (
              <TouchCard className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{selectedTeam.name}</h2>
                
                {/* Progress Bar - Only show if team has active goal */}
                {selectedTeam.progress && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>{formatDistance(selectedTeam.progress.currentDistance, userPreferredUnits)}</span>
                      <span>{formatDistance(selectedTeam.progress.targetDistance, userPreferredUnits)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(selectedTeam.progress.percentComplete, 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 text-center">
                      <span className="text-sm text-gray-600">
                        {selectedTeam.progress.goalName && (
                          <span className="font-medium">{selectedTeam.progress.goalName}</span>
                        )}
                        {selectedTeam.progress.daysRemaining !== null && (
                          <span className="ml-2">• {selectedTeam.progress.daysRemaining} days left</span>
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* User Stats */}
                {personalStats && (
                  <div className="space-y-2 text-gray-700">
                    <p className="text-sm">
                      <span className="font-medium">This Week:</span> {formatDistance(personalStats.thisWeek.distance, userPreferredUnits)}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Your Best:</span> {formatBestDayDate(personalStats.bestDay.date)} ({formatDistance(personalStats.bestDay.distance, userPreferredUnits)})
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Current Streak:</span> {personalStats.currentStreak} days
                    </p>
                  </div>
                )}

                {/* Team member count */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    {selectedTeam.memberCount} {selectedTeam.memberCount === 1 ? 'member' : 'members'} • Your role: {selectedTeam.role.toLowerCase()}
                  </p>
                </div>
              </TouchCard>
            )}

            {/* Team Activity Feed - Following wireframe */}
            <TouchCard className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {recentActivities.length > 0 ? (
                  recentActivities.slice(0, 3).map((activity) => {
                    const timeAgo = getRelativeTime(activity.activityDate);
                    
                    return (
                      <div key={activity.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">
                            {activity.isOwn ? 'You' : activity.userName}
                          </span>
                          <span className="text-gray-600"> in </span>
                          <span className="text-gray-600 font-medium">
                            {activity.teamName}
                          </span>
                          <br />
                          <span className="text-gray-600">
                            {formatDistance(activity.distance, userPreferredUnits)}
                          </span>
                          {activity.duration > 0 && (
                            <>
                              <span className="text-gray-600"> • </span>
                              <span className="text-gray-600">
                                {Math.round(activity.duration / 60)}min
                              </span>
                            </>
                          )}
                          <span className="text-gray-600"> • </span>
                          <span className="text-gray-500 text-sm">{timeAgo}</span>
                          {activity.note && (
                            <>
                              <br />
                              <span className="text-sm text-gray-500 italic">&quot;{activity.note}&quot;</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    No recent activities. Be the first to log a walk!
                  </p>
                )}
                
                {recentActivities.length > 3 && (
                  <div className="pt-3">
                    <Link
                      href="/activities"
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View all activities →
                    </Link>
                  </div>
                )}
              </div>
            </TouchCard>

            {/* Log Activity Button - Following wireframe */}
            <TouchButton 
              onClick={() => window.location.href = '/activities/new'}
              variant="primary"
              size="lg"
              className="w-full mb-6"
              hapticFeedback="medium"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Log Today&apos;s Walk
            </TouchButton>

            {/* Progress Charts Section */}
            <div className="space-y-6">
              {/* Goal Progress Chart */}
              {selectedTeam?.progress && (
                <TouchCard className="bg-white rounded-lg shadow-sm p-4 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Goal Progress</h3>
                  <div className="overflow-hidden touch-transform">
                    <GoalProgressChart
                      currentDistance={selectedTeam.progress.currentDistance}
                      targetDistance={selectedTeam.progress.targetDistance}
                      userPreferredUnits={userPreferredUnits}
                      height={viewport.isMobile ? 180 : 200} 
                      className="w-full"
                    />
                  </div>
                </TouchCard>
              )}

              {/* Activity Breakdown Chart */}
              <TouchCard className="bg-white rounded-lg shadow-sm p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Activity</h3>
                <div className="overflow-hidden touch-transform">
                  <ActivityBarChart
                    data={activityBreakdownData}
                    userPreferredUnits={userPreferredUnits}
                    height={viewport.isMobile ? 200 : 220}
                    className="w-full"
                    showActivityCount={false}
                  />
                </div>
              </TouchCard>

              {/* Progress Over Time Chart with Swipeable Views */}
              <TouchCard className="bg-white rounded-lg shadow-sm p-4 mb-6">
                <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Progress Over Time</h3>
                  <div className="flex bg-gray-100 rounded-lg p-1 self-end sm:self-auto">
                    <TouchButton
                      onClick={() => setChartView('daily')}
                      variant={chartView === 'daily' ? 'primary' : 'ghost'}
                      size="sm"
                      className="flex-1"
                      hapticFeedback="light"
                    >
                      Daily
                    </TouchButton>
                    <TouchButton
                      onClick={() => setChartView('weekly')}
                      variant={chartView === 'weekly' ? 'primary' : 'ghost'}
                      size="sm"
                      className="flex-1"
                      hapticFeedback="light"
                    >
                      Weekly
                    </TouchButton>
                  </div>
                </div>
                <div className="overflow-hidden">
                  <SwipeableChart
                    showIndicators={false}
                    onIndexChange={(index) => setChartView(index === 0 ? 'daily' : 'weekly')}
                    initialIndex={chartView === 'daily' ? 0 : 1}
                  >
                    <ProgressLineChart
                      data={dailyProgressData}
                      userPreferredUnits={userPreferredUnits}
                      showCumulative={false}
                      height={viewport.isMobile ? 200 : 220}
                      className="w-full"
                    />
                    <ProgressLineChart
                      data={weeklyProgressData}
                      userPreferredUnits={userPreferredUnits}
                      showCumulative={true}
                      height={viewport.isMobile ? 200 : 220}
                      className="w-full"
                    />
                  </SwipeableChart>
                </div>
              </TouchCard>
            </div>

            {/* Additional Stats Cards for better visualization */}
            <div className={`grid gap-4 mb-6 ${
              viewport.isMobile ? 'grid-cols-2' : 
              viewport.isTablet ? 'grid-cols-3' : 'grid-cols-4'
            }`}>
              <TouchCard className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-sm text-gray-600">Total Distance</p>
                <p className="text-xl font-semibold text-gray-900">
                  {personalStats ? formatDistance(personalStats.totalDistance, userPreferredUnits) : '0 km'}
                </p>
              </TouchCard>
              <TouchCard className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-sm text-gray-600">Current Streak</p>
                <p className="text-xl font-semibold text-gray-900">
                  {personalStats ? `${personalStats.currentStreak} days` : '0 days'}
                </p>
              </TouchCard>
              {personalStats && (
                <TouchCard className="bg-white rounded-lg shadow-sm p-4">
                  <p className="text-sm text-gray-600">This Month</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatDistance(personalStats.thisMonth.distance, userPreferredUnits)}
                  </p>
                </TouchCard>
              )}
              {personalStats && (
                <TouchCard className="bg-white rounded-lg shadow-sm p-4">
                  <p className="text-sm text-gray-600">Total Activities</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {personalStats.totalActivities}
                  </p>
                </TouchCard>
              )}
            </div>

            {/* Team Leaderboard with Swipe Navigation */}
            {selectedTeamLeaderboard && selectedTeamLeaderboard.members.length > 0 && (
              <SwipeableLeaderboard
                teamMembers={selectedTeamLeaderboard.members.map(member => ({
                  id: member.userId,
                  name: member.name,
                  totalDistance: member.distance,
                  rank: selectedTeamLeaderboard.members.indexOf(member) + 1,
                  avatarUrl: member.avatarUrl,
                  percentage: member.percentage,
                }))}
                userPreferredUnits={userPreferredUnits}
                className="mb-6"
                onMemberSelect={(member) => {
                  console.log('Selected member:', member);
                  // Future: Navigate to member profile or show details
                }}
              />
            )}

            {/* Coming Soon Features */}
            <TouchCard className="bg-gray-100 rounded-lg p-6 mb-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Coming Soon</h3>
              <ul className="space-y-3 text-sm text-gray-500">
                <li className="flex items-center py-1">
                  <span className="mr-3 text-base">🔒</span>
                  <span>Achievements - Week 2</span>
                </li>
                <li className="flex items-center py-1">
                  <span className="mr-3 text-base">🔒</span>
                  <span>Photos - Week 2</span>
                </li>
                <li className="flex items-center py-1">
                  <span className="mr-3 text-base">🔒</span>
                  <span>Leaderboard - Week 3</span>
                </li>
              </ul>
            </TouchCard>
          </div>
        )}
        </div>
      </PullToRefresh>
    </MobileLayout>
  );
}