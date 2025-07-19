'use client';

import React, { useState } from 'react';
import { LiveLeaderboard, LeaderboardData, LeaderboardMember } from './LiveLeaderboard';

// Mock data for demonstration
const mockLeaderboardData: LeaderboardData = {
  team: [
    {
      userId: '1',
      userName: 'Sarah Johnson',
      avatarUrl: null,
      totalDistance: 142.5,
      totalDuration: 8400,
      activityCount: 23,
      rank: 1,
      change: 'up',
      goalProgress: 95.2,
      recentActivity: {
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        distance: 3.2,
        type: 'run',
      },
      isOnline: true,
    },
    {
      userId: '2',
      userName: 'Mike Chen',
      avatarUrl: null,
      totalDistance: 138.7,
      totalDuration: 7200,
      activityCount: 19,
      rank: 2,
      change: 'down',
      goalProgress: 87.3,
      recentActivity: {
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        distance: 5.1,
        type: 'walk',
      },
      isOnline: false,
    },
    {
      userId: '3',
      userName: 'Emily Rodriguez',
      avatarUrl: null,
      totalDistance: 125.3,
      totalDuration: 6900,
      activityCount: 21,
      rank: 3,
      change: 'up',
      goalProgress: 78.9,
      recentActivity: {
        timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
        distance: 2.8,
        type: 'run',
      },
      isOnline: true,
    },
    {
      userId: '4',
      userName: 'David Kim',
      avatarUrl: null,
      totalDistance: 112.8,
      totalDuration: 5400,
      activityCount: 18,
      rank: 4,
      change: 'same',
      goalProgress: 71.2,
      isOnline: true,
    },
    {
      userId: '5',
      userName: 'Lisa Thompson',
      avatarUrl: null,
      totalDistance: 98.4,
      totalDuration: 4800,
      activityCount: 15,
      rank: 5,
      change: 'new',
      goalProgress: 62.1,
      recentActivity: {
        timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        distance: 1.5,
        type: 'walk',
      },
      isOnline: true,
    },
  ],
  individual: [
    // Copy of team data for individual view
  ],
  goals: [
    {
      goalId: '1',
      goalName: 'Monthly Challenge - 150 Miles',
      members: [], // Would contain subset of members working on this goal
    },
  ],
  lastUpdated: new Date(),
};

// Fill individual data (copy of team for demo)
mockLeaderboardData.individual = [...mockLeaderboardData.team];
mockLeaderboardData.goals[0].members = mockLeaderboardData.team.slice(0, 3);

export function LiveLeaderboardDemo() {
  const [teamId] = useState('demo-team-1');
  const [view, setView] = useState<'team' | 'individual' | 'goals'>('team');
  const [timePeriod, setTimePeriod] = useState<'daily' | 'weekly' | 'monthly' | 'all-time'>('weekly');

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Live Leaderboard Demo
        </h1>
        <p className="text-gray-600">
          Experience real-time leaderboard updates with multiple views and time periods
        </p>
      </div>

      {/* Demo Controls */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Demo Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <h4 className="font-medium mb-2">🏆 Real-time Features:</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>Live position tracking with animations</li>
              <li>Real-time rank change indicators</li>
              <li>Online presence indicators</li>
              <li>Recent activity highlights</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">🎯 Interactive Elements:</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>Multiple view types (team, individual, goals)</li>
              <li>Time period filtering</li>
              <li>Goal progress visualization</li>
              <li>Medal/trophy icons for top positions</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Leaderboard */}
      <LiveLeaderboard
        teamId={teamId}
        initialData={mockLeaderboardData}
        view={view}
        timePeriod={timePeriod}
        maxEntries={10}
        showFilters={true}
        showConnectionStatus={true}
        showRecentActivity={true}
        showGoalProgress={true}
        enableAnimations={true}
        autoRefreshInterval={30000}
        userPreferredUnits="miles"
        className="shadow-lg"
      />

      {/* Quick View Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Quick View</h4>
          <div className="space-y-2">
            <button
              onClick={() => setView('team')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'team'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              👥 Team Rankings
            </button>
            <button
              onClick={() => setView('individual')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'individual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🏃 Individual Stats
            </button>
            <button
              onClick={() => setView('goals')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'goals'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🎯 Goal Progress
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Time Period</h4>
          <div className="space-y-2">
            <button
              onClick={() => setTimePeriod('daily')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                timePeriod === 'daily'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📅 Today
            </button>
            <button
              onClick={() => setTimePeriod('weekly')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                timePeriod === 'weekly'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📊 This Week
            </button>
            <button
              onClick={() => setTimePeriod('monthly')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                timePeriod === 'monthly'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🗓️ This Month
            </button>
            <button
              onClick={() => setTimePeriod('all-time')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                timePeriod === 'all-time'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🕐 All Time
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Demo Status</h4>
          <div className="space-y-3 text-sm">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-green-600 font-medium">Live Demo Active</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              <span className="text-blue-600">WebSocket Connected</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              <span className="text-purple-600">5 Team Members Online</span>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Real implementation uses live data from the Mile Quest API
            </div>
          </div>
        </div>
      </div>

      {/* Feature Showcase */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Implementation Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Components Included:</h4>
            <ul className="space-y-1 text-gray-600">
              <li>• <code className="bg-white px-1 rounded">LiveLeaderboard</code> - Main component</li>
              <li>• <code className="bg-white px-1 rounded">LeaderboardEntry</code> - Individual member card</li>
              <li>• <code className="bg-white px-1 rounded">LeaderboardFilters</code> - View and time controls</li>
              <li>• <code className="bg-white px-1 rounded">useLiveLeaderboard</code> - Real-time data hook</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Key Features:</h4>
            <ul className="space-y-1 text-gray-600">
              <li>• Real-time WebSocket updates</li>
              <li>• Smooth position change animations</li>
              <li>• Mobile-responsive design</li>
              <li>• Comprehensive error handling</li>
              <li>• Accessibility compliant</li>
              <li>• TypeScript support</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}