import { useEffect, useRef, useCallback, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { WebSocketConnectionState } from '@/services/websocket';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface PresenceInfo {
  userId: string;
  isOnline: boolean;
  lastSeen: number;
  socketId?: string;
}

export interface TeamPresence {
  teamId: string;
  members: Map<string, PresenceInfo>;
  onlineCount: number;
  totalCount: number;
}

export interface UsePresenceOptions {
  onMemberOnline?: (userId: string, presenceInfo: PresenceInfo) => void;
  onMemberOffline?: (userId: string, presenceInfo: PresenceInfo) => void;
  onPresenceChange?: (teamPresence: TeamPresence) => void;
  onError?: (error: Error) => void;
  enableLogging?: boolean;
}

export function usePresence(
  teamId: string | null,
  options: UsePresenceOptions = {}
) {
  const { 
    onMemberOnline, 
    onMemberOffline, 
    onPresenceChange, 
    onError, 
    enableLogging = false 
  } = options;
  
  const { service, isConnected, connectionState, error } = useWebSocket({
    autoConnect: true,
    reconnectOnAuthChange: true,
  });
  
  const [presence, setPresence] = useState<TeamPresence | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastTeamIdRef = useRef<string | null>(null);

  const log = useCallback((message: string, data?: any) => {
    if (enableLogging) {
      console.log(`[Presence] ${message}`, data);
    }
  }, [enableLogging]);

  const handlePresenceUpdate = useCallback((message: any) => {
    const { event, data, timestamp } = message;
    
    if (!teamId) return;

    log('Received presence update', { event, data, timestamp });

    try {
      switch (event) {
        case 'presence:member_online':
          {
            const { userId, socketId } = data;
            const presenceInfo: PresenceInfo = {
              userId,
              isOnline: true,
              lastSeen: timestamp || Date.now(),
              socketId,
            };
            
            setPresence(prev => {
              if (!prev || prev.teamId !== teamId) {
                return {
                  teamId,
                  members: new Map([[userId, presenceInfo]]),
                  onlineCount: 1,
                  totalCount: 1,
                };
              }
              
              const newMembers = new Map(prev.members);
              const wasOnline = newMembers.get(userId)?.isOnline ?? false;
              newMembers.set(userId, presenceInfo);
              
              const onlineCount = Array.from(newMembers.values()).filter(p => p.isOnline).length;
              
              const updated = {
                ...prev,
                members: newMembers,
                onlineCount,
                totalCount: Math.max(prev.totalCount, newMembers.size),
              };
              
              if (onPresenceChange) {
                onPresenceChange(updated);
              }
              
              if (!wasOnline && onMemberOnline) {
                onMemberOnline(userId, presenceInfo);
              }
              
              return updated;
            });
          }
          break;

        case 'presence:member_offline':
          {
            const { userId } = data;
            const presenceInfo: PresenceInfo = {
              userId,
              isOnline: false,
              lastSeen: timestamp || Date.now(),
            };
            
            setPresence(prev => {
              if (!prev || prev.teamId !== teamId) {
                return prev;
              }
              
              const newMembers = new Map(prev.members);
              const wasOnline = newMembers.get(userId)?.isOnline ?? false;
              newMembers.set(userId, presenceInfo);
              
              const onlineCount = Array.from(newMembers.values()).filter(p => p.isOnline).length;
              
              const updated = {
                ...prev,
                members: newMembers,
                onlineCount,
              };
              
              if (onPresenceChange) {
                onPresenceChange(updated);
              }
              
              if (wasOnline && onMemberOffline) {
                onMemberOffline(userId, presenceInfo);
              }
              
              return updated;
            });
          }
          break;

        case 'presence:initial_state':
          {
            const { members } = data;
            const memberMap = new Map<string, PresenceInfo>();
            
            if (Array.isArray(members)) {
              members.forEach((member: any) => {
                memberMap.set(member.userId, {
                  userId: member.userId,
                  isOnline: member.isOnline,
                  lastSeen: member.lastSeen || timestamp || Date.now(),
                  socketId: member.socketId,
                });
              });
            }
            
            const onlineCount = Array.from(memberMap.values()).filter(p => p.isOnline).length;
            
            const newPresence: TeamPresence = {
              teamId,
              members: memberMap,
              onlineCount,
              totalCount: memberMap.size,
            };
            
            setPresence(newPresence);
            setIsLoading(false);
            
            if (onPresenceChange) {
              onPresenceChange(newPresence);
            }
          }
          break;

        default:
          log('Unknown presence event type', event);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Presence update failed');
      console.error('Error handling presence update:', err);
      if (onError) {
        onError(err);
      }
    }
  }, [teamId, onMemberOnline, onMemberOffline, onPresenceChange, onError, log]);

  const subscribeToTeamPresence = useCallback((currentTeamId: string) => {
    if (!service || !isConnected) {
      log('Cannot subscribe: service not available or not connected');
      return;
    }

    try {
      const channelName = `presence-${currentTeamId}`;
      log('Subscribing to presence channel', channelName);
      
      setIsLoading(true);
      const unsubscribe = service.subscribe(channelName, handlePresenceUpdate);
      unsubscribeRef.current = unsubscribe;
      
      log('Successfully subscribed to presence channel', channelName);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Presence subscription failed');
      console.error('Failed to subscribe to presence channel:', err);
      setIsLoading(false);
      if (onError) {
        onError(err);
      }
    }
  }, [service, isConnected, handlePresenceUpdate, onError, log]);

  const unsubscribeFromPresence = useCallback(() => {
    if (unsubscribeRef.current) {
      log('Unsubscribing from presence channel');
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    setPresence(null);
    setIsLoading(false);
  }, [log]);

  // Handle team changes and connection state
  useEffect(() => {
    const currentTeamId = teamId;
    const lastTeamId = lastTeamIdRef.current;

    // If team changed, unsubscribe from old team
    if (lastTeamId && lastTeamId !== currentTeamId) {
      unsubscribeFromPresence();
    }

    // Subscribe to new team if connected and team exists
    if (currentTeamId && isConnected && connectionState === WebSocketConnectionState.CONNECTED) {
      subscribeToTeamPresence(currentTeamId);
    } else if (!isConnected || connectionState !== WebSocketConnectionState.CONNECTED) {
      setIsLoading(false);
    }

    lastTeamIdRef.current = currentTeamId;

    // Cleanup on unmount or team change
    return () => {
      if (currentTeamId !== teamId) {
        unsubscribeFromPresence();
      }
    };
  }, [teamId, isConnected, connectionState, subscribeToTeamPresence, unsubscribeFromPresence]);

  // Handle WebSocket errors
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeFromPresence();
    };
  }, [unsubscribeFromPresence]);

  // Helper functions
  const isUserOnline = useCallback((userId: string): boolean => {
    return presence?.members.get(userId)?.isOnline ?? false;
  }, [presence]);

  const getUserLastSeen = useCallback((userId: string): number | null => {
    return presence?.members.get(userId)?.lastSeen ?? null;
  }, [presence]);

  const getOnlineMembers = useCallback((): PresenceInfo[] => {
    if (!presence) return [];
    return Array.from(presence.members.values()).filter(p => p.isOnline);
  }, [presence]);

  const getOfflineMembers = useCallback((): PresenceInfo[] => {
    if (!presence) return [];
    return Array.from(presence.members.values()).filter(p => !p.isOnline);
  }, [presence]);

  return {
    // State
    presence,
    isLoading,
    isConnected,
    connectionState,
    error,
    
    // Computed values
    onlineCount: presence?.onlineCount ?? 0,
    totalCount: presence?.totalCount ?? 0,
    
    // Helper functions
    isUserOnline,
    getUserLastSeen,
    getOnlineMembers,
    getOfflineMembers,
    
    // Current team
    teamId,
  };
}