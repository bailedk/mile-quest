# AWS Amplify Deployment Configuration

## Amplify Build Specification

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
            - pnpm run test:ci
      artifacts:
        baseDirectory: apps/web/.next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .pnpm-store/**/*
          - .next/cache/**/*
    env:
      variables:
        AMPLIFY_MONOREPO_APP_ROOT: apps/web
        _LIVE_UPDATES:
          - name: NEXT_PUBLIC_API_URL
            value: https://api.mile-quest.com
          - name: NEXT_PUBLIC_WS_URL
            value: wss://ws.mile-quest.com
          - name: NEXT_PUBLIC_COGNITO_USER_POOL_ID
            value: ${COGNITO_USER_POOL_ID}
          - name: NEXT_PUBLIC_COGNITO_CLIENT_ID
            value: ${COGNITO_CLIENT_ID}
```

## GitHub Actions Configuration

```yaml
# .github/workflows/deploy.yml
name: Deploy Mile Quest
on:
  push:
    branches: [main, staging, develop]
  pull_request:
    types: [opened, synchronize]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install -g pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run type-check
      - run: pnpm run test

  deploy-backend:
    needs: test
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - run: npm install -g pnpm @aws-amplify/cli
      - run: pnpm install --frozen-lockfile
      - run: npx serverless deploy --stage ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}

  # Frontend deployment is handled automatically by Amplify's GitHub integration
  notify-amplify:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Amplify Build
        run: |
          echo "Amplify will automatically detect and build this commit"
          echo "Branch: ${{ github.ref_name }}"
          echo "Commit: ${{ github.sha }}"
```

## Environment Configuration

### Production Environment
```bash
# AWS Amplify Console Environment Variables
NEXT_PUBLIC_API_URL=https://api.mile-quest.com
NEXT_PUBLIC_WS_URL=wss://ws.mile-quest.com
NEXT_PUBLIC_MAPBOX_TOKEN=pk_production_token
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_production
NEXT_PUBLIC_COGNITO_CLIENT_ID=production_client_id
NEXTAUTH_SECRET=production_secret
NEXTAUTH_URL=https://mile-quest.com
NODE_ENV=production
```

### Staging Environment
```bash
# Branch-specific variables
NEXT_PUBLIC_API_URL=https://api-staging.mile-quest.com
NEXT_PUBLIC_WS_URL=wss://ws-staging.mile-quest.com
NEXTAUTH_URL=https://staging.mile-quest.com
```

### Development Environment
```bash
# Local development
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3002
NEXTAUTH_URL=http://localhost:3000
```

## Branch Configuration

### Main Branch (Production)
- **URL**: https://mile-quest.com
- **Build Settings**: Production optimizations enabled
- **Environment**: production
- **Auto Deploy**: Yes

### Staging Branch
- **URL**: https://staging.mile-quest.com
- **Build Settings**: Production build with debug info
- **Environment**: staging
- **Auto Deploy**: Yes

### Feature Branches (PRs)
- **URL**: https://pr-{number}.d1234567890.amplifyapp.com
- **Build Settings**: Development build
- **Environment**: preview
- **Auto Deploy**: Yes (on PR open/update)

## Monitoring and Alerts

### CloudWatch Alarms
```javascript
// infrastructure/monitoring/amplify-alarms.js
const alarms = [
  {
    name: 'AmplifyBuildFailure',
    metric: 'BuildFailureCount',
    threshold: 1,
    evaluationPeriods: 1,
  },
  {
    name: 'AmplifyHighLatency',
    metric: 'OriginLatency',
    threshold: 2000, // 2 seconds
    evaluationPeriods: 2,
  },
  {
    name: 'Amplify4xxErrors',
    metric: '4xxErrorRate',
    threshold: 0.05, // 5%
    evaluationPeriods: 3,
  },
];
```

### Build Notifications
```yaml
# Amplify Console Settings
notifications:
  - type: BUILD_FAILURE
    email: devops@mile-quest.com
  - type: BUILD_SUCCESS
    webhook: https://hooks.slack.com/services/xxx
```

## Cost Optimization

### Build Minutes Optimization
- Cache pnpm store: Saves ~3 minutes per build
- Skip unnecessary builds: Use `[skip ci]` in commit messages
- Optimize build commands: Parallel execution where possible

### Bandwidth Optimization
- Enable Brotli compression
- Optimize images with Next.js Image component
- Use appropriate cache headers
- Serve static assets from CloudFront

## Migration Notes

### From Vercel
1. Environment variables have been migrated to Amplify Console
2. Build commands updated in amplify.yml
3. Custom domains configured in Route 53
4. Preview deployments work similarly (PR-based)

### Key Differences
- Build logs available in CloudWatch
- Deployment status in Amplify Console
- Native AWS service integration
- Unified billing with other AWS services

---

**Total Setup Time**: ~1 hour
**Monthly Cost**: ~$17 (build minutes + bandwidth)
**Free Tier**: 1000 build minutes, 15GB transfer