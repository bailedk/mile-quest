'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Achievement } from '@/hooks/useRealtimeUpdates';
import { AchievementBadge, ACHIEVEMENT_METADATA } from './AchievementCelebration';

interface ManagedAchievementCelebrationProps {
  achievement: Achievement | null;
  onComplete: () => void;
  enableSound?: boolean;
  enableSharing?: boolean;
  autoHideDuration?: number;
  onShare?: (achievement: Achievement) => void;
}

export function ManagedAchievementCelebration({
  achievement,
  onComplete,
  enableSound = true,
  enableSharing = true,
  autoHideDuration = 6000,
  onShare,
}: ManagedAchievementCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Handle achievement display
  useEffect(() => {
    if (!achievement) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);

    // Play celebration effects
    const metadata = ACHIEVEMENT_METADATA[achievement.id] || {
      celebrationIntensity: 0.5,
      rarity: 'common',
    };

    // Trigger confetti
    if (!prefersReducedMotion) {
      triggerConfetti(metadata.celebrationIntensity);
    }

    // Play sound
    if (enableSound) {
      playAchievementSound(metadata.rarity);
    }

    // Auto-hide after duration
    timeoutRef.current = setTimeout(() => {
      handleDismiss();
    }, autoHideDuration);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [achievement, enableSound, autoHideDuration, prefersReducedMotion]);

  // Trigger confetti animation
  const triggerConfetti = useCallback((intensity: number) => {
    const count = Math.floor(200 * intensity);
    const defaults = {
      origin: { y: 0.5 },
      spread: 50,
      ticks: 60,
      gravity: 1,
      decay: 0.9,
      startVelocity: 30 * intensity,
    };

    const fire = (particleRatio: number, opts: any) => {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    };

    // Multi-burst confetti for higher intensity
    fire(0.25, {
      spread: 26,
      startVelocity: 55 * intensity,
    });

    fire(0.2, {
      spread: 60,
    });

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25 * intensity,
      decay: 0.92,
      scalar: 1.2,
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45 * intensity,
    });
  }, []);

  // Play achievement sound
  const playAchievementSound = useCallback((rarity: string) => {
    try {
      // Different sounds for different rarities
      const sounds = {
        common: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmgfCjiM0+/JfC0GIm+/8+CVSA0PVqzn77BdGAg+ltryxnkpBSl+zPLaizsIGGS57+OWT',
        rare: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmgfCjiM0+/JfC0GIm+/8+CVSA0PVqzn77BdGAg+ltryxnkpBSl+zPLaizsIGGS57+OWT',
        epic: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmgfCjiM0+/JfC0GIm+/8+CVSA0PVqzn77BdGAg+ltryxnkpBSl+zPLaizsIGGS57+OWT',
        legendary: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmgfCjiM0+/JfC0GIm+/8+CVSA0PVqzn77BdGAg+ltryxnkpBSl+zPLaizsIGGS57+OWT',
      };

      const audio = new Audio(sounds[rarity as keyof typeof sounds] || sounds.common);
      audio.volume = rarity === 'legendary' ? 0.6 : 0.4;
      audioRef.current = audio;
      audio.play().catch(() => {
        // Ignore audio errors - browser may block autoplay
      });
    } catch (error) {
      // Ignore audio errors
    }
  }, []);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onComplete();
    }, 300);
  }, [onComplete]);

  // Handle share
  const handleShare = useCallback(() => {
    if (!achievement) return;

    if (onShare) {
      onShare(achievement);
    } else if (navigator.share) {
      navigator.share({
        title: `Achievement Unlocked: ${achievement.name}`,
        text: achievement.description,
        url: window.location.href,
      }).catch(() => {
        // User cancelled or share failed
      });
    }
  }, [achievement, onShare]);

  if (!achievement) return null;

  const metadata = ACHIEVEMENT_METADATA[achievement.id] || {
    icon: '🏆',
    rarity: 'common',
    color: 'from-gray-400 to-gray-600',
    celebrationIntensity: 0.5,
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -50 }}
          transition={{
            type: prefersReducedMotion ? 'tween' : 'spring',
            damping: 15,
            stiffness: 300,
          }}
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full px-4"
        >
          <div className={`bg-gradient-to-r ${metadata.color} rounded-2xl shadow-2xl overflow-hidden`}>
            {/* Shimmer effect for rare achievements */}
            {(metadata.rarity === 'epic' || metadata.rarity === 'legendary') && !prefersReducedMotion && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-shimmer" />
            )}

            <div className="relative p-6 text-white">
              {/* Achievement header */}
              <div className="text-center mb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    delay: 0.2,
                    type: prefersReducedMotion ? 'tween' : 'spring',
                    damping: 10,
                    stiffness: 200,
                  }}
                  className="inline-block"
                >
                  <AchievementBadge
                    icon={metadata.icon}
                    rarity={metadata.rarity}
                    size="large"
                    animated={!prefersReducedMotion}
                  />
                </motion.div>
                
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold mt-4 mb-1"
                >
                  Achievement Unlocked!
                </motion.h2>
                
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-xl font-semibold"
                >
                  {achievement.name}
                </motion.h3>
              </div>

              {/* Achievement description */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center text-white/90 mb-6"
              >
                {achievement.description}
              </motion.p>

              {/* Progress bar (if applicable) */}
              {metadata.rarity !== 'common' && (
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mb-6"
                >
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-white/80 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ delay: 0.7, duration: 1 }}
                    />
                  </div>
                  <p className="text-center text-sm text-white/70 mt-1">
                    Completed on {new Date(achievement.earnedAt).toLocaleDateString()}
                  </p>
                </motion.div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                {enableSharing && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    onClick={handleShare}
                    className="flex-1 bg-white/20 hover:bg-white/30 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    Share Achievement
                  </motion.button>
                )}
                
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                  onClick={handleDismiss}
                  className="flex-1 bg-white/20 hover:bg-white/30 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  Continue
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}