# AWS Amplify Setup Guide for Mile Quest

## Overview
This guide provides step-by-step instructions for setting up AWS Amplify hosting for the Mile Quest Next.js application.

## Prerequisites
- AWS Account with appropriate permissions
- GitHub repository with Next.js application
- Domain name (mile-quest.com) registered or transferred to Route 53
- Node.js 18+ and pnpm installed locally

## Step 1: Initial Amplify Setup

### Install Amplify CLI
```bash
npm install -g @aws-amplify/cli
amplify configure
```

### Initialize Amplify in Your Project
```bash
cd mile-quest
amplify init

# Answer the prompts:
? Enter a name for the project: milequest
? Enter a name for the environment: dev
? Choose your default editor: Visual Studio Code
? Choose the type of app: javascript
? What javascript framework are you using: react
? Source Directory Path: apps/web
? Distribution Directory Path: apps/web/.next
? Build Command: pnpm build
? Start Command: pnpm dev
```

## Step 2: Configure Next.js for Amplify

### Update next.config.js
```javascript
// apps/web/next.config.js
module.exports = {
  output: 'standalone',
  images: {
    domains: ['mile-quest.com'],
  },
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  // Enable SWC minification
  swcMinify: true,
  // Amplify specific settings
  generateBuildId: async () => {
    return process.env.AMPLIFY_BUILD_ID || 'local-build'
  },
}
```

### Create amplify.yml
```yaml
# amplify.yml (root of repository)
version: 1
applications:
  - appRoot: apps/web
    frontend:
      phases:
        preBuild:
          commands:
            - npm install -g pnpm
            - pnpm install --frozen-lockfile
            - npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID
        build:
          commands:
            - pnpm run build
      artifacts:
        baseDirectory: apps/web/.next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .pnpm-store/**/*
    env:
      variables:
        AMPLIFY_MONOREPO_APP_ROOT: apps/web
        _LIVE_UPDATES:
          - name: NEXT_PUBLIC_API_URL
            value: https://api.mile-quest.com
          - name: NEXT_PUBLIC_WS_URL
            value: wss://ws.mile-quest.com
```

## Step 3: Connect to GitHub

### Via AWS Console
1. Navigate to AWS Amplify Console
2. Click "New app" → "Host web app"
3. Choose GitHub as the source provider
4. Authorize AWS Amplify to access your GitHub
5. Select repository: `mile-quest`
6. Select branch: `main`

### Configure Build Settings
1. App name: `mile-quest`
2. Environment: `production`
3. Select "Monorepo" checkbox
4. App root directory: `apps/web`
5. Review the auto-detected build settings
6. Click "Save and deploy"

## Step 4: Custom Domain Setup

### Add Domain in Amplify Console
1. Go to App settings → Domain management
2. Click "Add domain"
3. Enter: `mile-quest.com`
4. Configure subdomains:
   - `@` → Production branch
   - `www` → Redirect to apex domain
   - `staging` → Staging branch
   - `dev` → Development branch

### DNS Configuration Options

#### Option 1: Amplify Managed (Recommended)
1. Amplify provides CNAME records
2. Update your Route 53 hosted zone:
```bash
# Amplify will provide records like:
_abc123.mile-quest.com → _def456.acm-validations.aws
mile-quest.com → d111111abcdef8.cloudfront.net
```

#### Option 2: Route 53 Alias
1. Create alias records pointing to Amplify:
```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch file://dns-records.json
```

## Step 5: Environment Variables

### Set Environment Variables in Amplify Console
```bash
# Production environment
NEXT_PUBLIC_API_URL=https://api.mile-quest.com
NEXT_PUBLIC_WS_URL=wss://ws.mile-quest.com
NEXT_PUBLIC_MAPBOX_TOKEN=pk.abc123...
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=generated-secret
NEXTAUTH_URL=https://mile-quest.com
```

### Branch-Specific Variables
```bash
# Staging branch
NEXT_PUBLIC_API_URL=https://api-staging.mile-quest.com
NEXTAUTH_URL=https://staging.mile-quest.com

# Development branch
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3000
```

## Step 6: Performance Optimization

### Enable Performance Mode
```yaml
# amplify.yml
frontend:
  phases:
    build:
      commands:
        - pnpm run build
  cache:
    paths:
      - '.next/cache/**/*'
      - 'node_modules/**/*'
      - '.pnpm-store/**/*'
```

### Configure Headers
```javascript
// apps/web/next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|png|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}
```

## Step 7: Monitoring and Alerts

### Enable Amplify Monitoring
1. Go to App settings → Monitoring
2. Enable CloudWatch Logs
3. Enable X-Ray tracing
4. Set up alarms:
   - Build failures
   - 4xx/5xx errors > 1%
   - Response time > 2s

### Custom Metrics
```javascript
// apps/web/lib/monitoring.js
import { CloudWatch } from '@aws-sdk/client-cloudwatch';

export function reportWebVitals(metric) {
  if (process.env.NODE_ENV === 'production') {
    // Send to CloudWatch
    console.log(metric);
  }
}
```

## Step 8: Advanced Features

### Server-Side Rendering (SSR)
```javascript
// Amplify automatically detects and configures SSR
export async function getServerSideProps(context) {
  return {
    props: {
      // Props
    },
  }
}
```

### Image Optimization
```javascript
// Amplify supports Next.js Image component
import Image from 'next/image'

<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority
/>
```

### API Routes
```javascript
// apps/web/pages/api/health.js
export default function handler(req, res) {
  res.status(200).json({ status: 'healthy' })
}
```

## Step 9: Deployment Workflow

### Automatic Deployments
- Push to `main` → Production deployment
- Push to `staging` → Staging deployment
- Open PR → Preview deployment

### Manual Deployments
```bash
# Deploy specific branch
amplify push --branch production

# Redeploy without changes
amplify publish --invalidate-cache
```

### Rollback
1. Go to Amplify Console
2. Select "Redeploy this build" on previous successful build
3. Or use: `amplify publish --branch main --commit abc123`

## Step 10: Cost Optimization

### Amplify Pricing
- Build minutes: $0.01 per minute
- Hosting: $0.15 per GB served
- Free tier: 1000 build minutes, 15 GB transfer

### Cost Saving Tips
1. Use build cache effectively
2. Optimize images and assets
3. Enable CloudFront compression
4. Use appropriate cache headers
5. Monitor build times

### Budget Alerts
```bash
aws budgets create-budget \
  --account-id 123456789012 \
  --budget file://amplify-budget.json \
  --notifications-with-subscribers file://notifications.json
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version matches
   - Verify all dependencies are in package.json
   - Check build logs in Amplify Console

2. **Environment Variables Not Working**
   - Rebuild after adding variables
   - Check variable names for typos
   - Verify NEXT_PUBLIC_ prefix for client-side vars

3. **Custom Domain Issues**
   - Wait for DNS propagation (up to 48 hours)
   - Verify SSL certificate status
   - Check Route 53 records

4. **Performance Issues**
   - Enable Amplify Performance Mode
   - Check bundle size with `next build --analyze`
   - Optimize images and fonts

### Debug Commands
```bash
# Check Amplify status
amplify status

# View logs
amplify console

# Test build locally
npm run build && npm run start
```

## Migration from S3/CloudFront

If migrating from S3 + CloudFront:

1. Keep existing setup running
2. Deploy to Amplify with different subdomain
3. Test thoroughly
4. Update DNS to point to Amplify
5. Monitor for issues
6. Decommission old infrastructure

## Summary

AWS Amplify provides:
- ✅ Git-based deployments (like Vercel)
- ✅ Preview URLs for PRs
- ✅ Automatic SSL certificates
- ✅ Built-in CDN (CloudFront)
- ✅ Server-side rendering support
- ✅ Monorepo support
- ✅ Environment management
- ✅ Custom domains
- ✅ Monitoring and logging

Total setup time: ~1 hour
Monthly cost: ~$5-20 for typical usage