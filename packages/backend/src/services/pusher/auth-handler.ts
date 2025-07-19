/**
 * Authentication and authorization handler for Pusher connections
 */

import { 
  AuthenticationRequest, 
  AuthenticationResult, 
  ChannelAuthorizationRule, 
  ChannelPermissions,
  PusherConnectionError,
  PusherErrorCode 
} from './types';
import { AuthService } from '../auth/types';
import { createAuthService } from '../auth/factory';

export class PusherAuthHandler {
  private authService: AuthService;
  private authorizationRules = new Map<string, ChannelAuthorizationRule>();

  constructor(authService?: AuthService) {
    this.authService = authService || createAuthService();
    this.setupDefaultRules();
  }

  /**
   * Authenticate a channel subscription request
   */
  async authenticateChannel(request: AuthenticationRequest): Promise<AuthenticationResult> {
    try {
      // Validate the request
      if (!request.socketId || !request.channel) {
        return {
          success: false,
          error: 'Missing required authentication parameters',
          errorCode: 'INVALID_REQUEST'
        };
      }

      // Check if this is a public channel (no auth required)
      if (this.isPublicChannel(request.channel)) {
        return {
          success: true,
          permissions: this.getDefaultPermissions(request.channel)
        };
      }

      // For private/presence channels, require authentication
      if (!request.token) {
        return {
          success: false,
          error: 'Authentication token required for private channels',
          errorCode: 'TOKEN_REQUIRED'
        };
      }

      // Verify the JWT token
      const user = await this.authService.verifyToken(request.token);
      if (!user) {
        return {
          success: false,
          error: 'Invalid authentication token',
          errorCode: 'INVALID_TOKEN'
        };
      }

      // Check channel authorization
      const authorized = await this.authorizeChannel(request.channel, user.id, request.teamId);
      if (!authorized.success) {
        return authorized;
      }

      // Generate auth string for Pusher
      const auth = this.generateAuthString(request.socketId, request.channel, user.id);
      
      // Prepare channel data for presence channels
      let channelData;
      if (this.isPresenceChannel(request.channel)) {
        channelData = {
          userId: user.id,
          userInfo: {
            name: user.name,
            email: user.email,
            ...request.userData
          }
        };
      }

      return {
        success: true,
        auth,
        channelData,
        permissions: authorized.permissions
      };

    } catch (error) {
      console.error('Channel authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed',
        errorCode: 'AUTH_ERROR'
      };
    }
  }

  /**
   * Authorize access to a specific channel
   */
  async authorizeChannel(
    channel: string, 
    userId: string, 
    teamId?: string
  ): Promise<AuthenticationResult> {
    const rule = this.findAuthorizationRule(channel);
    if (!rule) {
      return {
        success: false,
        error: 'No authorization rule found for channel',
        errorCode: 'NO_AUTH_RULE'
      };
    }

    try {
      // Check team membership if required
      if (rule.requiredTeamMembership && teamId) {
        const isMember = await this.checkTeamMembership(userId, teamId);
        if (!isMember) {
          return {
            success: false,
            error: 'Team membership required',
            errorCode: 'NOT_TEAM_MEMBER'
          };
        }
      }

      // Check required roles if specified
      if (rule.requiredRoles && rule.requiredRoles.length > 0) {
        const hasRole = await this.checkUserRoles(userId, rule.requiredRoles);
        if (!hasRole) {
          return {
            success: false,
            error: 'Insufficient permissions',
            errorCode: 'INSUFFICIENT_PERMISSIONS'
          };
        }
      }

      // Run custom validator if provided
      if (rule.customValidator) {
        const customResult = await rule.customValidator({
          socketId: '',
          channel,
          userId,
          teamId
        });
        if (!customResult) {
          return {
            success: false,
            error: 'Custom authorization failed',
            errorCode: 'CUSTOM_AUTH_FAILED'
          };
        }
      }

      return {
        success: true,
        permissions: this.getChannelPermissions(channel, userId, teamId)
      };

    } catch (error) {
      console.error('Channel authorization error:', error);
      return {
        success: false,
        error: 'Authorization check failed',
        errorCode: 'AUTH_CHECK_ERROR'
      };
    }
  }

  /**
   * Add a custom authorization rule
   */
  addAuthorizationRule(pattern: string, rule: ChannelAuthorizationRule): void {
    this.authorizationRules.set(pattern, rule);
  }

  /**
   * Remove an authorization rule
   */
  removeAuthorizationRule(pattern: string): void {
    this.authorizationRules.delete(pattern);
  }

  /**
   * Check if a user has permissions for a specific action on a channel
   */
  async checkPermission(
    channel: string, 
    userId: string, 
    action: 'read' | 'write' | 'invite' | 'moderate',
    teamId?: string
  ): Promise<boolean> {
    const permissions = this.getChannelPermissions(channel, userId, teamId);
    
    switch (action) {
      case 'read':
        return permissions.canRead;
      case 'write':
        return permissions.canWrite;
      case 'invite':
        return permissions.canInvite;
      case 'moderate':
        return permissions.canModerate;
      default:
        return false;
    }
  }

  private setupDefaultRules(): void {
    // Public channels (no auth required)
    this.addAuthorizationRule('public-*', {
      pattern: 'public-*'
    });

    // User private channels (user must be authenticated)
    this.addAuthorizationRule('private-user-*', {
      pattern: 'private-user-*',
      customValidator: async (request) => {
        const userIdFromChannel = this.extractUserIdFromChannel(request.channel);
        return request.userId === userIdFromChannel;
      }
    });

    // Team channels (team membership required)
    this.addAuthorizationRule('private-team-*', {
      pattern: 'private-team-*',
      requiredTeamMembership: true
    });

    // Team presence channels
    this.addAuthorizationRule('presence-team-*', {
      pattern: 'presence-team-*',
      requiredTeamMembership: true
    });

    // Admin channels (admin role required)
    this.addAuthorizationRule('private-admin-*', {
      pattern: 'private-admin-*',
      requiredRoles: ['admin']
    });
  }

  private generateAuthString(socketId: string, channel: string, userId: string): string {
    // This would integrate with the Pusher service's auth generation
    // For now, return a placeholder that indicates the auth was successful
    return `${socketId}:${channel}:${userId}`;
  }

  private findAuthorizationRule(channel: string): ChannelAuthorizationRule | undefined {
    for (const [pattern, rule] of this.authorizationRules) {
      if (this.matchesPattern(channel, pattern)) {
        return rule;
      }
    }
    return undefined;
  }

  private matchesPattern(channel: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(channel);
  }

  private isPublicChannel(channel: string): boolean {
    return channel.startsWith('public-') || (!channel.startsWith('private-') && !channel.startsWith('presence-'));
  }

  private isPrivateChannel(channel: string): boolean {
    return channel.startsWith('private-');
  }

  private isPresenceChannel(channel: string): boolean {
    return channel.startsWith('presence-');
  }

  private getDefaultPermissions(channel: string): ChannelPermissions {
    if (this.isPublicChannel(channel)) {
      return {
        canRead: true,
        canWrite: false,
        canInvite: false,
        canModerate: false
      };
    }

    return {
      canRead: false,
      canWrite: false,
      canInvite: false,
      canModerate: false
    };
  }

  private getChannelPermissions(channel: string, userId: string, teamId?: string): ChannelPermissions {
    // Default permissions for authenticated users
    const permissions: ChannelPermissions = {
      canRead: true,
      canWrite: true,
      canInvite: false,
      canModerate: false
    };

    // Team channels have different permissions
    if (channel.includes('team') && teamId) {
      permissions.canInvite = true;
      // Team owners/admins would have moderate permissions
      // This would need to be enhanced with role checking
    }

    // Admin channels
    if (channel.includes('admin')) {
      permissions.canModerate = true;
    }

    return permissions;
  }

  private extractUserIdFromChannel(channel: string): string | null {
    const match = channel.match(/private-user-(.+)/);
    return match ? match[1] : null;
  }

  private async checkTeamMembership(userId: string, teamId: string): Promise<boolean> {
    try {
      // This would integrate with the team service to check membership
      // For now, return true as a placeholder
      return true;
    } catch (error) {
      console.error('Error checking team membership:', error);
      return false;
    }
  }

  private async checkUserRoles(userId: string, requiredRoles: string[]): Promise<boolean> {
    try {
      // This would integrate with the user/auth service to check roles
      // For now, return true as a placeholder
      return true;
    } catch (error) {
      console.error('Error checking user roles:', error);
      return false;
    }
  }
}