# External Service Abstraction Pattern

## Overview

All external services in Mile Quest MUST be abstracted behind service interfaces to ensure vendor flexibility, testability, and future scalability. This document defines the standard pattern for abstracting external services.

## Core Principles

1. **No Direct Dependencies**: Components should never import external service SDKs directly
2. **Interface First**: Define the interface based on business needs, not provider capabilities
3. **Provider Agnostic**: Interfaces should not leak provider-specific concepts
4. **Testable**: Every service must have a mock implementation
5. **Configuration Driven**: Provider selection via environment variables
6. **Zero Migration Impact**: Switching providers should require no component changes

## Standard Abstraction Pattern

### 1. Define Business Interface

```typescript
// types/[service-name].types.ts
export interface [ServiceName]Service {
  // Only methods the business needs
  // No provider-specific parameters
  // Clear, consistent naming
}
```

### 2. Implement Provider Adapter

```typescript
// services/[service-name]/[provider].service.ts
export class [Provider][ServiceName]Service implements [ServiceName]Service {
  // Adapts provider SDK to business interface
  // Handles provider-specific configuration
  // Manages provider lifecycle
}
```

### 3. Create Service Factory

```typescript
// services/[service-name]/factory.ts
export function create[ServiceName]Service(
  config?: Partial<[ServiceName]Config>
): [ServiceName]Service {
  const provider = process.env.NEXT_PUBLIC_[SERVICE]_PROVIDER;
  
  switch (provider) {
    case 'provider1':
      return new Provider1[ServiceName]Service(config);
    case 'provider2':
      return new Provider2[ServiceName]Service(config);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
```

### 4. Mock Implementation

```typescript
// services/[service-name]/mock.service.ts
export class Mock[ServiceName]Service implements [ServiceName]Service {
  // Implements full interface
  // Provides test helpers
  // Simulates real behavior
}
```

## Current External Services

### 1. WebSocket Service (Pusher → API Gateway)
- **Interface**: `WebSocketService`
- **Current**: Pusher
- **Future**: API Gateway WebSocket
- **Migration Trigger**: >$100/month costs
- **Status**: ✅ Abstracted

### 2. Authentication Service (Cognito → ?)
- **Interface**: `AuthService`
- **Current**: AWS Cognito
- **Future**: Auth0, Supabase Auth, Custom
- **Migration Trigger**: Need for features Cognito doesn't support
- **Status**: 🔄 Needs abstraction

### 3. Email Service (SES → ?)
- **Interface**: `EmailService`
- **Current**: AWS SES (planned)
- **Future**: SendGrid, Postmark, Resend
- **Migration Trigger**: Deliverability issues or cost
- **Status**: 📋 Not yet implemented

### 4. Maps Service (Mapbox → ?)
- **Interface**: `MapsService`
- **Current**: Mapbox (planned)
- **Future**: Google Maps, OpenStreetMap
- **Migration Trigger**: Cost or API limits
- **Status**: 📋 Not yet implemented

### 5. Analytics Service (GA4 → ?)
- **Interface**: `AnalyticsService`
- **Current**: Google Analytics 4 (planned)
- **Future**: Mixpanel, Amplitude, PostHog
- **Migration Trigger**: Privacy requirements or features
- **Status**: 📋 Not yet implemented

## Implementation Examples

### Authentication Service Abstraction

```typescript
// types/auth.types.ts
export interface AuthService {
  // Authentication
  signIn(email: string, password: string): Promise<AuthUser>;
  signInWithGoogle(): Promise<AuthUser>;
  signOut(): Promise<void>;
  
  // Registration
  signUp(email: string, password: string, name: string): Promise<AuthUser>;
  confirmEmail(email: string, code: string): Promise<void>;
  
  // Password Management
  resetPassword(email: string): Promise<void>;
  confirmResetPassword(email: string, code: string, newPassword: string): Promise<void>;
  
  // Session Management
  getCurrentUser(): Promise<AuthUser | null>;
  refreshSession(): Promise<void>;
  
  // Token Management
  getIdToken(): Promise<string>;
  getAccessToken(): Promise<string>;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: Date;
}
```

### Cognito Implementation

```typescript
// services/auth/cognito.service.ts
import { 
  CognitoUserPool, 
  CognitoUser, 
  AuthenticationDetails 
} from 'amazon-cognito-identity-js';

export class CognitoAuthService implements AuthService {
  private userPool: CognitoUserPool;
  
  constructor(config: AuthConfig) {
    this.userPool = new CognitoUserPool({
      UserPoolId: config.userPoolId,
      ClientId: config.clientId,
    });
  }
  
  async signIn(email: string, password: string): Promise<AuthUser> {
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
          resolve(this.mapCognitoUser(cognitoUser));
        },
        onFailure: (err) => {
          reject(this.mapCognitoError(err));
        },
      });
    });
  }
  
  private mapCognitoUser(cognitoUser: any): AuthUser {
    // Map Cognito user to our interface
  }
  
  private mapCognitoError(error: any): Error {
    // Map Cognito errors to standard errors
  }
  
  // ... implement other methods
}
```

### Email Service Abstraction

```typescript
// types/email.types.ts
export interface EmailService {
  sendEmail(params: SendEmailParams): Promise<void>;
  sendBulkEmails(params: SendBulkEmailParams): Promise<void>;
  validateEmail(email: string): Promise<boolean>;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

// services/email/ses.service.ts
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export class SESEmailService implements EmailService {
  private client: SESClient;
  
  constructor(config: EmailConfig) {
    this.client = new SESClient({ region: config.region });
  }
  
  async sendEmail(params: SendEmailParams): Promise<void> {
    const command = new SendEmailCommand({
      Source: params.from || process.env.DEFAULT_FROM_EMAIL,
      Destination: {
        ToAddresses: Array.isArray(params.to) ? params.to : [params.to],
      },
      Message: {
        Subject: { Data: params.subject },
        Body: {
          Html: params.html ? { Data: params.html } : undefined,
          Text: params.text ? { Data: params.text } : undefined,
        },
      },
    });
    
    await this.client.send(command);
  }
}
```

## Testing Strategy

### 1. Unit Tests with Mocks

```typescript
// __tests__/auth.test.ts
describe('Authentication Flow', () => {
  let authService: MockAuthService;
  
  beforeEach(() => {
    authService = new MockAuthService();
  });
  
  test('successful sign in', async () => {
    authService.mockSignInResponse({
      id: '123',
      email: 'test@example.com',
      name: 'Test User',
    });
    
    const user = await authService.signIn('test@example.com', 'password');
    expect(user.email).toBe('test@example.com');
  });
});
```

### 2. Integration Tests

```typescript
// __tests__/integration/auth.test.ts
describe('Auth Service Integration', () => {
  let authService: AuthService;
  
  beforeEach(() => {
    authService = createAuthService({
      // Test configuration
    });
  });
  
  test('real authentication flow', async () => {
    // Test against actual service in test environment
  });
});
```

## Migration Process

### 1. Preparation Phase
- Implement new provider adapter
- Test thoroughly in development
- Compare behavior with current provider
- Load test if necessary

### 2. Gradual Rollout
```typescript
// Feature flag approach
export function createAuthService(): AuthService {
  const userId = getCurrentUserId();
  const provider = getFeatureFlag('auth-provider', userId);
  
  switch (provider) {
    case 'cognito':
      return new CognitoAuthService(config);
    case 'auth0':
      return new Auth0AuthService(config);
  }
}
```

### 3. Monitoring
- Track error rates by provider
- Monitor performance metrics
- Gather user feedback
- Compare costs

### 4. Cutover
- Gradually increase rollout percentage
- Monitor closely
- Have rollback plan ready
- Update documentation

## Environment Configuration

```bash
# .env.local
# WebSocket Provider
NEXT_PUBLIC_WEBSOCKET_PROVIDER=pusher
NEXT_PUBLIC_PUSHER_KEY=your-key
PUSHER_SECRET=your-secret

# Auth Provider
NEXT_PUBLIC_AUTH_PROVIDER=cognito
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxx

# Email Provider
EMAIL_PROVIDER=ses
AWS_SES_REGION=us-east-1
DEFAULT_FROM_EMAIL=noreply@mile-quest.com

# Maps Provider
NEXT_PUBLIC_MAPS_PROVIDER=mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk_xxxxx

# Analytics Provider
NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXX
```

## Best Practices

### 1. Interface Design
- Start with business requirements, not provider features
- Keep interfaces minimal and focused
- Use standard types (no provider-specific types)
- Version interfaces if breaking changes needed

### 2. Error Handling
```typescript
// Define standard errors
export class AuthError extends Error {
  constructor(
    message: string,
    public code: AuthErrorCode,
    public originalError?: any
  ) {
    super(message);
  }
}

export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  // etc.
}
```

### 3. Configuration
- Use environment variables for provider selection
- Validate configuration at startup
- Provide sensible defaults
- Document all configuration options

### 4. Monitoring
```typescript
// Add instrumentation to all services
export class InstrumentedAuthService implements AuthService {
  constructor(
    private service: AuthService,
    private metrics: MetricsService
  ) {}
  
  async signIn(email: string, password: string): Promise<AuthUser> {
    const start = Date.now();
    try {
      const user = await this.service.signIn(email, password);
      this.metrics.recordSuccess('auth.signIn', Date.now() - start);
      return user;
    } catch (error) {
      this.metrics.recordError('auth.signIn', error);
      throw error;
    }
  }
}
```

## Compliance Checklist

Before using any external service directly:

- [ ] Business interface defined
- [ ] At least one provider implementation
- [ ] Mock implementation for testing
- [ ] Factory with environment-based selection
- [ ] Unit tests with mock
- [ ] Integration tests (if applicable)
- [ ] Error mapping to standard errors
- [ ] Documentation of configuration
- [ ] Migration strategy documented
- [ ] Cost analysis completed
- [ ] Security review completed

## Benefits

1. **Vendor Flexibility**: Switch providers without code changes
2. **Cost Optimization**: Move to cheaper providers as you scale
3. **Risk Mitigation**: No vendor lock-in
4. **Testing**: Easy to test with mocks
5. **Consistency**: Standard patterns across all services
6. **Maintenance**: Centralized provider logic

## Anti-Patterns to Avoid

1. **Direct SDK Usage**: Never import provider SDKs in components
2. **Leaky Abstractions**: Provider-specific types in interfaces
3. **Over-Engineering**: Don't add features you don't need
4. **Under-Abstracting**: Ensure complete abstraction
5. **Missing Mocks**: Every service needs a mock

## Conclusion

By following this abstraction pattern for all external services, Mile Quest maintains maximum flexibility for future growth and cost optimization. The small upfront investment in abstractions pays dividends in reduced migration costs and improved testability.