# Mapbox Setup Guide for Mile Quest

## Overview

This guide walks through setting up Mapbox for the Mile Quest application, including account creation, token management, and security configuration.

## Table of Contents

1. [Account Setup](#account-setup)
2. [Token Creation](#token-creation)
3. [Environment Configuration](#environment-configuration)
4. [Security Best Practices](#security-best-practices)
5. [Testing Your Setup](#testing-your-setup)
6. [Monitoring Usage](#monitoring-usage)
7. [Troubleshooting](#troubleshooting)

## Account Setup

### 1. Create a Mapbox Account

1. Visit [Mapbox.com](https://www.mapbox.com)
2. Click "Sign up" and create a free account
3. Verify your email address
4. Complete the onboarding process

### 2. Understanding Mapbox Pricing

Mile Quest uses the following Mapbox services:
- **Geocoding API**: For address search and reverse geocoding
- **Directions API**: For route calculation
- **Optimization API**: For waypoint optimization
- **Vector Tiles**: For map display

Free tier includes:
- 50,000 web map loads/month
- 50,000 Directions API requests/month
- 50,000 Geocoding API requests/month

## Token Creation

### 1. Development Token (Public)

For local development, create a public token:

1. Go to your [Mapbox Account](https://account.mapbox.com/access-tokens/)
2. Click "Create a token"
3. Name: `mile-quest-dev`
4. Token scopes (check all):
   - `styles:read`
   - `tiles:read`
   - `datasets:read`
   - `geocoding:read`
   - `directions:read`
   - `optimization:read`
5. URL restrictions: Leave empty for development
6. Click "Create token"
7. Copy the token (starts with `pk.`)

### 2. Staging Token (Public with Restrictions)

For staging environment:

1. Create another token named `mile-quest-staging`
2. Same scopes as development
3. Add URL restrictions:
   - `https://staging.milequest.app`
   - `https://api-staging.milequest.app`
4. Create and copy token

### 3. Production Token (Secret)

For production, use a secret token with domain restrictions:

1. Create token named `mile-quest-production`
2. Check "Secret scopes" to create a secret token
3. Select all required scopes
4. Add URL restrictions:
   - `https://milequest.app`
   - `https://www.milequest.app`
   - `https://api.milequest.app`
5. Create and copy token (starts with `sk.`)

**Important**: Secret tokens should only be used server-side. Never expose them in frontend code.

## Environment Configuration

### Backend Configuration

1. Copy the example environment file:
   ```bash
   cd packages/backend
   cp .env.example .env.local
   ```

2. Update the Mapbox tokens in `.env.local`:
   ```bash
   # Mapbox Configuration
   MAPBOX_ACCESS_TOKEN=pk.your_development_token_here
   MAPBOX_TOKEN_DEV=pk.your_development_token_here
   MAPBOX_TOKEN_STAGING=pk.your_staging_token_here
   MAPBOX_TOKEN_PROD=sk.your_production_token_here
   
   # Map Provider
   MAP_PROVIDER=mapbox
   ```

3. Configure rate limits (optional):
   ```bash
   MAPBOX_RATE_LIMIT_PER_MINUTE=600
   MAPBOX_RATE_LIMIT_PER_DAY=100000
   ```

### Frontend Configuration

1. Copy the example environment file:
   ```bash
   cd packages/frontend
   cp .env.example .env.local
   ```

2. Update the Mapbox token in `.env.local`:
   ```bash
   # Maps Configuration
   NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_public_mapbox_token_here
   NEXT_PUBLIC_MAP_PROVIDER=mapbox
   ```

### Token Security Matrix

| Environment | Token Type | Where Used | Domain Restrictions |
|-------------|------------|------------|-------------------|
| Development | Public (`pk.`) | Frontend & Backend | None |
| Staging | Public (`pk.`) | Frontend & Backend | Staging domains |
| Production | Secret (`sk.`) | Backend only | Production domains |
| Production | Public (`pk.`) | Frontend only | Production domains |

## Security Best Practices

### 1. Token Rotation

- Rotate tokens every 90 days
- Immediately rotate if exposed
- Keep old tokens active for 24h during rotation

### 2. Domain Restrictions

Always use domain restrictions for production tokens:

1. Go to token settings
2. Add allowed URLs
3. Include all subdomains
4. Test thoroughly

### 3. Scope Minimization

Only enable required scopes:
- ✅ `geocoding:read`
- ✅ `directions:read`
- ✅ `optimization:read`
- ✅ `tiles:read`
- ✅ `styles:read`
- ❌ `*:write` (not needed)

### 4. Environment Isolation

- Never use production tokens in development
- Use separate tokens per environment
- Store tokens securely (AWS Secrets Manager, etc.)

## Testing Your Setup

### 1. Backend Token Validation

Test the Mapbox configuration:

```bash
cd packages/backend
npm run test:mapbox
```

Or manually test:

```typescript
// Test script: packages/backend/scripts/test-mapbox.ts
import { mapboxConfig } from '../src/config/mapbox.config';
import { createMapService } from '../src/services/map';

async function testMapbox() {
  // Validate configuration
  console.log('Token valid:', mapboxConfig.hasRequiredScopes());
  console.log('Rate limits:', mapboxConfig.getRateLimits());
  
  // Test geocoding
  const mapService = createMapService();
  const results = await mapService.searchAddress('Times Square, New York');
  console.log('Search results:', results);
}

testMapbox().catch(console.error);
```

### 2. Frontend Map Display

Test map rendering:

```typescript
// Simple map test component
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

export function MapTest() {
  const mapRef = useRef<mapboxgl.Map>();
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
    
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-122.4194, 37.7749],
      zoom: 12
    });
    
    return () => mapRef.current?.remove();
  }, []);
  
  return <div ref={containerRef} style={{ height: '400px' }} />;
}
```

## Monitoring Usage

### 1. Mapbox Dashboard

Monitor API usage at [account.mapbox.com](https://account.mapbox.com/):
- View monthly usage
- Set up billing alerts
- Track API errors

### 2. Application Monitoring

Implement usage tracking:

```typescript
// Log Mapbox API calls
import { logger } from '@/services/logger';

export class MonitoredMapboxService extends MapboxService {
  async searchAddress(query: string, options?: SearchOptions) {
    const start = Date.now();
    try {
      const result = await super.searchAddress(query, options);
      logger.info('Mapbox geocoding', {
        duration: Date.now() - start,
        query,
        resultCount: result.length
      });
      return result;
    } catch (error) {
      logger.error('Mapbox geocoding failed', { error, query });
      throw error;
    }
  }
}
```

### 3. Cost Optimization

Tips to minimize costs:
- Cache geocoding results
- Batch waypoint optimization
- Use appropriate zoom levels
- Implement client-side rate limiting

## Troubleshooting

### Common Issues

#### 1. Invalid Token Error
```
Error: Invalid Mapbox access token
```
**Solution**: 
- Verify token starts with `pk.` or `sk.`
- Check token is not expired
- Ensure correct environment variable

#### 2. Domain Restriction Error
```
Error: Forbidden - URL not allowed
```
**Solution**:
- Add your domain to token restrictions
- Include both `http` and `https` variants
- Add `www` and non-`www` versions

#### 3. Rate Limit Exceeded
```
Error: Rate limit exceeded
```
**Solution**:
- Implement request caching
- Add client-side throttling
- Upgrade Mapbox plan if needed

#### 4. CORS Issues
```
Error: CORS policy blocked
```
**Solution**:
- Use public token in frontend
- Verify domain restrictions
- Check API endpoint URLs

### Debug Checklist

- [ ] Token format is correct (`pk.` or `sk.`)
- [ ] Environment variables are loaded
- [ ] Token has required scopes
- [ ] Domain restrictions match your URLs
- [ ] API endpoints are accessible
- [ ] Rate limits not exceeded

## Token Management Process

### Initial Setup
1. Create development token
2. Test locally
3. Create staging token
4. Test in staging
5. Create production tokens
6. Deploy with proper tokens

### Ongoing Management
1. Monitor usage monthly
2. Review security quarterly
3. Rotate tokens every 90 days
4. Update documentation

### Emergency Procedures
If a token is compromised:
1. Immediately delete the token in Mapbox dashboard
2. Create new token with same settings
3. Update all environments
4. Review access logs
5. Document incident

## Next Steps

After setting up Mapbox:

1. **Implement Caching**: Add Redis caching for geocoding results
2. **Add Monitoring**: Set up CloudWatch alarms for API errors
3. **Optimize Performance**: Implement request batching
4. **Test Failover**: Prepare fallback for service outages

## Related Documentation

- [External Service Abstraction Pattern](../agents/01-architecture/current/external-service-abstraction-pattern.md)
- [Map Integration Implementation Guide](../agents/05-map-integration/current/map-integration-implementation-guide.md)
- [Backend Environment Variables](../../packages/backend/docs/ENVIRONMENT-VARIABLES.md)