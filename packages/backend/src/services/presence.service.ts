import { PrismaClient } from '@prisma/client';
import { WebSocketService } from './websocket';

export interface UserPresence {
  userId: string;
  teamId: string;
  isOnline: boolean;
  lastSeen: Date;
  currentActivity?: string;
  location?: string;
  sessionId?: string;
}

export interface TeamPresence {
  teamId: string;
  members: UserPresence[];
  lastUpdated: Date;
}

export class PresenceService {
  private readonly prisma: PrismaClient;
  private readonly webSocketService: WebSocketService;
  private readonly presenceMap = new Map<string, UserPresence>();
  private readonly sessionToUser = new Map<string, string>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(prisma: PrismaClient, webSocketService: WebSocketService) {
    this.prisma = prisma;
    this.webSocketService = webSocketService;
    
    // Clean up stale presence data every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupStalePresence();
    }, 30000);
  }

  /**
   * Update user presence when they connect/disconnect
   */
  async updateUserPresence(
    userId: string,
    isOnline: boolean,
    options: {
      teamId?: string;
      sessionId?: string;
      currentActivity?: string;
      location?: string;
    } = {}
  ): Promise<void> {
    const { teamId, sessionId, currentActivity, location } = options;
    
    try {
      // Get user's current team if not provided
      let userTeamId = teamId;
      if (!userTeamId) {
        const membership = await this.prisma.teamMember.findFirst({
          where: { 
            userId,
            status: 'ACTIVE' 
          },
          include: { team: true }
        });
        userTeamId = membership?.teamId;
      }

      if (!userTeamId) {
        console.warn(`No team found for user ${userId}, skipping presence update`);
        return;
      }

      const presenceKey = `${userId}-${userTeamId}`;
      const now = new Date();

      // Update presence data
      const presence: UserPresence = {
        userId,
        teamId: userTeamId,
        isOnline,
        lastSeen: now,
        currentActivity,
        location,
        sessionId
      };

      this.presenceMap.set(presenceKey, presence);
      
      if (sessionId) {
        this.sessionToUser.set(sessionId, presenceKey);
      }

      // Broadcast team presence update
      await this.broadcastTeamPresence(userTeamId);

      console.log(`Updated presence for user ${userId} in team ${userTeamId}: ${isOnline ? 'online' : 'offline'}`);
    } catch (error) {
      console.error('Error updating user presence:', error);
    }
  }

  /**
   * Handle user connection
   */
  async handleUserConnect(
    userId: string,
    sessionId: string,
    options: {
      teamId?: string;
      currentActivity?: string;
      location?: string;
    } = {}
  ): Promise<void> {
    await this.updateUserPresence(userId, true, {
      ...options,
      sessionId
    });
  }

  /**
   * Handle user disconnection
   */
  async handleUserDisconnect(sessionId: string): Promise<void> {
    const presenceKey = this.sessionToUser.get(sessionId);
    if (!presenceKey) {
      return;
    }

    const presence = this.presenceMap.get(presenceKey);
    if (!presence) {
      return;
    }

    // Mark as offline
    await this.updateUserPresence(presence.userId, false, {
      teamId: presence.teamId,
      currentActivity: presence.currentActivity,
      location: presence.location
    });

    // Clean up session mapping
    this.sessionToUser.delete(sessionId);
  }

  /**
   * Update user activity status
   */
  async updateUserActivity(
    userId: string,
    teamId: string,
    activity: string,
    location?: string
  ): Promise<void> {
    const presenceKey = `${userId}-${teamId}`;
    const existing = this.presenceMap.get(presenceKey);
    
    if (existing) {
      await this.updateUserPresence(userId, true, {
        teamId,
        sessionId: existing.sessionId,
        currentActivity: activity,
        location: location || existing.location
      });
    }
  }

  /**
   * Get team presence data
   */
  async getTeamPresence(teamId: string): Promise<TeamPresence> {
    try {
      // Get all team members
      const teamMembers = await this.prisma.teamMember.findMany({
        where: {
          teamId,
          status: 'ACTIVE'
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Build presence data for each member
      const members: UserPresence[] = teamMembers.map(member => {
        const presenceKey = `${member.userId}-${teamId}`;
        const presence = this.presenceMap.get(presenceKey);
        
        return {
          userId: member.userId,
          teamId,
          isOnline: presence?.isOnline || false,
          lastSeen: presence?.lastSeen || new Date(0),
          currentActivity: presence?.currentActivity,
          location: presence?.location,
          sessionId: presence?.sessionId
        };
      });

      return {
        teamId,
        members,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error(`Error getting team presence for team ${teamId}:`, error);
      return {
        teamId,
        members: [],
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Get user's presence across all teams
   */
  async getUserPresence(userId: string): Promise<UserPresence[]> {
    const userPresence: UserPresence[] = [];
    
    for (const [key, presence] of this.presenceMap.entries()) {
      if (presence.userId === userId) {
        userPresence.push(presence);
      }
    }
    
    return userPresence;
  }

  /**
   * Broadcast team presence to all team members
   */
  private async broadcastTeamPresence(teamId: string): Promise<void> {
    try {
      const teamPresence = await this.getTeamPresence(teamId);
      
      await this.webSocketService.broadcastToChannel(
        `team-${teamId}`,
        'presence:team:updated',
        {
          teamId,
          presence: teamPresence,
          timestamp: new Date().toISOString()
        }
      );
    } catch (error) {
      console.error(`Error broadcasting team presence for team ${teamId}:`, error);
    }
  }

  /**
   * Clean up stale presence data
   */
  private cleanupStalePresence(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    for (const [key, presence] of this.presenceMap.entries()) {
      const timeSinceLastSeen = now - presence.lastSeen.getTime();
      
      if (presence.isOnline && timeSinceLastSeen > staleThreshold) {
        // Mark as offline
        this.presenceMap.set(key, {
          ...presence,
          isOnline: false,
          lastSeen: new Date()
        });
        
        // Broadcast update
        this.broadcastTeamPresence(presence.teamId).catch(error => {
          console.error('Error broadcasting cleanup update:', error);
        });
        
        console.log(`Marked user ${presence.userId} as offline due to stale presence`);
      }
    }
  }

  /**
   * Get presence statistics for team
   */
  async getTeamPresenceStats(teamId: string): Promise<{
    total: number;
    online: number;
    offline: number;
    percentage: number;
  }> {
    const teamPresence = await this.getTeamPresence(teamId);
    const online = teamPresence.members.filter(m => m.isOnline).length;
    const total = teamPresence.members.length;
    
    return {
      total,
      online,
      offline: total - online,
      percentage: total > 0 ? Math.round((online / total) * 100) : 0
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.presenceMap.clear();
    this.sessionToUser.clear();
  }
}

// Export default instance
export const presenceService = new PresenceService(
  new PrismaClient(),
  new WebSocketService()
);