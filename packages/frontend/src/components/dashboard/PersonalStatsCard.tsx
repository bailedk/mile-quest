/**
 * Personal statistics card component
 */

'use client';

import { MobileCard, MobileStatCard } from '@/components/mobile/MobileCard';
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
      <MobileCard>
        <div className="text-center py-4">
          <p className="text-gray-500">No personal statistics available</p>
        </div>
      </MobileCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Personal Stats Cards Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Distance */}
        <MobileStatCard
          label="Total Distance"
          value={personalStats ? formatDistance(personalStats.totalDistance, userPreferredUnits) : '0 km'}
        />

        {/* This Month */}
        <MobileStatCard
          label="This Month"
          value={formatDistance(personalStats.thisMonth?.distance || 0, userPreferredUnits)}
        />
      </div>

      {/* Additional Stats */}
      <MobileCard>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Progress</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">This Week</span>
            <span className="text-sm font-semibold text-gray-900">{formatDistance(personalStats.thisWeek?.distance || 0, userPreferredUnits)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">Your Best</span>
            <span className="text-sm font-semibold text-gray-900">{formatBestDayDate(personalStats.bestDay?.date || null)} ({formatDistance(personalStats.bestDay?.distance || 0, userPreferredUnits)})</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">Current Streak</span>
            <span className="text-sm font-semibold text-gray-900">{personalStats.currentStreak} days</span>
          </div>
        </div>
      </MobileCard>
    </div>
  );
}