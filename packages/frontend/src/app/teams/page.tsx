'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useUserTeams } from '@/hooks/useTeams';
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
    <MobileLayout title="My Teams">
      <PullToRefresh onRefresh={reloadTeams} disabled={isLoading}>
        <div className="pb-20">
        {teams.length > 0 && (
          <div className="mb-8">
            <p className="text-gray-600">
              You're a member of {teams.length} team{teams.length === 1 ? '' : 's'}.
            </p>
          </div>
        )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {error && (
        <TouchCard className="mb-6 border-red-200 bg-red-50">
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
              <TouchCard className="h-full hover:shadow-lg transition-shadow duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    {team.avatarUrl ? (
                      <img
                        src={team.avatarUrl}
                        alt={team.name}
                        className="w-12 h-12 rounded-full mr-4"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-blue-100 rounded-full mr-4 flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-lg">
                          {team.name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                      <p className="text-sm text-gray-500">
                        {team.memberCount} member{team.memberCount === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  {team.role === 'ADMIN' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Admin
                    </span>
                  )}
                </div>
                
                {team.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {team.description}
                  </p>
                )}
                
                <div className="flex items-center text-sm text-gray-500">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Joined {new Date(team.joinedAt).toLocaleDateString()}
                </div>
              </TouchCard>
            </Link>
          ))}
        </div>
      )}

      {!isLoading && !error && teams.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No teams yet</h3>
          <p className="text-gray-500 mb-6">
            Create your first team or join an existing one to start tracking your walking goals together.
          </p>
          <div className="flex gap-4 justify-center">
            <TouchButton
              onClick={() => router.push('/teams/new')}
              variant="primary"
              className="inline-flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Team
            </TouchButton>
            <TouchButton
              variant="secondary"
              onClick={() => router.push('/teams/join')}
              className="inline-flex items-center"
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
  );
}