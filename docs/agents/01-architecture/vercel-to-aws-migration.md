# Vercel to AWS Migration Guide

## Overview
This guide outlines the migration strategy from Vercel to AWS for the Mile Quest Next.js application, ensuring all infrastructure is consolidated on AWS.

## Current Vercel Features to Replace

| Vercel Feature | AWS Replacement | Cost Comparison |
|----------------|-----------------|-----------------|
| Hosting | S3 + CloudFront | Vercel: $20/mo → AWS: ~$5-10/mo |
| Edge Functions | Lambda@Edge | Included in CloudFront |
| Image Optimization | CloudFront + Lambda | Pay per transformation |
| Analytics | CloudWatch RUM | ~$0.30/1K page views |
| Preview Deployments | Amplify or S3 branches | Minimal cost |
| Automatic Git Deploy | GitHub Actions + S3 | Free with GitHub |
| Custom Domains | Route 53 + ACM | $0.50/mo + free SSL |
| DDoS Protection | CloudFront + Shield | Included free |

## Migration Architecture

### Option 1: S3 + CloudFront (Recommended for MVP)
Best for: Static sites, SSG, cost optimization

```
GitHub Repo → GitHub Actions → Build → S3 → CloudFront → Users
                                           ↓
                                    Lambda@Edge (for redirects)
```

### Option 2: AWS Amplify Hosting
Best for: Quick migration, Vercel-like experience

```
GitHub Repo → Amplify Console → Build & Deploy → CloudFront → Users
                                                      ↓
                                              SSR via Lambda
```

### Option 3: ECS Fargate (For full SSR)
Best for: Complex SSR needs, full control

```
GitHub Repo → ECR → ECS Fargate → ALB → CloudFront → Users
```

## Step-by-Step Migration Plan

### Phase 1: Preparation (Day 1)

1. **Export from Vercel**
   ```bash
   # Download your environment variables
   vercel env pull .env.local
   
   # Note your current build settings
   vercel inspect
   ```

2. **Prepare Next.js for AWS**
   ```javascript
   // next.config.js
   module.exports = {
     output: 'standalone', // For containerized deployments
     images: {
       loader: 'custom',
       loaderFile: './lib/imageLoader.js', // Custom S3/CloudFront loader
     },
     assetPrefix: process.env.NEXT_PUBLIC_CDN_URL || '',
   }
   ```

3. **Create AWS Resources**
   ```bash
   # Using AWS CDK (recommended)
   npm install -g aws-cdk
   cdk init app --language typescript
   ```

### Phase 2: Infrastructure Setup (Day 2)

1. **S3 Buckets**
   ```typescript
   // cdk/lib/hosting-stack.ts
   const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
     bucketName: 'mile-quest-web',
     websiteIndexDocument: 'index.html',
     websiteErrorDocument: '404.html',
     publicReadAccess: false, // Use OAI
     blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
     removalPolicy: RemovalPolicy.RETAIN,
   });
   ```

2. **CloudFront Distribution**
   ```typescript
   const distribution = new cloudfront.Distribution(this, 'Distribution', {
     defaultBehavior: {
       origin: new origins.S3Origin(websiteBucket),
       viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
       cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
       compress: true,
     },
     domainNames: ['mile-quest.com', 'www.mile-quest.com'],
     certificate: certificate, // ACM certificate
     priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
   });
   ```

3. **Lambda@Edge for Dynamic Routes**
   ```typescript
   // For Next.js dynamic routes
   const edgeFunction = new lambda.Function(this, 'EdgeFunction', {
     runtime: lambda.Runtime.NODEJS_18_X,
     handler: 'index.handler',
     code: lambda.Code.fromAsset('lambda/edge-router'),
   });
   ```

### Phase 3: Build Pipeline (Day 3)

1. **GitHub Actions Workflow**
   ```yaml
   # .github/workflows/deploy.yml
   name: Deploy to AWS
   
   on:
     push:
       branches: [main]
   
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         
         - name: Setup Node.js
           uses: actions/setup-node@v3
           with:
             node-version: '20'
             
         - name: Install dependencies
           run: pnpm install
           
         - name: Build Next.js
           run: pnpm build
           env:
             NEXT_PUBLIC_API_URL: ${{ secrets.API_URL }}
             
         - name: Export static files
           run: pnpm next export
           
         - name: Deploy to S3
           uses: aws-actions/configure-aws-credentials@v2
           with:
             aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
             aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
             aws-region: us-east-1
             
         - name: Sync to S3
           run: |
             aws s3 sync out/ s3://${{ secrets.S3_BUCKET }} --delete
             aws cloudfront create-invalidation --distribution-id ${{ secrets.CF_DISTRIBUTION_ID }} --paths "/*"
   ```

2. **Environment Variables Migration**
   ```bash
   # Store in AWS Systems Manager Parameter Store
   aws ssm put-parameter \
     --name "/mile-quest/prod/DATABASE_URL" \
     --value "$DATABASE_URL" \
     --type "SecureString"
   ```

### Phase 4: Migration Execution (Day 4)

1. **DNS Preparation**
   - Lower TTL on Vercel DNS records to 300 seconds
   - Create Route 53 hosted zone
   - Verify domain ownership

2. **Test Deployment**
   ```bash
   # Deploy to staging
   git push origin main:staging
   
   # Test all critical paths
   - Homepage loads
   - API routes work
   - Images load correctly
   - Authentication flows
   ```

3. **Traffic Migration**
   ```bash
   # Step 1: Add AWS as secondary
   # Step 2: Split traffic 90/10
   # Step 3: Monitor for issues
   # Step 4: Full cutover
   ```

### Phase 5: Cleanup (Day 5)

1. **Verify Everything Works**
   - All pages load correctly
   - No 404 errors in CloudWatch
   - Performance metrics acceptable
   - SSL certificates working

2. **Cancel Vercel**
   ```bash
   # Remove Vercel configuration
   rm vercel.json
   
   # Update documentation
   # Cancel Vercel subscription
   ```

## Cost Optimization Tips

### 1. CloudFront Caching
```javascript
// Set proper cache headers
export async function getStaticProps() {
  return {
    props: { ... },
    revalidate: 3600, // 1 hour
  }
}
```

### 2. Image Optimization
```javascript
// Custom image loader for CloudFront
export default function cloudFrontLoader({ src, width, quality }) {
  const params = [`w=${width}`];
  if (quality) params.push(`q=${quality}`);
  return `${process.env.NEXT_PUBLIC_CDN_URL}/${src}?${params.join('&')}`;
}
```

### 3. Compression
- Enable Brotli compression in CloudFront
- Minify all JavaScript and CSS
- Use WebP images with fallbacks

## Monitoring Setup

### CloudWatch Dashboards
```typescript
new cloudwatch.Dashboard(this, 'WebsiteDashboard', {
  widgets: [
    [
      new cloudwatch.GraphWidget({
        title: 'Origin Response Time',
        left: [cfDistribution.metricOriginLatency()],
      }),
      new cloudwatch.GraphWidget({
        title: 'Cache Hit Rate',
        left: [cfDistribution.metricCacheHitRate()],
      }),
    ],
  ],
});
```

### Alarms
- 4xx errors > 10% of requests
- Origin response time > 1 second
- Cache hit rate < 80%
- Monthly cost > budget

## Rollback Plan

If issues arise:
1. Update Route 53 to point back to Vercel
2. CloudFront has automatic failover
3. Keep Vercel active for 1 week post-migration

## Common Gotchas

1. **API Routes**: Next.js API routes need Lambda functions
2. **ISR**: Incremental Static Regeneration requires Lambda@Edge
3. **Preview Mode**: Needs custom implementation
4. **Image Optimization**: Requires custom loader or Lambda
5. **Trailing Slashes**: CloudFront behavior differs from Vercel

## Alternative: AWS Amplify Hosting

If you want a more Vercel-like experience:

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Initialize Amplify
amplify init

# Add hosting
amplify add hosting

# Deploy
amplify publish
```

Benefits:
- Automatic Git deployments
- Preview URLs for PRs
- Built-in Next.js support
- Simpler than S3+CloudFront

Drawbacks:
- Slightly more expensive
- Less control
- Some Next.js features limited

## Final Architecture

```
┌─────────────────┐
│   GitHub Repo   │
└────────┬────────┘
         │ Push
┌────────▼────────┐
│ GitHub Actions  │
└────────┬────────┘
         │ Build & Deploy
┌────────▼────────┐
│    S3 Bucket    │
└────────┬────────┘
         │ Origin
┌────────▼────────┐
│   CloudFront    │
│  Lambda@Edge    │
└────────┬────────┘
         │
┌────────▼────────┐
│   Route 53      │
│ mile-quest.com  │
└─────────────────┘
```

## Success Metrics

- Page load time < 2 seconds globally
- Monthly hosting cost < $20
- 99.9% uptime
- Automated deployments < 5 minutes
- Zero downtime during migration