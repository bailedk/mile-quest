'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ProgressLineChart, GoalProgressChart, ActivityBarChart } from '@/components/charts';
import { formatDistance } from '@/services/activity.service';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PullToRefresh, TouchCard } from '@/components/mobile/TouchInteractions';
import { ConnectionStatus, ConnectionStatusBanner } from '@/components/ConnectionStatus';
import { AchievementNotificationManager } from '@/components/AchievementNotification';
import { useWebSocketContext, useWebSocketStatus } from '@/contexts/WebSocketContext';
import { useRealtimeActivities } from '@/hooks/useRealtimeActivities';
import { useRealtimeUpdates, Achievement } from '@/hooks/useRealtimeUpdates';
import { 
  mockUser, 
  mockTeams, 
  mockTeamProgress, 
  mockRecentActivities,
  mockDashboardStats,
  mockTeamMembers 
} from '@/utils/mockData';
import { 
  generateDailyProgressData, 
  generateWeeklyProgressData, 
  generateActivityBreakdownData 
} from '@/utils/chartMockData';

// Helper function to get relative time
function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return then.toLocaleDateString();
}

export default function DashboardPage() {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartView, setChartView] = useState<'daily' | 'weekly'>('daily');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  
  // Use mock data instead of API calls
  const user = mockUser;
  const teams = mockTeams;

  // WebSocket connection for real-time updates
  const { connect } = useWebSocketContext();
  const { isConnected, connectionState, error, isOnline, wasOffline } = useWebSocketStatus();

  // Real-time activity updates for the selected team
  const realtimeActivities = useRealtimeActivities(selectedTeamId, {
    onActivity: (update) => {
      console.log('Dashboard received activity update:', update);
      // Could show toast notification here
    },
    onError: (error) => {
      console.error('Realtime activity error:', error);
    },
    enableLogging: process.env.NODE_ENV === 'development',
  });

  // Real-time updates for general events
  const realtimeUpdates = useRealtimeUpdates({
    channels: selectedTeamId ? [
      `team-${selectedTeamId}`,
      `user-${user.id}`,
      'global-achievements'
    ] : [`user-${user.id}`, 'global-achievements'],
    onAchievement: (achievement) => {
      setAchievements(prev => [...prev, achievement]);
    },
    onError: (error) => {
      console.error('Realtime updates error:', error);
    },
    enableLogging: process.env.NODE_ENV === 'development',
  });
  
  // Generate chart data
  const dailyProgressData = generateDailyProgressData();
  const weeklyProgressData = generateWeeklyProgressData();
  const activityBreakdownData = generateActivityBreakdownData();
  
  // Set default team when component mounts
  useEffect(() => {
    // Simulate loading delay
    setTimeout(() => {
      if (teams.length > 0 && !selectedTeamId) {
        setSelectedTeamId(teams[0].id);
      }
      setIsLoading(false);
    }, 1000);
  }, [teams, selectedTeamId]);

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh delay and reconnect WebSocket if needed
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Try to reconnect if disconnected
    if (!isConnected && error) {
      try {
        await connect();
      } catch (err) {
        console.error('Failed to reconnect during refresh:', err);
      }
    }
    
    setIsRefreshing(false);
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

  if (isLoading) {
    return (
      <MobileLayout title="Dashboard">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const hasTeams = teams.length > 0;
  
  // Get mock data for selected team
  const teamProgress = selectedTeamId ? mockTeamProgress[selectedTeamId] : null;

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
      <PullToRefresh onRefresh={handleRefresh} className="bg-gray-50">
        <div className="max-w-md mx-auto px-4 py-6">
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
                  You're currently offline. Data will sync when you reconnect.
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
              <div>
                <select
                  id="team-select"
                  value={selectedTeamId || ''}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="block w-full px-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Team Progress Card - Following wireframe */}
            {selectedTeam && teamProgress && (
              <TouchCard className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{selectedTeam.name}</h2>
                
                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>{formatDistance(teamProgress.totalDistance, user.preferredUnits)}</span>
                    <span>{formatDistance(teamProgress.targetDistance, user.preferredUnits)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(teamProgress.percentageComplete, 100)}%` }}
                    />
                  </div>
                </div>

                {/* User Stats */}
                <div className="space-y-2 text-gray-700">
                  <p className="text-sm">
                    <span className="font-medium">This Week:</span> {formatDistance(mockDashboardStats.weekDistance, user.preferredUnits)}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Your Best:</span> {mockDashboardStats.bestDay.date} ({formatDistance(mockDashboardStats.bestDay.distance, user.preferredUnits)})
                  </p>
                </div>
              </TouchCard>
            )}

            {/* Team Activity Feed - Following wireframe */}
            <TouchCard className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Activity</h3>
              <div className="space-y-3">
                {mockRecentActivities.slice(0, 3).map((activity) => {
                  const isCurrentUser = activity.userName === 'You' || activity.userName === user.name;
                  const timeAgo = getRelativeTime(activity.timestamp);
                  
                  return (
                    <div key={activity.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">
                          {isCurrentUser ? 'You' : activity.userName}
                        </span>
                        <span className="text-gray-600"> - </span>
                        <span className="text-gray-600">
                          {formatDistance(activity.distance, user.preferredUnits)}
                        </span>
                        <span className="text-gray-600"> - </span>
                        <span className="text-gray-500 text-sm">{timeAgo}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TouchCard>

            {/* Log Activity Button - Following wireframe */}
            <TouchCard 
              onClick={() => window.location.href = '/activities/new'}
              className="bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm mb-6 transition-colors"
            >
              <div className="px-6 py-4 text-center">
                <span className="text-white font-medium text-lg">Log Today's Walk</span>
              </div>
            </TouchCard>

            {/* Progress Charts Section */}
            <div className="space-y-6">
              {/* Goal Progress Chart */}
              {selectedTeam && teamProgress && (
                <TouchCard className="bg-white rounded-lg shadow-sm p-4 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Goal Progress</h3>
                  <div className="overflow-hidden">
                    <GoalProgressChart
                      currentDistance={teamProgress.totalDistance}
                      targetDistance={teamProgress.targetDistance}
                      userPreferredUnits={user.preferredUnits}
                      height={200} 
                      className="w-full"
                    />
                  </div>
                </TouchCard>
              )}

              {/* Activity Breakdown Chart */}
              <TouchCard className="bg-white rounded-lg shadow-sm p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Activity</h3>
                <div className="overflow-hidden">
                  <ActivityBarChart
                    data={activityBreakdownData}
                    userPreferredUnits={user.preferredUnits}
                    height={220}
                    className="w-full"
                    showActivityCount={false}
                  />
                </div>
              </TouchCard>

              {/* Progress Over Time Chart */}
              <TouchCard className="bg-white rounded-lg shadow-sm p-4 mb-6">
                <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Progress Over Time</h3>
                  <div className="flex bg-gray-100 rounded-lg p-1 self-end sm:self-auto">
                    <button
                      onClick={() => setChartView('daily')}
                      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors min-h-[44px] ${
                        chartView === 'daily'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Daily
                    </button>
                    <button
                      onClick={() => setChartView('weekly')}
                      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors min-h-[44px] ${
                        chartView === 'weekly'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Weekly
                    </button>
                  </div>
                </div>
                <div className="overflow-hidden">
                  <ProgressLineChart
                    data={chartView === 'daily' ? dailyProgressData : weeklyProgressData}
                    userPreferredUnits={user.preferredUnits}
                    showCumulative={chartView === 'weekly'}
                    height={220}
                    className="w-full"
                  />
                </div>
              </TouchCard>
            </div>

            {/* Additional Stats Cards for better visualization */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <TouchCard className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-sm text-gray-600">Total Distance</p>
                <p className="text-xl font-semibold text-gray-900">
                  {formatDistance(mockDashboardStats.totalDistance, user.preferredUnits)}
                </p>
              </TouchCard>
              <TouchCard className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-sm text-gray-600">Current Streak</p>
                <p className="text-xl font-semibold text-gray-900">
                  {mockDashboardStats.weekDistance > 0 ? '7 days' : '0 days'}
                </p>
              </TouchCard>
            </div>

            {/* Team Leaderboard Preview */}
            <TouchCard className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Members</h3>
              <div className="space-y-3">
                {mockTeamMembers[selectedTeamId || 'team-1']?.slice(0, 4).map((member) => (
                  <div key={member.userId} className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        member.rank === 1 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {member.rank}
                      </div>
                      <span className="font-medium">
                        {member.isCurrentUser ? `${member.name} (You)` : member.name}
                      </span>
                    </div>
                    <span className="text-gray-600 text-sm">
                      {formatDistance(member.weekDistance, user.preferredUnits)}
                    </span>
                  </div>
                ))}
              </div>
            </TouchCard>

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