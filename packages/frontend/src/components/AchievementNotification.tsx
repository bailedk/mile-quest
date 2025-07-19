'use client';

import React, { useEffect, useState } from 'react';
import { Achievement } from '@/hooks/useRealtimeUpdates';

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
        fixed top-4 right-4 z-50 max-w-sm w-full
        transform transition-all duration-300 ease-out
        ${isVisible && !isExiting 
          ? 'translate-x-0 opacity-100' 
          : 'translate-x-full opacity-0'
        }
      `}
    >
      <div className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                {achievement.icon ? (
                  <span className="text-2xl">{achievement.icon}</span>
                ) : (
                  <div className="w-8 h-8 bg-yellow-300 rounded-full flex items-center justify-center">
                    <span className="text-yellow-800 font-bold text-sm">🏆</span>
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white mb-1">
                  Achievement Earned!
                </h3>
                <p className="text-lg font-bold text-white mb-1">
                  {achievement.name}
                </p>
                <p className="text-sm text-yellow-100 opacity-90">
                  {achievement.description}
                </p>
              </div>
            </div>
            
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 ml-2 text-yellow-100 hover:text-white transition-colors"
              aria-label="Dismiss notification"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path 
                  fillRule="evenodd" 
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
                  clipRule="evenodd" 
                />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Progress bar for auto-dismiss */}
        <div className="h-1 bg-yellow-300">
          <div 
            className="h-full bg-yellow-600 transition-all ease-linear"
            style={{
              width: '100%',
              animation: `shrink ${duration}ms linear`,
            }}
          />
        </div>
      </div>
      
      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

interface AchievementNotificationManagerProps {
  achievements: Achievement[];
  onDismiss: (id: string) => void;
}

export function AchievementNotificationManager({ 
  achievements, 
  onDismiss 
}: AchievementNotificationManagerProps) {
  return (
    <>
      {achievements.map((achievement, index) => (
        <div
          key={achievement.id}
          style={{
            top: `${1 + index * 6}rem`, // Stack notifications with spacing
          }}
          className="absolute"
        >
          <AchievementNotification
            achievement={achievement}
            onDismiss={() => onDismiss(achievement.id)}
          />
        </div>
      ))}
    </>
  );
}