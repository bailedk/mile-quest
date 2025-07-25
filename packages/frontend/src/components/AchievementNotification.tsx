'use client';

import React, { useEffect, useState } from 'react';

// Define Achievement type locally
interface Achievement {
  id: string;
  title: string;
  description: string;
  points: number;
  icon?: string;
}

interface AchievementNotificationProps {
  achievement: Achievement;
  onDismiss: () => void;
  duration?: number;
}

export function AchievementNotification({ 
  achievement, 
  onDismiss, 
  duration = 5000 
}: AchievementNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const enterTimer = setTimeout(() => setIsVisible(true), 100);
    
    // Auto-dismiss after duration
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onDismiss, 300); // Wait for exit animation
    }, duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, [duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`
        fixed top-20 right-4 bg-white rounded-lg shadow-xl p-4 
        transform transition-all duration-300 ease-out max-w-sm
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div className="flex items-start">
        <div className="text-3xl mr-3">
          {achievement.icon || '🏆'}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">
            {achievement.title}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {achievement.description}
          </p>
          {achievement.points && (
            <p className="text-sm font-semibold text-green-600 mt-2">
              +{achievement.points} points
            </p>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="ml-2 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

interface AchievementNotificationManagerProps {
  achievements: Achievement[];
  onDismiss: (achievementId: string) => void;
}

export function AchievementNotificationManager({
  achievements,
  onDismiss,
}: AchievementNotificationManagerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const currentAchievement = achievements[currentIndex];

  const handleDismiss = () => {
    if (currentAchievement) {
      onDismiss(currentAchievement.id);
      
      // Move to next achievement if available
      if (currentIndex < achievements.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  if (!currentAchievement) {
    return null;
  }

  return (
    <AchievementNotification
      achievement={currentAchievement}
      onDismiss={handleDismiss}
    />
  );
}