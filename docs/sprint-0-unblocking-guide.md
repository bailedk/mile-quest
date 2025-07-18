# Sprint 0 Unblocking Guide

## 🚨 Critical Blockers Resolution

### DB-001: Deploy RDS PostgreSQL Instance

**Status**: READY TO DEPLOY
**Blocks**: DB-002, DB-003, DB-004, BE-003

#### Quick Deployment Steps:

```bash
# 1. Navigate to infrastructure directory
cd infrastructure

# 2. Install dependencies (if not done)
npm install

# 3. Bootstrap CDK (one-time setup)
npx cdk bootstrap

# 4. Deploy the database stack
npm run deploy:database

# Or if npm script not available:
npx cdk deploy MileQuest-staging-Database
```

**Expected Output**:
- Database creation takes 10-15 minutes
- Outputs will include:
  - DatabaseEndpoint: mile-quest-staging.xxx.rds.amazonaws.com
  - DatabaseCredentialsArn: arn:aws:secretsmanager:...
  - VpcId: vpc-xxx
  - LambdaSecurityGroupId: sg-xxx

#### Post-Deployment Database Setup:

```bash
# 1. Retrieve database connection details
aws secretsmanager get-secret-value \
  --secret-id mile-quest-staging-db-credentials \
  --query SecretString --output text | jq .

# 2. Set up DATABASE_URL in backend
cd ../packages/backend
echo "DATABASE_URL=postgresql://milequest:PASSWORD@ENDPOINT:5432/milequest" > .env

# 3. Run Prisma migrations
npx prisma migrate deploy

# 4. Verify connection
npx prisma db push
```

### INT-001: Create AWS Service Abstractions

**Status**: READY TO IMPLEMENT
**Blocks**: INT-002, INT-003, INT-004, INT-005

#### Implementation Plan:

Create the base abstraction layer for all AWS services:

```typescript
// packages/backend/src/services/aws/base-service.ts
export interface ServiceConfig {
  region?: string;
  endpoint?: string;
}

export abstract class BaseAWSService {
  protected config: ServiceConfig;
  
  constructor(config: ServiceConfig = {}) {
    this.config = {
      region: process.env.AWS_REGION || 'us-east-1',
      ...config
    };
  }
  
  abstract initialize(): Promise<void>;
}
```

#### Service Abstractions to Create:

1. **Cognito Service** (INT-002)
```typescript
// packages/backend/src/services/auth/cognito-service.ts
export interface AuthService {
  verifyToken(token: string): Promise<User>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
}
```

2. **Pusher Service** (INT-003)
```typescript
// packages/backend/src/services/websocket/pusher-service.ts
export interface WebSocketService {
  broadcast(channel: string, event: string, data: any): Promise<void>;
  trigger(userId: string, event: string, data: any): Promise<void>;
}
```

3. **SES Service** (INT-004)
```typescript
// packages/backend/src/services/email/ses-service.ts
export interface EmailService {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
  sendTemplatedEmail(to: string, template: string, data: any): Promise<void>;
}
```

4. **Config Service** (INT-005)
```typescript
// packages/backend/src/services/config/environment-service.ts
export interface ConfigService {
  get(key: string): string;
  getOptional(key: string, defaultValue?: string): string | undefined;
}
```

### BE-003: Implement Health Check Endpoint

**Status**: PARTIALLY BLOCKED
**Blocks**: None (but needs DB connection for full health check)

#### Current Implementation:

```typescript
// Already exists at packages/backend/src/handlers/health/index.ts
export const handler = createHandler(
  async (event, context) => {
    // Add database health check
    const dbHealthy = await checkDatabaseHealth();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbHealthy ? 'connected' : 'disconnected',
      version: process.env.API_VERSION || '1.0.0'
    };
  }
);
```

## 🚀 Recommended Action Plan

### Immediate Actions (Do Now):

1. **Deploy Database (DB-001)**
   - Run the CDK deployment commands above
   - This unblocks 4 other tasks immediately

2. **Start INT-001 Implementation**
   - Create base service abstractions
   - This unblocks 4 integration tasks

3. **Complete BE-003**
   - Add database health check
   - Update existing endpoint

### Next Wave (After DB Deploy):

1. **DB-002**: Run Prisma migrations
2. **DB-003**: Create seed data
3. **DB-004**: Configure backups
4. **BE-005**: Set up CloudWatch logging

### Developer Assignments:

- **Database Developer**: Focus on DB-001 deployment NOW
- **Integration Developer**: Start INT-001 abstractions NOW
- **Backend Developer**: Complete BE-003 and prepare for BE-005
- **Frontend Developer**: Can start FE-001 independently (no blockers)

## 📊 Expected Sprint Progress After Unblocking:

- Current: 3/14 tasks (21%)
- After DB-001: 4/14 tasks (29%)
- After INT-001: 5/14 tasks (36%)
- After unblocked tasks: 12/14 tasks (86%)

## 🔧 Quick Commands Reference:

```bash
# Check current progress
node scripts/backlog-utils.js sprint 0

# Monitor specific developer
node scripts/backlog-utils.js agent 18  # Database
node scripts/backlog-utils.js agent 19  # Integration

# Update task status in backlog
# Edit: docs/agents/[number]/backlog.json
# Change task status from "pending" to "in-progress" or "completed"
```

---
**Time to unblock**: ~30 minutes for deployments + 2 hours for implementations