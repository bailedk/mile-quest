import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth/jwt.utils';
import { createDefaultAuthService } from '../services/auth/factory';
import { AuthError, AuthErrorCode } from '../services/auth/types';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    emailVerified?: boolean;
    attributes?: Record<string, any>;
  };
  authService?: ReturnType<typeof createDefaultAuthService>;
}

export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1]; // Bearer <token>

  if (!token) {
    res.status(401).json({ 
      error: 'Access token required',
      code: 'MISSING_TOKEN' 
    });
    return;
  }

  try {
    // Create auth service instance for this request
    const authService = createDefaultAuthService();
    req.authService = authService;

    // Try to verify token using the auth service first
    const user = await authService.verifyToken(token);
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      attributes: user.attributes,
    };
    next();
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.code) {
        case AuthErrorCode.TOKEN_EXPIRED:
          res.status(401).json({ 
            error: 'Token expired', 
            code: 'TOKEN_EXPIRED' 
          });
          break;
        case AuthErrorCode.INVALID_TOKEN:
          res.status(403).json({ 
            error: 'Invalid token', 
            code: 'INVALID_TOKEN' 
          });
          break;
        default:
          res.status(403).json({ 
            error: 'Authentication failed', 
            code: error.code 
          });
      }
    } else {
      // Fallback to JWT utils for backwards compatibility
      try {
        const payload = verifyToken(token);
        req.user = {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
        };
        next();
      } catch {
        res.status(403).json({ 
          error: 'Invalid or expired token',
          code: 'INVALID_TOKEN' 
        });
      }
    }
  }
}

export async function optionalAuthentication(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (token) {
    try {
      // Create auth service instance for this request
      const authService = createDefaultAuthService();
      req.authService = authService;

      // Try to verify token using the auth service first
      const user = await authService.verifyToken(token);
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        attributes: user.attributes,
      };
    } catch (error) {
      // Fallback to JWT utils for backwards compatibility
      try {
        const payload = verifyToken(token);
        req.user = {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
        };
      } catch {
        // Token is invalid, but we continue without user
      }
    }
  }

  next();
}

/**
 * Middleware to require specific user attributes or roles
 */
export function requireUserAttribute(attribute: string, expectedValue?: any) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED' 
      });
      return;
    }

    const userAttribute = req.user.attributes?.[attribute];
    
    if (expectedValue !== undefined && userAttribute !== expectedValue) {
      res.status(403).json({ 
        error: `Required attribute ${attribute} with value ${expectedValue}`,
        code: 'INSUFFICIENT_PERMISSIONS' 
      });
      return;
    }

    if (expectedValue === undefined && !userAttribute) {
      res.status(403).json({ 
        error: `Required attribute ${attribute} is missing`,
        code: 'MISSING_ATTRIBUTE' 
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require verified email
 */
export function requireVerifiedEmail(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED' 
    });
    return;
  }

  if (!req.user.emailVerified) {
    res.status(403).json({ 
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED' 
    });
    return;
  }

  next();
}