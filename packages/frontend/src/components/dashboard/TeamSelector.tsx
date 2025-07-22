/**
 * Team selector component for dashboard
 */

'use client';

import { MobileCard } from '@/components/mobile/MobileCard';

interface TeamSelectorProps {
  teams: Array<{
    id: string;
    name: string;
    memberCount: number;
    role: string;
    progress?: {
      currentDistance: number;
      targetDistance: number;
      percentComplete: number;
      goalName?: string;
      daysRemaining?: number | null;
    };
  }>;
  selectedTeamId: string | null;
  setSelectedTeamId: (teamId: string | null) => void;
}

export function TeamSelector({ teams, selectedTeamId, setSelectedTeamId }: TeamSelectorProps) {
  if (teams.length <= 1) {
    return null; // Don't show selector if only one team
  }

  return (
    <MobileCard>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Team</h3>
      <div className="grid gap-2">
        {teams.map((team) => (
          <button
            key={team.id}
            onClick={() => setSelectedTeamId(team.id)}
            className={`p-3 rounded-lg text-left transition-colors ${
              selectedTeamId === team.id
                ? 'bg-blue-100 border-2 border-blue-500'
                : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{team.name}</h4>
                <p className="text-sm text-gray-600">
                  {team.memberCount} members • {team.role}
                </p>
              </div>
              {team.progress && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {team.progress.percentComplete.toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-600">
                    {team.progress.goalName || 'Goal'}
                  </p>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </MobileCard>
  );
}