/**
 * Performance Dashboard - Demonstrates all performance optimizations
 */

import React, { memo, useMemo, useCallback, useState } from 'react';
import { usePerformanceContext } from './PerformanceProvider';
import { usePerformanceMonitor, useMemoryMonitor, useRenderTracker } from '@/hooks/usePerformance';
import { VirtualActivityList, VirtualTeamList } from './VirtualList';
import LazyImage from './LazyImage';
import { useOptimizedQuery, queryKeys } from '@/utils/optimizedFetching';
import { PERFORMANCE_BUDGETS } from '@/utils/performance';

// Mock data for demonstration
const generateMockActivities = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `activity-${i}`,
    type: 'walk',
    distance: Math.random() * 10,
    date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    user: {
      name: `User ${i + 1}`,
      avatar: Math.random() > 0.5 ? `https://picsum.photos/40/40?random=${i}` : undefined,
    },
  }));

const generateMockTeamMembers = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `member-${i}`,
    name: `Team Member ${i + 1}`,
    email: `member${i + 1}@example.com`,
    avatar: Math.random() > 0.5 ? `https://picsum.photos/48/48?random=${i + 100}` : undefined,
    totalDistance: Math.random() * 100,
    weeklyDistance: Math.random() * 20,
    isOnline: Math.random() > 0.5,
  }));

// Memoized metric card component
const MetricCard = memo<{
  title: string;
  value: number | string;
  unit?: string;
  status: 'good' | 'warning' | 'error';
  budget?: number;
}>(({ title, value, unit, status, budget }) => {
  const statusColors = {
    good: 'text-green-600 bg-green-50 border-green-200',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    error: 'text-red-600 bg-red-50 border-red-200',
  };

  return (
    <div className={`p-4 border rounded-lg ${statusColors[status]}`}>
      <h3 className="font-medium text-sm">{title}</h3>
      <div className="mt-1">
        <span className="text-2xl font-bold">
          {typeof value === 'number' ? value.toFixed(1) : value}
        </span>
        {unit && <span className="text-sm ml-1">{unit}</span>}
      </div>
      {budget && (
        <div className="text-xs mt-1">
          Budget: {budget}{unit}
        </div>
      )}
    </div>
  );
});

MetricCard.displayName = 'MetricCard';

// Optimized performance stats component
const PerformanceStats = memo(() => {
  const { metrics, budgetStatus } = usePerformanceContext();
  const memoryInfo = useMemoryMonitor();
  const perfMonitor = usePerformanceMonitor();

  const coreVitals = useMemo(() => {
    const getStatus = (value: number, budget: number) => {
      if (value <= budget * 0.8) return 'good';
      if (value <= budget) return 'warning';
      return 'error';
    };

    return [
      {
        title: 'Largest Contentful Paint',
        value: metrics.LCP || 0,
        unit: 'ms',
        budget: PERFORMANCE_BUDGETS.LCP,
        status: metrics.LCP ? getStatus(metrics.LCP, PERFORMANCE_BUDGETS.LCP) : 'good',
      },
      {
        title: 'First Input Delay',
        value: metrics.FID || 0,
        unit: 'ms',
        budget: PERFORMANCE_BUDGETS.FID,
        status: metrics.FID ? getStatus(metrics.FID, PERFORMANCE_BUDGETS.FID) : 'good',
      },
      {
        title: 'Cumulative Layout Shift',
        value: metrics.CLS || 0,
        unit: '',
        budget: PERFORMANCE_BUDGETS.CLS,
        status: metrics.CLS ? getStatus(metrics.CLS, PERFORMANCE_BUDGETS.CLS) : 'good',
      },
      {
        title: 'First Contentful Paint',
        value: metrics.FCP || 0,
        unit: 'ms',
        budget: PERFORMANCE_BUDGETS.FCP,
        status: metrics.FCP ? getStatus(metrics.FCP, PERFORMANCE_BUDGETS.FCP) : 'good',
      },
    ] as const;
  }, [metrics]);

  const memoryStats = useMemo(() => {
    if (!memoryInfo.usedJSHeapSize) return [];

    return [
      {
        title: 'Used JS Heap',
        value: (memoryInfo.usedJSHeapSize / 1024 / 1024) || 0,
        unit: 'MB',
        status: (memoryInfo.usedJSHeapSize / 1024 / 1024) < 50 ? 'good' : 'warning',
      },
      {
        title: 'Total JS Heap',
        value: (memoryInfo.totalJSHeapSize / 1024 / 1024) || 0,
        unit: 'MB',
        status: (memoryInfo.totalJSHeapSize / 1024 / 1024) < 100 ? 'good' : 'warning',
      },
    ] as const;
  }, [memoryInfo]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Core Web Vitals</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {coreVitals.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>
      </div>

      {memoryStats.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Memory Usage</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {memoryStats.map((metric) => (
              <MetricCard key={metric.title} {...metric} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Performance Budget</h2>
        <div className={`p-4 border rounded-lg ${
          budgetStatus.passed 
            ? 'text-green-600 bg-green-50 border-green-200'
            : 'text-red-600 bg-red-50 border-red-200'
        }`}>
          <div className="font-medium">
            {budgetStatus.passed ? '✅ All budgets passed' : '❌ Budget violations detected'}
          </div>
          {budgetStatus.violations.length > 0 && (
            <div className="mt-2 text-sm">
              <div className="font-medium mb-1">Violations:</div>
              <ul className="space-y-1">
                {budgetStatus.violations.map(({ metric, value, budget }) => (
                  <li key={metric}>
                    {metric}: {value.toFixed(1)}ms exceeds {budget}ms budget
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

PerformanceStats.displayName = 'PerformanceStats';

// Virtual list demonstration
const VirtualListDemo = memo(() => {
  useRenderTracker('VirtualListDemo');
  
  const [activeTab, setActiveTab] = useState<'activities' | 'members'>('activities');
  const [listSize, setListSize] = useState(1000);

  const mockActivities = useMemo(
    () => generateMockActivities(listSize),
    [listSize]
  );

  const mockMembers = useMemo(
    () => generateMockTeamMembers(listSize),
    [listSize]
  );

  const handleActivityClick = useCallback((activity: any) => {
    console.log('Activity clicked:', activity.id);
  }, []);

  const handleMemberClick = useCallback((member: any) => {
    console.log('Member clicked:', member.id);
  }, []);

  const tabButtons = useMemo(() => [
    { id: 'activities', label: 'Activities', count: mockActivities.length },
    { id: 'members', label: 'Team Members', count: mockMembers.length },
  ], [mockActivities.length, mockMembers.length]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Virtual List Performance Demo</h2>
        <div className="flex items-center space-x-2">
          <label className="text-sm">List Size:</label>
          <select
            value={listSize}
            onChange={(e) => setListSize(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value={100}>100 items</option>
            <option value={1000}>1,000 items</option>
            <option value={10000}>10,000 items</option>
            <option value={50000}>50,000 items</option>
          </select>
        </div>
      </div>

      <div className="flex space-x-1 border-b border-gray-200">
        {tabButtons.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label} ({tab.count.toLocaleString()})
          </button>
        ))}
      </div>

      <div className="border border-gray-200 rounded-lg">
        {activeTab === 'activities' && (
          <VirtualActivityList
            activities={mockActivities}
            onActivityClick={handleActivityClick}
            className="rounded-lg"
          />
        )}
        {activeTab === 'members' && (
          <VirtualTeamList
            members={mockMembers}
            onMemberClick={handleMemberClick}
            className="rounded-lg"
          />
        )}
      </div>

      <div className="text-sm text-gray-600">
        💡 This virtual list efficiently renders {listSize.toLocaleString()} items with minimal DOM nodes.
        Only visible items are rendered, providing smooth scrolling performance.
      </div>
    </div>
  );
});

VirtualListDemo.displayName = 'VirtualListDemo';

// Lazy image demonstration
const LazyImageDemo = memo(() => {
  useRenderTracker('LazyImageDemo');

  const images = useMemo(() => 
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      src: `https://picsum.photos/300/200?random=${i}`,
      alt: `Demo image ${i + 1}`,
    }))
  , []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Lazy Image Loading Demo</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map((image) => (
          <div key={image.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <LazyImage
              src={image.src}
              alt={image.alt}
              className="w-full h-40"
              onLoad={() => console.log(`Image ${image.id} loaded`)}
              onError={() => console.log(`Image ${image.id} failed to load`)}
            />
            <div className="p-2 text-sm text-gray-600">
              Image {image.id + 1}
            </div>
          </div>
        ))}
      </div>

      <div className="text-sm text-gray-600">
        💡 Images are loaded only when they enter the viewport, reducing initial page load time
        and improving performance on slower connections.
      </div>
    </div>
  );
});

LazyImageDemo.displayName = 'LazyImageDemo';

// Data fetching demonstration
const DataFetchingDemo = memo(() => {
  useRenderTracker('DataFetchingDemo');

  // Simulated optimized query
  const { data: userData, isLoading: userLoading, error: userError } = useOptimizedQuery(
    ['demo', 'user'],
    async () => {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
      return {
        id: '1',
        name: 'Demo User',
        email: 'demo@example.com',
        stats: {
          totalDistance: 127.5,
          weeklyDistance: 23.2,
          totalActivities: 45,
        },
      };
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      batch: true,
    }
  );

  if (userLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Optimized Data Fetching Demo</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Optimized Data Fetching Demo</h2>
        <div className="text-red-600">Error loading data</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Optimized Data Fetching Demo</h2>
      
      <div className="border border-gray-200 rounded-lg p-4">
        <h3 className="font-medium text-lg">{userData?.name}</h3>
        <p className="text-gray-600">{userData?.email}</p>
        
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {userData?.stats.totalDistance}
            </div>
            <div className="text-sm text-gray-600">Total Miles</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {userData?.stats.weeklyDistance}
            </div>
            <div className="text-sm text-gray-600">This Week</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {userData?.stats.totalActivities}
            </div>
            <div className="text-sm text-gray-600">Activities</div>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        💡 This data is fetched with automatic retry logic, request batching, 
        and intelligent caching. The query is reused across components without refetching.
      </div>
    </div>
  );
});

DataFetchingDemo.displayName = 'DataFetchingDemo';

// Main performance dashboard component
export default memo(function PerformanceDashboard() {
  useRenderTracker('PerformanceDashboard');

  const [activeSection, setActiveSection] = useState<'stats' | 'virtual' | 'images' | 'data'>('stats');

  const sections = useMemo(() => [
    { id: 'stats', label: 'Performance Stats', icon: '📊' },
    { id: 'virtual', label: 'Virtual Lists', icon: '📋' },
    { id: 'images', label: 'Lazy Images', icon: '🖼️' },
    { id: 'data', label: 'Data Fetching', icon: '🔄' },
  ], []);

  const renderContent = useCallback(() => {
    switch (activeSection) {
      case 'stats':
        return <PerformanceStats />;
      case 'virtual':
        return <VirtualListDemo />;
      case 'images':
        return <LazyImageDemo />;
      case 'data':
        return <DataFetchingDemo />;
      default:
        return <PerformanceStats />;
    }
  }, [activeSection]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Performance Optimization Dashboard
        </h1>
        <p className="text-gray-600">
          Demonstrating comprehensive performance optimizations implemented in Mile Quest
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id as any)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-2 ${
              activeSection === section.id
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>{section.icon}</span>
            <span>{section.label}</span>
          </button>
        ))}
      </div>

      <div className="min-h-[600px]">
        {renderContent()}
      </div>
    </div>
  );
});

PerformanceDashboard.displayName = 'PerformanceDashboard';