'use client';

// @ts-nocheck

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDistance } from '@/services/activity.service';
import { DailyProgressData } from '@/utils/chartMockData';

interface ProgressLineChartProps {
  data: DailyProgressData[];
  userPreferredUnits?: 'miles' | 'kilometers';
  showCumulative?: boolean;
  height?: number;
  className?: string;
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
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-900 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.dataKey === 'distance' ? 'Daily: ' : 'Total: '}
            {formatDistance(entry.value, userPreferredUnits)}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function ProgressLineChart({ 
  data, 
  userPreferredUnits = 'miles',
  showCumulative = false,
  height = 250,
  className = ''
}: ProgressLineChartProps) {
  // Loading state
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="animate-pulse bg-gray-200 rounded h-4 w-24 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading chart data...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (data.every(d => d.distance === 0 && d.cumulative === 0)) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-gray-500 font-medium">No activity data yet</p>
          <p className="text-sm text-gray-400">Start logging walks to see your progress!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 5,
            left: 5,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            interval="preserveStartEnd"
          />
          <YAxis 
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
          <Tooltip 
            content={<CustomTooltip userPreferredUnits={userPreferredUnits} />}
            cursor={{ stroke: '#e5e7eb', strokeDasharray: '3 3' }}
          />
          
          {/* Daily distance line */}
          <Line 
            type="monotone" 
            dataKey="distance" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, fill: '#2563eb' }}
            connectNulls={false}
          />
          
          {/* Cumulative distance line (optional) */}
          {showCumulative && (
            <Line 
              type="monotone" 
              dataKey="cumulative" 
              stroke="#10b981" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#10b981', strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, fill: '#059669' }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}