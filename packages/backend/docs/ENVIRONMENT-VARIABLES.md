# Backend Environment Variables Documentation

## Overview

The Mile Quest backend uses environment variables for configuration management. All environment variables are centrally managed through the `/packages/backend/src/config/environment.ts` file, which provides type safety and validation.

## Configuration Architecture

### Central Configuration Module

```typescript
// packages/backend/src/config/environment.ts
interface EnvironmentConfig {
  // Core settings
  nodeEnv: 'development' | 'production' | 'test'
  port: number
  databaseUrl: string
  jwtSecret: string
  
  // AWS settings
  awsRegion: string
  cognitoUserPoolId?: string
  cognitoClientId?: string
  
  // External services
  pusherAppId?: string
  pusherKey?: string
  pusherSecret?: string
  pusherCluster?: string
  mapboxAccessToken?: string
  
  // Feature flags
  enableRealTime: boolean
  enableOfflineSync: boolean
  
  // API settings
  corsOrigin: string
  stage: 'dev' | 'staging' | 'production'
  
  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  
  // Service implementations
  serviceImplementations?: 'real' | 'mock'
}
```

### Access Pattern

Environment variables are accessed through a singleton configuration object:

```typescript
import { config } from '@/config/environment';

// Usage
const dbUrl = config.databaseUrl;
const isProd = config.nodeEnv === 'production';
```

## Environment Variables Reference

### Required Variables

These variables MUST be set for the application to start:

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `DATABASE_URL` | string | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/milequest` |
| `JWT_SECRET` | string | Secret key for JWT token signing | `your-secret-key-here` |

### Core Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NODE_ENV` | string | `development` | Application environment (`development`, `production`, `test`) |
| `PORT` | number | `3001` | Server port number |
| `AWS_REGION` | string | `us-east-1` | AWS region for services |
| `STAGE` | string | `dev` | Deployment stage (`dev`, `staging`, `production`) |

### Authentication (AWS Cognito)

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `COGNITO_USER_POOL_ID` | string | No | AWS Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | string | No | AWS Cognito App Client ID |

### Real-time Communication (Pusher)

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `PUSHER_APP_ID` | string | No | Pusher application ID |
| `PUSHER_KEY` | string | No | Pusher public key |
| `PUSHER_SECRET` | string | No | Pusher secret key |
| `PUSHER_CLUSTER` | string | No | Pusher cluster region |

### External Services

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `MAPBOX_ACCESS_TOKEN` | string | No | Mapbox API access token for mapping features |

### Feature Flags

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ENABLE_REAL_TIME` | boolean | `false` | Enable real-time WebSocket features |
| `ENABLE_OFFLINE_SYNC` | boolean | `false` | Enable offline data synchronization |

### API Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `CORS_ORIGIN` | string | `http://localhost:3000` | Allowed CORS origin for API requests |

### Logging

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LOG_LEVEL` | string | `info` | Logging level (`debug`, `info`, `warn`, `error`) |

### Development-Specific

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SERVICE_IMPLEMENTATIONS` | string | `real` | Service implementation mode (`real`, `mock`) |

## Environment Files

### `.env` - Production Configuration

The main `.env` file contains the production-ready configuration:

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/milequest

# Authentication
JWT_SECRET=your-jwt-secret-here

# AWS Configuration
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=your-user-pool-id
COGNITO_CLIENT_ID=your-client-id

# External Services
PUSHER_APP_ID=your-pusher-app-id
PUSHER_KEY=your-pusher-key
PUSHER_SECRET=your-pusher-secret
PUSHER_CLUSTER=us2
MAPBOX_ACCESS_TOKEN=your-mapbox-token

# Feature Flags
ENABLE_REAL_TIME=true
ENABLE_OFFLINE_SYNC=true

# API Configuration
CORS_ORIGIN=https://milequest.app
STAGE=production

# Logging
LOG_LEVEL=info
```

### `.env.local` - Local Development

For local development, create a `.env.local` file that overrides production settings:

```bash
# Core
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/milequest_dev

# Use mock services for local development
SERVICE_IMPLEMENTATIONS=mock

# Development CORS
CORS_ORIGIN=http://localhost:3000

# Verbose logging
LOG_LEVEL=debug

# Disable production features
ENABLE_REAL_TIME=false
ENABLE_OFFLINE_SYNC=false
```

## Usage Examples

### 1. Accessing Configuration

```typescript
import { config } from '@/config/environment';

export class AuthService {
  constructor() {
    if (config.cognitoUserPoolId) {
      // Initialize Cognito
    } else {
      // Use local auth
    }
  }
}
```

### 2. Feature Flag Checking

```typescript
import { config } from '@/config/environment';

if (config.enableRealTime) {
  // Initialize WebSocket connections
  initializeWebSockets();
}
```

### 3. Environment-Specific Logic

```typescript
import { config } from '@/config/environment';

const baseUrl = config.nodeEnv === 'production' 
  ? 'https://api.milequest.app' 
  : 'http://localhost:3001';
```

## Validation

The backend validates required environment variables on startup:

```typescript
export function validateEnvironment(): void {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

## Best Practices

1. **Never commit `.env` files** - Use `.env.example` as a template
2. **Use `.env.local` for local overrides** - This file is gitignored
3. **Access through config object** - Don't use `process.env` directly
4. **Validate on startup** - Fail fast if required variables are missing
5. **Use appropriate defaults** - Provide sensible defaults for optional variables
6. **Type your configuration** - Use TypeScript interfaces for type safety

## Security Considerations

1. **Sensitive Variables**:
   - `JWT_SECRET` - Keep secure and rotate regularly
   - `DATABASE_URL` - Contains database credentials
   - `PUSHER_SECRET` - API secret key
   - AWS credentials - Use IAM roles in production

2. **Environment Isolation**:
   - Use different values for dev/staging/production
   - Never use production credentials in development
   - Consider using AWS Secrets Manager for production

## Deployment Notes

### Local Development
1. Copy `.env` to `.env.local`
2. Update values for local development
3. Set `SERVICE_IMPLEMENTATIONS=mock` to use mock services

### Docker
Environment variables can be passed via docker-compose:

```yaml
services:
  backend:
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
```

### AWS Deployment
For AWS deployments, use:
- AWS Systems Manager Parameter Store
- AWS Secrets Manager
- Environment variables in ECS task definitions

## Troubleshooting

### Missing Required Variables
```
Error: Missing required environment variables: DATABASE_URL, JWT_SECRET
```
**Solution**: Ensure all required variables are set in your `.env` or `.env.local` file.

### Type Errors
If TypeScript complains about environment config types, ensure you're using the config object:
```typescript
// ❌ Wrong
const token = process.env.MAPBOX_ACCESS_TOKEN; // type: string | undefined

// ✅ Correct  
const token = config.mapboxAccessToken; // type: string | undefined
```

### Service Connection Issues
If services aren't connecting:
1. Check service-specific environment variables are set
2. Verify `SERVICE_IMPLEMENTATIONS` is set correctly
3. Check network connectivity to external services

## Future Improvements

1. **Schema Validation**: Implement Zod validation for environment variables
2. **`.env.example`**: Create template file for developers
3. **Secret Rotation**: Implement automatic secret rotation
4. **Environment Presets**: Create preset configurations for common scenarios
5. **Validation CLI**: Add command to validate environment setup

## Related Documentation

- [External Service Abstraction Pattern](../../../docs/agents/01-architecture/current/external-service-abstraction-pattern.md)
- [Infrastructure Setup](../../../docs/agents/11-devops/current/infrastructure-setup.md)
- [Security Implementation](../../../docs/agents/06-security/current/)