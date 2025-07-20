/**
 * Performance monitoring and optimization utilities
 */

// Core Web Vitals tracking
export interface PerformanceMetrics {
  // Core Web Vitals
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  FCP?: number; // First Contentful Paint
  TTFB?: number; // Time to First Byte
  
  // Custom metrics
  navigationStart?: number;
  domContentLoaded?: number;
  loadComplete?: number;
  
  // User timing
  customTiming?: Record<string, number>;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics = {};
  private observers: PerformanceObserver[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeObservers();
      this.trackNavigationTiming();
    }
  }

  private initializeObservers(): void {
    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
          this.metrics.LCP = lastEntry.startTime;
          this.reportMetric('LCP', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (e) {
        console.warn('LCP observer not supported', e);
      }

      // First Input Delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            const fidEntry = entry as PerformanceEntry & { processingStart: number; startTime: number };
            const fid = fidEntry.processingStart - fidEntry.startTime;
            this.metrics.FID = fid;
            this.reportMetric('FID', fid);
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (e) {
        console.warn('FID observer not supported', e);
      }

      // Cumulative Layout Shift
      try {
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          const entries = list.getEntries();
          entries.forEach((entry) => {
            const layoutShiftEntry = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
            if (!layoutShiftEntry.hadRecentInput) {
              clsValue += layoutShiftEntry.value;
            }
          });
          this.metrics.CLS = clsValue;
          this.reportMetric('CLS', clsValue);
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (e) {
        console.warn('CLS observer not supported', e);
      }

      // Navigation timing
      try {
        const navigationObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            const navEntry = entry as PerformanceNavigationTiming;
            this.metrics.FCP = navEntry.responseStart - navEntry.requestStart;
            this.metrics.TTFB = navEntry.responseStart - navEntry.requestStart;
            this.reportMetric('FCP', this.metrics.FCP);
            this.reportMetric('TTFB', this.metrics.TTFB);
          });
        });
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navigationObserver);
      } catch (e) {
        console.warn('Navigation observer not supported', e);
      }
    }
  }

  private trackNavigationTiming(): void {
    if (typeof window !== 'undefined' && window.performance) {
      // Wait for page load to get accurate timing
      window.addEventListener('load', () => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.metrics.navigationStart = navigation.navigationStart;
          this.metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.navigationStart;
          this.metrics.loadComplete = navigation.loadEventEnd - navigation.navigationStart;
        }
      });
    }
  }

  // Mark custom timing
  public mark(name: string): void {
    if (typeof window !== 'undefined' && window.performance) {
      performance.mark(name);
    }
  }

  // Measure time between marks
  public measure(name: string, startMark: string, endMark?: string): number {
    if (typeof window !== 'undefined' && window.performance) {
      try {
        if (endMark) {
          performance.measure(name, startMark, endMark);
        } else {
          performance.measure(name, startMark);
        }
        
        const measure = performance.getEntriesByName(name, 'measure')[0];
        const duration = measure?.duration || 0;
        
        if (!this.metrics.customTiming) {
          this.metrics.customTiming = {};
        }
        this.metrics.customTiming[name] = duration;
        
        this.reportMetric(name, duration);
        return duration;
      } catch (e) {
        console.warn('Performance measurement failed', e);
        return 0;
      }
    }
    return 0;
  }

  // Get all metrics
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Report metric to analytics
  private reportMetric(name: string, value: number): void {
    // In a real app, you would send this to your analytics service
    if (process.env.NODE_ENV === 'development') {
      console.log(`Performance metric - ${name}: ${value.toFixed(2)}ms`);
    }

    // Example: Send to Google Analytics 4
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'performance_metric', {
        metric_name: name,
        metric_value: value,
        custom_parameter_1: 'mile_quest_performance'
      });
    }

    // Example: Send to custom analytics endpoint
    if (typeof window !== 'undefined') {
      fetch('/api/analytics/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: name,
          value,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      }).catch(() => {
        // Silently fail for analytics
      });
    }
  }

  // Clean up observers
  public disconnect(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Performance budget checker
export const PERFORMANCE_BUDGETS = {
  LCP: 2500, // 2.5s
  FID: 100,  // 100ms
  CLS: 0.1,  // 0.1
  FCP: 1800, // 1.8s
  TTFB: 800, // 800ms
} as const;

export function checkPerformanceBudget(metrics: PerformanceMetrics): {
  passed: boolean;
  violations: Array<{ metric: string; value: number; budget: number; }>;
} {
  const violations: Array<{ metric: string; value: number; budget: number; }> = [];

  Object.entries(PERFORMANCE_BUDGETS).forEach(([metric, budget]) => {
    const value = metrics[metric as keyof PerformanceMetrics] as number;
    if (value && value > budget) {
      violations.push({ metric, value, budget });
    }
  });

  return {
    passed: violations.length === 0,
    violations
  };
}

// Hook for React components
export function usePerformanceMonitor() {
  const monitor = PerformanceMonitor.getInstance();

  return {
    mark: monitor.mark.bind(monitor),
    measure: monitor.measure.bind(monitor),
    getMetrics: monitor.getMetrics.bind(monitor),
    checkBudget: () => checkPerformanceBudget(monitor.getMetrics())
  };
}

// Higher-order component for route performance tracking
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  routeName: string
) {
  return function PerformanceTrackedComponent(props: P) {
    const monitor = PerformanceMonitor.getInstance();

    React.useEffect(() => {
      monitor.mark(`${routeName}_start`);
      
      return () => {
        monitor.mark(`${routeName}_end`);
        monitor.measure(`${routeName}_render`, `${routeName}_start`, `${routeName}_end`);
      };
    }, []);

    return React.createElement(Component, props);
  };
}

// Lazy loading with performance tracking
export function createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string
) {
  return React.lazy(async () => {
    const monitor = PerformanceMonitor.getInstance();
    monitor.mark(`${componentName}_lazy_start`);
    
    try {
      const component = await importFn();
      monitor.mark(`${componentName}_lazy_end`);
      monitor.measure(`${componentName}_lazy_load`, `${componentName}_lazy_start`, `${componentName}_lazy_end`);
      return component;
    } catch (error) {
      monitor.mark(`${componentName}_lazy_error`);
      throw error;
    }
  });
}

// Initialize global performance monitoring
if (typeof window !== 'undefined') {
  PerformanceMonitor.getInstance();
}