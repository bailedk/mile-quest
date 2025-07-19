'use client';

import React, { useMemo } from 'react';
import { formatDistance } from '@/services/activity.service';
import type { RouteData } from '@mile-quest/shared';

interface RouteProgressProps {
  routeData: RouteData;
  currentDistance: number;
  totalDistance: number;
  currentSegment: number;
  segmentProgress: number;
  compact?: boolean;
  className?: string;
}

export function RouteProgress({
  routeData,
  currentDistance,
  totalDistance,
  currentSegment,
  segmentProgress,
  compact = false,
  className = '',
}: RouteProgressProps) {
  const { waypoints, segments } = routeData;

  // Calculate cumulative distances for each waypoint
  const waypointDistances = useMemo(() => {
    const distances: number[] = [0];
    let cumulative = 0;
    
    segments.forEach((segment) => {
      cumulative += segment.distance;
      distances.push(cumulative);
    });
    
    return distances;
  }, [segments]);

  // Calculate position on route (0-100%)
  const routePosition = (currentDistance / totalDistance) * 100;

  // Simplified route visualization
  const RouteVisualization = () => (
    <div className="relative">
      {/* Route line */}
      <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-1000"
          style={{ width: `${routePosition}%` }}
        />
      </div>

      {/* Waypoint markers */}
      <div className="absolute top-0 left-0 w-full h-2">
        {waypoints.map((waypoint, index) => {
          const position = (waypointDistances[index] / totalDistance) * 100;
          const isReached = currentDistance >= waypointDistances[index];
          const isNext = index === currentSegment;

          return (
            <div
              key={`waypoint-${index}`}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${position}%` }}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 transition-all duration-500 ${
                  isReached
                    ? 'bg-green-500 border-green-600 scale-110'
                    : isNext
                    ? 'bg-blue-500 border-blue-600 animate-pulse'
                    : 'bg-white border-gray-400'
                }`}
              />
              {!compact && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 w-max">
                  <p className="text-xs text-gray-600 text-center">
                    {waypoint.address.split(',')[0]}
                  </p>
                  {isNext && !isReached && (
                    <p className="text-xs text-blue-600 font-medium">
                      Next stop
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Current position marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000"
          style={{ left: `${routePosition}%` }}
        >
          <div className="relative">
            <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-3 h-3 bg-blue-400 rounded-full animate-ping" />
          </div>
        </div>
      </div>
    </div>
  );

  // Detailed route view with segments
  const DetailedRouteView = () => (
    <div className="space-y-4">
      {/* Overall progress */}
      <div className="bg-gray-50 rounded-lg p-4">
        <RouteVisualization />
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Current Location</p>
            <p className="font-medium">
              {currentSegment < waypoints.length - 1
                ? `Between ${waypoints[currentSegment].address.split(',')[0]} and ${
                    waypoints[currentSegment + 1].address.split(',')[0]
                  }`
                : 'Final destination reached!'}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Progress in Segment</p>
            <p className="font-medium">{(segmentProgress * 100).toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Segment breakdown */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Route Segments</h4>
        {segments.map((segment, index) => {
          const segmentStart = waypointDistances[index];
          const segmentEnd = waypointDistances[index + 1];
          const isComplete = currentDistance >= segmentEnd;
          const isActive = currentDistance >= segmentStart && currentDistance < segmentEnd;
          const segmentPercentage = isActive
            ? ((currentDistance - segmentStart) / segment.distance) * 100
            : isComplete
            ? 100
            : 0;

          return (
            <div
              key={`segment-${index}`}
              className={`border rounded-lg p-3 transition-all ${
                isActive
                  ? 'border-blue-500 bg-blue-50'
                  : isComplete
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">
                  {waypoints[segment.from].address.split(',')[0]} →{' '}
                  {waypoints[segment.to].address.split(',')[0]}
                </p>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    isComplete
                      ? 'bg-green-100 text-green-700'
                      : isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {segment.distance.toFixed(1)} miles
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    isComplete ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${segmentPercentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={className}>
      {compact ? <RouteVisualization /> : <DetailedRouteView />}
    </div>
  );
}