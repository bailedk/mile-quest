/**
 * Tests for PusherAuthHandler
 */

import { PusherAuthHandler } from '../auth-handler';
import { AuthService } from '../../auth/types';
import { AuthenticationRequest } from '../types';

// Mock AuthService
const mockAuthService: jest.Mocked<AuthService> = {
  signIn: jest.fn(),
  signInWithGoogle: jest.fn(),
  signOut: jest.fn(),
  signUp: jest.fn(),
  confirmSignUp: jest.fn(),
  resendConfirmationCode: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  changePassword: jest.fn(),
  getCurrentUser: jest.fn(),
  getSession: jest.fn(),
  refreshSession: jest.fn(),
  verifyToken: jest.fn(),
  getIdToken: jest.fn(),
  getAccessToken: jest.fn(),
  updateUserAttributes: jest.fn(),
  deleteUser: jest.fn(),
  adminGetUser: jest.fn(),
  adminCreateUser: jest.fn(),
  adminDeleteUser: jest.fn(),
  adminUpdateUserAttributes: jest.fn(),
  adminResetUserPassword: jest.fn()
};

describe('PusherAuthHandler', () => {
  let authHandler: PusherAuthHandler;

  beforeEach(() => {
    authHandler = new PusherAuthHandler(mockAuthService);
    jest.clearAllMocks();
  });

  describe('Channel Authentication', () => {
    it('should authenticate public channels without token', async () => {
      const request: AuthenticationRequest = {
        socketId: 'socket-123',
        channel: 'public-announcements'
      };

      const result = await authHandler.authenticateChannel(request);

      expect(result.success).toBe(true);
      expect(result.permissions).toBeDefined();
      expect(result.permissions?.canRead).toBe(true);
      expect(result.permissions?.canWrite).toBe(false);
    });

    it('should require token for private channels', async () => {
      const request: AuthenticationRequest = {
        socketId: 'socket-123',
        channel: 'private-user-1'
      };

      const result = await authHandler.authenticateChannel(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication token required');
      expect(result.errorCode).toBe('TOKEN_REQUIRED');
    });

    it('should authenticate private channels with valid token', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
        createdAt: new Date()
      };

      mockAuthService.verifyToken.mockResolvedValue(mockUser);

      const request: AuthenticationRequest = {
        socketId: 'socket-123',
        channel: 'private-user-1',
        userId: 'user-1',
        token: 'valid-jwt-token'
      };

      const result = await authHandler.authenticateChannel(request);

      expect(result.success).toBe(true);
      expect(result.auth).toBeDefined();
      expect(result.permissions).toBeDefined();
      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid-jwt-token');
    });

    it('should reject invalid tokens', async () => {
      mockAuthService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      const request: AuthenticationRequest = {
        socketId: 'socket-123',
        channel: 'private-user-1',
        token: 'invalid-token'
      };

      const result = await authHandler.authenticateChannel(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
      expect(result.errorCode).toBe('AUTH_ERROR');
    });

    it('should handle presence channels with channel data', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
        createdAt: new Date()
      };

      mockAuthService.verifyToken.mockResolvedValue(mockUser);

      const request: AuthenticationRequest = {
        socketId: 'socket-123',
        channel: 'presence-team-1',
        userId: 'user-1',
        teamId: 'team-1',
        token: 'valid-jwt-token',
        userData: { avatar: 'avatar-url' }
      };

      const result = await authHandler.authenticateChannel(request);

      expect(result.success).toBe(true);
      expect(result.channelData).toBeDefined();
      expect(result.channelData?.userId).toBe('user-1');
      expect(result.channelData?.userInfo.name).toBe('Test User');
      expect(result.channelData?.userInfo.avatar).toBe('avatar-url');
    });

    it('should handle missing required parameters', async () => {
      const request: AuthenticationRequest = {
        socketId: '',
        channel: 'private-test'
      };

      const result = await authHandler.authenticateChannel(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required authentication parameters');
      expect(result.errorCode).toBe('INVALID_REQUEST');
    });
  });

  describe('Channel Authorization', () => {
    it('should authorize user-specific private channels', async () => {
      const result = await authHandler.authorizeChannel('private-user-123', 'user-123');

      expect(result.success).toBe(true);
      expect(result.permissions).toBeDefined();
    });

    it('should reject access to other users private channels', async () => {
      const result = await authHandler.authorizeChannel('private-user-123', 'user-456');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBeDefined();
    });

    it('should authorize team channels for team members', async () => {
      const result = await authHandler.authorizeChannel('private-team-1', 'user-1', 'team-1');

      expect(result.success).toBe(true);
    });
  });

  describe('Authorization Rules', () => {
    it('should add custom authorization rules', () => {
      const customRule = {
        pattern: 'custom-*',
        requiredRoles: ['admin'],
        customValidator: jest.fn().mockResolvedValue(true)
      };

      expect(() => {
        authHandler.addAuthorizationRule('custom-*', customRule);
      }).not.toThrow();
    });

    it('should remove authorization rules', () => {
      authHandler.addAuthorizationRule('test-*', { pattern: 'test-*' });
      
      expect(() => {
        authHandler.removeAuthorizationRule('test-*');
      }).not.toThrow();
    });
  });

  describe('Permission Checking', () => {
    it('should check read permissions', async () => {
      const canRead = await authHandler.checkPermission('public-test', 'user-1', 'read');
      expect(typeof canRead).toBe('boolean');
    });

    it('should check write permissions', async () => {
      const canWrite = await authHandler.checkPermission('private-team-1', 'user-1', 'write', 'team-1');
      expect(typeof canWrite).toBe('boolean');
    });

    it('should check invite permissions', async () => {
      const canInvite = await authHandler.checkPermission('private-team-1', 'user-1', 'invite', 'team-1');
      expect(typeof canInvite).toBe('boolean');
    });

    it('should check moderate permissions', async () => {
      const canModerate = await authHandler.checkPermission('private-admin-1', 'user-1', 'moderate');
      expect(typeof canModerate).toBe('boolean');
    });

    it('should return false for unknown actions', async () => {
      const result = await authHandler.checkPermission('test', 'user-1', 'unknown' as any);
      expect(result).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle auth service errors gracefully', async () => {
      mockAuthService.verifyToken.mockRejectedValue(new Error('Auth service error'));

      const request: AuthenticationRequest = {
        socketId: 'socket-123',
        channel: 'private-test',
        token: 'some-token'
      };

      const result = await authHandler.authenticateChannel(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
      expect(result.errorCode).toBe('AUTH_ERROR');
    });
  });
});