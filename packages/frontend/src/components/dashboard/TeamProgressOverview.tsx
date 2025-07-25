'use client';

import { formatDistance } from '@/services/activity.service';

interface TeamProgress {
  teamId: string;
  teamName: string;
  currentDistance: number;
  targetDistance: number;
  percentageComplete: number;
}

interface TeamProgressOverviewProps {
  teams: TeamProgress[];
  userPreferredUnits?: 'miles' | 'kilometers';
}

export function TeamProgressOverview({ 
  teams, 
  userPreferredUnits = 'miles'
}: TeamProgressOverviewProps) {
  
  if (teams.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Team Progress</h3>
      </div>
      
      <div className="space-y-4">
        {teams.map((team) => (
          <div key={team.teamId} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {team.teamName}
              </span>
              <span className="text-sm text-gray-500">
                {formatDistance(team.currentDistance, userPreferredUnits)} / {formatDistance(team.targetDistance, userPreferredUnits)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(team.percentageComplete, 100)}%` }}
              />
            </div>
            <div className="text-right">
              <span className="text-sm text-gray-600">
                {team.percentageComplete.toFixed(1)}% complete
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}