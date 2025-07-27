import React, { useMemo, useState } from 'react';
import { DashboardTeam } from '@/types/dashboard';
import { formatDistance } from '@/services/activity.service';
import { TouchButton } from '@/components/mobile/TouchInteractions';
import { MobileCard } from '@/components/mobile/MobileCard';
import { useAuthStore } from '@/store/auth.store';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { goalService } from '@/services/goal.service';
import { useRouter } from 'next/navigation';
import { useToastContext } from '@/contexts/ToastContext';

interface TeamGoalCardProps {
  team: DashboardTeam;
  userPreferredUnits: 'kilometers' | 'miles';
  personalContribution?: number; // in meters
  onRefresh?: () => void;
}

export const TeamGoalCard: React.FC<TeamGoalCardProps> = ({
  team,
  userPreferredUnits,
  personalContribution = 0,
  onRefresh,
}) => {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showToast } = useToastContext();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const isAdmin = team.role === 'admin' || team.role === 'owner';

  // Debug logging (remove in production)
  // console.log('TeamGoalCard - team data:', team);
  // console.log('TeamGoalCard - team.progress:', team.progress);
  // console.log('TeamGoalCard - personalContribution:', personalContribution);

  // Calculate all the metrics
  const metrics = useMemo(() => {
    if (!team.progress) {
      return null;
    }

    const { currentDistance, targetDistance, percentComplete, daysRemaining, isOnTrack } = team.progress;
    
    // Distance calculations
    const distanceLeft = Math.max(0, targetDistance - currentDistance);
    const contributionPercentage = targetDistance > 0 
      ? (personalContribution / targetDistance) * 100 
      : 0;

    // Format distances based on user preference
    const formatDist = (meters: number) => formatDistance(meters, userPreferredUnits);

    // Daily pace needed to complete on time
    const dailyPaceNeeded = daysRemaining && daysRemaining > 0 
      ? distanceLeft / daysRemaining 
      : 0;

    return {
      currentDistance: formatDist(currentDistance),
      targetDistance: formatDist(targetDistance),
      distanceLeft: formatDist(distanceLeft),
      personalContribution: formatDist(personalContribution),
      contributionPercentage: contributionPercentage.toFixed(1),
      percentComplete,
      daysRemaining,
      isOnTrack,
      dailyPaceNeeded: formatDist(dailyPaceNeeded),
      unit: userPreferredUnits === 'kilometers' ? 'km' : 'mi',
    };
  }, [team.progress, personalContribution, userPreferredUnits]);

  const handleCancelGoal = async () => {
    if (!team.progress?.goalId) return;

    setIsCancelling(true);
    try {
      await goalService.updateGoal(team.id, team.progress.goalId, {
        status: 'FAILED',
      });
      showToast('Goal cancelled successfully', 'success');
      setShowCancelDialog(false);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to cancel goal:', error);
      showToast('Failed to cancel goal', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  if (!team.progress || !metrics) {
    return (
      <MobileCard className="bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center py-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Active Goal</h3>
          <p className="text-gray-600 mb-4">Your team hasn't set a goal yet</p>
          {isAdmin && (
            <TouchButton
              variant="primary"
              onPress={() => router.push(`/teams/${team.id}/goals/new`)}
            >
              Create Team Goal
            </TouchButton>
          )}
        </div>
      </MobileCard>
    );
  }

  // Check if goal hasn't started yet
  const isUpcoming = team.progress.startDate && new Date(team.progress.startDate) > new Date();
  const daysUntilStart = isUpcoming 
    ? Math.ceil((new Date(team.progress.startDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const progressColor = metrics.percentComplete >= 100 
    ? 'bg-green-500' 
    : metrics.isOnTrack 
      ? 'bg-blue-500' 
      : 'bg-orange-500';

  const statusColor = isUpcoming
    ? 'text-purple-600 bg-purple-100'
    : metrics.percentComplete >= 100
      ? 'text-green-600 bg-green-100'
      : metrics.isOnTrack
        ? 'text-blue-600 bg-blue-100'
        : 'text-orange-600 bg-orange-100';

  return (
    <>
      <MobileCard className="bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
        {/* Header Section */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900">{team.progress.goalName}</h3>
            <p className="text-sm text-gray-600 mt-1">{team.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
              {isUpcoming ? 'UPCOMING' : metrics.percentComplete >= 100 ? 'COMPLETED' : 'ACTIVE'}
            </span>
          </div>
        </div>

        {/* Progress Bar Section */}
        <div className="mb-6">
          {isUpcoming ? (
            <div className="text-center py-4">
              <div className="text-2xl font-bold text-purple-600 mb-2">
                Starting in {daysUntilStart} {daysUntilStart === 1 ? 'day' : 'days'}
              </div>
              <div className="text-sm text-gray-600">
                Goal starts on {new Date(team.progress.startDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-3xl font-bold text-gray-900">
                  {metrics.percentComplete.toFixed(0)}%
                </span>
                <span className="text-sm text-gray-600">
                  {metrics.currentDistance} / {metrics.targetDistance} {metrics.unit}
                </span>
              </div>
          
              <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`absolute left-0 top-0 h-full ${progressColor} transition-all duration-500 ease-out`}
                  style={{ width: `${Math.min(100, metrics.percentComplete)}%` }}
                />
                {/* Personal contribution overlay */}
                {metrics.contributionPercentage && parseFloat(metrics.contributionPercentage) > 0 && (
                  <div
                    className="absolute left-0 top-0 h-full bg-indigo-600 opacity-50"
                    style={{ width: `${Math.min(100, parseFloat(metrics.contributionPercentage))}%` }}
                  />
                )}
              </div>
              
              <div className="mt-2 text-xs text-gray-600">
                <span className="font-medium">{metrics.distanceLeft} {metrics.unit}</span> remaining
              </div>
            </>
          )}
        </div>

        {/* Stats Grid - Only show for active goals */}
        {!isUpcoming && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Personal Contribution */}
            <div className="bg-white/50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Your Contribution</div>
              <div className="text-lg font-bold text-indigo-700">
                {metrics.personalContribution} {metrics.unit}
              </div>
              <div className="text-xs text-indigo-600">
                {metrics.contributionPercentage}% of goal
              </div>
            </div>

            {/* Days Remaining */}
            <div className="bg-white/50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Time Remaining</div>
              <div className="text-lg font-bold text-gray-900">
                {metrics.daysRemaining !== null ? `${metrics.daysRemaining} days` : 'No deadline'}
              </div>
              {metrics.dailyPaceNeeded && metrics.daysRemaining && metrics.daysRemaining > 0 && (
                <div className="text-xs text-gray-600">
                  {metrics.dailyPaceNeeded} {metrics.unit}/day needed
                </div>
              )}
            </div>
          </div>
        )}

        {/* Goal Details */}
        <div className="border-t border-gray-200/50 pt-4 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total Goal Distance</span>
            <span className="font-semibold text-gray-900">
              {metrics.targetDistance} {metrics.unit}
            </span>
          </div>
          {team.progress.startDate && (
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-600">Start Date</span>
              <span className="font-semibold text-gray-900">
                {new Date(team.progress.startDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
          {team.progress.endDate && (
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-600">End Date</span>
              <span className="font-semibold text-gray-900">
                {new Date(team.progress.endDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
          {metrics.daysRemaining !== null && (
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-600">Status</span>
              <span className={`font-semibold ${metrics.isOnTrack ? 'text-green-600' : 'text-orange-600'}`}>
                {metrics.isOnTrack ? 'On Track' : 'Behind Schedule'}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <TouchButton
            variant="primary"
            className="flex-1"
            onPress={() => router.push(`/teams/${team.id}/goals/${team.progress?.goalId}`)}
          >
            View Details
          </TouchButton>
          
          {isAdmin && metrics.percentComplete < 100 && (
            <TouchButton
              variant="ghost"
              className="text-red-600"
              onPress={() => setShowCancelDialog(true)}
            >
              Cancel
            </TouchButton>
          )}
        </div>
      </MobileCard>

      {/* Cancel Confirmation Dialog */}
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
    </>
  );
};