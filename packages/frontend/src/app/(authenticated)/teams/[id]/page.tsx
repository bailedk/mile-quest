'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Team, UpdateTeamInput } from '@/types/team.types';
import { TeamGoal } from '@mile-quest/shared';
import { teamService } from '@/services/team.service';
import { goalService } from '@/services/goal.service';
import { activityService, formatDistance } from '@/services/activity.service';
import { Button } from '@/components/patterns/Button';
import { useAuthStore } from '@/store/auth.store';
import { useToastContext } from '@/contexts/ToastContext';
import { AlertDialog } from '@/components/ui/AlertDialog';

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { showToast } = useToastContext();
  const teamId = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [goals, setGoals] = useState<TeamGoal[]>([]);
  const [userContributions, setUserContributions] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingGoals, setIsLoadingGoals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<UpdateTeamInput>({});
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [cancelGoalId, setCancelGoalId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const currentUserMember = team?.members.find(m => m.user.email === user?.email);
  const isAdmin = currentUserMember?.role === 'ADMIN';
  const userPreferredUnits = user?.preferredUnits || 'kilometers';

  useEffect(() => {
    if (!user) {
      router.push('/signin');
      return;
    }

    loadTeam();
    
    // Cleanup on unmount
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [user, router, teamId]);

  // Reload goals when navigating back from goal creation
  useEffect(() => {
    const handleFocus = () => {
      // Only reload if team is loaded and not currently loading goals
      if (team && !isLoadingGoals) {
        loadGoals();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [team, isLoadingGoals]);

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
    // Prevent multiple simultaneous loads
    if (isLoadingGoals) return;
    
    // Cancel any existing request
    if (abortController) {
      abortController.abort();
    }
    
    // Create new abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);
    
    try {
      setIsLoadingGoals(true);
      const teamGoals = await goalService.getTeamGoals(teamId);
      
      // Only update state if the request wasn't aborted
      if (!controller.signal.aborted) {
        setGoals(teamGoals);
        
        // Load user contributions for active goals
        const activeGoals = teamGoals.filter(g => g.status === 'ACTIVE');
        if (activeGoals.length > 0 && user) {
          const contributions: Record<string, number> = {};
          for (const goal of activeGoals) {
            try {
              const totalDistance = await activityService.getUserTotalDistance(
                user.id,
                teamId,
                goal.startDate ? new Date(goal.startDate) : undefined,
                goal.targetDate ? new Date(goal.targetDate) : new Date()
              );
              contributions[goal.id] = totalDistance;
            } catch (err) {
              console.error(`Failed to load contribution for goal ${goal.id}:`, err);
              contributions[goal.id] = 0;
            }
          }
          setUserContributions(contributions);
        }
      }
    } catch (err: any) {
      // Ignore abort errors
      if (err.name !== 'AbortError') {
        console.error('Failed to load goals:', err);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingGoals(false);
        setAbortController(null);
      }
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

  const handleCancelGoal = async () => {
    if (!cancelGoalId) return;

    setIsCancelling(true);
    try {
      await goalService.updateGoal(teamId, cancelGoalId, {
        status: 'FAILED',
      });
      showToast('Goal cancelled successfully', 'success');
      setShowCancelDialog(false);
      setCancelGoalId(null);
      loadGoals(); // Reload goals
    } catch (error) {
      console.error('Failed to cancel goal:', error);
      showToast('Failed to cancel goal', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  // Calculate goal metrics
  const getGoalMetrics = (goal: TeamGoal) => {
    const now = new Date();
    const startDate = goal.startDate ? new Date(goal.startDate) : null;
    const endDate = goal.targetDate ? new Date(goal.targetDate) : null;
    
    const isUpcoming = startDate && startDate > now;
    const daysUntilStart = isUpcoming && startDate
      ? Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    const percentComplete = goal.totalDistance > 0
      ? Math.min(100, (goal.currentDistance / goal.totalDistance) * 100)
      : 0;
    
    const daysRemaining = endDate && endDate > now
      ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    const distanceLeft = Math.max(0, goal.totalDistance - goal.currentDistance);
    const dailyPaceNeeded = daysRemaining && daysRemaining > 0
      ? distanceLeft / daysRemaining
      : 0;
    
    const userContribution = userContributions[goal.id] || 0;
    const contributionPercentage = goal.totalDistance > 0
      ? (userContribution / goal.totalDistance) * 100
      : 0;
    
    // Check if on track
    let isOnTrack = true;
    if (startDate && endDate && !isUpcoming && daysRemaining !== null) {
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const elapsedDays = totalDays - daysRemaining;
      const expectedProgress = (elapsedDays / totalDays) * 100;
      isOnTrack = percentComplete >= expectedProgress * 0.9; // 90% of expected progress
    }
    
    return {
      isUpcoming,
      daysUntilStart,
      percentComplete,
      daysRemaining,
      distanceLeft,
      dailyPaceNeeded,
      userContribution,
      contributionPercentage,
      isOnTrack,
    };
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
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={editFormData.isPublic}
                onChange={(e) => setEditFormData({ ...editFormData, isPublic: e.target.checked })}
                className="mr-2 text-blue-600"
              />
              Public Team
            </label>
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
            {goals.map((goal) => {
              const metrics = getGoalMetrics(goal);
              const progressColor = metrics.percentComplete >= 100 
                ? 'bg-green-500' 
                : metrics.isOnTrack 
                  ? 'bg-blue-500' 
                  : 'bg-orange-500';
              
              const statusColor = metrics.isUpcoming
                ? 'text-purple-600 bg-purple-100'
                : goal.status === 'PASSED' 
                  ? 'text-green-600 bg-green-100' 
                  : goal.status === 'ACTIVE'
                    ? 'text-blue-600 bg-blue-100'
                    : goal.status === 'FAILED'
                      ? 'text-red-600 bg-red-100'
                      : 'text-gray-600 bg-gray-100';
              
              return (
              <div 
                key={goal.id} 
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-gradient-to-br from-white to-gray-50"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 
                      className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                      onClick={() => router.push(`/teams/${team.id}/goals/${goal.id}`)}
                    >
                      {goal.name}
                    </h3>
                    {goal.description && (
                      <p className="text-gray-600 text-sm mt-1 line-clamp-2">{goal.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusColor}`}>
                      {metrics.isUpcoming ? 'UPCOMING' : goal.status}
                    </span>
                    {isAdmin && goal.status === 'ACTIVE' && (
                      <button
                        onClick={() => {
                          setCancelGoalId(goal.id);
                          setShowCancelDialog(true);
                        }}
                        className="p-1 hover:bg-red-50 rounded text-red-600 transition-colors"
                        title="Cancel goal"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Progress Section */}
                {metrics.isUpcoming ? (
                  <div className="bg-purple-50 rounded-lg p-3 mb-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">
                        Starting in {metrics.daysUntilStart} {metrics.daysUntilStart === 1 ? 'day' : 'days'}
                      </div>
                      <div className="text-sm text-purple-500 mt-1">
                        {goal.startDate && new Date(goal.startDate).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Progress Bar with Personal Contribution */}
                    <div className="mb-3">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-2xl font-bold text-gray-900">
                          {metrics.percentComplete.toFixed(0)}%
                        </span>
                        <span className="text-sm text-gray-600">
                          {formatDistance(goal.currentDistance, userPreferredUnits)} / {formatDistance(goal.totalDistance, userPreferredUnits)}
                        </span>
                      </div>
                      <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`absolute left-0 top-0 h-full ${progressColor} transition-all duration-500 ease-out`}
                          style={{ width: `${Math.min(100, metrics.percentComplete)}%` }}
                        />
                        {/* Personal contribution overlay */}
                        {metrics.contributionPercentage > 0 && (
                          <div
                            className="absolute left-0 top-0 h-full bg-indigo-600 opacity-40"
                            style={{ width: `${Math.min(100, metrics.contributionPercentage)}%` }}
                          />
                        )}
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-gray-600">
                        <span>{formatDistance(metrics.distanceLeft, userPreferredUnits)} remaining</span>
                        {metrics.daysRemaining !== null && (
                          <span className={metrics.isOnTrack ? 'text-green-600' : 'text-orange-600'}>
                            {metrics.isOnTrack ? 'On Track' : 'Behind Schedule'}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/70 rounded-lg p-2">
                        <div className="text-xs text-gray-600">Your Contribution</div>
                        <div className="text-sm font-bold text-indigo-700">
                          {formatDistance(metrics.userContribution, userPreferredUnits)}
                        </div>
                        <div className="text-xs text-indigo-600">
                          {metrics.contributionPercentage.toFixed(1)}% of goal
                        </div>
                      </div>
                      
                      <div className="bg-white/70 rounded-lg p-2">
                        <div className="text-xs text-gray-600">Time Remaining</div>
                        <div className="text-sm font-bold text-gray-900">
                          {metrics.daysRemaining !== null ? `${metrics.daysRemaining} days` : 'No deadline'}
                        </div>
                        {metrics.dailyPaceNeeded > 0 && metrics.daysRemaining && metrics.daysRemaining > 0 && (
                          <div className="text-xs text-gray-600">
                            {formatDistance(metrics.dailyPaceNeeded, userPreferredUnits)}/day needed
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
                
                <div className="flex items-center justify-between text-sm mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-4 text-gray-500">
                    {goal.startDate && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(goal.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    {goal.targetDate && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        {new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                  
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => router.push(`/teams/${team.id}/goals/${goal.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
              );
            })}
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

      {/* Cancel Goal Confirmation Dialog */}
      <AlertDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        title="Cancel Team Goal"
        description="Are you sure you want to cancel this goal? This action cannot be undone and all progress will be marked as incomplete."
        confirmText="Cancel Goal"
        cancelText="Keep Goal"
        onConfirm={handleCancelGoal}
        isDestructive
        isLoading={isCancelling}
      />
    </div>
  );
}