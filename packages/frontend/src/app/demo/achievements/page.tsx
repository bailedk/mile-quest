'use client';

import React, { useState } from 'react';
import { 
  AchievementCelebration, 
  AchievementBadge, 
  useAchievementCelebration,
  ACHIEVEMENT_METADATA,
  celebrationAnimations
} from '@/components/achievements';
import { Achievement } from '@/hooks/useRealtimeUpdates';

// Mock achievements for demo
const mockAchievements: Achievement[] = [
  {
    id: 'FIRST_WALK',
    name: 'First Walk',
    description: 'You completed your first walk!',
    icon: '🚶',
    earnedAt: new Date().toISOString(),
    userId: 'demo-user',
    teamId: 'demo-team',
  },
  {
    id: '10_MILE_CLUB',
    name: '10 Mile Club',
    description: 'You\'ve walked a total of 10 miles!',
    icon: '🏃',
    earnedAt: new Date().toISOString(),
    userId: 'demo-user',
    teamId: 'demo-team',
  },
  {
    id: '100_MILE_HERO',
    name: '100 Mile Hero',
    description: 'Incredible! You\'ve walked 100 miles!',
    icon: '🦸',
    earnedAt: new Date().toISOString(),
    userId: 'demo-user',
    teamId: 'demo-team',
  },
  {
    id: '7_DAY_STREAK',
    name: '7-Day Streak',
    description: 'You\'ve walked every day for a week!',
    icon: '🔥',
    earnedAt: new Date().toISOString(),
    userId: 'demo-user',
    teamId: 'demo-team',
  },
  {
    id: '30_DAY_STREAK',
    name: '30-Day Streak',
    description: 'Amazing! 30 days of consistent walking!',
    icon: '💪',
    earnedAt: new Date().toISOString(),
    userId: 'demo-user',
    teamId: 'demo-team',
  },
  {
    id: 'TEAM_PLAYER',
    name: 'Team Player',
    description: 'You\'ve contributed to 5 team goals!',
    icon: '🤝',
    earnedAt: new Date().toISOString(),
    userId: 'demo-user',
    teamId: 'demo-team',
  },
  {
    id: 'EARLY_BIRD',
    name: 'Early Bird',
    description: 'You\'ve completed 10 morning walks!',
    icon: '🌅',
    earnedAt: new Date().toISOString(),
    userId: 'demo-user',
    teamId: 'demo-team',
  },
];

export default function AchievementsDemo() {
  const [enableSound, setEnableSound] = useState(true);
  const [enableSharing, setEnableSharing] = useState(true);
  const { celebrate, queue, clearQueue } = useAchievementCelebration();
  const [triggerAchievement, setTriggerAchievement] = useState<Achievement | null>(null);

  const handleTriggerAchievement = (achievement: Achievement) => {
    // Set the achievement to trigger the celebration component
    setTriggerAchievement({ ...achievement, earnedAt: new Date().toISOString() });
    
    // Clear after a short delay to allow re-triggering
    setTimeout(() => {
      setTriggerAchievement(null);
    }, 100);
  };

  const handleMultipleAchievements = () => {
    // Trigger multiple achievements with delays
    mockAchievements.slice(0, 3).forEach((achievement, index) => {
      setTimeout(() => {
        handleTriggerAchievement(achievement);
      }, index * 500);
    });
  };

  const handleShare = (achievement: Achievement) => {
    alert(`Sharing achievement: ${achievement.name}`);
  };

  const handleConfettiOnly = (type: 'confetti' | 'fireworks' | 'stars') => {
    celebrationAnimations[type](0.8);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* Achievement Celebration Component */}
      {triggerAchievement && (
        <AchievementCelebration
          enableSound={enableSound}
          enableSharing={enableSharing}
          onShare={handleShare}
          autoHideDuration={6000}
        />
      )}

      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Achievement Celebration Demo</h1>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Settings</h2>
          <div className="flex gap-6">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enableSound}
                onChange={(e) => setEnableSound(e.target.checked)}
                className="mr-2"
              />
              Enable Sound
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enableSharing}
                onChange={(e) => setEnableSharing(e.target.checked)}
                className="mr-2"
              />
              Enable Sharing
            </label>
          </div>
        </div>

        {/* Achievement Triggers */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Trigger Achievements</h2>
          
          <div className="mb-6">
            <button
              onClick={handleMultipleAchievements}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Trigger Multiple Achievements
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockAchievements.map((achievement) => {
              const metadata = ACHIEVEMENT_METADATA[achievement.id] || {
                icon: '🏆',
                rarity: 'common',
                color: 'from-gray-400 to-gray-600',
              };
              
              return (
                <div
                  key={achievement.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleTriggerAchievement(achievement)}
                >
                  <div className="flex items-start gap-3">
                    <AchievementBadge
                      icon={metadata.icon}
                      rarity={metadata.rarity}
                      size="small"
                      animated={false}
                    />
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{achievement.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{achievement.description}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Rarity: <span className="capitalize font-medium">{metadata.rarity}</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Confetti Controls */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Confetti Effects Only</h2>
          <div className="flex gap-4">
            <button
              onClick={() => handleConfettiOnly('confetti')}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Basic Confetti
            </button>
            <button
              onClick={() => handleConfettiOnly('fireworks')}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Fireworks
            </button>
            <button
              onClick={() => handleConfettiOnly('stars')}
              className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition-colors"
            >
              Stars
            </button>
          </div>
        </div>

        {/* Achievement Badges Gallery */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Achievement Badges</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Object.entries(ACHIEVEMENT_METADATA).map(([id, metadata]) => (
              <div key={id} className="text-center">
                <AchievementBadge
                  icon={metadata.icon}
                  rarity={metadata.rarity}
                  size="medium"
                  animated={true}
                  className="mx-auto mb-2"
                />
                <p className="text-sm font-medium text-gray-700">{id.replace(/_/g, ' ')}</p>
                <p className="text-xs text-gray-500 capitalize">{metadata.rarity}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}