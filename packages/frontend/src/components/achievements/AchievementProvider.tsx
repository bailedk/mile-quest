'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { ManagedAchievementCelebration } from './ManagedAchievementCelebration';

// Define Achievement type locally
export interface Achievement {
  id: string;
  type: string;
  title: string;
  description: string;
  points: number;
  icon?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: string;
}

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
  celebrationStyle?: 'minimal' | 'standard' | 'epic';
}

export function AchievementProvider({
  children,
  defaultEnableSound = true,
  defaultEnableSharing = false,
  celebrationStyle = 'standard',
}: AchievementProviderProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [enableSound, setEnableSound] = useState(defaultEnableSound);
  const [enableSharing, setEnableSharing] = useState(defaultEnableSharing);

  const triggerAchievement = useCallback((achievement: Achievement) => {
    setAchievements(prev => [...prev, achievement]);
  }, []);

  const handleDismiss = useCallback((achievementId: string) => {
    setAchievements(prev => prev.filter(a => a.id !== achievementId));
  }, []);

  const value: AchievementContextValue = {
    triggerAchievement,
    enableSound,
    setEnableSound,
    enableSharing,
    setEnableSharing,
  };

  return (
    <AchievementContext.Provider value={value}>
      {children}
      <ManagedAchievementCelebration
        achievements={achievements}
        onDismiss={handleDismiss}
        celebrationStyle={celebrationStyle}
        enableSound={enableSound}
        enableSharing={enableSharing}
      />
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