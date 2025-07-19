'use client';

import { formatDistance } from '@/services/activity.service';
import { TeamGoalProgress } from '@/types/activity.types';

interface TeamProgressCardProps {
  teamName: string;
  progress: TeamGoalProgress;
  userPreferredUnits?: 'miles' | 'kilometers';
  loading?: boolean;
  error?: string | null;
}

export function TeamProgressCard({ 
  teamName, 
  progress, 
  userPreferredUnits = 'miles',
  loading = false,
  error = null 
}: TeamProgressCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  const progressPercentage = Math.min(progress.percentageComplete, 100);
  const progressBarColor = progress.onTrack ? 'bg-green-500' : 'bg-yellow-500';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{teamName}</h3>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-2xl font-bold text-gray-900">
              {formatDistance(progress.totalDistance, userPreferredUnits)}
            </span>
            <span className="text-sm text-gray-500">
              of {formatDistance(progress.targetDistance, userPreferredUnits)}
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ease-out ${progressBarColor}`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          
          <p className="text-sm text-gray-600 mt-2">
            {progressPercentage.toFixed(1)}% complete
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Remaining</p>
            <p className="text-sm font-medium text-gray-900 mt-1">
              {formatDistance(progress.remainingDistance, userPreferredUnits)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Days Left</p>
            <p className="text-sm font-medium text-gray-900 mt-1">
              {progress.daysRemaining}
            </p>
          </div>
        </div>

        {!progress.onTrack && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              You need to average {formatDistance(progress.averageDailyDistance, userPreferredUnits)} per day to reach your goal!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}