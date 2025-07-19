'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { useRealtimeTeamProgress } from '@/hooks/useRealtimeTeamProgress';
import { ProgressBar } from './ProgressBar';
import { RouteProgress } from './RouteProgress';
import { MilestoneMarker } from './MilestoneMarker';
import { TeamContributionChart } from './TeamContributionChart';
import { ProgressStats } from './ProgressStats';
import { useLiveProgress } from './useLiveProgress';
import { formatDistance } from '@/services/activity.service';
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
  userPreferredUnits?: 'miles' | 'kilometers';
  className?: string;
  showStats?: boolean;
  defaultMode?: VisualizationMode;
  compactMode?: boolean;
}

export function LiveProgressVisualization({
  teamId,
  goalId,
  goalName,
  targetDistance,
  targetDate,
  routeData,
  initialProgress,
  userPreferredUnits = 'miles',
  className = '',
  showStats = true,
  defaultMode = 'bar',
  compactMode = false,
}: LiveProgressVisualizationProps) {
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>(defaultMode);
  const [celebratingMilestone, setCelebratingMilestone] = useState<string | null>(null);
  
  const { isConnected } = useWebSocketContext();
  
  const {
    progress,
    recentContributors,
    currentPace,
    estimatedCompletion,
    milestones,
    isLoading,
  } = useLiveProgress({
    teamId,
    goalId,
    targetDistance,
    initialProgress,
    routeData,
  });

  // Handle milestone celebrations
  const handleMilestoneReached = (milestone: any) => {
    setCelebratingMilestone(milestone.message);
    setTimeout(() => setCelebratingMilestone(null), 5000);
  };

  // Subscribe to real-time updates
  useRealtimeTeamProgress(teamId, {
    onProgressUpdate: (data) => {
      // Progress updates are handled by useLiveProgress hook
    },
    onMilestoneReached: handleMilestoneReached,
    onGoalCompleted: (data) => {
      setCelebratingMilestone(`🎉 Goal Complete! ${data.goalName} achieved!`);
    },
  });

  const percentComplete = (progress.totalDistance / targetDistance) * 100;

  // Mode selector for non-compact view
  const ModeSelector = () => (
    <div className="flex gap-2 mb-4">
      <button
        onClick={() => setVisualizationMode('bar')}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
          visualizationMode === 'bar'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        Progress Bar
      </button>
      <button
        onClick={() => setVisualizationMode('circular')}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
          visualizationMode === 'circular'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        Circular
      </button>
      {routeData && (
        <button
          onClick={() => setVisualizationMode('route')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            visualizationMode === 'route'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Route Map
        </button>
      )}
      <button
        onClick={() => setVisualizationMode('contributions')}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
          visualizationMode === 'contributions'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        Team Contributions
      </button>
    </div>
  );

  return (
    <div className={`bg-white rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">{goalName}</h3>
          {isConnected && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-gray-500">Live</span>
            </div>
          )}
        </div>

        {/* Milestone celebration */}
        {celebratingMilestone && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg animate-bounce-subtle">
            <p className="text-sm font-medium text-yellow-800">{celebratingMilestone}</p>
          </div>
        )}

        {/* Mode selector for desktop */}
        {!compactMode && <ModeSelector />}
      </div>

      {/* Visualization Content */}
      <div className="px-6 pb-6">
        {visualizationMode === 'bar' && (
          <ProgressBar
            current={progress.totalDistance}
            target={targetDistance}
            milestones={milestones}
            userPreferredUnits={userPreferredUnits}
            animated={true}
            showMilestones={!compactMode}
            height={compactMode ? 'sm' : 'md'}
          />
        )}

        {visualizationMode === 'circular' && (
          <div className="flex justify-center">
            <CircularProgress
              percentage={percentComplete}
              current={progress.totalDistance}
              target={targetDistance}
              userPreferredUnits={userPreferredUnits}
              size={compactMode ? 120 : 200}
            />
          </div>
        )}

        {visualizationMode === 'route' && routeData && (
          <RouteProgress
            routeData={routeData}
            currentDistance={progress.totalDistance}
            totalDistance={targetDistance}
            currentSegment={progress.currentSegmentIndex}
            segmentProgress={progress.segmentProgress}
            compact={compactMode}
          />
        )}

        {visualizationMode === 'contributions' && (
          <TeamContributionChart
            contributors={recentContributors}
            totalDistance={progress.totalDistance}
            userPreferredUnits={userPreferredUnits}
            compact={compactMode}
          />
        )}
      </div>

      {/* Stats Section */}
      {showStats && !compactMode && (
        <ProgressStats
          currentDistance={progress.totalDistance}
          targetDistance={targetDistance}
          currentPace={currentPace}
          estimatedCompletion={estimatedCompletion}
          lastActivityAt={progress.lastActivityAt}
          totalActivities={progress.totalActivities}
          userPreferredUnits={userPreferredUnits}
        />
      )}
    </div>
  );
}

// Circular Progress Component
interface CircularProgressProps {
  percentage: number;
  current: number;
  target: number;
  userPreferredUnits: 'miles' | 'kilometers';
  size?: number;
}

function CircularProgress({ 
  percentage, 
  current, 
  target, 
  userPreferredUnits,
  size = 200 
}: CircularProgressProps) {
  const strokeWidth = size / 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#3b82f6"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold text-gray-900">
          {percentage.toFixed(0)}%
        </div>
        <div className="text-sm text-gray-500">
          {formatDistance(current, userPreferredUnits)}
        </div>
        <div className="text-xs text-gray-400">
          of {formatDistance(target, userPreferredUnits)}
        </div>
      </div>
    </div>
  );
}