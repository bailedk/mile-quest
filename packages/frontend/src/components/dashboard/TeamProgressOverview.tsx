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
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Progress</h3>
      
      <div className="space-y-4">
        {teams.map((team) => {
          const progressBarColor = team.percentageComplete >= 75 ? 'bg-green-500' : 
                                 team.percentageComplete >= 50 ? 'bg-yellow-500' : 
                                 'bg-blue-500';
          
          return (
            <div key={team.teamId} className="space-y-2">
              <div className="flex justify-between items-baseline">
                <h4 className="text-sm font-medium text-gray-900">{team.teamName}</h4>
                <span className="text-sm text-gray-500">
                  {formatDistance(team.currentDistance, userPreferredUnits)} / {formatDistance(team.targetDistance, userPreferredUnits)}
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ease-out ${progressBarColor}`}
                  style={{ width: `${Math.min(team.percentageComplete, 100)}%` }}
                />
              </div>
              
              <p className="text-xs text-gray-500">
                {team.percentageComplete.toFixed(0)}% complete
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}