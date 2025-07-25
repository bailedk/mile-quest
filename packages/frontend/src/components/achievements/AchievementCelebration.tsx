'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

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

// Achievement types and their metadata
export const ACHIEVEMENT_METADATA: Record<string, {
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  color: string;
  celebrationIntensity: number;
}> = {
  'FIRST_WALK': {
    icon: '🚶',
    rarity: 'common',
    color: 'from-green-400 to-green-600',
    celebrationIntensity: 0.5,
  },
  '10_MILE_CLUB': {
    icon: '🏃',
    rarity: 'common',
    color: 'from-blue-400 to-blue-600',
    celebrationIntensity: 0.6,
  },
  '100_MILE_HERO': {
    icon: '🦸',
    rarity: 'rare',
    color: 'from-purple-400 to-purple-600',
    celebrationIntensity: 0.7,
  },
  'WALKING_WARRIOR': {
    icon: '⚔️',
    rarity: 'rare',
    color: 'from-red-400 to-red-600',
    celebrationIntensity: 0.8,
  },
  'TEAM_CHAMPION': {
    icon: '👥',
    rarity: 'epic',
    color: 'from-yellow-400 to-yellow-600',
    celebrationIntensity: 0.85,
  },
  'MILESTONE_MASTER': {
    icon: '🏆',
    rarity: 'epic',
    color: 'from-orange-400 to-orange-600',
    celebrationIntensity: 0.9,
  },
  'LEGENDARY_WALKER': {
    icon: '👑',
    rarity: 'legendary',
    color: 'from-purple-600 via-pink-500 to-red-500',
    celebrationIntensity: 1,
  },
};

interface AchievementCelebrationProps {
  achievements?: Achievement[];
  onDismiss?: (achievementId: string) => void;
  displayDuration?: number;
  celebrationStyle?: 'minimal' | 'standard' | 'epic';
  position?: 'top' | 'center' | 'bottom';
}

export function AchievementCelebration({
  achievements = [],
  onDismiss,
  displayDuration = 5000,
  celebrationStyle = 'standard',
  position = 'top',
}: AchievementCelebrationProps) {
  const [displayedAchievements, setDisplayedAchievements] = useState<Achievement[]>([]);
  const [queuedAchievements, setQueuedAchievements] = useState<Achievement[]>([]);
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const celebrationTimeoutRef = useRef<NodeJS.Timeout>();

  // Process achievements from props
  useEffect(() => {
    if (achievements.length > 0) {
      setQueuedAchievements(prev => [...prev, ...achievements]);
    }
  }, [achievements]);

  // Process queued achievements
  useEffect(() => {
    if (!currentAchievement && queuedAchievements.length > 0) {
      const [next, ...rest] = queuedAchievements;
      setCurrentAchievement(next);
      setQueuedAchievements(rest);
    }
  }, [currentAchievement, queuedAchievements]);

  // Handle achievement display and celebration
  useEffect(() => {
    if (currentAchievement) {
      // Get achievement metadata
      const metadata = ACHIEVEMENT_METADATA[currentAchievement.type] || {
        icon: '🎉',
        rarity: 'common',
        color: 'from-blue-400 to-blue-600',
        celebrationIntensity: 0.5,
      };

      // Trigger celebration based on style
      if (celebrationStyle !== 'minimal') {
        triggerCelebration(metadata.celebrationIntensity);
      }

      // Set timeout to dismiss
      celebrationTimeoutRef.current = setTimeout(() => {
        handleDismiss(currentAchievement.id);
      }, displayDuration);

      return () => {
        if (celebrationTimeoutRef.current) {
          clearTimeout(celebrationTimeoutRef.current);
        }
      };
    }
  }, [currentAchievement, celebrationStyle, displayDuration]);

  // Trigger confetti celebration
  const triggerCelebration = (intensity: number) => {
    const count = Math.floor(200 * intensity);
    const defaults = {
      origin: { y: 0.7 },
      spread: 120,
      ticks: 60,
      gravity: 0.8,
      decay: 0.94,
      startVelocity: 30,
    };

    // Fire confetti based on intensity
    if (intensity >= 0.8) {
      // Epic celebration
      const fire = (particleRatio: number, opts: any) => {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio),
        });
      };

      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    } else {
      // Standard celebration
      confetti({
        ...defaults,
        particleCount: count,
        spread: 70,
        scalar: intensity * 1.2,
      });
    }
  };

  // Handle achievement dismissal
  const handleDismiss = (achievementId: string) => {
    setCurrentAchievement(null);
    if (onDismiss) {
      onDismiss(achievementId);
    }
  };

  // Position classes based on prop
  const positionClasses = {
    top: 'top-20',
    center: 'top-1/2 -translate-y-1/2',
    bottom: 'bottom-20',
  };

  return (
    <AnimatePresence>
      {currentAchievement && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: position === 'top' ? -50 : 0 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: position === 'bottom' ? 50 : -50 }}
          className={`fixed left-1/2 transform -translate-x-1/2 ${positionClasses[position]} z-50`}
        >
          <div
            className={`
              bg-white rounded-lg shadow-2xl p-6 min-w-[320px] max-w-md
              ${celebrationStyle === 'epic' ? 'border-4 border-yellow-400' : ''}
            `}
          >
            <div className="flex items-center space-x-4">
              <div
                className={`
                  text-4xl p-3 rounded-full
                  bg-gradient-to-br ${ACHIEVEMENT_METADATA[currentAchievement.type]?.color || 'from-blue-400 to-blue-600'}
                `}
              >
                {ACHIEVEMENT_METADATA[currentAchievement.type]?.icon || '🎉'}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">
                  {currentAchievement.title}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {currentAchievement.description}
                </p>
                {currentAchievement.points && (
                  <p className="text-sm font-semibold text-yellow-600 mt-2">
                    +{currentAchievement.points} points
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDismiss(currentAchievement.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            {queuedAchievements.length > 0 && (
              <div className="mt-4 text-center text-sm text-gray-500">
                +{queuedAchievements.length} more achievements
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook for managing achievement celebrations
export function useAchievementCelebration() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  const celebrate = useCallback((achievement: Omit<Achievement, 'id'>) => {
    const newAchievement: Achievement = {
      ...achievement,
      id: Date.now().toString(),
    };
    setAchievements(prev => [...prev, newAchievement]);
  }, []);

  const dismissAchievement = useCallback((achievementId: string) => {
    setAchievements(prev => prev.filter(a => a.id !== achievementId));
  }, []);

  return {
    achievements,
    celebrate,
    dismissAchievement,
  };
}