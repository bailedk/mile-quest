'use client';

// @ts-nocheck

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatDistance } from '@/services/activity.service';

interface GoalProgressChartProps {
  currentDistance: number;
  targetDistance: number;
  userPreferredUnits?: 'miles' | 'kilometers';
  height?: number;
  className?: string;
  showLegend?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
  }>;
  userPreferredUnits: 'miles' | 'kilometers';
}

function CustomTooltip({ active, payload, userPreferredUnits }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-900 mb-1">{data.name}</p>
        <p className="text-sm" style={{ color: data.color }}>
          {formatDistance(data.value, userPreferredUnits)}
        </p>
      </div>
    );
  }
  return null;
}

export function GoalProgressChart({ 
  currentDistance, 
  targetDistance,
  userPreferredUnits = 'miles',
  height = 200,
  className = '',
  showLegend = true
}: GoalProgressChartProps) {
  // Calculate remaining distance
  const remainingDistance = Math.max(0, targetDistance - currentDistance);
  const progressPercentage = Math.min(100, (currentDistance / targetDistance) * 100);
  
  // Prepare data for the pie chart
  const data = [
    {
      name: 'Completed',
      value: currentDistance,
      color: '#10b981'
    },
    {
      name: 'Remaining',
      value: remainingDistance,
      color: '#e5e7eb'
    }
  ];

  // Loading state
  if (targetDistance === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="animate-pulse bg-gray-200 rounded-full h-16 w-16 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading goal data...</p>
        </div>
      </div>
    );
  }

  // Goal achieved state
  if (currentDistance >= targetDistance) {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-lg font-semibold text-green-600 mb-1">Goal Achieved!</p>
          <p className="text-sm text-gray-600">
            {formatDistance(currentDistance, userPreferredUnits)} of {formatDistance(targetDistance, userPreferredUnits)}
          </p>
          <div className="mt-4 w-full bg-green-100 rounded-full h-3">
            <div className="bg-green-500 h-3 rounded-full w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Progress summary */}
      <div className="text-center mb-4">
        <div className="text-2xl font-bold text-gray-900">
          {progressPercentage.toFixed(0)}%
        </div>
        <div className="text-sm text-gray-600">
          {formatDistance(currentDistance, userPreferredUnits)} of {formatDistance(targetDistance, userPreferredUnits)}
        </div>
      </div>

      {/* Pie chart */}
      <div style={{ height: height - 80 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              startAngle={90}
              endAngle={450}
              innerRadius={40}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              content={<CustomTooltip userPreferredUnits={userPreferredUnits} />}
            />
            {showLegend && (
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
                formatter={(value: any, entry: any) => (
                  <span style={{ color: entry.color, fontSize: '12px' }}>
                    {value}
                  </span>
                )}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Progress bar alternative for small screens */}
      <div className="mt-4 md:hidden">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-green-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{formatDistance(currentDistance, userPreferredUnits)}</span>
          <span>{formatDistance(targetDistance, userPreferredUnits)}</span>
        </div>
      </div>
    </div>
  );
}