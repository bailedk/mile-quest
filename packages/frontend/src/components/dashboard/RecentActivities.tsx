'use client';

import { formatDistance, formatDuration } from '@/services/activity.service';
import { formatDistanceToNow } from 'date-fns';

interface RecentActivity {
  id: string;
  userName: string;
  userInitials: string;
  distance: number;
  duration: number;
  timestamp: string;
  notes?: string;
}

interface RecentActivitiesProps {
  activities: RecentActivity[];
  userPreferredUnits?: 'miles' | 'kilometers';
  maxItems?: number;
}

export function RecentActivities({ 
  activities, 
  userPreferredUnits = 'miles',
  maxItems = 5
}: RecentActivitiesProps) {
  const displayActivities = activities.slice(0, maxItems);

  if (displayActivities.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Team Activities</h3>
        <p className="text-gray-500 text-center py-4">
          No activities yet. Be the first to log a walk!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Team Activities</h3>
      
      <div className="space-y-3">
        {displayActivities.map((activity) => (
          <div key={activity.id} className="flex items-start space-x-3 py-2">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-xs">
                {activity.userInitials}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium text-gray-900">
                  {activity.userName}
                </p>
                <span className="text-gray-400">·</span>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </p>
              </div>
              <p className="text-sm text-gray-700">
                {formatDistance(activity.distance, userPreferredUnits)} in {formatDuration(activity.duration)}
              </p>
              {activity.notes && (
                <p className="text-xs text-gray-600 mt-1 italic">{activity.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}