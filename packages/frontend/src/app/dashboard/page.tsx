/**
 * Refactored Dashboard Page - Clean and modular
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useResponsive } from '@/utils/responsiveUtils';
import { SwipeableLeaderboard } from '@/components/dashboard/SwipeableLeaderboard';
import { PersonalStatsCard } from '@/components/dashboard/PersonalStatsCard';
import { ChartsSection } from '@/components/dashboard/ChartsSection';
import { TeamSelector } from '@/components/dashboard/TeamSelector';
import { EnhancedRecentActivities } from '@/components/dashboard/EnhancedRecentActivities';
import { formatDistance } from '@/services/activity.service';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PullToRefresh, TouchCard, TouchButton } from '@/components/mobile/TouchInteractions';
import { ConnectionStatus, ConnectionStatusBanner } from '@/components/ConnectionStatus';
import { AchievementNotificationManager } from '@/components/AchievementNotification';
import { useWebSocketContext, useWebSocketStatus } from '@/contexts/WebSocketContext';
import { useRealtimeActivities } from '@/hooks/useRealtimeActivities';
import { useRealtimeUpdates, Achievement } from '@/hooks/useRealtimeUpdates';
import { useAuthStore } from '@/store/auth.store';

// Custom hooks for clean separation of concerns
import { useDashboardData } from '@/hooks/useDashboardData';
import { useDashboardCallbacks } from '@/hooks/useDashboardCallbacks';
import { useDashboardSelection } from '@/hooks/useDashboardSelection';
import { transformLeaderboardData } from '@/utils/dashboardDataTransforms';

export default function DashboardPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  
  // Responsive detection
  const viewport = useResponsive();
  
  // Auth state
  const { user, isAuthenticated } = useAuthStore();
  
  // Dashboard data management
  const {
    dashboardData,
    loading: isLoading,
    error: dashboardError,
    refresh,
    teams,
    recentActivities,
    personalStats,
    teamLeaderboards,
    chartData,
  } = useDashboardData();

  // Team and view selection
  const {
    selectedTeamId,
    setSelectedTeamId,
    chartView,
    setChartView,
    selectedTeam,
    selectedTeamLeaderboard,
  } = useDashboardSelection(teams, teamLeaderboards);

  // WebSocket connection for real-time updates
  const { connect } = useWebSocketContext();
  const { isConnected, connectionState, error, isOnline, wasOffline } = useWebSocketStatus();

  // Callback handlers
  const {
    handleActivityUpdate,
    handleActivityError,
    handleAchievement,
    handleRealtimeError,
    handleRefresh,
    handleAchievementDismiss,
    handleConnectionRetry,
  } = useDashboardCallbacks({
    refresh,
    connect,
    isConnected,
    error,
    setAchievements,
  });

  // User preferences
  const userPreferredUnits = user?.preferredUnits || 'kilometers';

  // Real-time subscriptions
  useRealtimeActivities({
    onActivityUpdate: handleActivityUpdate,
    onError: handleActivityError,
  });

  useRealtimeUpdates({
    channels: selectedTeamId ? [`team-${selectedTeamId}`, `user-${user?.id}`] : [`user-${user?.id}`],
    onAchievement: handleAchievement,
    onError: handleRealtimeError,
  });

  // Authentication check
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
              href="/signin"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Dashboard">
      {/* Connection Status Banner */}
      <ConnectionStatusBanner 
        isOnline={isOnline}
        wasOffline={wasOffline}
        onRetry={handleConnectionRetry}
      />

      {/* Achievement Notifications */}
      <AchievementNotificationManager
        achievements={achievements}
        onDismiss={handleAchievementDismiss}
      />

      <PullToRefresh onRefresh={handleRefresh} disabled={isLoading}>
        <div className="space-y-4 pb-24">
          {/* Error State */}
          {dashboardError && (
            <TouchCard className="border-red-200 bg-red-50">
              <div className="text-center">
                <p className="text-red-800 mb-4">Failed to load dashboard data</p>
                <TouchButton onClick={handleRefresh} variant="primary" size="sm">
                  Retry
                </TouchButton>
              </div>
            </TouchCard>
          )}

          {/* Loading State */}
          {isLoading && (
            <TouchCard>
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading your dashboard...</p>
              </div>
            </TouchCard>
          )}

          {/* Main Content */}
          {!isLoading && (
            <>
              {/* Team Selector */}
              <TeamSelector
                teams={teams}
                selectedTeamId={selectedTeamId}
                setSelectedTeamId={setSelectedTeamId}
              />

              {/* Selected Team Progress */}
              {selectedTeam && (
                <TouchCard className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">{selectedTeam.name}</h2>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {selectedTeam.memberCount} {selectedTeam.memberCount === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
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

                  {/* Team Role */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      Your role: {selectedTeam.role.toLowerCase()}
                    </p>
                  </div>
                </TouchCard>
              )}

              {/* Log Activity Button */}
              <TouchButton 
                onClick={() => window.location.href = '/activities/new'}
                variant="primary"
                size="lg"
                className="w-full"
                hapticFeedback={true}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Log Today&apos;s Walk
              </TouchButton>

              {/* Personal Statistics */}
              <PersonalStatsCard
                personalStats={personalStats}
                userPreferredUnits={userPreferredUnits}
              />

              {/* Charts Section */}
              <ChartsSection
                chartView={chartView}
                setChartView={setChartView}
                selectedTeam={selectedTeam}
                userPreferredUnits={userPreferredUnits}
                viewport={viewport}
                chartData={chartData}
              />

              {/* Team Leaderboard */}
              {selectedTeamLeaderboard && selectedTeamLeaderboard.members.length > 0 && (
                <SwipeableLeaderboard
                  teamMembers={transformLeaderboardData(selectedTeamLeaderboard.members, user?.id)}
                  userPreferredUnits={userPreferredUnits}
                  className="mb-6"
                  onMemberSelect={(member) => {
                    console.log('Selected member:', member);
                    // Future: Navigate to member profile or show details
                  }}
                />
              )}

              {/* Recent Activities */}
              <EnhancedRecentActivities
                activities={recentActivities}
                userPreferredUnits={userPreferredUnits}
              />
            </>
          )}
        </div>
      </PullToRefresh>

      {/* Connection Status */}
      <ConnectionStatus connectionState={connectionState} />
    </MobileLayout>
  );
}