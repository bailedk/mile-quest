/**
 * Unit tests for auth middleware
 */

import { Request, Response, NextFunction } from 'express';
import {
  authenticateToken,
  optionalAuthentication,
  requireUserAttribute,
  requireVerifiedEmail,
  AuthRequest,
} from '../auth.middleware';
import { AuthError, AuthErrorCode } from '../services/auth/types';
import { MockAuthService } from '../services/auth/mock.service';

// Mock the auth factory
jest.mock('../services/auth/factory', () => ({
  createDefaultAuthService: jest.fn(),
}));

import { createDefaultAuthService } from '../services/auth/factory';
const mockCreateDefaultAuthService = createDefaultAuthService as jest.MockedFunction<typeof createDefaultAuthService>;

describe('Auth Middleware', () => {
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;
  let next: NextFunction;
  let mockAuthService: MockAuthService;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    
    mockAuthService = new MockAuthService();
    mockCreateDefaultAuthService.mockReturnValue(mockAuthService);
  });

  describe('authenticateToken', () => {
    it('should return 401 when no token provided', async () => {
      await authenticateToken(req as AuthRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access token required',
        code: 'MISSING_TOKEN',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should authenticate valid token successfully', async () => {
      req.headers = {
        authorization: 'Bearer valid-token',
      };

      const testUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
        createdAt: new Date(),
        attributes: { role: 'user' },
      };

      jest.spyOn(mockAuthService, 'verifyToken').mockResolvedValue(testUser);

      await authenticateToken(req as AuthRequest, res as Response, next);

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(req.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
        attributes: { role: 'user' },
      });
      expect(req.authService).toBe(mockAuthService);
      expect(next).toHaveBeenCalled();
    });

    it('should handle expired token error', async () => {
      req.headers = {
        authorization: 'Bearer expired-token',
      };

      const authError = new AuthError('Token expired', AuthErrorCode.TOKEN_EXPIRED);
      jest.spyOn(mockAuthService, 'verifyToken').mockRejectedValue(authError);

      await authenticateToken(req as AuthRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle invalid token error', async () => {
      req.headers = {
        authorization: 'Bearer invalid-token',
      };

      const authError = new AuthError('Invalid token', AuthErrorCode.INVALID_TOKEN);
      jest.spyOn(mockAuthService, 'verifyToken').mockRejectedValue(authError);

      await authenticateToken(req as AuthRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should fallback to JWT utils for non-auth errors', async () => {
      req.headers = {
        authorization: 'Bearer fallback-token',
      };

      // Mock auth service to throw non-auth error
      jest.spyOn(mockAuthService, 'verifyToken').mockRejectedValue(new Error('Service error'));

      // Mock JWT utils
      const mockJwtUtils = require('../utils/auth/jwt.utils');
      mockJwtUtils.verifyToken = jest.fn().mockReturnValue({
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });

      await authenticateToken(req as AuthRequest, res as Response, next);

      expect(req.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });
      expect(next).toHaveBeenCalled();
    });

    it('should handle JWT utils failure', async () => {
      req.headers = {
        authorization: 'Bearer bad-token',
      };

      // Mock both services to fail
      jest.spyOn(mockAuthService, 'verifyToken').mockRejectedValue(new Error('Service error'));
      
      const mockJwtUtils = require('../utils/auth/jwt.utils');
      mockJwtUtils.verifyToken = jest.fn().mockImplementation(() => {
        throw new Error('JWT error');
      });

      await authenticateToken(req as AuthRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuthentication', () => {
    it('should continue without user when no token provided', async () => {
      await optionalAuthentication(req as AuthRequest, res as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should authenticate when valid token provided', async () => {
      req.headers = {
        authorization: 'Bearer valid-token',
      };

      const testUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
        createdAt: new Date(),
        attributes: { role: 'user' },
      };

      jest.spyOn(mockAuthService, 'verifyToken').mockResolvedValue(testUser);

      await optionalAuthentication(req as AuthRequest, res as Response, next);

      expect(req.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
        attributes: { role: 'user' },
      });
      expect(next).toHaveBeenCalled();
    });

    it('should continue without user when token is invalid', async () => {
      req.headers = {
        authorization: 'Bearer invalid-token',
      };

      const authError = new AuthError('Invalid token', AuthErrorCode.INVALID_TOKEN);
      jest.spyOn(mockAuthService, 'verifyToken').mockRejectedValue(authError);

      const mockJwtUtils = require('../utils/auth/jwt.utils');
      mockJwtUtils.verifyToken = jest.fn().mockImplementation(() => {
        throw new Error('JWT error');
      });

      await optionalAuthentication(req as AuthRequest, res as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireUserAttribute', () => {
    it('should return 401 when no user is authenticated', () => {
      const middleware = requireUserAttribute('role');
      
      middleware(req as AuthRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when required attribute is missing', () => {
      req.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        attributes: {},
      };

      const middleware = requireUserAttribute('role');
      
      middleware(req as AuthRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Required attribute role is missing',
        code: 'MISSING_ATTRIBUTE',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when attribute value does not match', () => {
      req.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        attributes: { role: 'user' },
      };

      const middleware = requireUserAttribute('role', 'admin');
      
      middleware(req as AuthRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Required attribute role with value admin',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should continue when attribute exists without expected value', () => {
      req.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        attributes: { role: 'user' },
      };

      const middleware = requireUserAttribute('role');
      
      middleware(req as AuthRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should continue when attribute matches expected value', () => {
      req.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        attributes: { role: 'admin' },
      };

      const middleware = requireUserAttribute('role', 'admin');
      
      middleware(req as AuthRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireVerifiedEmail', () => {
    it('should return 401 when no user is authenticated', () => {
      requireVerifiedEmail(req as AuthRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when email is not verified', () => {
      req.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: false,
      };

      requireVerifiedEmail(req as AuthRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Email verification required',
        code: 'EMAIL_NOT_VERIFIED',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should continue when email is verified', () => {
      req.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
      };

      requireVerifiedEmail(req as AuthRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });
});