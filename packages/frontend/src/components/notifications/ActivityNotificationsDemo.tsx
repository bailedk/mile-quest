'use client';

import React, { useState } from 'react';
import { ActivityNotifications, useActivityNotifications } from './index';
import type { ActivityNotification, NotificationType } from './ActivityNotifications';

/**
 * Demo component showing how to use ActivityNotifications
 * This can be used for testing and as a reference implementation
 */
export function ActivityNotificationsDemo() {
  const [position, setPosition] = useState<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>('top-right');
  const [enableSound, setEnableSound] = useState(true);
  const [enableHistory, setEnableHistory] = useState(true);
  const [maxVisible, setMaxVisible] = useState(3);
  const [autoHideDuration, setAutoHideDuration] = useState(5000);

  const {
    notifications,
    history,
    soundEnabled,
    addNotification,
    clearAll,
    clearHistory,
    unreadCount,
    historyCount,
    createActivityNotification,
    createAchievementNotification,
    createTeamMilestoneNotification
  } = useActivityNotifications({
    maxVisible,
    enableSound,
    enableHistory,
    autoHideDuration,
    enableLogging: true,
    onNotification: (notification) => {
      console.log('Notification received:', notification);
    },
    onAchievement: (achievement) => {
      console.log('Achievement earned:', achievement);
    },
    onTeamMilestone: (milestone) => {
      console.log('Team milestone reached:', milestone);
    }
  });

  // Sample data generators
  const generateSampleActivity = () => {
    const activities = [
      { userName: 'Alice Johnson', distance: 5000, source: 'STRAVA' },
      { userName: 'Bob Smith', distance: 3200, source: 'APPLE_HEALTH' },
      { userName: 'Carol Davis', distance: 8500, source: 'GOOGLE_FIT' },
      { userName: 'David Wilson', distance: 1200, source: 'MANUAL' },
      { userName: 'Eva Brown', distance: 6800, source: 'STRAVA' }
    ];
    
    const activity = activities[Math.floor(Math.random() * activities.length)];
    return {
      ...activity,
      id: `activity-${Date.now()}`,
      teamId: 'team-123',
      userId: `user-${Math.random()}`,
      duration: 1800 + Math.random() * 1800, // 30-60 minutes
      date: new Date().toISOString()
    };
  };

  const generateSampleAchievement = () => {
    const achievements = [
      { name: 'First 5K', description: 'Completed your first 5 kilometer walk!', icon: '🥇' },
      { name: 'Weekend Warrior', description: 'Active every weekend this month', icon: '💪' },
      { name: 'Team Player', description: 'Contributed to 10 team goals', icon: '🤝' },
      { name: 'Distance Master', description: 'Walked over 100km total', icon: '🏆' },
      { name: 'Consistency King', description: '30-day activity streak!', icon: '🔥' }
    ];
    
    const achievement = achievements[Math.floor(Math.random() * achievements.length)];
    return {
      ...achievement,
      id: `achievement-${Date.now()}`,
      userId: 'current-user',
      teamId: 'team-123',
      earnedAt: new Date().toISOString()
    };
  };

  const generateSampleMilestone = () => {
    const milestones = [
      { name: '25% Team Goal', message: 'Your team is 25% of the way to San Francisco!' },
      { name: '50% Team Goal', message: 'Halfway there! Keep walking to reach Los Angeles!' },
      { name: '75% Team Goal', message: 'Almost there! 75% complete on your journey to NYC!' },
      { name: '100% Team Goal', message: 'Congratulations! Your team reached Seattle!' }
    ];
    
    const milestone = milestones[Math.floor(Math.random() * milestones.length)];
    return {
      ...milestone,
      id: `milestone-${Date.now()}`,
      teamId: 'team-123'
    };
  };

  // Test notification generators
  const addActivityNotification = () => {
    const activity = generateSampleActivity();
    const notification = createActivityNotification(activity);
    addNotification(notification);
  };

  const addAchievementNotification = () => {
    const achievement = generateSampleAchievement();
    const notification = createAchievementNotification(achievement);
    addNotification(notification);
  };

  const addMilestoneNotification = () => {
    const milestone = generateSampleMilestone();
    const notification = createTeamMilestoneNotification(milestone);
    addNotification(notification);
  };

  const addCustomNotification = () => {
    const customTypes: NotificationType[] = ['activity:created', 'team:goal_progress', 'personal:achievement'];
    const randomType = customTypes[Math.floor(Math.random() * customTypes.length)];
    
    addNotification({
      type: randomType,
      title: 'Custom Notification',
      message: 'This is a custom notification for testing purposes',
      icon: '🎯',
      priority: 'medium'
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Activity Notifications Demo
        </h1>
        <p className="text-gray-600">
          Test the real-time activity notification system for Mile Quest
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Controls</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Position */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Position
            </label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="top-right">Top Right</option>
              <option value="top-left">Top Left</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
            </select>
          </div>

          {/* Max Visible */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Visible: {maxVisible}
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={maxVisible}
              onChange={(e) => setMaxVisible(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Auto Hide Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Auto Hide: {autoHideDuration / 1000}s
            </label>
            <input
              type="range"
              min="2000"
              max="10000"
              step="1000"
              value={autoHideDuration}
              onChange={(e) => setAutoHideDuration(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={enableSound}
              onChange={(e) => setEnableSound(e.target.checked)}
              className="mr-2"
            />
            Enable Sound
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={enableHistory}
              onChange={(e) => setEnableHistory(e.target.checked)}
              className="mr-2"
            />
            Enable History
          </label>
        </div>

        {/* Test Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={addActivityNotification}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors"
          >
            Add Activity
          </button>
          <button
            onClick={addAchievementNotification}
            className="bg-yellow-600 text-white px-4 py-2 rounded-md text-sm hover:bg-yellow-700 transition-colors"
          >
            Add Achievement
          </button>
          <button
            onClick={addMilestoneNotification}
            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 transition-colors"
          >
            Add Milestone
          </button>
          <button
            onClick={addCustomNotification}
            className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm hover:bg-purple-700 transition-colors"
          >
            Add Custom
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{notifications.length}</div>
            <div className="text-sm text-gray-600">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{unreadCount}</div>
            <div className="text-sm text-gray-600">Unread</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{historyCount}</div>
            <div className="text-sm text-gray-600">History</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{soundEnabled ? '🔊' : '🔇'}</div>
            <div className="text-sm text-gray-600">Sound</div>
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          <button
            onClick={clearAll}
            className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700 transition-colors"
          >
            Clear All
          </button>
          {enableHistory && (
            <button
              onClick={clearHistory}
              className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-700 transition-colors"
            >
              Clear History
            </button>
          )}
        </div>
      </div>

      {/* Usage Example */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Usage Example</h2>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-md text-sm overflow-x-auto">
{`import { ActivityNotifications, useActivityNotifications } from '@/components/notifications';

function MyComponent() {
  const {
    addNotification,
    clearAll,
    notifications,
    soundEnabled,
    toggleSound
  } = useActivityNotifications({
    maxVisible: 3,
    enableSound: true,
    enableHistory: true,
    autoHideDuration: 5000,
    onNotification: (notification) => {
      console.log('New notification:', notification);
    }
  });

  return (
    <div>
      {/* Your app content */}
      
      <ActivityNotifications
        maxVisible={3}
        position="top-right"
        enableSound={soundEnabled}
        enableHistory={true}
        autoHideDuration={5000}
      />
    </div>
  );
}`}
        </pre>
      </div>

      {/* The actual notification system */}
      <ActivityNotifications
        maxVisible={maxVisible}
        position={position}
        enableSound={enableSound}
        enableHistory={enableHistory}
        autoHideDuration={autoHideDuration}
      />
    </div>
  );
}

export default ActivityNotificationsDemo;