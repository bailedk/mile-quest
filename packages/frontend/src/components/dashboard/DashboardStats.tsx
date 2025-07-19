'use client';

import { formatDistance } from '@/services/activity.service';

interface DashboardStatsProps {
  totalDistance: number;
  weekDistance: number;
  bestDay: {
    date: string;
    distance: number;
  };
  userPreferredUnits?: 'miles' | 'kilometers';
}

export function DashboardStats({ 
  totalDistance, 
  weekDistance, 
  bestDay,
  userPreferredUnits = 'miles' 
}: DashboardStatsProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Week</h3>
      
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600">This Week</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatDistance(weekDistance, userPreferredUnits)}
          </p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">Your Best Day</p>
          <p className="text-lg font-semibold text-gray-900">
            {bestDay.date} ({formatDistance(bestDay.distance, userPreferredUnits)})
          </p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">All Time Total</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatDistance(totalDistance, userPreferredUnits)}
          </p>
        </div>
      </div>
    </div>
  );
}