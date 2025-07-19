'use client';

import React from 'react';

export interface FilterOptions {
  view: 'team' | 'individual' | 'goals';
  timePeriod: 'daily' | 'weekly' | 'monthly' | 'all-time';
}

interface LeaderboardFiltersProps {
  currentView: FilterOptions['view'];
  currentTimePeriod: FilterOptions['timePeriod'];
  onChange: (filters: FilterOptions) => void;
  disabled?: boolean;
  className?: string;
}

export function LeaderboardFilters({
  currentView,
  currentTimePeriod,
  onChange,
  disabled = false,
  className = '',
}: LeaderboardFiltersProps) {
  
  const viewOptions = [
    { value: 'team' as const, label: 'Team', icon: '👥' },
    { value: 'individual' as const, label: 'Individual', icon: '🏃' },
    { value: 'goals' as const, label: 'Goals', icon: '🎯' },
  ];

  const timePeriodOptions = [
    { value: 'daily' as const, label: 'Today', icon: '📅' },
    { value: 'weekly' as const, label: 'Week', icon: '📊' },
    { value: 'monthly' as const, label: 'Month', icon: '🗓️' },
    { value: 'all-time' as const, label: 'All Time', icon: '🕐' },
  ];

  const handleViewChange = (view: FilterOptions['view']) => {
    if (disabled) return;
    onChange({ view, timePeriod: currentTimePeriod });
  };

  const handleTimePeriodChange = (timePeriod: FilterOptions['timePeriod']) => {
    if (disabled) return;
    onChange({ view: currentView, timePeriod });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* View Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          View
        </label>
        <div className="flex flex-wrap gap-2">
          {viewOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleViewChange(option.value)}
              disabled={disabled}
              className={`
                inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${currentView === option.value
                  ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-opacity-20'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:bg-gray-200'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              `}
            >
              <span className="mr-2">{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Time Period Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Time Period
        </label>
        <div className="flex flex-wrap gap-2">
          {timePeriodOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleTimePeriodChange(option.value)}
              disabled={disabled}
              className={`
                inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${currentTimePeriod === option.value
                  ? 'bg-green-600 text-white shadow-md ring-2 ring-green-600 ring-opacity-20'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:bg-gray-200'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
              `}
            >
              <span className="mr-2">{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Filter Combinations */}
      <div className="pt-2 border-t border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Quick Filters
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onChange({ view: 'team', timePeriod: 'weekly' })}
            disabled={disabled}
            className={`
              inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200
              ${currentView === 'team' && currentTimePeriod === 'weekly'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1
            `}
          >
            🏆 Team Week
          </button>
          
          <button
            onClick={() => onChange({ view: 'individual', timePeriod: 'daily' })}
            disabled={disabled}
            className={`
              inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200
              ${currentView === 'individual' && currentTimePeriod === 'daily'
                ? 'bg-orange-600 text-white'
                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1
            `}
          >
            ⚡ Today's MVP
          </button>
          
          <button
            onClick={() => onChange({ view: 'goals', timePeriod: 'monthly' })}
            disabled={disabled}
            className={`
              inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200
              ${currentView === 'goals' && currentTimePeriod === 'monthly'
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1
            `}
          >
            🎯 Monthly Goals
          </button>
        </div>
      </div>

      {/* Current Selection Summary */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <span className="font-medium">Showing:</span>
          <span className="inline-flex items-center">
            {viewOptions.find(v => v.value === currentView)?.icon}
            <span className="ml-1">{viewOptions.find(v => v.value === currentView)?.label}</span>
          </span>
          <span>•</span>
          <span className="inline-flex items-center">
            {timePeriodOptions.find(t => t.value === currentTimePeriod)?.icon}
            <span className="ml-1">{timePeriodOptions.find(t => t.value === currentTimePeriod)?.label}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// Compact version for smaller spaces
export function CompactLeaderboardFilters({
  currentView,
  currentTimePeriod,
  onChange,
  disabled = false,
  className = '',
}: LeaderboardFiltersProps) {
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* View Select */}
      <select
        value={currentView}
        onChange={(e) => onChange({ 
          view: e.target.value as FilterOptions['view'], 
          timePeriod: currentTimePeriod 
        })}
        disabled={disabled}
        className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="team">👥 Team</option>
        <option value="individual">🏃 Individual</option>
        <option value="goals">🎯 Goals</option>
      </select>

      {/* Time Period Select */}
      <select
        value={currentTimePeriod}
        onChange={(e) => onChange({ 
          view: currentView, 
          timePeriod: e.target.value as FilterOptions['timePeriod'] 
        })}
        disabled={disabled}
        className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="daily">📅 Today</option>
        <option value="weekly">📊 Week</option>
        <option value="monthly">🗓️ Month</option>
        <option value="all-time">🕐 All Time</option>
      </select>
    </div>
  );
}