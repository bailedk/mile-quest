/**
 * Offline team management component with data persistence and sync
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  UsersIcon,
  CloudArrowDownIcon,
  WifiIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { offlineDB, OfflineTeam } from '@/services/offline/db';
import { useTeams } from '@/hooks/useTeams';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useNetworkAwareSync } from '@/hooks/useNetworkAwareSync';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface OfflineTeamManagerProps {
  className?: string;
}

export default function OfflineTeamManager({ className = '' }: OfflineTeamManagerProps) {
  const { teams: onlineTeams, loading: onlineLoading } = useTeams();
  const { isOnline } = useOnlineStatus();
  const { canDownloadLargeFiles, shouldReduceDataUsage } = useNetworkAwareSync();
  const [offlineTeams, setOfflineTeams] = useState<OfflineTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingTeams, setSyncingTeams] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Load offline teams on mount
  useEffect(() => {
    loadOfflineTeams();
  }, []);

  // Sync online teams to offline storage when available
  useEffect(() => {
    if (isOnline && onlineTeams.length > 0 && !onlineLoading) {
      syncTeamsToOffline();
    }
  }, [isOnline, onlineTeams, onlineLoading]);

  const loadOfflineTeams = async () => {
    try {
      setLoading(true);
      const teams = await offlineDB.getTeams();
      setOfflineTeams(teams);
      setError(null);
    } catch (error) {
      console.error('[OfflineTeamManager] Failed to load offline teams:', error);
      setError('Failed to load offline teams');
    } finally {
      setLoading(false);
    }
  };

  const syncTeamsToOffline = async () => {
    try {
      for (const team of onlineTeams) {
        const offlineTeam: OfflineTeam = {
          id: team.id,
          name: team.name,
          description: team.description,
          members: team.members?.map(member => ({
            id: member.user.id,
            name: member.user.name,
            avatarUrl: shouldReduceDataUsage ? undefined : member.user.avatarUrl,
            role: member.role,
            isOnline: false,
          })) || [],
          goal: team.goal,
          lastSynced: Date.now(),
          isStale: false,
        };

        await offlineDB.saveTeam(offlineTeam);
      }

      await loadOfflineTeams();
    } catch (error) {
      console.error('[OfflineTeamManager] Failed to sync teams:', error);
    }
  };

  const syncTeam = async (teamId: string) => {
    if (!isOnline) return;

    setSyncingTeams(prev => new Set(prev).add(teamId));

    try {
      // In a real implementation, this would fetch fresh data from the API
      const team = onlineTeams.find(t => t.id === teamId);
      if (team) {
        const offlineTeam: OfflineTeam = {
          id: team.id,
          name: team.name,
          description: team.description,
          members: team.members?.map(member => ({
            id: member.user.id,
            name: member.user.name,
            avatarUrl: canDownloadLargeFiles ? member.user.avatarUrl : undefined,
            role: member.role,
            isOnline: false,
          })) || [],
          goal: team.goal,
          lastSynced: Date.now(),
          isStale: false,
        };

        await offlineDB.saveTeam(offlineTeam);
        await loadOfflineTeams();
      }
    } catch (error) {
      console.error(`[OfflineTeamManager] Failed to sync team ${teamId}:`, error);
    } finally {
      setSyncingTeams(prev => {
        const next = new Set(prev);
        next.delete(teamId);
        return next;
      });
    }
  };

  const getTeamFreshness = (team: OfflineTeam) => {
    const age = Date.now() - team.lastSynced;
    const hourInMs = 60 * 60 * 1000;
    
    if (age < hourInMs) return 'fresh';
    if (age < 24 * hourInMs) return 'recent';
    return 'stale';
  };

  const formatLastSynced = (timestamp: number) => {
    const age = Date.now() - timestamp;
    const minutes = Math.floor(age / 60000);
    const hours = Math.floor(age / 3600000);
    const days = Math.floor(age / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (loading && offlineTeams.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error && offlineTeams.length === 0) {
    return (
      <div className={`bg-red-50 dark:bg-red-900/20 rounded-lg p-6 ${className}`}>
        <ExclamationCircleIcon className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-center text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  const displayTeams = isOnline && onlineTeams.length > 0 ? onlineTeams : offlineTeams;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Offline indicator */}
      {!isOnline && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 flex items-center gap-3">
          <WifiIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Viewing Offline Data
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              Team information may not be up to date
            </p>
          </div>
        </div>
      )}

      {/* Teams list */}
      <div className="space-y-3">
        {displayTeams.map((team) => {
          const offlineTeam = offlineTeams.find(t => t.id === team.id);
          const freshness = offlineTeam ? getTeamFreshness(offlineTeam) : 'fresh';
          const isSyncing = syncingTeams.has(team.id);

          return (
            <div
              key={team.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <UsersIcon className="h-5 w-5 text-gray-400" />
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {team.name}
                    </h3>
                    {freshness === 'stale' && (
                      <span className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded">
                        Outdated
                      </span>
                    )}
                  </div>
                  
                  {team.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {team.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>{team.members?.length || offlineTeam?.members.length || 0} members</span>
                    {offlineTeam && (
                      <span>Synced {formatLastSynced(offlineTeam.lastSynced)}</span>
                    )}
                  </div>
                </div>

                {isOnline && (
                  <button
                    onClick={() => syncTeam(team.id)}
                    disabled={isSyncing}
                    className={`ml-4 p-2 rounded-lg transition-colors ${
                      isSyncing
                        ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    title="Sync team data"
                  >
                    {isSyncing ? (
                      <CloudArrowDownIcon className="h-5 w-5 text-blue-500 animate-pulse" />
                    ) : freshness === 'fresh' ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <CloudArrowDownIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                )}
              </div>

              {/* Offline team members preview */}
              {!isOnline && offlineTeam && offlineTeam.members.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Team Members</p>
                  <div className="flex -space-x-2">
                    {offlineTeam.members.slice(0, 5).map((member) => (
                      <div
                        key={member.id}
                        className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center"
                        title={member.name}
                      >
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    ))}
                    {offlineTeam.members.length > 5 && (
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          +{offlineTeam.members.length - 5}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {displayTeams.length === 0 && (
        <div className="text-center py-8">
          <UsersIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            {isOnline ? 'No teams found' : 'No offline teams available'}
          </p>
        </div>
      )}
    </div>
  );
}