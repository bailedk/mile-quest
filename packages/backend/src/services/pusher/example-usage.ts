/**
 * Example usage of the Pusher Connection Manager
 * This file demonstrates how to integrate the connection manager with your application
 */

import { PusherConnectionManager } from './connection-manager';
import { PusherEvent, ConnectionStatus, AuthenticationRequest } from './types';

// Example: Initialize the connection manager
export function createPusherManager() {
  const manager = new PusherConnectionManager(
    // Connection configuration
    {
      maxConnections: 5000,
      connectionTimeout: 30000,
      heartbeatInterval: 30000,
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      backoffMultiplier: 2,
      enableConnectionPooling: true,
      enableHealthMonitoring: true
    },
    // Rate limit configuration
    {
      messagesPerSecond: 10,
      messagesPerMinute: 600,
      subscriptionsPerConnection: 100,
      burstLimit: 50,
      windowSize: 60
    }
  );

  return manager;
}

// Example: Handle new user connections
export async function handleUserConnection(
  manager: PusherConnectionManager,
  socketId: string,
  userId: string,
  teamId?: string
) {
  try {
    // Register the connection
    const connection = await manager.registerConnection(socketId, userId, teamId, {
      userAgent: 'Mile Quest Mobile App',
      version: '1.0.0'
    });

    console.log('User connected:', {
      connectionId: connection.id,
      userId,
      teamId
    });

    // Subscribe to user-specific channels
    await subscribeToUserChannels(manager, connection.id, userId, teamId);

    return connection;
  } catch (error) {
    console.error('Failed to handle user connection:', error);
    throw error;
  }
}

// Example: Subscribe user to relevant channels
async function subscribeToUserChannels(
  manager: PusherConnectionManager,
  connectionId: string,
  userId: string,
  teamId?: string
) {
  // Subscribe to public announcements
  await manager.subscribeToChannel(connectionId, 'public-announcements');

  // Subscribe to user's private channel (requires auth)
  const userAuthRequest: AuthenticationRequest = {
    socketId: await getSocketIdFromConnection(manager, connectionId),
    channel: `private-user-${userId}`,
    userId,
    token: await getUserJWTToken(userId)
  };
  await manager.subscribeToChannel(connectionId, `private-user-${userId}`, userAuthRequest);

  // Subscribe to team channels if user is in a team
  if (teamId) {
    const teamAuthRequest: AuthenticationRequest = {
      socketId: await getSocketIdFromConnection(manager, connectionId),
      channel: `private-team-${teamId}`,
      userId,
      teamId,
      token: await getUserJWTToken(userId)
    };
    await manager.subscribeToChannel(connectionId, `private-team-${teamId}`, teamAuthRequest);

    // Subscribe to team presence channel
    const presenceAuthRequest: AuthenticationRequest = {
      socketId: await getSocketIdFromConnection(manager, connectionId),
      channel: `presence-team-${teamId}`,
      userId,
      teamId,
      token: await getUserJWTToken(userId),
      userData: {
        name: await getUserName(userId),
        avatar: await getUserAvatar(userId)
      }
    };
    await manager.subscribeToChannel(connectionId, `presence-team-${teamId}`, presenceAuthRequest);
  }
}

// Example: Send activity update to team
export async function broadcastActivityUpdate(
  manager: PusherConnectionManager,
  teamId: string,
  activity: any
) {
  const event: PusherEvent = {
    eventId: `activity-${activity.id}`,
    channel: `private-team-${teamId}`,
    event: 'activity-created',
    data: {
      id: activity.id,
      userId: activity.userId,
      distance: activity.distance,
      location: activity.location,
      timestamp: activity.createdAt
    },
    userId: activity.userId,
    timestamp: new Date()
  };

  try {
    const result = await manager.sendEvent(event);
    console.log('Activity broadcast result:', result);
    return result;
  } catch (error) {
    console.error('Failed to broadcast activity:', error);
    throw error;
  }
}

// Example: Send team progress update
export async function broadcastTeamProgress(
  manager: PusherConnectionManager,
  teamId: string,
  progress: any
) {
  const event: PusherEvent = {
    eventId: `progress-${teamId}-${Date.now()}`,
    channel: `private-team-${teamId}`,
    event: 'team-progress-updated',
    data: {
      teamId,
      totalDistance: progress.totalDistance,
      goalDistance: progress.goalDistance,
      percentage: progress.percentage,
      rank: progress.rank,
      members: progress.members
    },
    timestamp: new Date()
  };

  try {
    const result = await manager.sendEvent(event);
    console.log('Progress broadcast result:', result);
    return result;
  } catch (error) {
    console.error('Failed to broadcast progress:', error);
    throw error;
  }
}

// Example: Send achievement notification
export async function notifyAchievement(
  manager: PusherConnectionManager,
  userId: string,
  achievement: any
) {
  const userEvent: PusherEvent = {
    eventId: `achievement-${achievement.id}`,
    channel: `private-user-${userId}`,
    event: 'achievement-unlocked',
    data: {
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      points: achievement.points,
      icon: achievement.icon
    },
    userId,
    timestamp: new Date()
  };

  // Also notify team if achievement is team-related
  const events = [userEvent];
  
  if (achievement.teamId) {
    const teamEvent: PusherEvent = {
      eventId: `team-achievement-${achievement.id}`,
      channel: `private-team-${achievement.teamId}`,
      event: 'team-member-achievement',
      data: {
        userId,
        userName: await getUserName(userId),
        achievement: {
          id: achievement.id,
          title: achievement.title,
          description: achievement.description
        }
      },
      userId,
      timestamp: new Date()
    };
    events.push(teamEvent);
  }

  try {
    const results = await manager.sendEventBatch(events);
    console.log('Achievement notification results:', results);
    return results;
  } catch (error) {
    console.error('Failed to notify achievement:', error);
    throw error;
  }
}

// Example: Handle user disconnection
export async function handleUserDisconnection(
  manager: PusherConnectionManager,
  connectionId: string
) {
  try {
    const connection = manager.getConnection(connectionId);
    if (connection) {
      console.log('User disconnecting:', {
        connectionId,
        userId: connection.userId,
        teamId: connection.teamId,
        connectedDuration: Date.now() - connection.connectedAt.getTime()
      });
    }

    await manager.removeConnection(connectionId);
  } catch (error) {
    console.error('Failed to handle user disconnection:', error);
    throw error;
  }
}

// Example: Monitor system health
export function monitorPusherHealth(manager: PusherConnectionManager) {
  setInterval(() => {
    const health = manager.getHealthStatus();
    
    console.log('Pusher Health Status:', {
      status: health.status,
      activeConnections: health.connections.activeConnections,
      messagesPerSecond: health.connections.messagesPerSecond,
      errorRate: health.errors.errorRate,
      averageLatency: health.performance.averageMessageLatency
    });

    // Alert if system is unhealthy
    if (health.status === 'unhealthy') {
      console.error('ALERT: Pusher system is unhealthy!', health);
      // Here you would integrate with your alerting system
    }
  }, 30000); // Check every 30 seconds
}

// Example: Get team activity for real-time dashboard
export async function getTeamActivityData(
  manager: PusherConnectionManager,
  teamId: string
) {
  const teamConnections = manager.getTeamConnections(teamId);
  const activeMembers = teamConnections.filter(
    conn => conn.status === ConnectionStatus.CONNECTED
  );

  return {
    teamId,
    activeMemberCount: activeMembers.length,
    totalConnections: teamConnections.length,
    activeMembers: activeMembers.map(conn => ({
      userId: conn.userId,
      connectedAt: conn.connectedAt,
      lastActivity: conn.lastActivity,
      channels: Array.from(conn.channels)
    }))
  };
}

// Helper functions (these would be implemented based on your actual services)
async function getSocketIdFromConnection(manager: PusherConnectionManager, connectionId: string): Promise<string> {
  const connection = manager.getConnection(connectionId);
  if (!connection) {
    throw new Error('Connection not found');
  }
  return connection.socketId;
}

async function getUserJWTToken(userId: string): Promise<string> {
  // This would integrate with your auth service to get a JWT token for the user
  return `jwt-token-for-${userId}`;
}

async function getUserName(userId: string): Promise<string> {
  // This would integrate with your user service
  return `User ${userId}`;
}

async function getUserAvatar(userId: string): Promise<string> {
  // This would integrate with your user service
  return `https://example.com/avatars/${userId}.jpg`;
}

// Export for use in Lambda handlers or Express routes
export {
  PusherConnectionManager,
  PusherEvent,
  ConnectionStatus,
  AuthenticationRequest
};