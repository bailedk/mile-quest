'use client';

import { formatDistance, formatDuration } from '@/services/activity.service';
import { ActivityStats } from '@/types/activity.types';
import { format } from 'date-fns';

interface PersonalStatsCardProps {
  stats: ActivityStats;
  userPreferredUnits?: 'miles' | 'kilometers';
  loading?: boolean;
  error?: string | null;
}

export function PersonalStatsCard({ 
  stats, 
  userPreferredUnits = 'miles',
  loading = false,
  error = null 
}: PersonalStatsCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
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

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Stats</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Distance</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">
            {formatDistance(stats.totalDistance, userPreferredUnits)}
          </p>
        </div>
        
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Activities</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">
            {stats.totalActivities}
          </p>
        </div>
        
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Distance</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">
            {formatDistance(stats.averageDistance, userPreferredUnits)}
          </p>
        </div>
        
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Current Streak</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">
            {stats.currentStreak} days
          </p>
        </div>
      </div>

      {stats.lastActivityAt && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Last activity: {format(new Date(stats.lastActivityAt), 'MMM d, h:mm a')}
          </p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Total time: {formatDuration(stats.totalDuration)}
          </p>
          {stats.longestStreak > stats.currentStreak && (
            <p className="text-sm text-gray-600">
              Best streak: {stats.longestStreak} days
            </p>
          )}
        </div>
      </div>
    </div>
  );
}