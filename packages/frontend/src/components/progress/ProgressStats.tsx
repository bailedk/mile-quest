'use client';

import React from 'react';
import { formatDistance } from '@/services/activity.service';
import { formatDistanceToNow, format } from 'date-fns';

interface ProgressStatsProps {
  currentDistance: number;
  targetDistance: number;
  currentPace: number;
  estimatedCompletion: Date | null;
  lastActivityAt?: Date | string;
  totalActivities: number;
  userPreferredUnits?: 'miles' | 'kilometers';
  className?: string;
}

export function ProgressStats({
  currentDistance,
  targetDistance,
  currentPace,
  estimatedCompletion,
  lastActivityAt,
  totalActivities,
  userPreferredUnits = 'miles',
  className = '',
}: ProgressStatsProps) {
  const remainingDistance = targetDistance - currentDistance;
  const percentComplete = (currentDistance / targetDistance) * 100;
  const isOnTrack = estimatedCompletion && estimatedCompletion <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const stats = [
    {
      label: 'Remaining',
      value: formatDistance(remainingDistance, userPreferredUnits),
      subtext: `${(100 - percentComplete).toFixed(1)}% to go`,
      icon: '🎯',
    },
    {
      label: 'Current Pace',
      value: currentPace > 0 
        ? `${formatDistance(currentPace, userPreferredUnits)}/day`
        : 'No data',
      subtext: currentPace > 0 ? (isOnTrack ? 'On track' : 'Behind pace') : 'Start walking!',
      icon: '⚡',
      color: currentPace > 0 ? (isOnTrack ? 'text-green-600' : 'text-orange-600') : 'text-gray-500',
    },
    {
      label: 'Est. Completion',
      value: estimatedCompletion 
        ? format(estimatedCompletion, 'MMM d, yyyy')
        : 'Unknown',
      subtext: estimatedCompletion 
        ? `In ${formatDistanceToNow(estimatedCompletion)}`
        : 'Need more data',
      icon: '📅',
    },
    {
      label: 'Team Activities',
      value: totalActivities.toString(),
      subtext: lastActivityAt 
        ? `Last: ${formatDistanceToNow(new Date(lastActivityAt), { addSuffix: true })}`
        : 'No activities yet',
      icon: '👥',
    },
  ];

  return (
    <div className={`border-t border-gray-200 ${className}`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
        {stats.map((stat, index) => (
          <div key={index} className="text-center">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
            <p className={`text-lg font-semibold ${stat.color || 'text-gray-900'}`}>
              {stat.value}
            </p>
            <p className="text-xs text-gray-500 mt-1">{stat.subtext}</p>
          </div>
        ))}
      </div>

      {/* Progress insights */}
      <div className="px-4 pb-4">
        <div className={`rounded-lg p-3 ${
          isOnTrack ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-start gap-2">
            <span className="text-lg">{isOnTrack ? '✅' : '⚠️'}</span>
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                isOnTrack ? 'text-green-800' : 'text-yellow-800'
              }`}>
                {isOnTrack 
                  ? 'Great progress! You\'re on track to meet your goal.'
                  : 'Pick up the pace! You need to increase daily activity to meet your goal.'}
              </p>
              {currentPace > 0 && (
                <p className={`text-xs mt-1 ${
                  isOnTrack ? 'text-green-700' : 'text-yellow-700'
                }`}>
                  {isOnTrack
                    ? `Maintain ${formatDistance(currentPace, userPreferredUnits)} per day to finish on time.`
                    : `Increase to ${formatDistance(
                        remainingDistance / Math.max(1, Math.ceil((estimatedCompletion?.getTime() || Date.now() + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000))),
                        userPreferredUnits
                      )} per day to finish on time.`}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}