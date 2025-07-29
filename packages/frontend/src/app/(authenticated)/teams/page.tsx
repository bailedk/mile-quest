'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useUserTeams } from '@/hooks/useTeams';
import { useDashboard } from '@/hooks/useDashboard';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { TouchCard, TouchButton, PullToRefresh } from '@/components/mobile/TouchInteractions';

export default function TeamsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  // Use React Query hook for teams data
  const { 
    data: teams = [], 
    isLoading, 
    error,
    refetch: reloadTeams 
  } = useUserTeams();
  
  // Get dashboard data for team progress
  const { data: dashboardData } = useDashboard();

  useEffect(() => {
    if (!user) {
      router.push('/signin');
      return;
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <>
      <MobileLayout title="My Teams">
      <PullToRefresh onRefresh={reloadTeams} disabled={isLoading}>
        <div className="pb-20">
        {teams.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <p className="text-gray-600">
                You're a member of {teams.length} team{teams.length === 1 ? '' : 's'}.
              </p>
              <TouchButton
                onClick={() => router.push('/teams/new')}
                variant="secondary"
                size="sm"
                className="inline-flex items-center text-blue-600 hover:text-blue-700"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Team
              </TouchButton>
            </div>
          </div>
        )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border border-blue-400 opacity-20"></div>
          </div>
          <p className="mt-4 text-sm text-gray-500 animate-pulse">Loading your teams...</p>
        </div>
      )}

      {error && (
        <TouchCard className="mb-6 border-2 border-red-200 bg-red-50 rounded-xl p-6">
          <div className="flex justify-between items-center">
            <span className="text-red-700">{error.message || 'Failed to load teams'}</span>
            <TouchButton 
              variant="secondary" 
              size="sm" 
              onClick={() => reloadTeams()}
              className="ml-4"
            >
              Retry
            </TouchButton>
          </div>
        </TouchCard>
      )}

      {!isLoading && !error && teams.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.id}`}
              className="block"
            >
              <TouchCard className="h-full hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-white to-gray-50 border-2 border-gray-100 hover:border-blue-200 rounded-xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="p-8">
                  <div className="flex items-start justify-between mb-6 relative z-10">
                  <div className="flex items-center">
                    {team.avatarUrl ? (
                      <div className="relative mr-4 group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full opacity-0 group-hover:opacity-75 blur transition-all duration-300" />
                        <img
                          src={team.avatarUrl}
                          alt={team.name}
                          className="relative w-12 h-12 rounded-full ring-2 ring-white shadow-lg object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mr-4 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                        <span className="text-white font-bold text-lg">
                          {team.name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-300">{team.name}</h3>
                      <p className="text-sm text-gray-500">
                        <span className="inline-flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          {team.memberCount} member{team.memberCount === 1 ? '' : 's'}
                        </span>
                      </p>
                    </div>
                  </div>
                  {team.role === 'ADMIN' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm">
                      Admin
                    </span>
                  )}
                </div>
                
                {team.description && (
                  <p className="text-gray-600 text-sm mb-6 line-clamp-2 relative z-10">
                    {team.description}
                  </p>
                )}
                
                {/* Team Progress Indicator */}
                {(() => {
                  const teamProgress = dashboardData?.teams?.find(t => t.id === team.id)?.progress;
                  if (!teamProgress || !teamProgress.goalId) return null;
                  
                  return (
                    <div className="mb-6 relative z-10">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-600 font-medium">{teamProgress.goalName}</span>
                        <span className="text-blue-600 font-semibold">{teamProgress.percentComplete}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${Math.min(teamProgress.percentComplete, 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                        <span>{teamProgress.currentDistance.toFixed(1)} / {teamProgress.targetDistance} miles</span>
                        {teamProgress.daysRemaining !== null && (
                          <span className="flex items-center">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {teamProgress.daysRemaining} days left
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
                
                  <div className="flex items-center justify-between text-sm relative z-10">
                    <div className="flex items-center text-gray-500">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Joined {new Date(team.joinedAt).toLocaleDateString()}
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </TouchCard>
            </Link>
          ))}
        </div>
      )}

      {!isLoading && !error && teams.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto h-32 w-32 text-gray-300 mb-6 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full opacity-50 animate-pulse" />
            <svg className="relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-3">No teams yet</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Create your first team or join an existing one to start tracking your walking goals together.
          </p>
          <div className="flex gap-4 justify-center">
            <TouchButton
              onClick={() => router.push('/teams/new')}
              variant="primary"
              className="inline-flex items-center bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Team
            </TouchButton>
            <TouchButton
              variant="secondary"
              onClick={() => router.push('/teams/join')}
              className="inline-flex items-center border-2 border-gray-300 hover:border-blue-500 transform hover:scale-105 transition-all duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Join Team
            </TouchButton>
          </div>
        </div>
      )}
        </div>
      </PullToRefresh>
      </MobileLayout>
    </>
  );
}