'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatDistance } from '@/services/activity.service';

interface Contributor {
  userId: string;
  name: string;
  avatarUrl?: string;
  distance: number;
  percentage: number;
}

interface TeamContributionChartProps {
  contributors: Contributor[];
  totalDistance: number;
  userPreferredUnits?: 'miles' | 'kilometers';
  compact?: boolean;
  showAvatars?: boolean;
  chartType?: 'bar' | 'pie' | 'list';
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export function TeamContributionChart({
  contributors,
  totalDistance,
  userPreferredUnits = 'miles',
  compact = false,
  showAvatars = true,
  chartType = 'bar',
}: TeamContributionChartProps) {
  // Sort contributors by distance
  const sortedContributors = [...contributors].sort((a, b) => b.distance - a.distance);
  const topContributors = compact ? sortedContributors.slice(0, 5) : sortedContributors;

  // Prepare data for charts
  const chartData = topContributors.map((contributor, index) => ({
    ...contributor,
    name: contributor.name.split(' ')[0], // First name only for compact display
    displayDistance: formatDistance(contributor.distance, userPreferredUnits),
    color: COLORS[index % COLORS.length],
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-medium text-gray-900">{data.name}</p>
          <p className="text-sm text-gray-600">
            {formatDistance(data.distance, userPreferredUnits)} ({data.percentage.toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  // Bar chart view
  if (chartType === 'bar') {
    return (
      <div className={compact ? 'h-48' : 'h-64'}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              interval={0}
              angle={compact ? -45 : 0}
              textAnchor={compact ? 'end' : 'middle'}
              height={compact ? 50 : 30}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={(value) => `${value.toFixed(0)}${userPreferredUnits === 'miles' ? 'mi' : 'km'}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="distance" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Pie chart view
  if (chartType === 'pie') {
    return (
      <div className={compact ? 'h-48' : 'h-64'}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ percentage }) => `${percentage.toFixed(0)}%`}
              outerRadius={compact ? 60 : 80}
              fill="#8884d8"
              dataKey="distance"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {!compact && (
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {chartData.map((contributor, index) => (
              <div key={contributor.userId} className="flex items-center gap-1">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: contributor.color }}
                />
                <span className="text-xs text-gray-600">{contributor.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // List view (default)
  return (
    <div className="space-y-3">
      {topContributors.map((contributor, index) => (
        <div key={contributor.userId} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showAvatars && (
              <div className="relative">
                {contributor.avatarUrl ? (
                  <img
                    src={contributor.avatarUrl}
                    alt={contributor.name}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">
                      {contributor.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                {index === 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                    <span className="text-xs">👑</span>
                  </div>
                )}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">{contributor.name}</p>
              <p className="text-xs text-gray-500">
                {formatDistance(contributor.distance, userPreferredUnits)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {contributor.percentage.toFixed(1)}%
            </div>
            <div className="w-20 bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${contributor.percentage}%`,
                  backgroundColor: COLORS[index % COLORS.length],
                }}
              />
            </div>
          </div>
        </div>
      ))}
      
      {contributors.length > topContributors.length && (
        <p className="text-xs text-gray-500 text-center">
          +{contributors.length - topContributors.length} more contributors
        </p>
      )}
    </div>
  );
}