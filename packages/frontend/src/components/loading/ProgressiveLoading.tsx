'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, stagger, useAnimate } from 'framer-motion';
import { LoadingSpinner } from './LoadingSpinner';
import { Skeleton } from './SkeletonComponents';

interface ProgressiveLoadingProps<T> {
  stages: Array<{
    key: string;
    label: string;
    loader: () => Promise<T>;
    fallback?: React.ReactNode;
    delay?: number;
  }>;
  onComplete: (results: T[]) => void;
  onError?: (error: Error, stage: string) => void;
  className?: string;
  showProgress?: boolean;
}

export function ProgressiveLoading<T>({
  stages,
  onComplete,
  onError,
  className = '',
  showProgress = true
}: ProgressiveLoadingProps<T>) {
  const [currentStage, setCurrentStage] = useState(0);
  const [results, setResults] = useState<T[]>([]);
  const [errors, setErrors] = useState<Record<string, Error>>({});
  const [isComplete, setIsComplete] = useState(false);

  const loadStage = useCallback(async (stageIndex: number) => {
    if (stageIndex >= stages.length) {
      setIsComplete(true);
      onComplete(results);
      return;
    }

    const stage = stages[stageIndex];
    
    try {
      // Apply delay if specified
      if (stage.delay) {
        await new Promise(resolve => setTimeout(resolve, stage.delay));
      }

      const result = await stage.loader();
      setResults(prev => [...prev, result]);
      setCurrentStage(stageIndex + 1);
      
      // Automatically proceed to next stage
      setTimeout(() => loadStage(stageIndex + 1), 100);
    } catch (error) {
      const err = error as Error;
      setErrors(prev => ({ ...prev, [stage.key]: err }));
      if (onError) {
        onError(err, stage.key);
      }
      // Continue to next stage even on error
      setTimeout(() => loadStage(stageIndex + 1), 100);
    }
  }, [stages, results, onComplete, onError]);

  useEffect(() => {
    loadStage(0);
  }, [loadStage]);

  if (isComplete) {
    return null;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {showProgress && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
            <motion.div
              className="bg-blue-600 h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(currentStage / stages.length) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          {/* Stage list */}
          <div className="space-y-2">
            {stages.map((stage, index) => (
              <motion.div
                key={stage.key}
                className={`flex items-center space-x-3 p-2 rounded-lg ${
                  index < currentStage 
                    ? 'bg-green-50 text-green-800' 
                    : index === currentStage
                    ? 'bg-blue-50 text-blue-800'
                    : 'bg-gray-50 text-gray-600'
                }`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex-shrink-0">
                  {index < currentStage ? (
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : index === currentStage ? (
                    <LoadingSpinner size="xs" variant="dots" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                </div>
                <span className="text-sm font-medium">{stage.label}</span>
                {errors[stage.key] && (
                  <svg className="w-4 h-4 text-red-500 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Current stage content */}
      <AnimatePresence mode="wait">
        {currentStage < stages.length && (
          <motion.div
            key={stages[currentStage].key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {stages[currentStage].fallback || (
              <div className="text-center py-8">
                <LoadingSpinner size="lg" className="mb-4" />
                <p className="text-gray-600">{stages[currentStage].label}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface StaggeredRevealProps {
  children: React.ReactNode[];
  staggerDelay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  className?: string;
  trigger?: boolean;
}

export function StaggeredReveal({
  children,
  staggerDelay = 0.1,
  direction = 'up',
  className = '',
  trigger = true
}: StaggeredRevealProps) {
  const [scope, animate] = useAnimate();

  const getDirectionOffset = () => {
    switch (direction) {
      case 'up': return { y: 20 };
      case 'down': return { y: -20 };
      case 'left': return { x: 20 };
      case 'right': return { x: -20 };
      default: return { y: 20 };
    }
  };

  useEffect(() => {
    if (trigger) {
      animate(
        '.stagger-item',
        { opacity: 1, ...getDirectionOffset() },
        { delay: stagger(staggerDelay), duration: 0.5 }
      );
    }
  }, [trigger, animate, staggerDelay, direction]);

  return (
    <div ref={scope} className={className}>
      {children.map((child, index) => (
        <motion.div
          key={index}
          className="stagger-item"
          initial={{ opacity: 0, ...getDirectionOffset() }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

interface SkeletonMorphProps {
  isLoading: boolean;
  children: React.ReactNode;
  skeleton: React.ReactNode;
  className?: string;
  morphDuration?: number;
}

export function SkeletonMorph({
  isLoading,
  children,
  skeleton,
  className = '',
  morphDuration = 0.4
}: SkeletonMorphProps) {
  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: morphDuration / 2 }}
          className={className}
        >
          {skeleton}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: morphDuration, delay: morphDuration / 4 }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface WaveLoadingProps {
  items: number;
  delay?: number;
  className?: string;
  children?: (index: number) => React.ReactNode;
}

export function WaveLoading({
  items,
  delay = 0.1,
  className = '',
  children
}: WaveLoadingProps) {
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleItems(prev => {
        const next = new Set(prev);
        if (next.size < items) {
          next.add(next.size);
        }
        return next;
      });
    }, delay * 1000);

    return () => clearInterval(timer);
  }, [items, delay]);

  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: items }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={visibleItems.has(index) ? { 
            opacity: 1, 
            y: 0, 
            scale: 1 
          } : {}}
          transition={{ 
            duration: 0.5, 
            ease: 'easeOut',
            delay: index * delay 
          }}
        >
          {children ? children(index) : (
            <div className="bg-white rounded-lg shadow-sm p-4 space-y-2">
              <Skeleton width="60%" height="1.25rem" />
              <Skeleton width="80%" height="1rem" />
              <Skeleton width="40%" height="1rem" />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

interface SmartLoadingProps {
  data: any;
  isLoading: boolean;
  error?: Error | null;
  skeleton?: React.ReactNode;
  empty?: React.ReactNode;
  children: (data: any) => React.ReactNode;
  className?: string;
  retryButton?: boolean;
  onRetry?: () => void;
}

export function SmartLoading({
  data,
  isLoading,
  error,
  skeleton,
  empty,
  children,
  className = '',
  retryButton = true,
  onRetry
}: SmartLoadingProps) {
  const isEmpty = !data || (Array.isArray(data) && data.length === 0);

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={className}
        >
          {skeleton || (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-4 space-y-2">
                  <Skeleton width="60%" height="1.25rem" delay={i * 0.1} />
                  <Skeleton width="80%" height="1rem" delay={i * 0.1 + 0.05} />
                </div>
              ))}
            </div>
          )}
        </motion.div>
      ) : error ? (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`text-center py-8 ${className}`}
        >
          <div className="w-16 h-16 mx-auto mb-4 text-red-500">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Failed to load data
          </h3>
          <p className="text-gray-600 mb-4">
            {error.message}
          </p>
          {retryButton && onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          )}
        </motion.div>
      ) : isEmpty ? (
        <motion.div
          key="empty"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={className}
        >
          {empty || (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No data available
              </h3>
              <p className="text-gray-600">
                There's nothing to display right now.
              </p>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={className}
        >
          {children(data)}
        </motion.div>
      )}
    </AnimatePresence>
  );
}