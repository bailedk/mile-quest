/**
 * Personal statistics card component
 */

'use client';

import { TouchCard } from '@/components/mobile/TouchInteractions';
import { formatDistance } from '@/services/activity.service';
import { formatBestDayDate } from '@/utils/dateFormatting';

interface PersonalStatsCardProps {
  personalStats: {
    totalDistance: number;
    thisWeek: { distance: number };
    thisMonth: { distance: number };
    bestDay: { date: Date | null; distance: number };
    currentStreak: number;
  } | null;
  userPreferredUnits: 'miles' | 'kilometers';
}

export function PersonalStatsCard({ personalStats, userPreferredUnits }: PersonalStatsCardProps) {
  if (!personalStats) {
    return (
      <TouchCard className="mb-6">
        <div className="text-center py-8">
          <p className="text-gray-500">No personal statistics available</p>
        </div>
      </TouchCard>
    );
  }

  return (
    <>
      {/* Personal Stats Cards Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Total Distance */}
        <TouchCard className="text-center">
          <p className="text-sm text-gray-600">Total Distance</p>
          <p className="text-xl font-semibold text-gray-900">
            {personalStats ? formatDistance(personalStats.totalDistance, userPreferredUnits) : '0 km'}
          </p>
        </TouchCard>

        {/* This Month */}
        <TouchCard className="text-center">
          <p className="text-sm text-gray-600">This Month</p>
          <p className="text-xl font-semibold text-gray-900">
            {formatDistance(personalStats.thisMonth.distance, userPreferredUnits)}
          </p>
        </TouchCard>
      </div>

      {/* Additional Stats */}
      <TouchCard className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Progress</h3>
        <div className="space-y-2 text-gray-700">
          <p className="text-sm">
            <span className="font-medium">This Week:</span> {formatDistance(personalStats.thisWeek.distance, userPreferredUnits)}
          </p>
          <p className="text-sm">
            <span className="font-medium">Your Best:</span> {formatBestDayDate(personalStats.bestDay.date)} ({formatDistance(personalStats.bestDay.distance, userPreferredUnits)})
          </p>
          <p className="text-sm">
            <span className="font-medium">Current Streak:</span> {personalStats.currentStreak} days
          </p>
        </div>
      </TouchCard>
    </>
  );
}