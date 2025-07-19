import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyToken, 
  decodeToken, 
  generateTokens 
} from '../jwt.utils';
import { AuthUser } from '@mile-quest/shared';

// Mock jsonwebtoken
jest.mock('jsonwebtoken');

describe('JWT Utils', () => {
  const mockToken = 'mock.jwt.token';
  const mockSecret = 'test-secret';
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = mockSecret;
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', async () => {
      const mockDecodedToken = {
        sub: mockUserId,
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);

      const result = await verifyToken(mockToken);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, mockSecret);
      expect(result).toEqual(mockDecodedToken);
    });

    it('should throw an error for invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(verifyToken(mockToken)).rejects.toThrow('Invalid token');
    });

    it('should throw an error for expired token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.TokenExpiredError('jwt expired', new Date());
      });

      await expect(verifyToken(mockToken)).rejects.toThrow('jwt expired');
    });
  });

  describe('extractUserId', () => {
    it('should extract user ID from token with sub claim', async () => {
      const mockDecodedToken = {
        sub: mockUserId,
        email: 'test@example.com',
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);

      const result = await extractUserId(mockToken);

      expect(result).toBe(mockUserId);
    });

    it('should extract user ID from token with userId claim', async () => {
      const mockDecodedToken = {
        userId: mockUserId,
        email: 'test@example.com',
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);

      const result = await extractUserId(mockToken);

      expect(result).toBe(mockUserId);
    });

    it('should throw an error if no user ID found in token', async () => {
      const mockDecodedToken = {
        email: 'test@example.com',
        // No sub or userId
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);

      await expect(extractUserId(mockToken)).rejects.toThrow('No user ID found in token');
    });

    it('should throw an error for invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(extractUserId(mockToken)).rejects.toThrow('Invalid token');
    });
  });

  describe('generateMockToken', () => {
    it('should generate a mock token for testing', () => {
      const userId = 'test-user-123';
      const mockToken = 'generated.mock.token';

      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = generateMockToken(userId);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          sub: userId,
          email: `${userId}@example.com`,
          iat: expect.any(Number),
          exp: expect.any(Number),
        },
        mockSecret,
        { algorithm: 'HS256' }
      );
      expect(result).toBe(mockToken);
    });

    it('should include custom claims if provided', () => {
      const userId = 'test-user-123';
      const customClaims = {
        role: 'admin',
        permissions: ['read', 'write'],
      };
      const mockToken = 'generated.mock.token';

      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = generateMockToken(userId, customClaims);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          sub: userId,
          email: `${userId}@example.com`,
          iat: expect.any(Number),
          exp: expect.any(Number),
          ...customClaims,
        },
        mockSecret,
        { algorithm: 'HS256' }
      );
      expect(result).toBe(mockToken);
    });
  });
});