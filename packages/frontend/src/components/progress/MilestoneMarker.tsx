'use client';

import React from 'react';

interface Milestone {
  id: string;
  name: string;
  distance: number;
  reached: boolean;
  reachedAt?: string;
}

interface MilestoneMarkerProps {
  milestone: Milestone;
  position: number; // Percentage position (0-100)
  isReached: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'waypoint' | 'percentage';
}

export function MilestoneMarker({
  milestone,
  position,
  isReached,
  showLabel = true,
  size = 'md',
  variant = 'default',
}: MilestoneMarkerProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const getIcon = () => {
    if (variant === 'waypoint') return '📍';
    if (variant === 'percentage') {
      if (milestone.name.includes('25%')) return '🎯';
      if (milestone.name.includes('50%')) return '⭐';
      if (milestone.name.includes('75%')) return '🏃';
      if (milestone.name.includes('100%')) return '🏆';
    }
    return '🎯';
  };

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
      style={{ left: `${position}%` }}
    >
      {/* Marker */}
      <div className="relative">
        <div
          className={`${sizeClasses[size]} rounded-full transition-all duration-500 ${
            isReached
              ? 'bg-green-500 ring-2 ring-green-300 ring-offset-2'
              : 'bg-gray-400 ring-1 ring-gray-300'
          }`}
        />
        
        {/* Celebration effect for recently reached milestones */}
        {isReached && milestone.reachedAt && 
         new Date(milestone.reachedAt).getTime() > Date.now() - 5000 && (
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-green-400 rounded-full animate-ping" />
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-2xl animate-bounce">
              {getIcon()}
            </div>
          </div>
        )}
      </div>

      {/* Label */}
      {showLabel && (
        <div
          className={`absolute ${
            position > 80 ? 'right-0' : 'left-1/2 -translate-x-1/2'
          } top-full mt-1 z-10`}
        >
          <div
            className={`${
              isReached ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
            } px-2 py-1 rounded text-xs font-medium whitespace-nowrap shadow-sm`}
          >
            {milestone.name}
            {isReached && milestone.reachedAt && (
              <div className="text-xs opacity-75">
                {new Date(milestone.reachedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}