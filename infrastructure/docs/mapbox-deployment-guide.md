# Mapbox Infrastructure Deployment Guide

## Overview

This guide covers the deployment of Mapbox integration infrastructure for Mile Quest, including:
- Parameter Store configuration for Mapbox API keys
- Secrets Manager for sensitive tokens
- CloudFront distribution for map tile caching
- Lambda environment variables for map services
- CORS configuration for map requests

## Prerequisites

1. AWS CLI configured with appropriate permissions
2. CDK CLI installed: `npm install -g aws-cdk`
3. Node.js 20.x
4. Mapbox account with API tokens

## Mapbox Account Setup

### 1. Create Mapbox Account
1. Go to [mapbox.com](https://mapbox.com) and create an account
2. Navigate to Account → Tokens
3. Create tokens with appropriate scopes:

### 2. Token Configuration

#### Public Token (for frontend)
- **Scopes**: 
  - `styles:read`
  - `tiles:read`
  - `geocoding`
  - `directions`
- **URL restrictions**: Add your domain(s)
- **Name**: `Mile Quest ${ENVIRONMENT} Public`

#### Secret Token (for backend - optional)
- **Scopes**:
  - `styles:read`
  - `tiles:read`
  - `geocoding`
  - `directions`
  - `optimization`
- **Name**: `Mile Quest ${ENVIRONMENT} Secret`

## Infrastructure Deployment

### 1. Deploy External Services Stack

```bash
# Navigate to infrastructure directory
cd infrastructure

# Install dependencies
npm install

# Deploy external services (includes Mapbox config)
npm run deploy:external-services

# Or deploy with specific stage
npx cdk deploy MileQuest-staging-ExternalServices --context stage=staging
```

### 2. Configure Mapbox Secrets

After deployment, update the Secrets Manager with your actual tokens:

```bash
# Get the secret ARN from CloudFormation outputs
SECRET_ARN=$(aws cloudformation describe-stacks \
  --stack-name MileQuest-staging-ExternalServices \
  --query 'Stacks[0].Outputs[?OutputKey==`MapboxSecretsArn`].OutputValue' \
  --output text)

# Update the secret with your tokens
aws secretsmanager update-secret \
  --secret-id $SECRET_ARN \
  --secret-string '{
    "publicToken": "pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbGt3ZXhhYmMwMDJkM2NvOGt5b2Q5dXBqIn0.xxx",
    "secretToken": "sk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbGt3ZXhhYmMwMDJkM2NvOGt5b2Q5dXBqIn0.xxx"
  }'
```

### 3. Deploy CloudFront Stack

```bash
# Deploy CloudFront distribution for map assets
npm run deploy:cloudfront
```

### 4. Deploy Other Stacks

```bash
# Deploy API Gateway (now includes Mapbox environment variables)
npm run deploy:api

# Deploy all remaining stacks
npm run deploy:all
```

## Environment Configuration

### Development Environment

```bash
# .env.local
NEXT_PUBLIC_MAPBOX_TOKEN=pk.development_token_here
NEXT_PUBLIC_MAP_PROVIDER=mapbox
NEXT_PUBLIC_CLOUDFRONT_DOMAIN=d1234567890.cloudfront.net

# Backend environment (loaded from Parameter Store)
MAPBOX_SECRETS_ARN=arn:aws:secretsmanager:us-east-1:123456789012:secret:/mile-quest/dev/mapbox/tokens
MAPBOX_CONFIG_PARAM=/mile-quest/dev/mapbox/config
```

### Staging Environment

```bash
# .env.staging
NEXT_PUBLIC_MAPBOX_TOKEN=pk.staging_token_here
NEXT_PUBLIC_MAP_PROVIDER=mapbox
NEXT_PUBLIC_CLOUDFRONT_DOMAIN=d0987654321.cloudfront.net

# Backend environment (loaded from Parameter Store)
MAPBOX_SECRETS_ARN=arn:aws:secretsmanager:us-east-1:123456789012:secret:/mile-quest/staging/mapbox/tokens
MAPBOX_CONFIG_PARAM=/mile-quest/staging/mapbox/config
```

### Production Environment

```bash
# .env.production
NEXT_PUBLIC_MAPBOX_TOKEN=pk.production_token_here
NEXT_PUBLIC_MAP_PROVIDER=mapbox
NEXT_PUBLIC_CLOUDFRONT_DOMAIN=maps.milequest.app

# Backend environment (loaded from Parameter Store)
MAPBOX_SECRETS_ARN=arn:aws:secretsmanager:us-east-1:123456789012:secret:/mile-quest/production/mapbox/tokens
MAPBOX_CONFIG_PARAM=/mile-quest/production/mapbox/config
```

## Lambda Function Integration

### Using Environment Variables in Lambda

```typescript
// handlers/map/mapbox.ts
import { mapboxConfig } from '@/config/mapbox.config';

export const handler = async (event: any) => {
  // Configuration is automatically loaded from Parameter Store
  const token = mapboxConfig.getAccessToken();
  const allowedDomains = mapboxConfig.getAllowedDomains();
  
  // Use CloudFront for map tiles when available
  const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;
  const mapApiUrl = cloudfrontDomain 
    ? `https://${cloudfrontDomain}`
    : 'https://api.mapbox.com';
    
  // Your map service logic here
};
```

### IAM Permissions

Lambdas automatically get these permissions:
- Read Mapbox secrets from Secrets Manager
- Read configuration from Parameter Store
- Create CloudFront invalidations
- Publish CloudWatch metrics

## CloudFront Configuration

### Map Tile Caching

The CloudFront distribution includes optimized caching for:

1. **Map Tiles** (`/v4/*`): 30-day cache, immutable
2. **Styles** (`/styles/*`): 24-hour cache
3. **Fonts** (`/fonts/*`): Long-term cache
4. **Geocoding** (`/geocoding/*`): No cache
5. **Directions** (`/directions/*`): No cache

### CORS Configuration

CORS headers are configured for:
- `Access-Control-Allow-Origin`: Environment-specific domains
- `Access-Control-Allow-Methods`: GET, HEAD, OPTIONS
- `Access-Control-Allow-Headers`: Authorization, User-Agent, Accept

## Monitoring and Troubleshooting

### CloudWatch Metrics

Monitor these metrics:
- `Mile-Quest/Maps/RequestCount`
- `Mile-Quest/Maps/ErrorRate`
- `Mile-Quest/External-Services/MapboxAPIUsage`

### Common Issues

#### 1. Token Not Found Error
```bash
# Check if secret exists
aws secretsmanager describe-secret --secret-id /mile-quest/staging/mapbox/tokens

# Verify parameter store values
aws ssm get-parameter --name /mile-quest/staging/mapbox/config
```

#### 2. CORS Issues
```bash
# Check CloudFront distribution configuration
aws cloudfront get-distribution-config --id D1234567890

# Verify allowed origins in parameter store
aws ssm get-parameter --name /mile-quest/staging/mapbox/config --query 'Parameter.Value' | jq .allowedDomains
```

#### 3. Cache Issues
```bash
# Create cache invalidation
aws cloudfront create-invalidation \
  --distribution-id D1234567890 \
  --paths "/v4/*" "/styles/*"
```

## Security Best Practices

### 1. Token Security
- Use secret tokens for backend services
- Restrict public tokens to specific domains
- Rotate tokens regularly
- Monitor token usage in Mapbox dashboard

### 2. Network Security
- All traffic uses HTTPS
- CloudFront adds security headers
- Rate limiting configured per environment
- Origin access restricted

### 3. Access Control
- Lambda functions have minimal IAM permissions
- Secrets are encrypted at rest
- Parameter Store values are encrypted
- CloudWatch logging enabled

## Performance Optimization

### 1. Caching Strategy
- Map tiles cached for 30 days
- Styles cached for 24 hours
- Use CloudFront edge locations globally
- Gzip/Brotli compression enabled

### 2. Rate Limiting
- 600 requests/minute (Mapbox default)
- 100,000 requests/day (Mapbox default)
- Adjustable per environment
- Graceful degradation

### 3. Error Handling
- Retry logic with exponential backoff
- Circuit breaker pattern
- Fallback to alternative providers
- Comprehensive error reporting

## Cost Management

### Monthly Cost Estimates

#### Development
- CloudFront: ~$1 (minimal traffic)
- Parameter Store: Free tier
- Secrets Manager: ~$0.40 (1 secret)
- **Total**: ~$1.40

#### Staging
- CloudFront: ~$5 (moderate traffic)
- Parameter Store: Free tier
- Secrets Manager: ~$0.40 (1 secret)
- **Total**: ~$5.40

#### Production
- CloudFront: ~$10-50 (varies by usage)
- Parameter Store: Free tier
- Secrets Manager: ~$0.40 (1 secret)
- **Total**: ~$10.40-50.40

### Cost Optimization
- Use CloudFront caching to reduce API calls
- Monitor Mapbox usage dashboard
- Set up billing alerts
- Consider reserved capacity for production

## Deployment Commands Reference

```bash
# Deploy specific components
npm run deploy:external-services  # Mapbox config and secrets
npm run deploy:cloudfront         # CDN for map assets
npm run deploy:api               # API Gateway with map endpoints

# Deploy all infrastructure
npm run deploy:all

# Destroy infrastructure (careful!)
npm run destroy:all

# View differences before deployment
npm run diff

# Generate CloudFormation templates
npm run synth
```

## Next Steps

1. **Configure Domain Names**: Set up custom domains for CloudFront
2. **SSL Certificates**: Add TLS certificates for custom domains
3. **Monitoring Dashboards**: Create CloudWatch dashboards
4. **Alerting**: Set up alerts for errors and usage limits
5. **Backup Strategy**: Implement configuration backup procedures

---

**Last Updated**: 2025-01-20
**Version**: 1.0
**Owner**: DevOps Agent (Agent 11)