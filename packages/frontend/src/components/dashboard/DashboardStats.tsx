'use client';

import { formatDistance } from '@/services/activity.service';
import { AriaSection, AriaStatus } from '@/components/accessibility/AriaComponents';
import { useScreenReaderAnnouncements } from '@/components/accessibility/MobileAccessibility';
import { useVisualAccessibility } from '@/components/accessibility/VisualAccessibility';

interface DashboardStatsProps {
  totalDistance: number;
  weekDistance: number;
  bestDay: {
    date: string;
    distance: number;
  };
  userPreferredUnits?: 'miles' | 'kilometers';
}

export function DashboardStats({ 
  totalDistance, 
  weekDistance, 
  bestDay,
  userPreferredUnits = 'miles'
}: DashboardStatsProps) {
  const { announce } = useScreenReaderAnnouncements();
  const { highContrast } = useVisualAccessibility();
  
  const stats = [
    {
      id: 'total-distance',
      name: 'Total Distance',
      value: formatDistance(totalDistance, userPreferredUnits),
      label: `Total distance walked: ${formatDistance(totalDistance, userPreferredUnits)}`,
      description: 'Your all-time total walking distance'
    },
    {
      id: 'week-distance',
      name: 'This Week',
      value: formatDistance(weekDistance, userPreferredUnits),
      label: `Distance this week: ${formatDistance(weekDistance, userPreferredUnits)}`,
      description: 'Your walking distance for the current week'
    },
    {
      id: 'best-day',
      name: 'Best Day',
      value: formatDistance(bestDay.distance, userPreferredUnits),
      label: `Best day distance: ${formatDistance(bestDay.distance, userPreferredUnits)} on ${new Date(bestDay.date).toLocaleDateString()}`,
      description: `Your best single day: ${new Date(bestDay.date).toLocaleDateString()}`
    },
  ];

  return (
    <AriaSection labelledBy="dashboard-stats-heading">
      <h3 id="dashboard-stats-heading" className="sr-only">Your Walking Statistics</h3>
      
      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div 
            key={stat.id} 
            className={`bg-white p-4 rounded-lg shadow ${
              highContrast ? 'border-2 border-gray-900' : ''
            }`}
          >
            <AriaStatus 
              message={stat.label}
              priority="polite"
              className="sr-only"
            />
            
            <dt 
              className={`text-sm font-medium ${
                highContrast ? 'text-gray-900' : 'text-gray-500'
              }`}
              aria-label={stat.name}
            >
              {stat.name}
            </dt>
            
            <dd className="mt-1">
              <span 
                className={`text-2xl font-semibold ${
                  highContrast ? 'text-gray-900' : 'text-gray-900'
                }`}
                aria-hidden="true"
              >
                {stat.value}
              </span>
              
              <span 
                className={`block text-xs mt-1 ${
                  highContrast ? 'text-gray-800' : 'text-gray-500'
                }`}
                aria-hidden="true"
              >
                {stat.description}
              </span>
            </dd>
          </div>
        ))}
      </div>
    </AriaSection>
  );
}