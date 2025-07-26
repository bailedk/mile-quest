/**
 * Refactored Dashboard Page - Clean and modular
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useResponsive } from '@/utils/responsiveUtils';
import { SwipeableLeaderboard } from '@/components/dashboard/SwipeableLeaderboard';
import { PersonalStatsCard } from '@/components/dashboard/PersonalStatsCard';
import { ChartsSection } from '@/components/dashboard/ChartsSection';
import { TeamSelector } from '@/components/dashboard/TeamSelector';
import { EnhancedRecentActivities } from '@/components/dashboard/EnhancedRecentActivities';
import { formatDistance } from '@/services/activity.service';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PullToRefresh, TouchButton } from '@/components/mobile/TouchInteractions';
import { MobileCard } from '@/components/mobile/MobileCard';
import { AchievementNotificationManager } from '@/components/AchievementNotification';
import { useAuthStore } from '@/store/auth.store';
import { withAuth } from '@/components/auth/withAuth';

// Define Achievement type locally (matching AchievementNotification)
interface Achievement {
  id: string;
  title: string;
  description: string;
  points: number;
  icon?: string;
}

// Custom hooks for clean separation of concerns
import { useDashboardData } from '@/hooks/useDashboardData';
import { useDashboardCallbacks } from '@/hooks/useDashboardCallbacks';
import { useDashboardSelection } from '@/hooks/useDashboardSelection';

function DashboardPage() {
  const router = useRouter();
  const { isMobile } = useResponsive();
  
  // Achievement notifications state
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  
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

  // Simplified callback handlers without WebSocket
  const {
    handleActivityUpdate,
    handleActivityError,
    handleAchievement,
    handleRefresh,
    handleAchievementDismiss,
  } = useDashboardCallbacks({
    refresh,
    setAchievements,
  });

  // User preferences
  const userPreferredUnits = user?.preferredUnits || 'kilometers';

  // Handle error state
  if (dashboardError) {
    return (
      <MobileLayout title="Dashboard" showBack={false}>
        <div className="flex items-center justify-center h-full p-8">
          <MobileCard>
            <div className="text-center space-y-4">
              <p className="text-gray-600">Unable to load dashboard</p>
              <TouchButton onPress={refresh} variant="primary">
                Retry
              </TouchButton>
            </div>
          </MobileCard>
        </div>
      </MobileLayout>
    );
  }

  // Handle loading state
  if (isLoading && !dashboardData) {
    return (
      <MobileLayout title="Dashboard" showBack={false}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // Main dashboard content
  const dashboardContent = (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-6 pb-20">
        {/* Achievement Notifications */}
        <AchievementNotificationManager
          achievements={achievements}
          onDismiss={handleAchievementDismiss}
        />
        
        {/* Personal Stats Card */}
        {personalStats && (
          <MobileCard>
            <PersonalStatsCard
              totalDistance={personalStats.totalDistance}
              weekDistance={personalStats.weekDistance}
              bestDay={personalStats.bestDay}
              userPreferredUnits={userPreferredUnits}
            />
          </MobileCard>
        )}
        
        {/* Team Selector and Leaderboard */}
        {teams.length > 0 && (
          <>
            <TeamSelector
              teams={teams}
              selectedTeamId={selectedTeamId}
              setSelectedTeamId={setSelectedTeamId}
            />
            
            {selectedTeamLeaderboard && (
              <SwipeableLeaderboard
                leaderboard={selectedTeamLeaderboard}
                teamName={selectedTeam?.name || ''}
                userPreferredUnits={userPreferredUnits}
                currentUserId={user?.id || ''}
              />
            )}
          </>
        )}
        
        {/* Charts Section */}
        {chartData && (
          <ChartsSection
            chartData={chartData}
            chartView={chartView}
            setChartView={setChartView}
            selectedTeam={selectedTeam}
            userPreferredUnits={userPreferredUnits}
            viewport={{ isMobile }}
          />
        )}
        
        {/* Recent Activities */}
        {recentActivities && recentActivities.length > 0 && (
          <MobileCard>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Recent Activities</h3>
              <Link href="/activities">
                <TouchButton variant="ghost" size="sm">
                  View All
                </TouchButton>
              </Link>
            </div>
            <EnhancedRecentActivities
              activities={recentActivities}
              userPreferredUnits={userPreferredUnits}
              onActivityPress={(activityId) => {
                router.push(`/activities/${activityId}`);
              }}
            />
          </MobileCard>
        )}
        
        {/* Quick Actions */}
        <MobileCard>
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/activities/new">
              <TouchButton variant="primary" className="w-full">
                Log Activity
              </TouchButton>
            </Link>
            <Link href="/teams">
              <TouchButton variant="secondary" className="w-full">
                Manage Teams
              </TouchButton>
            </Link>
          </div>
        </MobileCard>
      </div>
    </PullToRefresh>
  );

  // Use mobile layout for mobile devices
  if (isMobile) {
    return (
      <MobileLayout 
        title="Dashboard" 
        showBack={false}
        rightAction={{
          icon: 'refresh',
          onPress: refresh,
        }}
      >
        {dashboardContent}
      </MobileLayout>
    );
  }

  // Desktop layout
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
        
        {dashboardContent}
      </div>
    </div>
  );
}

// Define minimal Achievement type locally if needed
interface Achievement {
  id: string;
  title: string;
  description: string;
  points: number;
  icon?: string;
}

export default withAuth(DashboardPage);