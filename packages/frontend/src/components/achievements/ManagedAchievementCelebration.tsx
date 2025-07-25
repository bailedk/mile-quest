'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ACHIEVEMENT_METADATA } from './AchievementCelebration';

// Define Achievement type locally
interface Achievement {
  id: string;
  type: string;
  title: string;
  description: string;
  points: number;
  icon?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: string;
}

interface ManagedAchievementCelebrationProps {
  achievements: Achievement[];
  onDismiss: (achievementId: string) => void;
  celebrationStyle?: 'minimal' | 'standard' | 'epic';
  enableSound?: boolean;
  enableSharing?: boolean;
}

export function ManagedAchievementCelebration({
  achievements,
  onDismiss,
  celebrationStyle = 'standard',
  enableSound = true,
  enableSharing = false,
}: ManagedAchievementCelebrationProps) {
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const [queue, setQueue] = useState<Achievement[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Process achievements queue
  useEffect(() => {
    if (achievements.length > 0 && !currentAchievement) {
      const newAchievements = achievements.filter(a => !queue.find(q => q.id === a.id));
      if (newAchievements.length > 0) {
        setQueue(prev => [...prev, ...newAchievements]);
      }
    }
  }, [achievements, currentAchievement, queue]);

  // Display next achievement from queue
  useEffect(() => {
    if (!currentAchievement && queue.length > 0) {
      const [next, ...rest] = queue;
      setCurrentAchievement(next);
      setQueue(rest);
    }
  }, [currentAchievement, queue]);

  // Handle achievement display
  useEffect(() => {
    if (currentAchievement) {
      const metadata = ACHIEVEMENT_METADATA[currentAchievement.type] || {
        celebrationIntensity: 0.5,
      };

      // Trigger celebration
      if (celebrationStyle !== 'minimal') {
        triggerCelebration(metadata.celebrationIntensity);
      }

      // Play sound if enabled
      if (enableSound) {
        playAchievementSound();
      }

      // Auto dismiss after duration
      timeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, 5000);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [currentAchievement, celebrationStyle, enableSound]);

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

    confetti({
      ...defaults,
      particleCount: count,
      spread: 70,
      scalar: intensity * 1.2,
    });
  };

  const playAchievementSound = () => {
    // Play a simple beep sound using Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.error('Failed to play achievement sound:', error);
    }
  };

  const handleDismiss = () => {
    if (currentAchievement) {
      onDismiss(currentAchievement.id);
      setCurrentAchievement(null);
    }
  };

  const handleShare = () => {
    if (currentAchievement && enableSharing && navigator.share) {
      navigator.share({
        title: currentAchievement.title,
        text: `I just unlocked "${currentAchievement.title}" in Mile Quest! ${currentAchievement.description}`,
      }).catch(console.error);
    }
  };

  if (!currentAchievement) {
    return null;
  }

  const metadata = ACHIEVEMENT_METADATA[currentAchievement.type] || {
    icon: '🎉',
    color: 'from-blue-400 to-blue-600',
    rarity: 'common',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: -50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: -50 }}
        className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
      >
        <div className="bg-white rounded-lg shadow-2xl p-6 min-w-[320px] max-w-md">
          <div className="flex items-center space-x-4">
            <div
              className={`
                text-4xl p-3 rounded-full
                bg-gradient-to-br ${metadata.color}
              `}
            >
              {metadata.icon}
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
          </div>
          
          <div className="flex justify-between items-center mt-4">
            {enableSharing && navigator.share && (
              <button
                onClick={handleShare}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Share
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="ml-auto text-sm text-gray-500 hover:text-gray-700"
            >
              Dismiss
            </button>
          </div>
          
          {queue.length > 0 && (
            <div className="mt-4 text-center text-sm text-gray-500">
              +{queue.length} more achievements
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}