'use client';

import { useState, useEffect } from 'react';
import { formatDistance } from '@/services/activity.service';
import { useRealtimeActivities } from '@/hooks/useRealtimeActivities';
import { ConnectionStatus } from '@/components/ConnectionStatus';

interface DashboardStatsProps {
  totalDistance: number;
  weekDistance: number;
  bestDay: {
    date: string;
    distance: number;
  };
  userPreferredUnits?: 'miles' | 'kilometers';
  teamId?: string | null;
  enableRealtime?: boolean;
  showConnectionStatus?: boolean;
}

export function DashboardStats({ 
  totalDistance, 
  weekDistance, 
  bestDay,
  userPreferredUnits = 'miles',
  teamId = null,
  enableRealtime = true,
  showConnectionStatus = false
}: DashboardStatsProps) {
  const [realtimeStats, setRealtimeStats] = useState({
    totalDistance,
    weekDistance,
    bestDay,
  });
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());

  // Use realtime activities to update stats
  const { connectionState, isConnected } = useRealtimeActivities(teamId, {
    enableLogging: false,
    onActivity: (update) => {
      // When a new activity is added, we'll just trigger a refresh indication
      // The actual stats update will come from the parent component via props
      setLastUpdateTime(Date.now());
    },
  });

  // Update realtime stats when props change (from parent component queries)
  useEffect(() => {
    setRealtimeStats({
      totalDistance,
      weekDistance,
      bestDay,
    });
  }, [totalDistance, weekDistance, bestDay]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Your Week</h3>
        
        {enableRealtime && (showConnectionStatus || !isConnected) && (
          <div className="flex items-center space-x-2">
            {isConnected && (
              <span className="text-xs text-green-600 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                Live
              </span>
            )}
            <ConnectionStatus 
              connectionState={connectionState}
              size="sm"
              showText={!isConnected}
            />
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600">This Week</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatDistance(realtimeStats.weekDistance, userPreferredUnits)}
          </p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">Your Best Day</p>
          <p className="text-lg font-semibold text-gray-900">
            {realtimeStats.bestDay.date} ({formatDistance(realtimeStats.bestDay.distance, userPreferredUnits)})
          </p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">All Time Total</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatDistance(realtimeStats.totalDistance, userPreferredUnits)}
          </p>
        </div>
      </div>
    </div>
  );
}