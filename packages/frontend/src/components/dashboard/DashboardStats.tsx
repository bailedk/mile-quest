'use client';

import { useState, useEffect } from 'react';
import { formatDistance } from '@/services/activity.service';
import { useRealtimeActivities } from '@/hooks/useRealtimeActivities';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { AriaSection, AriaStatus } from '@/components/accessibility/AriaComponents';
import { useScreenReaderAnnouncements } from '@/components/accessibility/MobileAccessibility';
import { useVisualAccessibility } from '@/components/accessibility/VisualAccessibility';

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
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [previousStats, setPreviousStats] = useState(realtimeStats);
  
  const { announce, AnnouncementRegion } = useScreenReaderAnnouncements();
  const { reducedMotion } = useVisualAccessibility();

  // Initialize time after hydration
  useEffect(() => {
    setLastUpdateTime(Date.now());
  }, []);

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
    const newStats = {
      totalDistance,
      weekDistance,
      bestDay,
    };
    
    // Check for changes and announce them
    if (previousStats.weekDistance !== weekDistance) {
      const change = weekDistance - previousStats.weekDistance;
      if (change > 0) {
        announce(`Your weekly distance increased by ${formatDistance(change, userPreferredUnits)}`, 'polite');
      }
    }
    
    if (previousStats.totalDistance !== totalDistance) {
      const change = totalDistance - previousStats.totalDistance;
      if (change > 0) {
        announce(`Your total distance increased by ${formatDistance(change, userPreferredUnits)}`, 'polite');
      }
    }
    
    setPreviousStats(realtimeStats);
    setRealtimeStats(newStats);
  }, [totalDistance, weekDistance, bestDay, previousStats, realtimeStats, userPreferredUnits, announce]);

  return (
    <>
      <AnnouncementRegion />
      <AriaSection 
        className="bg-white rounded-lg shadow p-6"
        label="Personal statistics summary"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 
            className="text-lg font-semibold text-gray-900"
            id="stats-heading"
          >
            Your Week
          </h3>
          
          {enableRealtime && (showConnectionStatus || !isConnected) && (
            <div className="flex items-center space-x-2">
              {isConnected && (
                <AriaStatus className="text-xs text-green-600 flex items-center">
                  <span 
                    className={`w-2 h-2 bg-green-500 rounded-full mr-1 ${!reducedMotion ? 'animate-pulse' : ''}`}
                    aria-hidden="true"
                  ></span>
                  <span className="sr-only">Connection status: </span>
                  Live
                </AriaStatus>
              )}
              <ConnectionStatus 
                connectionState={connectionState}
                size="sm"
                showText={!isConnected}
              />
            </div>
          )}
        </div>
        
        <div 
          className="space-y-4"
          role="list"
          aria-labelledby="stats-heading"
        >
          <div role="listitem">
            <p 
              className="text-sm text-gray-600"
              id="week-distance-label"
            >
              This Week
            </p>
            <p 
              className="text-2xl font-bold text-gray-900"
              aria-labelledby="week-distance-label"
              aria-live="polite"
            >
              {formatDistance(realtimeStats.weekDistance, userPreferredUnits)}
            </p>
          </div>

          <div 
            className="pt-4 border-t border-gray-200"
            role="listitem"
          >
            <p 
              className="text-sm text-gray-600"
              id="best-day-label"
            >
              Your Best Day
            </p>
            <p 
              className="text-lg font-semibold text-gray-900"
              aria-labelledby="best-day-label"
            >
              <time dateTime={realtimeStats.bestDay.date}>
                {realtimeStats.bestDay.date}
              </time>
              {' '}
              <span className="sr-only">with distance of </span>
              ({formatDistance(realtimeStats.bestDay.distance, userPreferredUnits)})
            </p>
          </div>

          <div 
            className="pt-4 border-t border-gray-200"
            role="listitem"
          >
            <p 
              className="text-sm text-gray-600"
              id="total-distance-label"
            >
              All Time Total
            </p>
            <p 
              className="text-lg font-semibold text-gray-900"
              aria-labelledby="total-distance-label"
              aria-live="polite"
            >
              {formatDistance(realtimeStats.totalDistance, userPreferredUnits)}
            </p>
          </div>
        </div>
      </AriaSection>
    </>
  );
}