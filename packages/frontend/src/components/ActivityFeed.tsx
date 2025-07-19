'use client';

import { useEffect, useState } from 'react';
import { formatDistance, formatDuration } from '@/services/activity.service';
import { ActivityListItem } from '@/types/activity.types';
import { formatDistanceToNow } from 'date-fns';

interface ActivityFeedProps {
  activities: ActivityListItem[];
  loading?: boolean;
  error?: string | null;
  userPreferredUnits?: 'miles' | 'kilometers';
  isRealtime?: boolean;
}

export function ActivityFeed({ 
  activities, 
  loading = false, 
  error = null,
  userPreferredUnits = 'miles',
  isRealtime = false
}: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No activities yet. Start walking to see your team&apos;s progress!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isRealtime && (
        <div className="flex items-center justify-end mb-2">
          <span className="flex items-center text-xs text-green-600">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
            Live updates
          </span>
        </div>
      )}
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-600 font-semibold text-sm">
              {activity.userId.substring(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium text-gray-900 truncate">
                {activity.team.name}
              </p>
              <span className="text-gray-400">·</span>
              <p className="text-sm text-gray-500">
                {formatDistanceToNow(new Date(activity.startTime), { addSuffix: true })}
              </p>
            </div>
            <p className="text-sm text-gray-700 mt-1">
              {formatDistance(activity.distance, userPreferredUnits)} in {formatDuration(activity.duration)}
            </p>
            {activity.notes && (
              <p className="text-sm text-gray-600 mt-1 italic">{activity.notes}</p>
            )}
            {activity.isPrivate && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 mt-1">
                Private
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}