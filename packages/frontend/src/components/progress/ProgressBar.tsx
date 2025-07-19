'use client';

import React, { useMemo } from 'react';
import { formatDistance } from '@/services/activity.service';
import { MilestoneMarker } from './MilestoneMarker';

interface Milestone {
  id: string;
  name: string;
  distance: number;
  reached: boolean;
  reachedAt?: string;
}

interface ProgressBarProps {
  current: number;
  target: number;
  milestones?: Milestone[];
  userPreferredUnits?: 'miles' | 'kilometers';
  animated?: boolean;
  showMilestones?: boolean;
  height?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabels?: boolean;
  color?: 'blue' | 'green' | 'gradient';
}

export function ProgressBar({
  current,
  target,
  milestones = [],
  userPreferredUnits = 'miles',
  animated = true,
  showMilestones = true,
  height = 'md',
  className = '',
  showLabels = true,
  color = 'gradient',
}: ProgressBarProps) {
  const percentage = Math.min((current / target) * 100, 100);
  
  const heightClasses = {
    sm: 'h-2',
    md: 'h-4',
    lg: 'h-6',
  };

  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    gradient: 'bg-gradient-to-r from-blue-500 to-green-500',
  };

  // Calculate color based on progress
  const progressColor = useMemo(() => {
    if (color !== 'gradient') return colorClasses[color];
    if (percentage >= 75) return 'bg-gradient-to-r from-green-500 to-emerald-500';
    if (percentage >= 50) return 'bg-gradient-to-r from-yellow-500 to-green-500';
    if (percentage >= 25) return 'bg-gradient-to-r from-orange-500 to-yellow-500';
    return 'bg-gradient-to-r from-blue-500 to-indigo-500';
  }, [percentage, color]);

  return (
    <div className={`relative ${className}`}>
      {/* Labels */}
      {showLabels && (
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-sm font-medium text-gray-700">
              {formatDistance(current, userPreferredUnits)}
            </p>
            <p className="text-xs text-gray-500">Current</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{percentage.toFixed(1)}%</p>
            <p className="text-xs text-gray-500">Complete</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">
              {formatDistance(target, userPreferredUnits)}
            </p>
            <p className="text-xs text-gray-500">Goal</p>
          </div>
        </div>
      )}

      {/* Progress bar container */}
      <div className="relative">
        <div className={`w-full bg-gray-200 rounded-full ${heightClasses[height]} overflow-hidden`}>
          <div
            className={`${heightClasses[height]} ${progressColor} rounded-full transition-all ${
              animated ? 'duration-1000 ease-out' : ''
            } relative`}
            style={{ width: `${percentage}%` }}
          >
            {/* Animated shimmer effect */}
            {animated && percentage > 0 && percentage < 100 && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            )}
          </div>
        </div>

        {/* Milestone markers */}
        {showMilestones && milestones.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {milestones.map((milestone) => {
              const position = (milestone.distance / target) * 100;
              if (position > 100) return null;
              
              return (
                <MilestoneMarker
                  key={milestone.id}
                  milestone={milestone}
                  position={position}
                  isReached={milestone.reached}
                  showLabel={height !== 'sm'}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Progress segments for route-based goals */}
      {showMilestones && milestones.filter(m => m.id.startsWith('waypoint')).length > 0 && (
        <div className="mt-2 flex gap-1">
          {milestones
            .filter(m => m.id.startsWith('waypoint'))
            .map((milestone, index, arr) => {
              const prevDistance = index === 0 ? 0 : arr[index - 1].distance;
              const segmentDistance = milestone.distance - prevDistance;
              const segmentPercentage = (segmentDistance / target) * 100;
              const isActive = current >= prevDistance && current < milestone.distance;
              const isComplete = current >= milestone.distance;

              return (
                <div
                  key={milestone.id}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    isComplete
                      ? 'bg-green-500'
                      : isActive
                      ? 'bg-blue-500'
                      : 'bg-gray-300'
                  }`}
                  style={{ width: `${segmentPercentage}%` }}
                  title={milestone.name}
                />
              );
            })}
        </div>
      )}

      {/* Remaining distance */}
      {showLabels && current < target && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          {formatDistance(target - current, userPreferredUnits)} remaining
        </p>
      )}
    </div>
  );
}