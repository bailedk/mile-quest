# AWS Service Abstractions

This directory contains provider-agnostic abstractions for all external services used in Mile Quest. These abstractions ensure vendor flexibility, improve testability, and allow for easy migration between service providers.

## Architecture Overview

```
services/
├── aws/
│   └── base-service.ts      # Base class for all AWS services
├── auth/                    # Authentication service abstraction
│   ├── types.ts            # Interfaces and types
│   ├── cognito.service.ts  # AWS Cognito implementation
│   ├── mock.service.ts     # Mock implementation for testing
│   ├── factory.ts          # Service factory
│   └── index.ts            # Public exports
├── websocket/              # WebSocket service abstraction
│   ├── types.ts            # Interfaces and types
│   ├── pusher.service.ts   # Pusher implementation
│   ├── mock.service.ts     # Mock implementation
│   ├── factory.ts          # Service factory
│   └── index.ts            # Public exports
├── email/                  # Email service abstraction
│   ├── types.ts            # Interfaces and types
│   ├── ses.service.ts      # AWS SES implementation
│   ├── mock.service.ts     # Mock implementation
│   ├── factory.ts          # Service factory
│   └── index.ts            # Public exports
├── config/                 # Configuration service abstraction
│   ├── types.ts            # Interfaces and types
│   ├── ssm.service.ts      # AWS SSM Parameter Store implementation
│   ├── mock.service.ts     # Mock implementation
│   ├── factory.ts          # Service factory
│   └── index.ts            # Public exports
└── index.ts                # Main service initialization and registry
```

## Core Principles

1. **No Direct Dependencies**: Components never import external service SDKs directly
2. **Interface First**: Interfaces are defined based on business needs, not provider capabilities
3. **Provider Agnostic**: Interfaces don't leak provider-specific concepts
4. **Testable**: Every service has a mock implementation
5. **Configuration Driven**: Provider selection via environment variables
6. **Zero Migration Impact**: Switching providers requires no component changes

## Usage

### Initializing Services

Services should be initialized once at application startup:

```typescript
import { initializeServices } from '@/services';

// Initialize all services based on environment configuration
await initializeServices();
```

### Using Services in Handlers

```typescript
import { getService, AuthService } from '@/services';

export async function handler(event: APIGatewayProxyEvent) {
  // Get service from registry
  const authService = getService<AuthService>('auth');
  
  // Use the service
  const session = await authService.signIn({
    email: 'user@example.com',
    password: 'password123'
  });
  
  return {
    statusCode: 200,
    body: JSON.stringify({ session })
  };
}
```

### Error Handling

Each service defines its own error types and codes:

```typescript
import { AuthError, AuthErrorCode } from '@/services';

try {
  await authService.signIn(credentials);
} catch (error) {
  if (error instanceof AuthError) {
    switch (error.code) {
      case AuthErrorCode.INVALID_CREDENTIALS:
        // Handle invalid credentials
        break;
      case AuthErrorCode.USER_NOT_CONFIRMED:
        // Handle unconfirmed user
        break;
    }
  }
}
```

## Service Registry

The service registry provides centralized access to all services:

```typescript
import { getServiceRegistry } from '@/services';

const registry = getServiceRegistry();

// Register a service
registry.register('myService', myServiceInstance);

// Get a service
const service = registry.get<MyService>('myService');

// Health check all services
const healthStatus = await registry.healthCheck();
```

## Configuration

Services are configured via environment variables:

```bash
# Authentication
AUTH_PROVIDER=cognito              # or 'mock', 'auth0', 'supabase'
COGNITO_USER_POOL_ID=us-east-1_xxx
COGNITO_CLIENT_ID=xxx

# WebSocket
WEBSOCKET_PROVIDER=pusher          # or 'mock', 'apigateway'
PUSHER_APP_ID=xxx
NEXT_PUBLIC_PUSHER_KEY=xxx
PUSHER_SECRET=xxx
PUSHER_CLUSTER=us2

# Email
EMAIL_PROVIDER=ses                 # or 'mock', 'sendgrid', 'postmark'
DEFAULT_FROM_EMAIL=noreply@mile-quest.com
SES_SANDBOX=true

# Configuration
CONFIG_PROVIDER=ssm                # or 'mock', 'vault', 'consul'
```

## Testing

### Using Mock Services

Mock services are automatically used in test environments:

```typescript
// In your test setup
process.env.NODE_ENV = 'test';
process.env.AUTH_PROVIDER = 'mock';
process.env.WEBSOCKET_PROVIDER = 'mock';
process.env.EMAIL_PROVIDER = 'mock';
process.env.CONFIG_PROVIDER = 'mock';

// Mock services will be used automatically
const authService = createAuthService(); // Returns MockAuthService
```

### Configuring Mock Behavior

```typescript
import { MockAuthService } from '@/services';

const mockAuth = createAuthServiceWithProvider('mock') as MockAuthService;

// Add test data
mockAuth.addMockUser({
  user: { id: '123', email: 'test@example.com', name: 'Test User' },
  password: 'password123',
  confirmed: true
});

// Simulate delays
mockAuth.setMockDelay(100);

// Simulate failures
mockAuth.failNext(new AuthError('Network error', AuthErrorCode.NETWORK_ERROR));
```

## Adding New Services

To add a new service abstraction:

1. Create a new directory under `services/`
2. Define the interface in `types.ts`
3. Implement provider adapters (e.g., `aws.service.ts`)
4. Create a mock implementation in `mock.service.ts`
5. Create a factory in `factory.ts`
6. Export everything in `index.ts`
7. Register in main `services/index.ts`

Example structure:
```typescript
// types.ts
export interface MyService {
  doSomething(param: string): Promise<Result>;
}

// aws.service.ts
export class AWSMyService extends BaseAWSService implements MyService {
  async doSomething(param: string): Promise<Result> {
    // AWS-specific implementation
  }
}

// factory.ts
export function createMyService(): MyService {
  const provider = process.env.MY_SERVICE_PROVIDER || 'aws';
  switch (provider) {
    case 'aws': return new AWSMyService();
    case 'mock': return new MockMyService();
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}
```

## Migration Strategy

When migrating between providers:

1. Implement the new provider adapter
2. Test thoroughly with feature flags
3. Gradually roll out using environment variables
4. Monitor metrics and errors
5. Complete migration by updating environment config

No application code changes required!

## Benefits

- **Vendor Flexibility**: Switch providers without code changes
- **Cost Optimization**: Move to cheaper providers as you scale
- **Risk Mitigation**: No vendor lock-in
- **Testing**: Easy to test with mocks
- **Consistency**: Standard patterns across all services
- **Maintenance**: Centralized provider logic