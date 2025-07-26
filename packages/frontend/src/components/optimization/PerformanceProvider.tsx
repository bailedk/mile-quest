/**
 * Performance monitoring provider
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { PerformanceMonitor, PerformanceMetrics, checkPerformanceBudget } from '@/utils/performance';

interface PerformanceContextType {
  metrics: PerformanceMetrics;
  budgetStatus: {
    passed: boolean;
    violations: Array<{ metric: string; value: number; budget: number; }>;
  };
  monitor: PerformanceMonitor;
}

const PerformanceContext = createContext<PerformanceContextType | null>(null);

export function usePerformanceContext() {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformanceContext must be used within a PerformanceProvider');
  }
  return context;
}

interface PerformanceProviderProps {
  children: React.ReactNode;
  enableDevtools?: boolean;
}

export function PerformanceProvider({ 
  children, 
  enableDevtools = process.env.NODE_ENV === 'development' 
}: PerformanceProviderProps) {
  const [monitor] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return PerformanceMonitor.getInstance();
      } catch (error) {
        console.warn('Failed to initialize PerformanceMonitor:', error);
        return null;
      }
    }
    return null;
  });
  const [metrics, setMetrics] = useState<PerformanceMetrics>({});
  const [budgetStatus, setBudgetStatus] = useState({
    passed: true,
    violations: [],
  });
  const [isEnabled] = useState(() => typeof window !== 'undefined' && process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_TRACKING !== 'false');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Skip if performance tracking is disabled or monitor not available
    if (!isEnabled || !monitor) return;
    
    // Update metrics periodically
    const updateMetrics = () => {
      try {
        const currentMetrics = monitor.getMetrics();
        setMetrics(currentMetrics);
        setBudgetStatus(checkPerformanceBudget(currentMetrics));
      } catch (error) {
        console.warn('Failed to update performance metrics:', error);
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000); // Update every 5 seconds

    return () => {
      clearInterval(interval);
      try {
        monitor.disconnect();
      } catch (error) {
        console.warn('Failed to disconnect performance monitor:', error);
      }
    };
  }, [monitor, isEnabled]);

  // Development performance devtools
  useEffect(() => {
    if (enableDevtools && isEnabled && typeof window !== 'undefined') {
      try {
        // Add performance data to window for debugging
        (window as any).__MILE_QUEST_PERFORMANCE__ = {
          metrics,
          budgetStatus,
          monitor,
          };

        // Log budget violations
        if (!budgetStatus.passed && budgetStatus.violations.length > 0) {
          console.group('🚨 Performance Budget Violations');
          budgetStatus.violations.forEach(({ metric, value, budget }) => {
            console.warn(
              `${metric}: ${value.toFixed(2)}ms exceeds budget of ${budget}ms ` +
              `(${((value / budget - 1) * 100).toFixed(1)}% over)`
            );
          });
          console.groupEnd();
        }
      } catch (error) {
        console.warn('Failed to setup performance devtools:', error);
      }
    }
  }, [enableDevtools, isEnabled, metrics, budgetStatus]);

  const contextValue: PerformanceContextType = {
    metrics,
    budgetStatus,
    monitor: monitor || ({} as PerformanceMonitor), // Provide empty object as fallback for SSR
  };

  return (
    <PerformanceContext.Provider value={contextValue}>
      {children}
      {enableDevtools && isEnabled && isMounted && <PerformanceDevtools />}
    </PerformanceContext.Provider>
  );
}

// Development performance overlay
function PerformanceDevtools() {
  const { metrics, budgetStatus } = usePerformanceContext();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'P') {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-blue-700 transition-colors"
          title="Show Performance Metrics (Ctrl+Shift+P)"
        >
          📊 Perf
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-4 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Performance Metrics</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2 text-sm">
        {/* Core Web Vitals */}
        <div className="grid grid-cols-2 gap-2">
          {metrics.LCP && (
            <div className={`p-2 rounded ${metrics.LCP > 2500 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              <div className="font-medium">LCP</div>
              <div>{metrics.LCP.toFixed(0)}ms</div>
            </div>
          )}
          
          {metrics.FID && (
            <div className={`p-2 rounded ${metrics.FID > 100 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              <div className="font-medium">FID</div>
              <div>{metrics.FID.toFixed(0)}ms</div>
            </div>
          )}
          
          {metrics.CLS && (
            <div className={`p-2 rounded ${metrics.CLS > 0.1 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              <div className="font-medium">CLS</div>
              <div>{metrics.CLS.toFixed(3)}</div>
            </div>
          )}
          
          {metrics.FCP && (
            <div className={`p-2 rounded ${metrics.FCP > 1800 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              <div className="font-medium">FCP</div>
              <div>{metrics.FCP.toFixed(0)}ms</div>
            </div>
          )}
        </div>

        {/* Budget Status */}
        <div className={`p-2 rounded ${budgetStatus.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <div className="font-medium">
            Budget: {budgetStatus.passed ? '✅ Passed' : '❌ Failed'}
          </div>
          {budgetStatus.violations.length > 0 && (
            <div className="text-xs mt-1">
              {budgetStatus.violations.length} violation(s)
            </div>
          )}
        </div>

        {/* Custom Timings */}
        {metrics.customTiming && Object.keys(metrics.customTiming).length > 0 && (
          <div>
            <div className="font-medium mb-1">Custom Timings</div>
            <div className="space-y-1">
              {Object.entries(metrics.customTiming).map(([name, duration]) => (
                <div key={name} className="flex justify-between text-xs">
                  <span>{name}</span>
                  <span>{duration.toFixed(1)}ms</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
        Press Ctrl+Shift+P to toggle
      </div>
    </div>
  );
}