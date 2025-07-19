'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { Achievement } from '@/hooks/useRealtimeUpdates';

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
    rarity: 'epic',
    color: 'from-purple-400 to-purple-600',
    celebrationIntensity: 0.8,
  },
  '7_DAY_STREAK': {
    icon: '🔥',
    rarity: 'rare',
    color: 'from-orange-400 to-orange-600',
    celebrationIntensity: 0.7,
  },
  '30_DAY_STREAK': {
    icon: '💪',
    rarity: 'legendary',
    color: 'from-red-400 to-red-600',
    celebrationIntensity: 1.0,
  },
  'TEAM_PLAYER': {
    icon: '🤝',
    rarity: 'rare',
    color: 'from-indigo-400 to-indigo-600',
    celebrationIntensity: 0.7,
  },
  'EARLY_BIRD': {
    icon: '🌅',
    rarity: 'rare',
    color: 'from-yellow-400 to-yellow-600',
    celebrationIntensity: 0.7,
  },
};

// Achievement celebration component
export interface AchievementCelebrationProps {
  maxQueueSize?: number;
  autoHideDuration?: number;
  enableSound?: boolean;
  enableSharing?: boolean;
  onShare?: (achievement: Achievement) => void;
  className?: string;
}

export function AchievementCelebration({
  maxQueueSize = 5,
  autoHideDuration = 6000,
  enableSound = true,
  enableSharing = true,
  onShare,
  className = '',
}: AchievementCelebrationProps) {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(enableSound);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to achievement events only if not using external queue management
  const { } = useRealtimeUpdates({
    channels: ['achievements'],
    onAchievement: (achievement) => {
      addToQueue(achievement);
    },
    enableLogging: process.env.NODE_ENV === 'development',
  });

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

  // Add achievement to queue
  const addToQueue = useCallback((achievement: Achievement) => {
    setQueue((prev) => {
      const newQueue = [...prev, achievement];
      return newQueue.slice(-maxQueueSize); // Keep only the last N achievements
    });
  }, [maxQueueSize]);

  // Process queue
  useEffect(() => {
    if (!currentAchievement && queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      setCurrentAchievement(next);
      setIsVisible(true);
    }
  }, [currentAchievement, queue]);

  // Handle current achievement display
  useEffect(() => {
    if (!currentAchievement || !isVisible) return;

    // Play celebration effects
    const metadata = ACHIEVEMENT_METADATA[currentAchievement.id] || {
      celebrationIntensity: 0.5,
      rarity: 'common',
    };

    // Trigger confetti
    if (!prefersReducedMotion) {
      triggerConfetti(metadata.celebrationIntensity);
    }

    // Play sound
    if (soundEnabled) {
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
  }, [currentAchievement, isVisible, soundEnabled, autoHideDuration, prefersReducedMotion]);

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
      setCurrentAchievement(null);
    }, 300);
  }, []);

  // Handle share
  const handleShare = useCallback(() => {
    if (!currentAchievement) return;

    if (onShare) {
      onShare(currentAchievement);
    } else if (navigator.share) {
      navigator.share({
        title: `Achievement Unlocked: ${currentAchievement.name}`,
        text: currentAchievement.description,
        url: window.location.href,
      }).catch(() => {
        // User cancelled or share failed
      });
    }
  }, [currentAchievement, onShare]);

  if (!currentAchievement) return null;

  const metadata = ACHIEVEMENT_METADATA[currentAchievement.id] || {
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
          className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full px-4 ${className}`}
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
                  {currentAchievement.name}
                </motion.h3>
              </div>

              {/* Achievement description */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center text-white/90 mb-6"
              >
                {currentAchievement.description}
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
                    Completed on {new Date(currentAchievement.earnedAt).toLocaleDateString()}
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

          {/* Queue indicator */}
          {queue.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-3 text-center"
            >
              <p className="text-sm text-gray-600">
                +{queue.length} more achievement{queue.length > 1 ? 's' : ''} unlocked
              </p>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Achievement badge component
export interface AchievementBadgeProps {
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
  className?: string;
}

export function AchievementBadge({
  icon,
  rarity,
  size = 'medium',
  animated = true,
  className = '',
}: AchievementBadgeProps) {
  const sizeClasses = {
    small: 'w-12 h-12 text-2xl',
    medium: 'w-16 h-16 text-3xl',
    large: 'w-24 h-24 text-5xl',
  };

  const rarityClasses = {
    common: 'bg-gray-200 border-gray-300',
    rare: 'bg-blue-200 border-blue-400',
    epic: 'bg-purple-200 border-purple-400',
    legendary: 'bg-yellow-200 border-yellow-400',
  };

  const glowClasses = {
    common: '',
    rare: 'shadow-blue-400/50',
    epic: 'shadow-purple-400/50',
    legendary: 'shadow-yellow-400/50',
  };

  return (
    <div
      className={`
        ${sizeClasses[size]} 
        ${rarityClasses[rarity]} 
        ${animated ? `shadow-lg ${glowClasses[rarity]}` : ''}
        rounded-full border-4 flex items-center justify-center
        ${animated ? 'animate-pulse-slow' : ''}
        ${className}
      `}
    >
      <span className={animated ? 'animate-bounce-slow' : ''}>{icon}</span>
    </div>
  );
}

// Custom hook for achievement celebrations
export function useAchievementCelebration() {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const celebrate = useCallback((achievement: Achievement) => {
    setQueue((prev) => [...prev, achievement]);
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const processNext = useCallback(() => {
    if (queue.length > 0 && !isProcessing) {
      setIsProcessing(true);
      const [next, ...rest] = queue;
      setQueue(rest);
      // Return the next achievement to process
      return next;
    }
    return null;
  }, [queue, isProcessing]);

  const finishProcessing = useCallback(() => {
    setIsProcessing(false);
  }, []);

  return {
    queue,
    celebrate,
    clearQueue,
    processNext,
    finishProcessing,
    isProcessing,
    hasAchievements: queue.length > 0,
  };
}

// Celebration animation utilities
export const celebrationAnimations = {
  confetti: (intensity = 0.5) => {
    const count = Math.floor(200 * intensity);
    confetti({
      particleCount: count,
      spread: 70,
      origin: { y: 0.6 },
    });
  },

  fireworks: (intensity = 0.5) => {
    const duration = 15 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  },

  stars: (intensity = 0.5) => {
    const defaults = {
      spread: 360,
      ticks: 50,
      gravity: 0,
      decay: 0.94,
      startVelocity: 30,
      colors: ['FFE400', 'FFBD00', 'E89400', 'FFCA6C', 'FDFFB8'],
    };

    const shoot = () => {
      confetti({
        ...defaults,
        particleCount: 40 * intensity,
        scalar: 1.2,
        shapes: ['star'],
      });

      confetti({
        ...defaults,
        particleCount: 20 * intensity,
        scalar: 0.75,
        shapes: ['circle'],
      });
    };

    setTimeout(shoot, 0);
    setTimeout(shoot, 100);
    setTimeout(shoot, 200);
  },
};

// CSS animations
const styles = `
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  @keyframes pulse-slow {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }

  @keyframes bounce-slow {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10%); }
  }

  .animate-shimmer {
    animation: shimmer 2s infinite;
  }

  .animate-pulse-slow {
    animation: pulse-slow 2s ease-in-out infinite;
  }

  .animate-bounce-slow {
    animation: bounce-slow 2s ease-in-out infinite;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

export default AchievementCelebration;