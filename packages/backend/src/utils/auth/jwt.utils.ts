import jwt from 'jsonwebtoken';
import { AuthUser } from '@mile-quest/shared';
import { UnauthorizedError } from '../lambda-handler';

interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

// Security: JWT_SECRET must be set in production environments
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  console.warn('WARNING: JWT_SECRET not set. Using default value for development only.');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-do-not-use-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

export function generateAccessToken(user: AuthUser): string {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function generateRefreshToken(user: AuthUser): string {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

export function verifyToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
}

export function generateTokens(user: AuthUser) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  
  return {
    accessToken,
    refreshToken,
    idToken: accessToken, // In a real app, this would be different
    expiresIn: 3600, // 1 hour in seconds
    tokenType: 'Bearer',
  };
}

export function isAuthError(error: any): boolean {
  return (
    error instanceof UnauthorizedError ||
    error.message === 'No token provided' ||
    error.message === 'Invalid or expired token'
  );
}