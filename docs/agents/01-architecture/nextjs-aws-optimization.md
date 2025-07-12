# Next.js AWS Optimization Guide

## Next.js Deployment Options on AWS

### 1. Static Export (SSG) - Recommended for MVP
**Best for**: Marketing pages, documentation, blogs

```javascript
// next.config.js
module.exports = {
  output: 'export',
  images: {
    unoptimized: true, // Or use custom loader
  },
  trailingSlash: true, // Important for S3
}
```

**Infrastructure**: S3 + CloudFront
**Cost**: ~$5-10/month
**Limitations**: No SSR, no API routes, no ISR

### 2. Serverless (SSR) - Full Features
**Best for**: Dynamic content, authentication, API routes

```javascript
// next.config.js  
module.exports = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
}
```

**Infrastructure**: Lambda + API Gateway + CloudFront
**Cost**: ~$20-50/month
**Benefits**: All Next.js features work

### 3. Container (SSR) - Maximum Control
**Best for**: Complex applications, WebSocket needs

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

**Infrastructure**: ECS Fargate + ALB + CloudFront
**Cost**: ~$50-100/month
**Benefits**: Full control, persistent connections

## Feature Comparison

| Feature | Vercel | S3+CF | Lambda | ECS |
|---------|---------|--------|---------|-----|
| Static Pages | ✅ | ✅ | ✅ | ✅ |
| SSR | ✅ | ❌ | ✅ | ✅ |
| API Routes | ✅ | ❌ | ✅ | ✅ |
| ISR | ✅ | ❌ | ⚠️ | ✅ |
| Image Optimization | ✅ | ⚠️ | ✅ | ✅ |
| Edge Functions | ✅ | ✅ | ✅ | ✅ |
| WebSockets | ⚠️ | ❌ | ⚠️ | ✅ |
| Preview Mode | ✅ | ❌ | ✅ | ✅ |
| Cost at Scale | $$$ | $ | $$ | $$ |

## Mile Quest Specific Recommendations

Given the Mile Quest requirements:

### Phase 1: MVP (Weeks 1-2)
Use **S3 + CloudFront** for:
- Landing pages
- Team dashboards (client-side data fetching)
- Static assets

Use **Lambda** for:
- API endpoints
- Authentication
- Data processing

### Phase 2: Growth (Weeks 3-4)
Add **Lambda@Edge** for:
- Dynamic routing
- A/B testing
- Geo-based content

### Phase 3: Scale (Month 2+)
Consider **ECS Fargate** if you need:
- WebSocket connections > 10 minutes
- Complex server-side logic
- Background jobs

## Quick Start Commands

### Option 1: S3 Static Export
```bash
# Build and export
pnpm build
pnpm export

# Deploy
aws s3 sync out/ s3://mile-quest-web --delete
aws cloudfront create-invalidation --distribution-id ABCD --paths "/*"
```

### Option 2: Serverless Framework
```yaml
# serverless.yml
service: mile-quest-web

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1

functions:
  web:
    handler: server.handler
    events:
      - http: ANY /
      - http: ANY /{proxy+}
```

### Option 3: AWS CDK
```typescript
import { NextjsSite } from '@serverless-stack/resources';

new NextjsSite(stack, 'WebSite', {
  path: 'apps/web',
  environment: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
  customDomain: {
    domainName: 'mile-quest.com',
    hostedZone: 'mile-quest.com',
  },
});
```

## Cost Breakdown

### S3 + CloudFront (Static)
- S3 Storage: $0.023/GB/month (~$0.50)
- CloudFront: $0.085/GB transfer (~$8.50 for 100GB)
- Route 53: $0.50/month
- **Total: ~$10/month**

### Lambda (Serverless)
- Lambda: $0.20 per 1M requests (~$2)
- API Gateway: $3.50 per 1M requests (~$35)
- CloudFront: $0.085/GB transfer (~$8.50)
- **Total: ~$45/month** for 10M requests

### ECS Fargate (Container)
- Fargate: ~$35/month (0.5 vCPU, 1GB RAM)
- ALB: ~$20/month
- CloudFront: $0.085/GB transfer (~$8.50)
- **Total: ~$65/month**

## Monitoring & Performance

### CloudWatch Metrics
```typescript
// Track Next.js performance
export function reportWebVitals(metric) {
  const cloudwatch = new AWS.CloudWatch();
  cloudwatch.putMetricData({
    Namespace: 'MileQuest/WebVitals',
    MetricData: [{
      MetricName: metric.name,
      Value: metric.value,
      Unit: 'Milliseconds',
      Timestamp: new Date(),
    }],
  });
}
```

### Optimization Checklist
- [ ] Enable gzip/brotli compression
- [ ] Set proper cache headers
- [ ] Optimize images (WebP, AVIF)
- [ ] Minimize JavaScript bundles
- [ ] Use CDN for all static assets
- [ ] Enable HTTP/2 and HTTP/3
- [ ] Implement proper error boundaries
- [ ] Add performance budgets

This approach gives you Vercel-like functionality at a fraction of the cost, with full control over your infrastructure!