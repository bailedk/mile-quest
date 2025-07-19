'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ProgressLineChart, GoalProgressChart, ActivityBarChart } from '@/components/charts';
import { formatDistance } from '@/services/activity.service';
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
  
  // Use mock data instead of API calls
  const user = mockUser;
  const teams = mockTeams;
  
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const hasTeams = teams.length > 0;
  
  // Get mock data for selected team
  const teamProgress = selectedTeamId ? mockTeamProgress[selectedTeamId] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Mile Quest</h1>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🚶</span>
              <span className="text-sm text-gray-600">{user.name.split(' ')[0]}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
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
              <div className="bg-white rounded-lg shadow-sm p-6">
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
              </div>
            )}

            {/* Team Activity Feed - Following wireframe */}
            <div className="bg-white rounded-lg shadow-sm p-6">
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
            </div>

            {/* Log Activity Button - Following wireframe */}
            <Link
              href="/activities/new"
              className="block w-full px-6 py-3 text-center border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Log Today&apos;s Walk
            </Link>

            {/* Progress Charts Section */}
            <div className="space-y-6">
              {/* Goal Progress Chart */}
              {selectedTeam && teamProgress && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Goal Progress</h3>
                  <GoalProgressChart
                    currentDistance={teamProgress.totalDistance}
                    targetDistance={teamProgress.targetDistance}
                    userPreferredUnits={user.preferredUnits}
                    height={240}
                    className="w-full"
                  />
                </div>
              )}

              {/* Activity Breakdown Chart */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Activity</h3>
                <ActivityBarChart
                  data={activityBreakdownData}
                  userPreferredUnits={user.preferredUnits}
                  height={280}
                  className="w-full"
                  showActivityCount={false}
                />
              </div>

              {/* Progress Over Time Chart */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Progress Over Time</h3>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setChartView('daily')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        chartView === 'daily'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Daily
                    </button>
                    <button
                      onClick={() => setChartView('weekly')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        chartView === 'weekly'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Weekly
                    </button>
                  </div>
                </div>
                <ProgressLineChart
                  data={chartView === 'daily' ? dailyProgressData : weeklyProgressData}
                  userPreferredUnits={user.preferredUnits}
                  showCumulative={chartView === 'weekly'}
                  height={280}
                  className="w-full"
                />
              </div>
            </div>

            {/* Additional Stats Cards for better visualization */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-sm text-gray-600">Total Distance</p>
                <p className="text-xl font-semibold text-gray-900">
                  {formatDistance(mockDashboardStats.totalDistance, user.preferredUnits)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-sm text-gray-600">Current Streak</p>
                <p className="text-xl font-semibold text-gray-900">
                  {mockDashboardStats.weekDistance > 0 ? '7 days' : '0 days'}
                </p>
              </div>
            </div>

            {/* Team Leaderboard Preview */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Members</h3>
              <div className="space-y-3">
                {mockTeamMembers[selectedTeamId || 'team-1']?.slice(0, 4).map((member) => (
                  <div key={member.userId} className="flex items-center justify-between">
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
                    <span className="text-gray-600">
                      {formatDistance(member.weekDistance, user.preferredUnits)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coming Soon Features */}
            <div className="bg-gray-100 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Coming Soon</h3>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center">
                  <span className="mr-2">🔒</span>
                  <span>Achievements - Week 2</span>
                </li>
                <li className="flex items-center">
                  <span className="mr-2">🔒</span>
                  <span>Photos - Week 2</span>
                </li>
                <li className="flex items-center">
                  <span className="mr-2">🔒</span>
                  <span>Leaderboard - Week 3</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}