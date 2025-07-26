'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Team, UpdateTeamInput } from '@/types/team.types';
import { TeamGoal } from '@mile-quest/shared';
import { teamService } from '@/services/team.service';
import { goalService } from '@/services/goal.service';
import { Button } from '@/components/patterns/Button';
import { useAuthStore } from '@/store/auth.store';

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const teamId = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [goals, setGoals] = useState<TeamGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingGoals, setIsLoadingGoals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<UpdateTeamInput>({});

  const currentUserMember = team?.members.find(m => m.user.email === user?.email);
  const isAdmin = currentUserMember?.role === 'ADMIN';

  useEffect(() => {
    if (!user) {
      router.push('/signin');
      return;
    }

    loadTeam();
  }, [user, router, teamId]);

  // Reload goals when navigating back from goal creation
  useEffect(() => {
    const handleFocus = () => {
      if (team) {
        loadGoals();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [team]);

  const loadTeam = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const teamData = await teamService.getTeam(teamId);
      setTeam(teamData);
      setEditFormData({
        name: teamData.name,
        description: teamData.description || '',
        isPublic: teamData.isPublic,
        maxMembers: teamData.maxMembers,
      });
      // Load goals after team is loaded
      loadGoals();
    } catch (err: any) {
      setError(err.message || 'Failed to load team');
    } finally {
      setIsLoading(false);
    }
  };

  const loadGoals = async () => {
    try {
      setIsLoadingGoals(true);
      console.log('Loading goals for team:', teamId); // Debug log
      const teamGoals = await goalService.getTeamGoals(teamId);
      console.log('Loaded goals:', teamGoals); // Debug log
      setGoals(teamGoals);
    } catch (err: any) {
      console.error('Failed to load goals for team', teamId, ':', err);
      console.error('Error details:', {
        message: err.message,
        status: err.status,
        response: err.response?.data
      });
      // Don't show error for goals, just log it
    } finally {
      setIsLoadingGoals(false);
    }
  };

  const handleUpdateTeam = async () => {
    if (!team) return;

    try {
      setError(null);
      const updatedTeam = await teamService.updateTeam(team.id, editFormData);
      setTeam(updatedTeam);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update team');
    }
  };

  const handleLeaveTeam = async () => {
    if (!team || !confirm('Are you sure you want to leave this team?')) return;

    try {
      await teamService.leaveTeam(team.id);
      router.push('/teams');
    } catch (err: any) {
      setError(err.message || 'Failed to leave team');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!team || !confirm('Are you sure you want to remove this member?')) return;

    try {
      await teamService.removeMember(team.id, userId);
      loadTeam(); // Reload to get updated member list
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    }
  };

  const handleChangeRole = async (userId: string, newRole: 'ADMIN' | 'MEMBER') => {
    if (!team) return;

    try {
      await teamService.updateMemberRole(team.id, userId, newRole);
      loadTeam(); // Reload to get updated roles
    } catch (err: any) {
      setError(err.message || 'Failed to update member role');
    }
  };

  const handleDeleteTeam = async () => {
    if (!team) return;
    
    const confirmMessage = `Are you sure you want to delete "${team.name}"? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;

    try {
      setError(null);
      await teamService.deleteTeam(team.id);
      router.push('/teams');
    } catch (err: any) {
      setError(err.message || 'Failed to delete team');
    }
  };

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Team Not Found</h1>
          <p className="text-gray-600 mb-6">This team doesn't exist or you don't have access to it.</p>
          <Button onClick={() => router.push('/teams')}>Back to Teams</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Navigation - Following UI/UX Design System */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/teams')}
          className="inline-flex items-center h-10 px-4 text-base font-medium text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
          aria-label="Back to teams list"
        >
          <svg 
            className="w-6 h-6 mr-2" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m0 0l7-7m-7 7l7 7" />
          </svg>
          Back to Teams
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {/* Team Header */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        {isEditing ? (
          <div className="space-y-4">
            <input
              type="text"
              value={editFormData.name || ''}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              className="text-2xl font-bold w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            />
            <textarea
              value={editFormData.description || ''}
              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
              rows={3}
              placeholder="Team description..."
            />
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={editFormData.isPublic}
                  onChange={(e) => setEditFormData({ ...editFormData, isPublic: e.target.checked })}
                  className="mr-2 text-blue-600"
                />
                Public Team
              </label>
              <label className="flex items-center">
                <span className="mr-2">Max Members:</span>
                <input
                  type="number"
                  value={editFormData.maxMembers || 50}
                  onChange={(e) => setEditFormData({ ...editFormData, maxMembers: parseInt(e.target.value) || 50 })}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900"
                  min="2"
                  max="100"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpdateTeam}>Save Changes</Button>
              <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 mb-4">
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{team.name}</h1>
                {team.description && (
                  <p className="text-gray-600">{team.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-sm text-gray-500">
                  <span>{team.members.length} {team.members.length === 1 ? 'member' : 'members'}</span>
                  <span className="hidden sm:inline px-2">•</span>
                  <span>{team.isPublic ? 'Public' : 'Private'} team</span>
                  <span className="hidden sm:inline px-2">•</span>
                  <span>Max {team.maxMembers} members</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                {isAdmin && (
                  <>
                    <Button 
                      onClick={() => router.push(`/teams/${team.id}/goals/new`)}
                      className="w-full sm:w-auto"
                    >
                      Create Goal
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => setIsEditing(true)}
                      className="w-full sm:w-auto"
                    >
                      Edit Team
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={handleDeleteTeam}
                      className="!text-red-600 hover:!bg-red-50 hover:!border-red-300 w-full sm:w-auto"
                    >
                      Delete Team
                    </Button>
                  </>
                )}
                {currentUserMember && (
                  <Button 
                    variant="secondary" 
                    onClick={handleLeaveTeam}
                    className="w-full sm:w-auto"
                  >
                    Leave Team
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Team Goals */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Team Goals</h2>
          {isAdmin && (
            <Button 
              size="sm" 
              onClick={() => router.push(`/teams/${team.id}/goals/new`)}
              className="sm:w-auto"
            >
              Add Goal
            </Button>
          )}
        </div>
        
        {isLoadingGoals ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : goals.length > 0 ? (
          <div className="space-y-4">
            {goals.map((goal) => (
              <div 
                key={goal.id} 
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 
                    className="text-lg font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                    onClick={() => router.push(`/teams/${team.id}/goals/${goal.id}`)}
                  >
                    {goal.name}
                  </h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    goal.status === 'COMPLETED' 
                      ? 'bg-green-100 text-green-800' 
                      : goal.status === 'ACTIVE'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {goal.status}
                  </span>
                </div>
                
                {goal.description && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">{goal.description}</p>
                )}
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4 text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {goal.totalDistance.toFixed(1)} miles
                    </span>
                    {goal.targetDate && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(goal.targetDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${Math.min(100, (goal.currentDistance / goal.totalDistance) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 font-medium">
                      {Math.round((goal.currentDistance / goal.totalDistance) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-600 text-center py-8">
            <p>No goals yet. Create your first team goal to start your journey!</p>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Team Members</h2>
        <div className="space-y-4">
          {team.members.map((member) => {
            const userName = member.user?.name || member.user?.email || 'Unknown User';
            const userEmail = member.user?.email || 'No email';
            const userInitial = userName.charAt(0).toUpperCase() || '?';
            return (
            <div key={member.id} className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0">
              <div className="flex items-center">
                {member.user?.avatarUrl ? (
                  <img
                    src={member.user?.avatarUrl}
                    alt={userName}
                    className="w-10 h-10 rounded-full mr-3"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-200 rounded-full mr-3 flex items-center justify-center">
                    <span className="text-gray-600 font-semibold">
                      {userInitial}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900">
                    {userName}
                    {userEmail === user?.email && <span className="text-gray-500"> (You)</span>}
                  </p>
                  <p className="text-sm text-gray-500">{userEmail}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  member.role === 'ADMIN' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {member.role}
                </span>
                {isAdmin && userEmail !== user?.email && (
                  <div className="relative group">
                    <button className="p-1 hover:bg-gray-100 rounded">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 hidden group-hover:block">
                      {member.role === 'MEMBER' && (
                        <button
                          onClick={() => handleChangeRole(member.user?.id || member.userId, 'ADMIN')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Make Admin
                        </button>
                      )}
                      {member.role === 'ADMIN' && (
                        <button
                          onClick={() => handleChangeRole(member.user?.id || member.userId, 'MEMBER')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Remove Admin
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveMember(member.user?.id || member.userId)}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                      >
                        Remove from Team
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Invite Section */}
      {isAdmin && (
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-2">Invite Team Members</h3>
          <p className="text-blue-800 mb-4">
            Share your team ID with others to let them join{team.isPublic ? '' : ' (invite code coming soon)'}.
          </p>
          <div className="bg-white rounded-md p-3 font-mono text-sm text-gray-700">
            Team ID: {team.id}
          </div>
        </div>
      )}
    </div>
  );
}