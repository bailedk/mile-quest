/**
 * Charts section component for dashboard
 */

'use client';

import { TouchButton } from '@/components/mobile/TouchInteractions';
import { MobileCard } from '@/components/mobile/MobileCard';
import { GoalProgressChart, ActivityBarChart, ProgressLineChart } from '@/components/charts';

interface ChartsSectionProps {
  chartView: 'daily' | 'weekly';
  setChartView: (view: 'daily' | 'weekly') => void;
  selectedTeam: any;
  userPreferredUnits: 'miles' | 'kilometers';
  viewport: { isMobile: boolean };
  chartData: {
    dailyProgress: any[];
    weeklyProgress: any[];
    activityBreakdown: any[];
  };
}

export function ChartsSection({
  chartView,
  setChartView,
  selectedTeam,
  userPreferredUnits,
  viewport,
  chartData,
}: ChartsSectionProps) {
  return (
    <div className="space-y-6">
      {/* Goal Progress Chart */}
      {selectedTeam?.progress && (
        <MobileCard>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Goal Progress</h3>
          <GoalProgressChart
            currentDistance={selectedTeam.progress.currentDistance}
            targetDistance={selectedTeam.progress.targetDistance}
            userPreferredUnits={userPreferredUnits}
            height={viewport.isMobile ? 180 : 200} 
            className="w-full"
          />
        </MobileCard>
      )}

      {/* Activity Breakdown Chart */}
      <MobileCard>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Breakdown</h3>
        <ActivityBarChart
          data={chartData.activityBreakdown}
          userPreferredUnits={userPreferredUnits}
          height={viewport.isMobile ? 200 : 220}
          className="w-full"
        />
      </MobileCard>

      {/* Progress Charts with Toggle */}
      <MobileCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Progress Over Time</h3>
          
          {/* Chart View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <TouchButton
              onClick={() => setChartView('daily')}
              variant={chartView === 'daily' ? 'primary' : 'secondary'}
              size="sm"
              className="flex-1"
              hapticFeedback={true}
            >
              Daily
            </TouchButton>
            <TouchButton
              onClick={() => setChartView('weekly')}
              variant={chartView === 'weekly' ? 'primary' : 'secondary'}
              size="sm"
              className="flex-1"
              hapticFeedback={true}
            >
              Weekly
            </TouchButton>
          </div>
        </div>

        {chartView === 'daily' ? (
          <ProgressLineChart
            data={chartData.dailyProgress}
            userPreferredUnits={userPreferredUnits}
            showCumulative={false}
            height={viewport.isMobile ? 200 : 220}
            className="w-full"
          />
        ) : (
          <ProgressLineChart
            data={chartData.weeklyProgress}
            userPreferredUnits={userPreferredUnits}
            showCumulative={true}
            height={viewport.isMobile ? 200 : 220}
            className="w-full"
          />
        )}
      </MobileCard>
    </div>
  );
}