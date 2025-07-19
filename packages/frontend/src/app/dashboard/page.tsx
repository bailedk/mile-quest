'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';
import { useUserTeams } from '@/hooks/useTeams';
import { useTeamActivities, useUserStats, useTeamGoalProgress } from '@/hooks/useActivities';
import { useRealtimeActivities } from '@/hooks/useRealtimeActivities';
import { ActivityFeed } from '@/components/ActivityFeed';
import { TeamProgressCard } from '@/components/TeamProgressCard';
import { PersonalStatsCard } from '@/components/PersonalStatsCard';
import Link from 'next/link';

export default function DashboardPage() {
  const { isLoading: authLoading } = useRequireAuth();
  const { user } = useAuthStore();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  
  // Fetch user's teams
  const { data: teams, isLoading: teamsLoading } = useUserTeams();
  
  // Set default team when teams are loaded
  useEffect(() => {
    if (teams && teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);
  
  // Fetch data based on selected team
  const { data: activities, isLoading: activitiesLoading, error: activitiesError } = useTeamActivities(
    selectedTeamId,
    { startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() } // Last 7 days
  );
  
  const { data: userStats, isLoading: statsLoading, error: statsError } = useUserStats();
  
  // For now, we'll use a mock goal ID - this should come from the team data
  const { data: teamProgress, isLoading: progressLoading, error: progressError } = useTeamGoalProgress(
    selectedTeamId,
    'mock-goal-id' // TODO: Get actual goal ID from team
  );
  
  // Enable real-time updates for the selected team
  useRealtimeActivities(selectedTeamId);

  if (authLoading || teamsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const selectedTeam = teams?.find(t => t.id === selectedTeamId);
  const hasTeams = teams && teams.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Mile Quest</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">👤 {user?.name}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!hasTeams ? (
          // No teams state
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Welcome to Mile Quest!
            </h2>
            <p className="text-gray-600 mb-8">
              Join a team or create your own to start tracking your walking goals.
            </p>
            <div className="space-x-4">
              <Link
                href="/teams/new"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Create a Team
              </Link>
              <Link
                href="/teams/join"
                className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Join a Team
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Team selector for multiple teams */}
            {teams.length > 1 && (
              <div className="mb-6">
                <label htmlFor="team-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Team
                </label>
                <select
                  id="team-select"
                  value={selectedTeamId || ''}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="block w-full px-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Main dashboard content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column - Team Progress */}
              <div className="lg:col-span-2 space-y-6">
                {/* Team Progress Card */}
                {selectedTeam && teamProgress && (
                  <TeamProgressCard
                    teamName={selectedTeam.name}
                    progress={teamProgress}
                    userPreferredUnits={user?.preferredUnits as 'miles' | 'kilometers' | undefined}
                    loading={progressLoading}
                    error={progressError?.message}
                  />
                )}

                {/* Activity Feed */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Team Activity</h2>
                    <Link
                      href="/activities/log"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Log Today's Walk
                    </Link>
                  </div>
                  <ActivityFeed
                    activities={activities || []}
                    loading={activitiesLoading}
                    error={activitiesError?.message}
                    userPreferredUnits={user?.preferredUnits as 'miles' | 'kilometers' | undefined}
                    isRealtime={true}
                  />
                </div>
              </div>

              {/* Right column - Personal Stats */}
              <div className="space-y-6">
                {userStats && (
                  <PersonalStatsCard
                    stats={userStats}
                    userPreferredUnits={user?.preferredUnits as 'miles' | 'kilometers' | undefined}
                    loading={statsLoading}
                    error={statsError?.message}
                  />
                )}

                {/* Quick Actions */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <Link
                      href="/activities/log"
                      className="block w-full text-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Log Activity
                    </Link>
                    <Link
                      href={`/teams/${selectedTeamId}`}
                      className="block w-full text-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      View Team
                    </Link>
                    <Link
                      href="/teams/join"
                      className="block w-full text-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Join Another Team
                    </Link>
                  </div>
                </div>

                {/* Coming Soon Features */}
                <div className="bg-gray-100 rounded-lg p-6">
                  <h3 className="text-sm font-semibold text-gray-600 mb-3">Coming Soon</h3>
                  <ul className="space-y-2 text-sm text-gray-500">
                    <li>🔒 Achievements - Week 2</li>
                    <li>🔒 Photos - Week 2</li>
                    <li>🔒 Leaderboard - Week 3</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}