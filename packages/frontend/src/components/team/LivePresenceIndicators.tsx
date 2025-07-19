'use client';

import React, { useMemo } from 'react';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { formatDistanceToNow } from 'date-fns';

interface TeamMemberPresence {
  userId: string;
  userName: string;
  isOnline: boolean;
  lastSeen: Date;
  currentActivity?: string;
  location?: string;
}

interface LivePresenceIndicatorsProps {
  teamId: string;
  maxVisible?: number;
  showDetails?: boolean;
  className?: string;
}

export function LivePresenceIndicators({
  teamId,
  maxVisible = 5,
  showDetails = true,
  className = ''
}: LivePresenceIndicatorsProps) {
  const { teamPresence, isPresenceLoading } = useWebSocketContext();

  const presenceData = useMemo(() => {
    if (!teamPresence || teamPresence.teamId !== teamId) {
      return { online: [], offline: [], total: 0 };
    }

    const members = teamPresence.members || [];
    const online = members.filter(m => m.isOnline);
    const offline = members.filter(m => !m.isOnline);

    return {
      online: online.slice(0, maxVisible),
      offline: offline.slice(0, Math.max(0, maxVisible - online.length)),
      total: members.length,
      hiddenCount: Math.max(0, members.length - maxVisible)
    };
  }, [teamPresence, teamId, maxVisible]);

  if (isPresenceLoading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="flex -space-x-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-8 h-8 bg-gray-200 rounded-full border-2 border-white animate-pulse"
            />
          ))}
        </div>
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  if (!teamPresence || presenceData.total === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        No team members online
      </div>
    );
  }

  return (
    <div className={`flex flex-col space-y-2 ${className}`}>
      {/* Compact view - avatars with indicators */}
      <div className="flex items-center space-x-3">
        <div className="flex -space-x-1">
          {presenceData.online.map((member) => (
            <PresenceAvatar
              key={member.userId}
              member={member}
              isOnline={true}
              showTooltip={true}
            />
          ))}
          {presenceData.offline.map((member) => (
            <PresenceAvatar
              key={member.userId}
              member={member}
              isOnline={false}
              showTooltip={true}
            />
          ))}
          {presenceData.hiddenCount > 0 && (
            <div className="w-8 h-8 bg-gray-100 rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-xs text-gray-600">+{presenceData.hiddenCount}</span>
            </div>
          )}
        </div>
        
        <div className="text-sm text-gray-600">
          <span className="text-green-600 font-medium">{presenceData.online.length}</span>
          {' / '}
          <span>{presenceData.total}</span>
          {' online'}
        </div>
      </div>

      {/* Detailed view */}
      {showDetails && presenceData.online.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
            Online Now
          </h4>
          {presenceData.online.map((member) => (
            <PresenceDetail key={member.userId} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}

interface PresenceAvatarProps {
  member: TeamMemberPresence;
  isOnline: boolean;
  showTooltip?: boolean;
}

function PresenceAvatar({ member, isOnline, showTooltip }: PresenceAvatarProps) {
  const initials = member.userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const statusColor = isOnline ? 'bg-green-400' : 'bg-gray-400';
  const tooltipText = isOnline 
    ? `${member.userName} is online`
    : `${member.userName} - last seen ${formatDistanceToNow(member.lastSeen, { addSuffix: true })}`;

  return (
    <div className="relative group">
      <div className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium ${
        isOnline ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'
      }`}>
        {initials}
      </div>
      
      {/* Online status indicator */}
      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusColor}`} />
      
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          {tooltipText}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

interface PresenceDetailProps {
  member: TeamMemberPresence;
}

function PresenceDetail({ member }: PresenceDetailProps) {
  return (
    <div className="flex items-center space-x-2 text-sm">
      <div className="w-2 h-2 bg-green-400 rounded-full" />
      <span className="font-medium">{member.userName}</span>
      {member.currentActivity && (
        <span className="text-gray-500">• {member.currentActivity}</span>
      )}
      {member.location && (
        <span className="text-gray-400 text-xs">📍 {member.location}</span>
      )}
    </div>
  );
}

// Hook for easy integration in other components
export function useTeamPresenceCount(teamId: string) {
  const { teamPresence } = useWebSocketContext();

  return useMemo(() => {
    if (!teamPresence || teamPresence.teamId !== teamId) {
      return { online: 0, total: 0 };
    }

    const members = teamPresence.members || [];
    return {
      online: members.filter(m => m.isOnline).length,
      total: members.length
    };
  }, [teamPresence, teamId]);
}