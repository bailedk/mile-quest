# Authentication Service Abstraction Design

**Version**: 1.0  
**Date**: 2025-01-17  
**Agent**: Security & Privacy Agent (06)  
**Status**: In Progress

## Overview

This document defines the authentication service abstraction for Mile Quest, following the Architecture Agent's external service abstraction pattern. The design ensures vendor flexibility while providing a clean, testable interface for authentication operations.

## Core Principles

1. **No Direct Cognito Dependencies**: Components never import AWS Cognito SDK directly
2. **Business-First Interface**: Interface based on Mile Quest needs, not Cognito features
3. **Provider Agnostic**: No AWS-specific concepts in the interface
4. **Fully Testable**: Complete mock implementation for all testing scenarios
5. **Configuration Driven**: Provider selection via environment variables
6. **Zero Migration Impact**: Switching from Cognito requires no component changes

## Authentication Service Interface

### Core Types

```typescript
// types/auth.types.ts

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  tokenType: 'Bearer';
}

export interface TokenPayload {
  userId: string;
  email: string;
  emailVerified: boolean;
  exp: number;
  iat: number;
}

export interface AuthConfig {
  region?: string;
  userPoolId?: string;
  clientId?: string;
  clientSecret?: string;
}

export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_EXISTS = 'USER_EXISTS',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  INVALID_CODE = 'INVALID_CODE',
  EXPIRED_CODE = 'EXPIRED_CODE',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: AuthErrorCode,
    public originalError?: any
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
```

### Service Interface

```typescript
// types/auth-service.interface.ts

export interface AuthService {
  // Registration
  signUp(email: string, password: string, name: string): Promise<AuthUser>;
  
  // Authentication
  signIn(email: string, password: string): Promise<TokenResponse>;
  signInWithGoogle(): Promise<TokenResponse>;
  signOut(refreshToken?: string): Promise<void>;
  
  // Email Verification
  verifyEmail(email: string, code: string): Promise<void>;
  resendVerificationCode(email: string): Promise<void>;
  
  // Password Management
  forgotPassword(email: string): Promise<void>;
  resetPassword(email: string, code: string, newPassword: string): Promise<void>;
  changePassword(oldPassword: string, newPassword: string): Promise<void>;
  
  // Session Management
  getCurrentUser(): Promise<AuthUser | null>;
  refreshTokens(refreshToken: string): Promise<TokenResponse>;
  
  // Token Operations
  validateAccessToken(token: string): Promise<boolean>;
  decodeAccessToken(token: string): Promise<TokenPayload>;
  revokeRefreshToken(refreshToken: string): Promise<void>;
  
  // User Management
  updateProfile(updates: Partial<Pick<AuthUser, 'name'>>): Promise<AuthUser>;
  deleteAccount(): Promise<void>;
}
```

## Cognito Implementation

### Adapter Implementation

```typescript
// services/auth/cognito.service.ts

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute
} from 'amazon-cognito-identity-js';
import { 
  AuthService, 
  AuthUser, 
  TokenResponse, 
  AuthError, 
  AuthErrorCode,
  TokenPayload,
  AuthConfig
} from '@/types/auth.types';

export class CognitoAuthService implements AuthService {
  private userPool: CognitoUserPool;
  private currentUser: CognitoUser | null = null;

  constructor(config: AuthConfig) {
    if (!config.userPoolId || !config.clientId) {
      throw new Error('Cognito configuration missing');
    }

    this.userPool = new CognitoUserPool({
      UserPoolId: config.userPoolId,
      ClientId: config.clientId,
    });
  }

  async signUp(email: string, password: string, name: string): Promise<AuthUser> {
    const attributeList = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'name', Value: name }),
    ];

    return new Promise((resolve, reject) => {
      this.userPool.signUp(email, password, attributeList, [], (err, result) => {
        if (err) {
          reject(this.mapCognitoError(err));
          return;
        }

        if (!result) {
          reject(new AuthError('Signup failed', AuthErrorCode.UNKNOWN_ERROR));
          return;
        }

        resolve({
          id: result.userSub,
          email,
          name,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      });
    });
  }

  async signIn(email: string, password: string): Promise<TokenResponse> {
    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: this.userPool,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (result) => {
          this.currentUser = cognitoUser;
          resolve({
            accessToken: result.getAccessToken().getJwtToken(),
            refreshToken: result.getRefreshToken().getToken(),
            expiresIn: 3600, // 1 hour
            tokenType: 'Bearer'
          });
        },
        onFailure: (err) => {
          reject(this.mapCognitoError(err));
        },
        newPasswordRequired: () => {
          reject(new AuthError(
            'Password change required',
            AuthErrorCode.INVALID_CREDENTIALS
          ));
        }
      });
    });
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const cognitoUser = this.userPool.getCurrentUser();
    if (!cognitoUser) return null;

    return new Promise((resolve, reject) => {
      cognitoUser.getSession((err: any) => {
        if (err) {
          resolve(null);
          return;
        }

        cognitoUser.getUserAttributes((err, attributes) => {
          if (err || !attributes) {
            resolve(null);
            return;
          }

          const user = this.attributesToUser(cognitoUser.getUsername(), attributes);
          resolve(user);
        });
      });
    });
  }

  async refreshTokens(refreshToken: string): Promise<TokenResponse> {
    // Implementation specific to Cognito refresh token flow
    // Returns new access and refresh tokens
  }

  async validateAccessToken(token: string): Promise<boolean> {
    try {
      const payload = await this.decodeAccessToken(token);
      return payload.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  }

  async decodeAccessToken(token: string): Promise<TokenPayload> {
    // Decode and verify JWT token
    // In production, verify signature with Cognito public keys
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new AuthError('Invalid token format', AuthErrorCode.INVALID_TOKEN);
    }

    try {
      const payload = JSON.parse(atob(parts[1]));
      return {
        userId: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified,
        exp: payload.exp,
        iat: payload.iat
      };
    } catch {
      throw new AuthError('Invalid token', AuthErrorCode.INVALID_TOKEN);
    }
  }

  private mapCognitoError(error: any): AuthError {
    const errorMap: Record<string, AuthErrorCode> = {
      'NotAuthorizedException': AuthErrorCode.INVALID_CREDENTIALS,
      'UserNotFoundException': AuthErrorCode.USER_NOT_FOUND,
      'UsernameExistsException': AuthErrorCode.USER_EXISTS,
      'CodeMismatchException': AuthErrorCode.INVALID_CODE,
      'ExpiredCodeException': AuthErrorCode.EXPIRED_CODE,
      'InvalidPasswordException': AuthErrorCode.WEAK_PASSWORD,
      'UserNotConfirmedException': AuthErrorCode.EMAIL_NOT_VERIFIED,
    };

    const code = errorMap[error.code] || AuthErrorCode.UNKNOWN_ERROR;
    return new AuthError(error.message, code, error);
  }

  private attributesToUser(id: string, attributes: any[]): AuthUser {
    const getAttr = (name: string) => 
      attributes.find(a => a.Name === name)?.Value || '';

    return {
      id,
      email: getAttr('email'),
      name: getAttr('name'),
      emailVerified: getAttr('email_verified') === 'true',
      createdAt: new Date(getAttr('created_at')),
      updatedAt: new Date(getAttr('updated_at'))
    };
  }

  // Implement remaining methods...
}
```

## Mock Implementation

### Mock Service for Testing

```typescript
// services/auth/mock.service.ts

import { 
  AuthService, 
  AuthUser, 
  TokenResponse, 
  AuthError, 
  AuthErrorCode,
  TokenPayload 
} from '@/types/auth.types';

interface MockUser extends AuthUser {
  password: string;
  verificationCode?: string;
  resetCode?: string;
}

export class MockAuthService implements AuthService {
  private users: Map<string, MockUser> = new Map();
  private sessions: Map<string, string> = new Map(); // token -> userId
  private currentUserId: string | null = null;

  // Test helpers
  addMockUser(user: MockUser): void {
    this.users.set(user.email, user);
  }

  clearMockData(): void {
    this.users.clear();
    this.sessions.clear();
    this.currentUserId = null;
  }

  getMockUsers(): MockUser[] {
    return Array.from(this.users.values());
  }

  async signUp(email: string, password: string, name: string): Promise<AuthUser> {
    if (this.users.has(email)) {
      throw new AuthError('User already exists', AuthErrorCode.USER_EXISTS);
    }

    const user: MockUser = {
      id: `user_${Date.now()}`,
      email,
      name,
      password,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      verificationCode: '123456'
    };

    this.users.set(email, user);

    const { password: _, verificationCode: __, ...authUser } = user;
    return authUser;
  }

  async signIn(email: string, password: string): Promise<TokenResponse> {
    const user = this.users.get(email);
    
    if (!user) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    if (user.password !== password) {
      throw new AuthError('Invalid credentials', AuthErrorCode.INVALID_CREDENTIALS);
    }

    if (!user.emailVerified) {
      throw new AuthError('Email not verified', AuthErrorCode.EMAIL_NOT_VERIFIED);
    }

    const token = `mock_token_${Date.now()}`;
    const refreshToken = `mock_refresh_${Date.now()}`;
    
    this.sessions.set(token, user.id);
    this.currentUserId = user.id;

    return {
      accessToken: token,
      refreshToken,
      expiresIn: 3600,
      tokenType: 'Bearer'
    };
  }

  async verifyEmail(email: string, code: string): Promise<void> {
    const user = this.users.get(email);
    
    if (!user) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    if (user.verificationCode !== code) {
      throw new AuthError('Invalid code', AuthErrorCode.INVALID_CODE);
    }

    user.emailVerified = true;
    user.verificationCode = undefined;
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    if (!this.currentUserId) return null;

    const user = Array.from(this.users.values())
      .find(u => u.id === this.currentUserId);

    if (!user) return null;

    const { password: _, verificationCode: __, resetCode: ___, ...authUser } = user;
    return authUser;
  }

  async validateAccessToken(token: string): Promise<boolean> {
    return this.sessions.has(token);
  }

  async decodeAccessToken(token: string): Promise<TokenPayload> {
    const userId = this.sessions.get(token);
    if (!userId) {
      throw new AuthError('Invalid token', AuthErrorCode.INVALID_TOKEN);
    }

    const user = Array.from(this.users.values()).find(u => u.id === userId);
    if (!user) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    return {
      userId: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      exp: Date.now() / 1000 + 3600,
      iat: Date.now() / 1000
    };
  }

  // Implement remaining methods...
}
```

## Service Factory

### Factory Implementation

```typescript
// services/auth/factory.ts

import { AuthService } from '@/types/auth.types';
import { CognitoAuthService } from './cognito.service';
import { MockAuthService } from './mock.service';

let authServiceInstance: AuthService | null = null;

export function createAuthService(config?: any): AuthService {
  if (authServiceInstance) {
    return authServiceInstance;
  }

  const provider = process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'cognito';

  switch (provider) {
    case 'cognito':
      authServiceInstance = new CognitoAuthService({
        region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
        userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
        clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
        ...config
      });
      break;

    case 'mock':
      authServiceInstance = new MockAuthService();
      break;

    default:
      throw new Error(`Unknown auth provider: ${provider}`);
  }

  return authServiceInstance;
}

export function resetAuthService(): void {
  authServiceInstance = null;
}
```

## Usage in Components

### React Hook Example

```typescript
// hooks/useAuth.ts

import { useState, useEffect } from 'react';
import { createAuthService } from '@/services/auth/factory';
import { AuthUser, TokenResponse } from '@/types/auth.types';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const authService = createAuthService();

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    const response = await authService.signIn(email, password);
    await storeTokens(response);
    await loadCurrentUser();
  };

  const signOut = async (): Promise<void> => {
    const refreshToken = await getStoredRefreshToken();
    await authService.signOut(refreshToken);
    await clearTokens();
    setUser(null);
  };

  return {
    user,
    loading,
    signIn,
    signOut,
    // ... other auth methods
  };
}
```

### API Route Example

```typescript
// app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createAuthService } from '@/services/auth/factory';
import { AuthError, AuthErrorCode } from '@/types/auth.types';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Missing credentials' } },
        { status: 400 }
      );
    }

    const authService = createAuthService();
    const tokens = await authService.signIn(email, password);

    return NextResponse.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const statusMap: Record<AuthErrorCode, number> = {
        [AuthErrorCode.INVALID_CREDENTIALS]: 401,
        [AuthErrorCode.USER_NOT_FOUND]: 404,
        [AuthErrorCode.EMAIL_NOT_VERIFIED]: 403,
        // ... other mappings
      };

      return NextResponse.json(
        { 
          success: false, 
          error: { code: error.code, message: error.message } 
        },
        { status: statusMap[error.code] || 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } },
      { status: 500 }
    );
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
// __tests__/services/auth/mock.service.test.ts

import { MockAuthService } from '@/services/auth/mock.service';
import { AuthErrorCode } from '@/types/auth.types';

describe('MockAuthService', () => {
  let authService: MockAuthService;

  beforeEach(() => {
    authService = new MockAuthService();
  });

  afterEach(() => {
    authService.clearMockData();
  });

  describe('signUp', () => {
    it('should create a new user', async () => {
      const user = await authService.signUp('test@example.com', 'password123', 'Test User');
      
      expect(user).toMatchObject({
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: false
      });
      expect(user.id).toBeDefined();
    });

    it('should throw error if user exists', async () => {
      await authService.signUp('test@example.com', 'password123', 'Test User');
      
      await expect(
        authService.signUp('test@example.com', 'password456', 'Another User')
      ).rejects.toThrow(AuthErrorCode.USER_EXISTS);
    });
  });

  describe('signIn', () => {
    beforeEach(async () => {
      const user = await authService.signUp('test@example.com', 'password123', 'Test User');
      await authService.verifyEmail('test@example.com', '123456');
    });

    it('should sign in with valid credentials', async () => {
      const tokens = await authService.signIn('test@example.com', 'password123');
      
      expect(tokens).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: 3600
      });
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
    });

    it('should throw error with invalid password', async () => {
      await expect(
        authService.signIn('test@example.com', 'wrongpassword')
      ).rejects.toThrow(AuthErrorCode.INVALID_CREDENTIALS);
    });
  });
});
```

### Integration Tests

```typescript
// __tests__/api/auth/login.test.ts

import { createMocks } from 'node-mocks-http';
import { POST } from '@/app/api/auth/login/route';

describe('/api/auth/login', () => {
  it('should return tokens for valid credentials', async () => {
    const { req } = createMocks({
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'password123'
      }
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.accessToken).toBeDefined();
  });

  it('should return 401 for invalid credentials', async () => {
    const { req } = createMocks({
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'wrongpassword'
      }
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INVALID_CREDENTIALS');
  });
});
```

## Migration Guide

### Switching Auth Providers

To switch from Cognito to another provider (e.g., Auth0):

1. **Implement New Adapter**
   ```typescript
   // services/auth/auth0.service.ts
   export class Auth0AuthService implements AuthService {
     // Implement all AuthService methods
   }
   ```

2. **Update Factory**
   ```typescript
   // services/auth/factory.ts
   case 'auth0':
     authServiceInstance = new Auth0AuthService(config);
     break;
   ```

3. **Update Environment**
   ```bash
   NEXT_PUBLIC_AUTH_PROVIDER=auth0
   NEXT_PUBLIC_AUTH0_DOMAIN=your-domain
   NEXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id
   ```

4. **Data Migration**
   - Export users from Cognito
   - Import to new provider
   - Map user IDs if needed

5. **Test Thoroughly**
   - Run all auth tests
   - Test in staging environment
   - Gradual rollout with feature flags

## Security Considerations

### Token Storage
- Access tokens: In memory only
- Refresh tokens: Secure HTTP-only cookies
- Never store in localStorage

### Token Validation
- Validate on every API request
- Check expiration
- Verify signature (in production)

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one number
- Special characters recommended

### Rate Limiting
- Applied per auth endpoint
- Track by IP for unauthenticated
- Track by user ID for authenticated

## Monitoring

### Key Metrics
- Sign up success rate
- Sign in success rate
- Token refresh rate
- Failed authentication attempts
- Average authentication time

### Alerts
- High failure rate (> 10%)
- Unusual spike in signups
- Multiple failed attempts from same IP
- Token validation errors

## Conclusion

This authentication service abstraction provides Mile Quest with:
- Complete vendor independence
- Easy testing with mock implementation
- Clean migration path between providers
- Type-safe authentication operations
- Consistent error handling

The abstraction follows all Architecture Agent guidelines and integrates seamlessly with the API contracts defined by the API Designer Agent.