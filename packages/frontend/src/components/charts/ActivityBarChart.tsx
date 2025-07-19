'use client';

// @ts-nocheck

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDistance } from '@/services/activity.service';
import { ActivityBreakdownData } from '@/utils/chartMockData';

interface ActivityBarChartProps {
  data: ActivityBreakdownData[];
  userPreferredUnits?: 'miles' | 'kilometers';
  height?: number;
  className?: string;
  showActivityCount?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
  }>;
  label?: string;
  userPreferredUnits: 'miles' | 'kilometers';
}

function CustomTooltip({ active, payload, label, userPreferredUnits }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const distanceEntry = payload.find(p => p.dataKey === 'distance');
    const activitiesEntry = payload.find(p => p.dataKey === 'activities');
    
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-900 mb-1">{label}</p>
        {distanceEntry && (
          <p className="text-sm" style={{ color: distanceEntry.color }}>
            Distance: {formatDistance(distanceEntry.value, userPreferredUnits)}
          </p>
        )}
        {activitiesEntry && (
          <p className="text-sm" style={{ color: activitiesEntry.color }}>
            Activities: {activitiesEntry.value}
          </p>
        )}
      </div>
    );
  }
  return null;
}

export function ActivityBarChart({ 
  data, 
  userPreferredUnits = 'miles',
  height = 250,
  className = '',
  showActivityCount = false
}: ActivityBarChartProps) {
  // Loading state
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="animate-pulse bg-gray-200 rounded h-4 w-24 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading activity data...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (data.every(d => d.distance === 0 && d.activities === 0)) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-gray-500 font-medium">No recent activities</p>
          <p className="text-sm text-gray-400">Log some walks to see your weekly breakdown!</p>
        </div>
      </div>
    );
  }

  // Calculate max values for scaling
  const maxActivities = Math.max(...data.map(d => d.activities));

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 5,
            right: 5,
            left: 5,
            bottom: 5,
          }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="day" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis 
            yAxisId="distance"
            orientation="left"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={(value: number) => {
              // Convert to display units and show short form
              const converted = userPreferredUnits === 'miles' 
                ? (value * 0.000621371).toFixed(1)
                : (value / 1000).toFixed(1);
              return `${converted}${userPreferredUnits === 'miles' ? 'mi' : 'km'}`;
            }}
          />
          {showActivityCount && (
            <YAxis 
              yAxisId="activities"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              domain={[0, Math.max(5, maxActivities)]}
            />
          )}
          <Tooltip 
            content={<CustomTooltip userPreferredUnits={userPreferredUnits} />}
            cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
          />
          
          {/* Distance bars */}
          <Bar 
            yAxisId="distance"
            dataKey="distance" 
            fill="#3b82f6"
            radius={[2, 2, 0, 0]}
            name="Distance"
          />
          
          {/* Activity count bars (optional) */}
          {showActivityCount && (
            <Bar 
              yAxisId="activities"
              dataKey="activities" 
              fill="#10b981"
              radius={[2, 2, 0, 0]}
              name="Activities"
            />
          )}
        </BarChart>
      </ResponsiveContainer>
      
      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-lg font-semibold text-gray-900">
            {formatDistance(data.reduce((sum, d) => sum + d.distance, 0), userPreferredUnits)}
          </div>
          <div className="text-xs text-gray-500">Total Distance</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">
            {data.reduce((sum, d) => sum + d.activities, 0)}
          </div>
          <div className="text-xs text-gray-500">Total Activities</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">
            {data.filter(d => d.distance > 0).length}/7
          </div>
          <div className="text-xs text-gray-500">Active Days</div>
        </div>
      </div>
    </div>
  );
}