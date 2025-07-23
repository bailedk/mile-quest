'use client';

import { useEffect, useState } from 'react';
import { formatDistance } from '@/services/activity.service';
import { useRealtimeTeamProgress } from '@/hooks/useRealtimeTeamProgress';
import { ConnectionStatus } from '@/components/ConnectionStatus';

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
  enableRealtime?: boolean;
  showConnectionStatus?: boolean;
}

export function TeamProgressOverview({ 
  teams, 
  userPreferredUnits = 'miles',
  enableRealtime = true,
  showConnectionStatus = false
}: TeamProgressOverviewProps) {
  const [realtimeUpdates, setRealtimeUpdates] = useState<Map<string, TeamProgress>>(new Map());
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);

  // Get the primary team for real-time updates (first team or active team)
  const primaryTeamId = teams.length > 0 ? teams[0].teamId : null;

  // Initialize time after hydration
  useEffect(() => {
    setLastUpdateTime(Date.now());
  }, []);

  const { connectionState, isConnected } = useRealtimeTeamProgress(primaryTeamId, {
    onProgressUpdate: (data) => {
      // Update the specific team's progress
      setRealtimeUpdates(prev => {
        const updated = new Map(prev);
        const existingTeam = teams.find(t => t.teamId === data.teamGoalId);
        if (existingTeam) {
          updated.set(data.teamGoalId, {
            ...existingTeam,
            currentDistance: data.totalDistance,
            percentageComplete: data.percentComplete,
          });
        }
        return updated;
      });
      setLastUpdateTime(Date.now());
    },
    onActivityAdded: (data) => {
      // Trigger a visual update indicator
      setLastUpdateTime(Date.now());
    },
  });

  // Merge realtime updates with initial data
  const updatedTeams = teams.map(team => {
    const realtimeUpdate = realtimeUpdates.get(team.teamId);
    return realtimeUpdate || team;
  });

  if (teams.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Team Progress</h3>
        
        {enableRealtime && (showConnectionStatus || !isConnected) && (
          <div className="flex items-center space-x-2">
            {isConnected && (
              <span className="text-xs text-green-600 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                Live
              </span>
            )}
            <ConnectionStatus 
              connectionState={connectionState}
              size="sm"
              showText={!isConnected}
            />
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        {updatedTeams.map((team) => {
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