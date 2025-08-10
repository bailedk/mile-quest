'use client';

import { useState, useEffect } from 'react';
import type { TeamProgressData, RouteData } from '@mile-quest/shared';

export type VisualizationMode = 'bar' | 'circular' | 'route' | 'contributions';

interface LiveProgressVisualizationProps {
  teamId: string;
  goalId: string;
  goalName: string;
  targetDistance: number;
  targetDate?: string;
  routeData?: RouteData;
  initialProgress?: TeamProgressData;
  userPreferredUnits?: 'kilometers' | 'miles';
  showStats?: boolean;
  defaultMode?: VisualizationMode;
  compactMode?: boolean;
}

/**
 * Temporary stub implementation of LiveProgressVisualization
 * This component should be properly implemented as part of the progress tracking system
 */
export function LiveProgressVisualization({
  goalName,
  targetDistance,
  initialProgress,
  showStats = true,
  compactMode = false,
  defaultMode = 'bar'
}: LiveProgressVisualizationProps) {
  const [mode, setMode] = useState<VisualizationMode>(defaultMode);
  
  const progress = initialProgress?.totalDistance || 0;
  const percentage = Math.min((progress / targetDistance) * 100, 100);
  
  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  if (compactMode) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <h3 className="font-medium text-gray-900 mb-2">{goalName}</h3>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-1">
          {Math.round(progress / 1000)}km of {Math.round(targetDistance / 1000)}km
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow border">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">{goalName}</h2>
        <p className="text-sm text-gray-600">Demo Progress Visualization</p>
      </div>

      {/* Mode Selector */}
      <div className="flex gap-2 mb-4">
        {(['bar', 'circular', 'route', 'contributions'] as VisualizationMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              mode === m
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* Progress Visualization */}
      <div className="mb-4">
        {mode === 'bar' && (
          <div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-600 mt-2">
              <span>0km</span>
              <span>{percentage.toFixed(1)}%</span>
              <span>{Math.round(targetDistance / 1000)}km</span>
            </div>
          </div>
        )}

        {mode === 'circular' && (
          <div className="flex justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  stroke="#e5e7eb"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  stroke="#2563eb"
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 54}`}
                  strokeDashoffset={`${2 * Math.PI * 54 * (1 - percentage / 100)}`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-semibold text-gray-900">
                  {percentage.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {(mode === 'route' || mode === 'contributions') && (
          <div className="bg-gray-100 p-4 rounded-lg text-center">
            <p className="text-gray-600">
              {mode === 'route' ? 'Route' : 'Contributions'} visualization coming soon
            </p>
          </div>
        )}
      </div>

      {/* Stats */}
      {showStats && initialProgress && (
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="font-semibold text-gray-900">
              {Math.round(progress / 1000)}km
            </div>
            <div className="text-gray-600">Distance</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900">
              {initialProgress.totalActivities}
            </div>
            <div className="text-gray-600">Activities</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900">
              {Math.round((initialProgress.totalDuration || 0) / 60)}h
            </div>
            <div className="text-gray-600">Duration</div>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> This is a temporary stub implementation. 
          The full LiveProgressVisualization component should be implemented with real-time updates, 
          WebSocket integration, and proper data fetching.
        </p>
      </div>
    </div>
  );
}