/**
 * Enhanced recent activities component with better formatting
 */

'use client';

import Link from 'next/link';
import { MobileCard } from '@/components/mobile/MobileCard';
import { formatDistance } from '@/services/activity.service';
import { getRelativeTime } from '@/utils/dateFormatting';

interface Activity {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  type: string;
  distance: number;
  duration: number;
  notes?: string;
  createdAt: string;
}

interface EnhancedRecentActivitiesProps {
  activities: Activity[];
  userPreferredUnits: 'miles' | 'kilometers';
}

export function EnhancedRecentActivities({ 
  activities, 
  userPreferredUnits 
}: EnhancedRecentActivitiesProps) {
  if (activities.length === 0) {
    return (
      <MobileCard>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activities</h3>
        <div className="text-center py-4">
          <p className="text-gray-500 mb-4">No recent activities</p>
          <Link
            href="/activities/new"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Log Your First Activity
          </Link>
        </div>
      </MobileCard>
    );
  }

  return (
    <MobileCard>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
        <Link
          href="/activities"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View All
        </Link>
      </div>
      
      <div className="space-y-3">
        {activities.slice(0, 5).map((activity) => (
          <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
            {/* User Avatar */}
            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
              {activity.userAvatarUrl ? (
                <img
                  src={activity.userAvatarUrl}
                  alt={activity.userName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-medium text-gray-700">
                  {activity.userName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Activity Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {activity.userName}
                </p>
                <span className="text-xs text-gray-500">
                  {getRelativeTime(activity.createdAt)}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mt-1">
                {activity.type}
                <br />
                <span className="text-gray-600">
                  {formatDistance(activity.distance, userPreferredUnits)}
                </span>
                {activity.duration > 0 && (
                  <span className="text-gray-500 ml-2">
                    • {Math.round(activity.duration / 60)} min
                  </span>
                )}
              </p>
              
              {activity.notes && (
                <p className="text-xs text-gray-500 mt-1 italic">
                  "{activity.notes}"
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </MobileCard>
  );
}