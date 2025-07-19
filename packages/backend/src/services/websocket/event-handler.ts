/**
 * Real-time event handling wrapper for WebSocket services
 * Provides high-level abstractions for common real-time patterns
 */

import { WebSocketService, WebSocketMessage } from './types';

export interface EventHandler<T = any> {
  (data: T, metadata: EventMetadata): Promise<void> | void;
}

export interface EventMetadata {
  channel: string;
  event: string;
  timestamp: Date;
  socketId?: string;
  userId?: string;
}

export interface EventBroadcastOptions {
  excludeUser?: string;
  includeUsers?: string[];
  metadata?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
}

export interface TeamEventOptions extends EventBroadcastOptions {
  teamId: string;
  includePrivateChannels?: boolean;
}

export interface UserEventOptions extends EventBroadcastOptions {
  userId: string;
  includeTeamChannels?: boolean;
}

/**
 * High-level event handling wrapper for WebSocket services
 */
export class WebSocketEventHandler {
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private middleware: Array<(event: string, data: any, metadata: EventMetadata) => Promise<boolean>> = [];

  constructor(private webSocketService: WebSocketService) {}

  /**
   * Register an event handler for a specific event type
   */
  on<T = any>(event: string, handler: EventHandler<T>): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as EventHandler);
  }

  /**
   * Remove an event handler
   */
  off(event: string, handler?: EventHandler): void {
    if (!handler) {
      this.eventHandlers.delete(event);
      return;
    }

    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  /**
   * Add middleware for event processing
   */
  use(middleware: (event: string, data: any, metadata: EventMetadata) => Promise<boolean>): void {
    this.middleware.push(middleware);
  }

  /**
   * Broadcast a team-specific event
   */
  async broadcastToTeam<T = any>(
    event: string,
    data: T,
    options: TeamEventOptions
  ): Promise<void> {
    const { teamId, includePrivateChannels = true, ...broadcastOptions } = options;
    
    const channels = this.getTeamChannels(teamId, includePrivateChannels);
    
    await this.broadcastToChannels(channels, event, data, broadcastOptions);
  }

  /**
   * Broadcast a user-specific event
   */
  async broadcastToUser<T = any>(
    event: string,
    data: T,
    options: UserEventOptions
  ): Promise<void> {
    const { userId, includeTeamChannels = false, ...broadcastOptions } = options;
    
    const channels = this.getUserChannels(userId, includeTeamChannels);
    
    await this.broadcastToChannels(channels, event, data, broadcastOptions);
  }

  /**
   * Broadcast a global event to public channels
   */
  async broadcastGlobal<T = any>(
    event: string,
    data: T,
    options: EventBroadcastOptions = {}
  ): Promise<void> {
    const channels = ['public-announcements', 'public-global'];
    
    await this.broadcastToChannels(channels, event, data, options);
  }

  /**
   * Broadcast activity updates with smart channel routing
   */
  async broadcastActivity(
    activityData: {
      userId: string;
      teamId: string;
      distance: number;
      duration: number;
      isPrivate: boolean;
    },
    progressUpdate?: {
      newTotalDistance: number;
      newPercentComplete: number;
      milestoneReached?: boolean;
    }
  ): Promise<void> {
    const { userId, teamId, isPrivate, ...activity } = activityData;

    // Always send to team channel (private activities count for team progress)
    await this.broadcastToTeam('activity-added', {
      user: { id: userId },
      activity,
      progress: progressUpdate,
      timestamp: new Date().toISOString(),
    }, { teamId });

    // Send to public channels only if activity is not private
    if (!isPrivate) {
      await this.broadcastGlobal('public-activity-added', {
        user: { id: userId },
        teamId,
        activity: { distance: activity.distance },
        timestamp: new Date().toISOString(),
      });
    }

    // Send milestone notification if reached
    if (progressUpdate?.milestoneReached) {
      await this.broadcastToTeam('milestone-reached', {
        teamId,
        progress: progressUpdate,
        celebrationType: 'PROGRESS_MILESTONE',
      }, { teamId });
    }
  }

  /**
   * Broadcast achievement unlocked events
   */
  async broadcastAchievement(
    achievementData: {
      userId: string;
      achievementId: string;
      achievementName: string;
      description: string;
      type: string;
    },
    teamIds: string[] = []
  ): Promise<void> {
    const { userId, ...achievement } = achievementData;

    // Send to user's private channel
    await this.broadcastToUser('achievement-unlocked', {
      achievement,
      celebrationType: 'ACHIEVEMENT_UNLOCK',
      timestamp: new Date().toISOString(),
    }, { userId });

    // Send to team channels
    for (const teamId of teamIds) {
      await this.broadcastToTeam('team-member-achievement', {
        user: { id: userId },
        achievement,
        timestamp: new Date().toISOString(),
      }, { teamId, excludeUser: userId }); // Exclude the achiever from team notification
    }
  }

  /**
   * Broadcast team progress updates
   */
  async broadcastTeamProgress(
    teamId: string,
    progressData: {
      totalDistance: number;
      percentComplete: number;
      isOnTrack: boolean;
      estimatedCompletionDate?: Date;
      topContributors: Array<{
        userId: string;
        name: string;
        distance: number;
      }>;
    }
  ): Promise<void> {
    await this.broadcastToTeam('progress-update', {
      ...progressData,
      timestamp: new Date().toISOString(),
    }, { teamId });
  }

  /**
   * Broadcast presence updates (user joined/left)
   */
  async broadcastPresence(
    userId: string,
    status: 'online' | 'offline',
    teamIds: string[] = [],
    userInfo?: Record<string, any>
  ): Promise<void> {
    const presenceData = {
      userId,
      status,
      userInfo,
      timestamp: new Date().toISOString(),
    };

    // Send to team presence channels
    for (const teamId of teamIds) {
      const channel = `presence-team-${teamId}`;
      await this.webSocketService.trigger(channel, 'user-presence-changed', presenceData);
    }
  }

  /**
   * Process incoming webhook events
   */
  async processWebhookEvent(
    event: string,
    data: any,
    metadata: EventMetadata
  ): Promise<void> {
    // Run middleware
    for (const middleware of this.middleware) {
      const shouldContinue = await middleware(event, data, metadata);
      if (!shouldContinue) {
        return;
      }
    }

    // Execute event handlers
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const promises = Array.from(handlers).map(handler => 
        Promise.resolve(handler(data, metadata))
      );
      
      await Promise.allSettled(promises);
    }
  }

  /**
   * Get team-related channels
   */
  private getTeamChannels(teamId: string, includePrivate: boolean): string[] {
    const channels = [`private-team-${teamId}`];
    
    if (includePrivate) {
      channels.push(`presence-team-${teamId}`);
    }
    
    return channels;
  }

  /**
   * Get user-related channels
   */
  private getUserChannels(userId: string, includeTeam: boolean): string[] {
    const channels = [`private-user-${userId}`];
    
    // Note: In a real implementation, you'd query user's teams
    // For now, we just return the user channel
    
    return channels;
  }

  /**
   * Broadcast to multiple channels with smart batching
   */
  private async broadcastToChannels<T = any>(
    channels: string[],
    event: string,
    data: T,
    options: EventBroadcastOptions
  ): Promise<void> {
    const { metadata, priority = 'normal', ...filterOptions } = options;
    
    const enhancedData = {
      ...data,
      metadata: {
        priority,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };

    // Create messages for batch sending
    const messages: WebSocketMessage[] = channels.map(channel => ({
      channel,
      event,
      data: enhancedData,
      userId: filterOptions.excludeUser,
    }));

    // Use batch trigger for efficiency
    if (messages.length > 1) {
      await this.webSocketService.triggerBatch(messages);
    } else if (messages.length === 1) {
      const msg = messages[0];
      await this.webSocketService.trigger(msg.channel, msg.event, msg.data);
    }
  }

  /**
   * Cleanup event handlers and resources
   */
  destroy(): void {
    this.eventHandlers.clear();
    this.middleware = [];
  }
}

/**
 * Middleware functions for common use cases
 */
export const EventMiddleware = {
  /**
   * Logging middleware
   */
  logger: (prefix = 'WebSocket') => async (
    event: string,
    data: any,
    metadata: EventMetadata
  ): Promise<boolean> => {
    console.log(`[${prefix}] ${event} on ${metadata.channel}`, {
      event,
      channel: metadata.channel,
      timestamp: metadata.timestamp,
      userId: metadata.userId,
    });
    return true;
  },

  /**
   * Rate limiting middleware
   */
  rateLimit: (
    limits: Record<string, { maxPerMinute: number; maxPerHour: number }>
  ) => {
    const counters = new Map<string, { minute: number; hour: number; lastReset: Date }>();
    
    return async (event: string, data: any, metadata: EventMetadata): Promise<boolean> => {
      const key = `${metadata.userId || 'anonymous'}:${event}`;
      const now = new Date();
      const limit = limits[event];
      
      if (!limit) return true;
      
      let counter = counters.get(key);
      if (!counter) {
        counter = { minute: 0, hour: 0, lastReset: now };
        counters.set(key, counter);
      }
      
      // Reset counters if needed
      const timeDiff = now.getTime() - counter.lastReset.getTime();
      if (timeDiff > 60000) { // 1 minute
        counter.minute = 0;
        if (timeDiff > 3600000) { // 1 hour
          counter.hour = 0;
        }
        counter.lastReset = now;
      }
      
      // Check limits
      if (counter.minute >= limit.maxPerMinute || counter.hour >= limit.maxPerHour) {
        console.warn(`Rate limit exceeded for ${key}`);
        return false;
      }
      
      counter.minute++;
      counter.hour++;
      
      return true;
    };
  },

  /**
   * Authentication middleware
   */
  requireAuth: () => async (
    event: string,
    data: any,
    metadata: EventMetadata
  ): Promise<boolean> => {
    if (!metadata.userId) {
      console.warn(`Unauthorized event ${event} on ${metadata.channel}`);
      return false;
    }
    return true;
  },
};