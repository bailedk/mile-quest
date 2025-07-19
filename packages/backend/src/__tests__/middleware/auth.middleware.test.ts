/**
 * Comprehensive tests for authentication middleware
 * Tests JWT validation, token parsing, and auth context
 */
import { authMiddleware } from '../../middleware/auth.middleware';
import { verifyToken } from '../../utils/auth/jwt.utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  createMockEvent,
  createMockContext,
  createMockToken,
  mockUsers,
  resetAllMocks,
} from '../utils/test-helpers';

// Mock the JWT utils
jest.mock('../../utils/auth/jwt.utils');

describe('Auth Middleware', () => {
  const mockContext = createMockContext();
  const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
  });

  describe('Token Validation', () => {
    it('should allow requests with valid Bearer token', async () => {
      const validToken = createMockToken(mockUsers.user1.id);
      const mockUser = {
        sub: mockUsers.user1.id,
        email: mockUsers.user1.email,
        'cognito:username': mockUsers.user1.id,
      };

      mockVerifyToken.mockResolvedValue(mockUser);

      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 200,
        body: { success: true },
      });

      const event = createMockEvent({
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
      });

      const wrappedHandler = authMiddleware(mockHandler);
      const result = await wrappedHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockVerifyToken).toHaveBeenCalledWith(validToken);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          ...event,
          user: mockUser, // Should add user to event
        }),
        mockContext
      );
    });

    it('should reject requests without Authorization header', async () => {
      const mockHandler = jest.fn();

      const event = createMockEvent({
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const wrappedHandler = authMiddleware(mockHandler);
      const result = await wrappedHandler(event, mockContext) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization header is required',
        },
      });

      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it('should reject requests with malformed Authorization header', async () => {
      const mockHandler = jest.fn();

      const invalidHeaders = [
        'InvalidToken', // Missing Bearer prefix
        'Bearer', // Missing token
        'Basic token123', // Wrong auth type
        '', // Empty header
      ];

      for (const authHeader of invalidHeaders) {
        const event = createMockEvent({
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
        });

        const wrappedHandler = authMiddleware(mockHandler);
        const result = await wrappedHandler(event, mockContext) as APIGatewayProxyResult;

        expect(result.statusCode).toBe(401);
        expect(JSON.parse(result.body)).toMatchObject({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid authorization format',
          },
        });
      }

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive Authorization header', async () => {
      const validToken = createMockToken(mockUsers.user1.id);
      const mockUser = {
        sub: mockUsers.user1.id,
        email: mockUsers.user1.email,
        'cognito:username': mockUsers.user1.id,
      };

      mockVerifyToken.mockResolvedValue(mockUser);

      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 200,
        body: { success: true },
      });

      // Test with lowercase 'authorization' header
      const event = createMockEvent({
        headers: {
          authorization: `Bearer ${validToken}`, // lowercase
          'Content-Type': 'application/json',
        },
      });

      const wrappedHandler = authMiddleware(mockHandler);
      const result = await wrappedHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockVerifyToken).toHaveBeenCalledWith(validToken);
      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('Token Verification', () => {
    it('should reject expired tokens', async () => {
      const expiredToken = createMockToken(mockUsers.user1.id);
      
      mockVerifyToken.mockRejectedValue(new Error('Token expired'));

      const mockHandler = jest.fn();

      const event = createMockEvent({
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      });

      const wrappedHandler = authMiddleware(mockHandler);
      const result = await wrappedHandler(event, mockContext) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        },
      });

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should reject malformed tokens', async () => {
      const malformedToken = 'invalid.jwt.token';
      
      mockVerifyToken.mockRejectedValue(new Error('Invalid token format'));

      const mockHandler = jest.fn();

      const event = createMockEvent({
        headers: {
          Authorization: `Bearer ${malformedToken}`,
        },
      });

      const wrappedHandler = authMiddleware(mockHandler);
      const result = await wrappedHandler(event, mockContext) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        },
      });

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should reject tokens with invalid signatures', async () => {
      const tokenWithInvalidSignature = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.invalid_signature';
      
      mockVerifyToken.mockRejectedValue(new Error('Invalid signature'));

      const mockHandler = jest.fn();

      const event = createMockEvent({
        headers: {
          Authorization: `Bearer ${tokenWithInvalidSignature}`,
        },
      });

      const wrappedHandler = authMiddleware(mockHandler);
      const result = await wrappedHandler(event, mockContext) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        },
      });

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('User Context', () => {
    it('should add user information to request context', async () => {
      const validToken = createMockToken(mockUsers.user1.id);
      const mockUser = {
        sub: mockUsers.user1.id,
        email: mockUsers.user1.email,
        'cognito:username': mockUsers.user1.id,
        name: mockUsers.user1.name,
        groups: ['users'],
      };

      mockVerifyToken.mockResolvedValue(mockUser);

      const mockHandler = jest.fn().mockImplementation((event) => {
        // Verify user is added to event
        expect(event.user).toEqual(mockUser);
        return Promise.resolve({
          statusCode: 200,
          body: { success: true, userId: event.user.sub },
        });
      });

      const event = createMockEvent({
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      const wrappedHandler = authMiddleware(mockHandler);
      const result = await wrappedHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUser,
        }),
        mockContext
      );
    });

    it('should preserve original event properties', async () => {
      const validToken = createMockToken(mockUsers.user1.id);
      const mockUser = {
        sub: mockUsers.user1.id,
        email: mockUsers.user1.email,
      };

      mockVerifyToken.mockResolvedValue(mockUser);

      const mockHandler = jest.fn().mockImplementation((event) => {
        // Verify original properties are preserved
        expect(event.httpMethod).toBe('POST');
        expect(event.path).toBe('/api/v1/test');
        expect(event.body).toBe('{"test": "data"}');
        expect(event.queryStringParameters).toEqual({ param1: 'value1' });
        
        return Promise.resolve({
          statusCode: 200,
          body: { success: true },
        });
      });

      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/api/v1/test',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
        body: '{"test": "data"}',
        queryStringParameters: {
          param1: 'value1',
        },
      });

      const wrappedHandler = authMiddleware(mockHandler);
      await wrappedHandler(event, mockContext);

      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle token verification service failures', async () => {
      const validToken = createMockToken(mockUsers.user1.id);
      
      // Mock service failure (not a token error)
      mockVerifyToken.mockRejectedValue(new Error('Service unavailable'));

      const mockHandler = jest.fn();

      const event = createMockEvent({
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      const wrappedHandler = authMiddleware(mockHandler);
      const result = await wrappedHandler(event, mockContext) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        },
      });

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should handle handler errors after successful auth', async () => {
      const validToken = createMockToken(mockUsers.user1.id);
      const mockUser = {
        sub: mockUsers.user1.id,
        email: mockUsers.user1.email,
      };

      mockVerifyToken.mockResolvedValue(mockUser);

      // Mock handler that throws an error
      const mockHandler = jest.fn().mockRejectedValue(new Error('Handler error'));

      const event = createMockEvent({
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      const wrappedHandler = authMiddleware(mockHandler);

      // Should propagate handler errors (not catch them)
      await expect(wrappedHandler(event, mockContext)).rejects.toThrow('Handler error');

      expect(mockVerifyToken).toHaveBeenCalledWith(validToken);
      expect(mockHandler).toHaveBeenCalled();
    });

    it('should return proper CORS headers in error responses', async () => {
      const mockHandler = jest.fn();

      const event = createMockEvent({
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://example.com',
        },
      });

      const wrappedHandler = authMiddleware(mockHandler);
      const result = await wrappedHandler(event, mockContext) as APIGatewayProxyResult;

      expect(result.statusCode).toBe(401);
      expect(result.headers).toMatchObject({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Content-Type': 'application/json',
      });
    });
  });

  describe('Integration with Different Event Types', () => {
    it('should work with GET requests', async () => {
      const validToken = createMockToken(mockUsers.user1.id);
      const mockUser = { sub: mockUsers.user1.id };

      mockVerifyToken.mockResolvedValue(mockUser);

      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 200,
        body: { data: [] },
      });

      const event = createMockEvent({
        httpMethod: 'GET',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
        body: null,
      });

      const wrappedHandler = authMiddleware(mockHandler);
      const result = await wrappedHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockHandler).toHaveBeenCalled();
    });

    it('should work with POST requests with body', async () => {
      const validToken = createMockToken(mockUsers.user1.id);
      const mockUser = { sub: mockUsers.user1.id };

      mockVerifyToken.mockResolvedValue(mockUser);

      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 201,
        body: { success: true },
      });

      const requestBody = JSON.stringify({
        name: 'Test Activity',
        distance: 5000,
      });

      const event = createMockEvent({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      const wrappedHandler = authMiddleware(mockHandler);
      const result = await wrappedHandler(event, mockContext);

      expect(result.statusCode).toBe(201);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: requestBody,
          user: mockUser,
        }),
        mockContext
      );
    });

    it('should work with requests containing path parameters', async () => {
      const validToken = createMockToken(mockUsers.user1.id);
      const mockUser = { sub: mockUsers.user1.id };

      mockVerifyToken.mockResolvedValue(mockUser);

      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 200,
        body: { success: true },
      });

      const event = createMockEvent({
        path: '/api/v1/activities/activity-123',
        pathParameters: {
          id: 'activity-123',
        },
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      const wrappedHandler = authMiddleware(mockHandler);
      const result = await wrappedHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          pathParameters: { id: 'activity-123' },
          user: mockUser,
        }),
        mockContext
      );
    });

    it('should work with requests containing query parameters', async () => {
      const validToken = createMockToken(mockUsers.user1.id);
      const mockUser = { sub: mockUsers.user1.id };

      mockVerifyToken.mockResolvedValue(mockUser);

      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 200,
        body: { success: true },
      });

      const event = createMockEvent({
        queryStringParameters: {
          teamId: 'team-123',
          limit: '10',
          startDate: '2025-01-01',
        },
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      const wrappedHandler = authMiddleware(mockHandler);
      const result = await wrappedHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          queryStringParameters: {
            teamId: 'team-123',
            limit: '10',
            startDate: '2025-01-01',
          },
          user: mockUser,
        }),
        mockContext
      );
    });
  });

  describe('Performance Considerations', () => {
    it('should not modify the original event object', async () => {
      const validToken = createMockToken(mockUsers.user1.id);
      const mockUser = { sub: mockUsers.user1.id };

      mockVerifyToken.mockResolvedValue(mockUser);

      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 200,
        body: { success: true },
      });

      const originalEvent = createMockEvent({
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      // Create a deep copy to verify original isn't modified
      const eventCopy = JSON.parse(JSON.stringify(originalEvent));

      const wrappedHandler = authMiddleware(mockHandler);
      await wrappedHandler(originalEvent, mockContext);

      // Original event should not have user property
      expect(originalEvent).not.toHaveProperty('user');
      expect(originalEvent).toEqual(eventCopy);

      // But handler should receive event with user
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUser,
        }),
        mockContext
      );
    });

    it('should handle multiple concurrent requests', async () => {
      const validToken1 = createMockToken(mockUsers.user1.id);
      const validToken2 = createMockToken(mockUsers.user2.id);

      const mockUser1 = { sub: mockUsers.user1.id };
      const mockUser2 = { sub: mockUsers.user2.id };

      mockVerifyToken
        .mockResolvedValueOnce(mockUser1)
        .mockResolvedValueOnce(mockUser2);

      const mockHandler = jest.fn()
        .mockResolvedValueOnce({ statusCode: 200, body: { userId: mockUsers.user1.id } })
        .mockResolvedValueOnce({ statusCode: 200, body: { userId: mockUsers.user2.id } });

      const event1 = createMockEvent({
        headers: { Authorization: `Bearer ${validToken1}` },
      });

      const event2 = createMockEvent({
        headers: { Authorization: `Bearer ${validToken2}` },
      });

      const wrappedHandler = authMiddleware(mockHandler);

      // Execute concurrently
      const [result1, result2] = await Promise.all([
        wrappedHandler(event1, mockContext),
        wrappedHandler(event2, mockContext),
      ]);

      expect(result1.statusCode).toBe(200);
      expect(result2.statusCode).toBe(200);
      expect(mockHandler).toHaveBeenCalledTimes(2);
    });
  });
});