'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { Achievement } from '@/hooks/useRealtimeUpdates';
import { ManagedAchievementCelebration } from './ManagedAchievementCelebration';

interface AchievementContextValue {
  triggerAchievement: (achievement: Achievement) => void;
  enableSound: boolean;
  setEnableSound: (enabled: boolean) => void;
  enableSharing: boolean;
  setEnableSharing: (enabled: boolean) => void;
}

const AchievementContext = createContext<AchievementContextValue | null>(null);

interface AchievementProviderProps {
  children: React.ReactNode;
  defaultEnableSound?: boolean;
  defaultEnableSharing?: boolean;
}

export function AchievementProvider({ 
  children,
  defaultEnableSound = true,
  defaultEnableSharing = true,
}: AchievementProviderProps) {
  const [enableSound, setEnableSound] = useState(defaultEnableSound);
  const [enableSharing, setEnableSharing] = useState(defaultEnableSharing);
  const [achievementQueue, setAchievementQueue] = useState<Achievement[]>([]);

  // Subscribe to achievement events via WebSocket
  useRealtimeUpdates({
    channels: ['achievements'],
    onAchievement: (achievement) => {
      setAchievementQueue(prev => [...prev, achievement]);
    },
    enableLogging: process.env.NODE_ENV === 'development',
  });

  // Load user preferences from localStorage
  useEffect(() => {
    const savedSoundPref = localStorage.getItem('achievementSoundEnabled');
    const savedSharingPref = localStorage.getItem('achievementSharingEnabled');
    
    if (savedSoundPref !== null) {
      setEnableSound(savedSoundPref === 'true');
    }
    if (savedSharingPref !== null) {
      setEnableSharing(savedSharingPref === 'true');
    }
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem('achievementSoundEnabled', String(enableSound));
  }, [enableSound]);

  useEffect(() => {
    localStorage.setItem('achievementSharingEnabled', String(enableSharing));
  }, [enableSharing]);

  // Manual trigger for achievements (useful for testing or manual triggers)
  const triggerAchievement = useCallback((achievement: Achievement) => {
    setAchievementQueue(prev => [...prev, achievement]);
  }, []);

  const handleShare = useCallback((achievement: Achievement) => {
    if (navigator.share) {
      navigator.share({
        title: `Achievement Unlocked: ${achievement.name}`,
        text: `I just earned the "${achievement.name}" achievement in Mile Quest! ${achievement.description}`,
        url: window.location.origin,
      }).catch(() => {
        // User cancelled or share failed
      });
    } else {
      // Fallback: Copy to clipboard
      const text = `I just earned the "${achievement.name}" achievement in Mile Quest! ${achievement.description}`;
      navigator.clipboard.writeText(text).then(() => {
        // You could show a toast notification here
        console.log('Achievement copied to clipboard');
      });
    }
  }, []);

  const contextValue: AchievementContextValue = {
    triggerAchievement,
    enableSound,
    setEnableSound,
    enableSharing,
    setEnableSharing,
  };

  return (
    <AchievementContext.Provider value={contextValue}>
      {children}
      
      {/* Achievement Celebration Component */}
      <ManagedAchievementCelebration
        achievement={achievementQueue[0] || null}
        onComplete={() => {
          setAchievementQueue(prev => prev.slice(1));
        }}
        enableSound={enableSound}
        enableSharing={enableSharing}
        onShare={handleShare}
        autoHideDuration={6000}
      />
      
      {/* Queue indicator */}
      {achievementQueue.length > 1 && (
        <div className="fixed top-40 left-1/2 transform -translate-x-1/2 z-40 text-center">
          <p className="text-sm text-gray-600 bg-white/90 px-3 py-1 rounded-full shadow-md">
            +{achievementQueue.length - 1} more achievement{achievementQueue.length > 2 ? 's' : ''} unlocked
          </p>
        </div>
      )}
    </AchievementContext.Provider>
  );
}

export function useAchievements() {
  const context = useContext(AchievementContext);
  if (!context) {
    throw new Error('useAchievements must be used within AchievementProvider');
  }
  return context;
}