/**
 * Stats Summary component - displays key metrics in a horizontal layout
 */

'use client';

import { MobileStatCard } from '@/components/mobile/MobileCard';
import { formatDistance } from '@/services/activity.service';

interface StatsSummaryProps {
  totalDistance: number;
  totalActivities: number;
  activeDays: { current: number; total: number };
  userPreferredUnits: 'miles' | 'kilometers';
}

export function StatsSummary({
  totalDistance,
  totalActivities,
  activeDays,
  userPreferredUnits,
}: StatsSummaryProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <MobileStatCard
        label="Total Distance"
        value={formatDistance(totalDistance, userPreferredUnits)}
      />
      <MobileStatCard
        label="Total Activities"
        value={totalActivities.toString()}
      />
      <MobileStatCard
        label="Active Days"
        value={`${activeDays.current}/${activeDays.total}`}
      />
    </div>
  );
}