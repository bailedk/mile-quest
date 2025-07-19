/**
 * WebSocket Authentication Handler
 * Handles authentication and authorization for real-time WebSocket connections
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { verifyToken } from '../../utils/auth/jwt.utils';
import { prisma } from '../../lib/database';
import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';
import { createLogger } from '../../services/logger';

// Validate environment on cold start
validateEnvironment();

const logger = createLogger();

// Create router
const router = createRouter();

interface WebSocketAuthRequest {
  socket_id: string;
  channel_name: string;
  auth?: string;
  team_id?: string;
  user_data?: Record<string, any>;
}

interface WebSocketAuthResponse {
  auth?: string;
  channel_data?: string;
  status: 'ok' | 'forbidden';
  error?: string;
}

/**
 * Authenticate WebSocket connection for Pusher channels
 * POST /websocket/auth
 */
router.post('/websocket/auth', async (event: APIGatewayProxyEvent, context: Context) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { socket_id, channel_name, team_id, user_data } = body as WebSocketAuthRequest;
    
    // Validate required parameters
    if (!socket_id || !channel_name) {
      return {
        statusCode: 400,
        body: {
          status: 'forbidden',
          error: 'Missing required parameters: socket_id and channel_name'
        } as WebSocketAuthResponse
      };
    }

    logger.info('WebSocket auth request', {
      socketId: socket_id,
      channel: channel_name,
      teamId: team_id
    });

    // Extract and verify JWT token from Authorization header
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const token = authHeader?.split(' ')[1]; // Bearer <token>

    if (!token) {
      // Public channels don't require authentication
      if (isPublicChannel(channel_name)) {
        logger.info('Public channel access granted', { channel: channel_name });
        return {
          statusCode: 200,
          body: {
            status: 'ok'
          } as WebSocketAuthResponse
        };
      }

      return {
        statusCode: 401,
        body: {
          status: 'forbidden',
          error: 'Authentication token required for private channels'
        } as WebSocketAuthResponse
      };
    }

    // Verify JWT token
    let user;
    try {
      const payload = verifyToken(token);
      user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name
      };
    } catch (error) {
      logger.warn('Invalid WebSocket auth token', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        statusCode: 403,
        body: {
          status: 'forbidden',
          error: 'Invalid or expired authentication token'
        } as WebSocketAuthResponse
      };
    }

    // Check channel-specific authorization
    const authResult = await authorizeChannelAccess(
      channel_name,
      user.id,
      team_id,
      socket_id,
      user_data
    );

    if (!authResult.authorized) {
      logger.warn('WebSocket channel authorization failed', {
        userId: user.id,
        channel: channel_name,
        reason: authResult.reason
      });
      
      return {
        statusCode: 403,
        body: {
          status: 'forbidden',
          error: authResult.reason || 'Access denied to channel'
        } as WebSocketAuthResponse
      };
    }

    // Generate Pusher auth signature
    const authData = generatePusherAuth(socket_id, channel_name, user, authResult.channelData);
    
    logger.info('WebSocket authentication successful', {
      userId: user.id,
      channel: channel_name,
      hasChannelData: !!authResult.channelData
    });

    return {
      statusCode: 200,
      body: {
        status: 'ok',
        auth: authData.auth,
        channel_data: authData.channel_data
      } as WebSocketAuthResponse
    };

  } catch (error) {
    logger.error('WebSocket authentication error', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return {
      statusCode: 500,
      body: {
        status: 'forbidden',
        error: 'Internal server error during authentication'
      } as WebSocketAuthResponse
    };
  }
});

/**
 * Check if a channel is public (no authentication required)
 */
function isPublicChannel(channel: string): boolean {
  return channel.startsWith('public-') || 
         (!channel.startsWith('private-') && !channel.startsWith('presence-'));
}

/**
 * Check if a channel is a presence channel
 */
function isPresenceChannel(channel: string): boolean {
  return channel.startsWith('presence-');
}

/**
 * Authorize user access to specific channels
 */
async function authorizeChannelAccess(
  channel: string,
  userId: string,
  teamId?: string,
  socketId?: string,
  userData?: Record<string, any>
): Promise<{
  authorized: boolean;
  reason?: string;
  channelData?: any;
}> {
  try {
    // User private channels - user can only access their own channel
    if (channel.startsWith('private-user-')) {
      const channelUserId = extractUserIdFromChannel(channel);
      if (channelUserId !== userId) {
        return {
          authorized: false,
          reason: 'Access denied: can only access your own user channel'
        };
      }
      return { authorized: true };
    }

    // Team channels - user must be a member of the team
    if (channel.startsWith('private-team-') || channel.startsWith('presence-team-')) {
      const channelTeamId = extractTeamIdFromChannel(channel) || teamId;
      
      if (!channelTeamId) {
        return {
          authorized: false,
          reason: 'Team ID required for team channels'
        };
      }

      const isMember = await checkTeamMembership(userId, channelTeamId);
      if (!isMember) {
        return {
          authorized: false,
          reason: 'Access denied: not a member of this team'
        };
      }

      // For presence channels, include user data
      let channelData;
      if (isPresenceChannel(channel)) {
        const userInfo = await getUserInfo(userId);
        channelData = JSON.stringify({
          user_id: userId,
          user_info: {
            name: userInfo.name,
            email: userInfo.email,
            ...userData
          }
        });
      }

      return { 
        authorized: true,
        channelData
      };
    }

    // Admin channels - check for admin permissions
    if (channel.startsWith('private-admin-')) {
      const isAdmin = await checkAdminPermissions(userId);
      if (!isAdmin) {
        return {
          authorized: false,
          reason: 'Access denied: admin permissions required'
        };
      }
      return { authorized: true };
    }

    // Global public channels
    if (channel.startsWith('public-')) {
      return { authorized: true };
    }

    // Default deny for unrecognized channel patterns
    return {
      authorized: false,
      reason: 'Unrecognized channel pattern'
    };

  } catch (error) {
    logger.error('Channel authorization error', { 
      channel,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return {
      authorized: false,
      reason: 'Authorization check failed'
    };
  }
}

/**
 * Extract user ID from user channel name
 */
function extractUserIdFromChannel(channel: string): string | null {
  const match = channel.match(/private-user-(.+)/);
  return match ? match[1] : null;
}

/**
 * Extract team ID from team channel name
 */
function extractTeamIdFromChannel(channel: string): string | null {
  const match = channel.match(/(?:private-team-|presence-team-)(.+)/);
  return match ? match[1] : null;
}

/**
 * Check if user is a member of the specified team
 */
async function checkTeamMembership(userId: string, teamId: string): Promise<boolean> {
  try {
    const membership = await prisma.teamMember.findFirst({
      where: {
        userId,
        teamId,
        leftAt: null, // Active membership
        team: {
          deletedAt: null // Team not deleted
        }
      }
    });

    return !!membership;
  } catch (error) {
    logger.error('Team membership check failed', { 
      userId, 
      teamId, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Check if user has admin permissions
 */
async function checkAdminPermissions(userId: string): Promise<boolean> {
  try {
    // Check if user has admin role in any team
    const adminMembership = await prisma.teamMember.findFirst({
      where: {
        userId,
        role: 'ADMIN',
        leftAt: null,
        team: {
          deletedAt: null
        }
      }
    });

    return !!adminMembership;
  } catch (error) {
    logger.error('Admin permission check failed', { 
      userId, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Get user information for presence channels
 */
async function getUserInfo(userId: string): Promise<{ name: string; email: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true }
    });

    return user || { name: 'Unknown User', email: '' };
  } catch (error) {
    logger.error('User info fetch failed', { 
      userId, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return { name: 'Unknown User', email: '' };
  }
}

/**
 * Generate Pusher authentication signature
 */
function generatePusherAuth(
  socketId: string,
  channel: string,
  user: { id: string; email: string; name: string },
  channelData?: string
): { auth: string; channel_data?: string } {
  // In a real implementation, this would use the Pusher secret to generate HMAC
  // For now, we'll create a simple auth string that can be validated
  const authString = `${socketId}:${channel}:${user.id}`;
  
  // Use environment variable for Pusher secret, fallback to JWT secret
  const secret = process.env.PUSHER_SECRET || process.env.JWT_SECRET || 'fallback-secret';
  
  // Generate HMAC SHA-256 signature
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(authString);
  const signature = hmac.digest('hex');
  
  const auth = `${process.env.PUSHER_KEY || 'app-key'}:${signature}`;
  
  const result: { auth: string; channel_data?: string } = { auth };
  
  if (channelData) {
    result.channel_data = channelData;
  }
  
  return result;
}

/**
 * Get temporary auth token for WebSocket connection
 * GET /websocket/token
 */
router.get('/websocket/token', async (event: APIGatewayProxyEvent, context: Context) => {
  try {
    // Extract user from headers
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return {
        statusCode: 401,
        body: { error: 'Authentication token required' }
      };
    }

    const payload = verifyToken(token);
    const user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name
    };

    // Generate a temporary token valid for 5 minutes for WebSocket auth
    const tempToken = generateTemporaryToken(user);
    
    logger.info('Temporary WebSocket token generated', { userId: user.id });

    return {
      statusCode: 200,
      body: {
        token: tempToken,
        expiresIn: 300, // 5 minutes
        userId: user.id
      }
    };

  } catch (error) {
    logger.error('Temporary token generation failed', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return {
      statusCode: 500,
      body: { error: 'Token generation failed' }
    };
  }
});

/**
 * Generate a short-lived token for WebSocket authentication
 */
function generateTemporaryToken(user: { id: string; email: string; name: string }): string {
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      temp: true // Mark as temporary token
    },
    secret,
    { expiresIn: '5m' }
  );
}

// Export handler
export const handler = createHandler(router.handle.bind(router));