# Mile Quest Deployment Guide

A comprehensive step-by-step guide for deploying Mile Quest to AWS in production.

## 📋 **Table of Contents**

- [Overview](#overview)
- [What Gets Deployed](#what-gets-deployed)
- [Prerequisites](#prerequisites)
- [Step-by-Step Deployment](#step-by-step-deployment)
- [Post-Deployment Setup](#post-deployment-setup)
- [Cost Estimates](#cost-estimates)
- [Ongoing Management](#ongoing-management)
- [Troubleshooting](#troubleshooting)

---

## 🔍 **Overview**

Mile Quest uses a hybrid AWS deployment approach:
- **Infrastructure**: AWS CDK for VPC, RDS, Cognito, API Gateway
- **Backend APIs**: AWS SAM for Lambda function deployment
- **Frontend**: AWS Amplify for Next.js hosting
- **Database**: PostgreSQL with PostGIS on RDS

**Total deployment time**: 45-60 minutes (first time), 5-15 minutes (updates)

---

## 🏗️ **What Gets Deployed**

### **✅ Automated Deployment**
- **AWS CDK Stacks**: VPC, RDS PostgreSQL, Cognito, API Gateway, CloudWatch monitoring
- **Lambda Functions**: All backend APIs via SAM templates
- **Frontend**: Next.js app via AWS Amplify
- **Networking**: Security groups, subnets, internet gateways
- **Monitoring**: CloudWatch dashboards, alarms, log groups

### **⚙️ Manual Configuration Required**
- **External API Keys**: Mapbox access tokens, Pusher credentials
- **Domain Setup**: Custom domain configuration (optional)
- **Database Migration**: Running Prisma schema setup
- **Environment Variables**: Production secrets and configuration
- **SSL Certificates**: If using custom domains

---

## 📋 **Prerequisites**

### **Required Tools**

1. **AWS CLI v2**
   ```bash
   # macOS
   curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
   sudo installer -pkg AWSCLIV2.pkg -target /
   
   # Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip && sudo ./aws/install
   
   # Configure credentials
   aws configure
   ```

2. **AWS SAM CLI**
   ```bash
   # macOS
   brew install aws-sam-cli
   
   # Linux/pip
   pip install aws-sam-cli
   ```

3. **Node.js 20+ and npm**
   ```bash
   # Check versions
   node --version  # Should be 20.x+
   npm --version   # Should be 10.x+
   ```

4. **Git**
   ```bash
   git --version
   ```

### **AWS Account Requirements**

- **AWS Account** with billing enabled
- **IAM User** with these policies:
  - `PowerUserAccess` (recommended for initial setup)
  - Or custom policy with: CloudFormation, VPC, RDS, Cognito, API Gateway, Lambda, IAM permissions
- **Region**: Recommended `us-east-1` (some services require this region)
- **Account limits**: Ensure you have capacity for RDS instances and VPC resources

### **External Service Accounts (Optional)**

- **Mapbox Account**: For mapping features ([mapbox.com](https://mapbox.com))
- **Pusher Account**: For real-time WebSocket features ([pusher.com](https://pusher.com))

---

## 🚀 **Step-by-Step Deployment**

### **Phase 1: Infrastructure Setup (AWS CDK) - ~30 minutes**

#### **Step 1: Repository Setup**
```bash
# Clone repository
git clone <your-repo-url>
cd mile-quest

# Install all dependencies
npm install

# Navigate to infrastructure
cd infrastructure
npm install
```

#### **Step 2: Bootstrap CDK (One-time per AWS account)**
```bash
# Get your AWS account ID
aws sts get-caller-identity

# Bootstrap CDK for your account and region
npx cdk bootstrap aws://YOUR-ACCOUNT-ID/us-east-1

# Example:
npx cdk bootstrap aws://123456789012/us-east-1
```

**What bootstrapping does:**
- Creates S3 bucket for CDK assets
- Creates IAM roles for CDK deployments
- Sets up CDK toolkit stack

#### **Step 3: Preview Infrastructure**
```bash
# Build TypeScript code
npm run build

# Generate CloudFormation templates (dry run)
npm run synth

# List all stacks that will be created
npx cdk list
```

**Expected output:**
```
MileQuest-staging-Cognito
MileQuest-staging-Database
MileQuest-staging-Api
MileQuest-staging-Monitoring
```

#### **Step 4: Deploy Infrastructure Stacks**

**Option A: Deploy All at Once (Recommended)**
```bash
npm run deploy:all
```

**Option B: Deploy Individual Stacks**
```bash
# Deploy in dependency order
npm run deploy:cognito     # ~5 min  - User authentication
npm run deploy:database    # ~15 min - PostgreSQL + VPC
npm run deploy:api         # ~3 min  - API Gateway
npm run deploy:monitoring  # ~5 min  - CloudWatch dashboards
```

**What each stack creates:**

**Cognito Stack:**
- Cognito User Pool for authentication
- User Pool Client for web applications
- Custom attributes for user preferences
- SSM parameters for configuration

**Database Stack:**
- VPC with public/private/database subnets
- RDS PostgreSQL instance with PostGIS
- Security groups and network ACLs
- Database credentials in Secrets Manager

**API Stack:**
- API Gateway REST API
- Resource structure for endpoints
- CORS configuration
- Access logging setup

**Monitoring Stack:**
- CloudWatch dashboard
- Alarms for API and database metrics
- SNS topic for alerts
- Log groups with retention policies

#### **Step 5: Record Infrastructure Outputs**
```bash
# Save important outputs for later use
aws cloudformation describe-stacks --stack-name MileQuest-staging-Cognito \
  --query 'Stacks[0].Outputs' > cognito-outputs.json

aws cloudformation describe-stacks --stack-name MileQuest-staging-Database \
  --query 'Stacks[0].Outputs' > database-outputs.json

aws cloudformation describe-stacks --stack-name MileQuest-staging-Api \
  --query 'Stacks[0].Outputs' > api-outputs.json
```

---

### **Phase 2: Backend API Deployment (AWS SAM) - ~10 minutes**

#### **Step 6: Configure Backend Environment**
```bash
cd packages/backend

# Copy environment template
cp env.json env.json.backup

# Update env.json with values from CDK outputs
# You'll need:
# - DATABASE_URL: From RDS endpoint (database-outputs.json)
# - COGNITO_USER_POOL_ID: From Cognito stack
# - JWT_SECRET: Generate a secure secret
```

**Sample env.json configuration:**
```json
{
  "ActivitiesFunction": {
    "DATABASE_URL": "postgresql://username:password@your-rds-endpoint:5432/mile_quest_prod",
    "JWT_SECRET": "your-super-secure-jwt-secret-change-this",
    "CORS_ORIGIN": "https://your-domain.com",
    "NODE_ENV": "production"
  }
}
```

#### **Step 7: Build and Deploy Lambda Functions**
```bash
# Build all Lambda functions
npm run build

# Deploy via SAM (first time - guided setup)
sam deploy --guided

# Follow the prompts:
# Stack name: mile-quest-backend-staging
# AWS Region: us-east-1
# Parameter DatabaseUrl: (from your RDS endpoint)
# Parameter JwtSecret: (your secure secret)
# Confirm changes before deploy: Y
# Allow SAM CLI IAM role creation: Y
# Save parameters to samconfig.toml: Y
```

**For subsequent deployments:**
```bash
# Quick deployment using saved config
sam deploy
```

**What this creates:**
- **10 Lambda Functions**: Health, Auth, Users, Teams, Activities, Dashboard, Progress, Leaderboards, WebSocket, Scheduled
- **API Gateway Integration**: Routes requests to appropriate Lambda functions
- **IAM Roles**: Execution roles with database and service permissions
- **CloudWatch Log Groups**: For Lambda function logs

---

### **Phase 3: Database Schema Setup - ~5 minutes**

#### **Step 8: Initialize Database Schema**
```bash
# Still in packages/backend directory

# Generate Prisma client
npm run db:generate

# Push schema to database (creates all tables)
npm run db:push

# Verify database connection
npm run test:db-connection  # Custom script to test DB
```

#### **Step 9: Seed Initial Data (Optional)**
```bash
# Add initial data like achievements, sample teams
npm run db:seed

# Verify seeding worked
npm run db:studio  # Opens Prisma Studio in browser
```

**What this creates in the database:**
- **Users table**: User profiles and authentication data
- **Teams table**: Team information and settings
- **TeamGoals table**: Geographic routes and distance targets
- **Activities table**: User walking/running logs
- **Achievements table**: Gamification badges and rewards
- **UserStats table**: Aggregated user statistics
- **Indexes**: Optimized for common queries

---

### **Phase 4: Frontend Deployment (AWS Amplify) - ~15 minutes**

#### **Step 10: Set Up Amplify Hosting**

**Option A: Via AWS Console (Recommended)**

1. **Go to Amplify Console**: [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. **Create New App**: Click "New app" → "Host web app"
3. **Connect Repository**: Select GitHub and authorize access to your repository
4. **Configure Build Settings**:
   ```yaml
   # amplify.yml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm install
           - cd packages/frontend && npm install
       build:
         commands:
           - cd packages/frontend && npm run build
     artifacts:
       baseDirectory: packages/frontend/.next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
         - packages/frontend/node_modules/**/*
         - packages/frontend/.next/cache/**/*
   ```
5. **Advanced Settings**: Set root directory to `packages/frontend`
6. **Deploy**: Click "Save and deploy"

#### **Step 11: Configure Amplify Environment Variables**

In the Amplify Console → Your App → Environment variables, add:

```bash
# Required variables
NEXT_PUBLIC_API_URL=https://YOUR-API-GATEWAY-URL/staging
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=YOUR_CLIENT_ID

# Optional production variables
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token
NEXT_PUBLIC_PUSHER_APP_KEY=your_pusher_key
NEXT_PUBLIC_PUSHER_CLUSTER=us2
NEXT_PUBLIC_DOMAIN=https://your-domain.com
NODE_ENV=production
```

**To get the values:**
```bash
# API Gateway URL
aws apigateway get-rest-apis --query 'items[?name==`MileQuest-staging-Api`]'

# Cognito details from your saved outputs
cat cognito-outputs.json
```

#### **Step 12: Set Up Custom Domain (Optional)**
```bash
# If you have a custom domain
# 1. In Amplify Console → Domain management
# 2. Add domain (e.g., app.mile-quest.com)
# 3. Amplify will create SSL certificate automatically
# 4. Update your DNS records as instructed
```

---

### **Phase 5: External Services Configuration (Optional) - ~10 minutes**

#### **Step 13: Set Up Mapbox Integration**
```bash
# 1. Sign up at mapbox.com
# 2. Create a new access token with these scopes:
#    - Maps API
#    - Geocoding API
#    - Directions API

# 3. Add token to AWS Parameter Store
aws ssm put-parameter \
  --name "/mile-quest/staging/MAPBOX_ACCESS_TOKEN" \
  --value "pk.your_actual_token_here" \
  --type "SecureString" \
  --description "Mapbox access token for Mile Quest"

# 4. Update Lambda environment
sam deploy --parameter-overrides \
  MapboxToken="pk.your_actual_token_here"
```

#### **Step 14: Configure Pusher WebSocket (Optional)**
```bash
# 1. Sign up at pusher.com
# 2. Create a new app with these settings:
#    - Name: mile-quest-staging
#    - Cluster: us2 (or closest to your region)
#    - Enable client events: Yes

# 3. Get your app credentials and add to Parameter Store
aws ssm put-parameter \
  --name "/mile-quest/staging/PUSHER_APP_ID" \
  --value "your_app_id" \
  --type "String"

aws ssm put-parameter \
  --name "/mile-quest/staging/PUSHER_KEY" \
  --value "your_key" \
  --type "String"

aws ssm put-parameter \
  --name "/mile-quest/staging/PUSHER_SECRET" \
  --value "your_secret" \
  --type "SecureString"

# 4. Update Amplify environment variables with Pusher key
# Add NEXT_PUBLIC_PUSHER_APP_KEY to Amplify Console
```

---

## ✅ **Post-Deployment Setup**

### **Step 15: Verify Deployment**

#### **Test Backend APIs**
```bash
# Test health endpoint
curl https://YOUR-API-GATEWAY-URL/health

# Expected response:
# {"status":"healthy","timestamp":"2024-01-16T12:00:00.000Z","checks":{"database":{"status":"connected"}}}

# Test authentication (should return 401)
curl https://YOUR-API-GATEWAY-URL/users/me

# Expected response:
# {"error":"Authentication required"}
```

#### **Test Frontend**
```bash
# Visit your Amplify app URL
# Should show Mile Quest landing page
# Test user registration and login flows
```

#### **Test Database Connection**
```bash
cd packages/backend

# Test database directly
npm run test:db-connection

# Should show successful connection and table count
```

### **Step 16: Set Up Monitoring and Alerts**

#### **Configure CloudWatch Alerts**
```bash
# Create SNS topic for alerts
aws sns create-topic --name mile-quest-alerts

# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:YOUR-ACCOUNT:mile-quest-alerts \
  --protocol email \
  --notification-endpoint your-email@domain.com

# Confirm subscription in your email
```

#### **View Monitoring Dashboard**
```bash
# Get dashboard URL
aws cloudwatch describe-dashboards --dashboard-names mile-quest-staging-dashboard

# Or visit AWS Console → CloudWatch → Dashboards
```

### **Step 17: Set Up Backup and Recovery**

#### **Database Backups**
```bash
# Verify automated backups are enabled (should be automatic)
aws rds describe-db-instances \
  --db-instance-identifier mile-quest-staging \
  --query 'DBInstances[0].BackupRetentionPeriod'

# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier mile-quest-staging \
  --db-snapshot-identifier mile-quest-staging-initial-snapshot
```

#### **Application Backups**
```bash
# Code is backed up in Git
# Infrastructure can be recreated from CDK code
# Database has automated daily backups

# Export configuration for disaster recovery
aws cloudformation describe-stacks > stack-configuration-backup.json
```

---

## 💰 **Cost Estimates**

### **Staging Environment (~$50-80/month)**
| Service | Instance/Plan | Monthly Cost |
|---------|---------------|--------------|
| **RDS PostgreSQL** | t3.micro (1 vCPU, 1GB RAM) | $25-30 |
| **Lambda Functions** | ~1M requests/month | $5-10 |
| **API Gateway** | ~1M requests/month | $3-5 |
| **Amplify Hosting** | Build + hosting | $5-10 |
| **CloudWatch** | Logs + monitoring | $2-5 |
| **Data Transfer** | Moderate usage | $5-10 |
| **VPC/Networking** | NAT Gateway, etc. | $5-10 |
| **Total** | | **$50-85** |

### **Production Environment (~$150-250/month)**
| Service | Instance/Plan | Monthly Cost |
|---------|---------------|--------------|
| **RDS PostgreSQL** | t3.small Multi-AZ (2 vCPU, 2GB RAM) | $60-80 |
| **Lambda Functions** | ~10M requests/month | $15-25 |
| **API Gateway** | ~10M requests/month | $10-15 |
| **Amplify Hosting** | Build + CDN + custom domain | $15-25 |
| **CloudWatch** | Enhanced monitoring | $10-15 |
| **Data Transfer** | High usage + CDN | $20-30 |
| **VPC/Networking** | NAT Gateway, Load Balancer | $15-25 |
| **SNS/SES** | Notifications + emails | $5-10 |
| **Backup Storage** | Snapshots + logs | $10-20 |
| **Total** | | **$160-245** |

### **Additional Costs (Optional)**
- **Custom Domain**: $0-15/month (depends on domain registrar)
- **Mapbox**: $0-50/month (has generous free tier)
- **Pusher**: $0-20/month (free tier available)
- **Enhanced Support**: $29-100+/month (AWS support plans)

### **Cost Optimization Tips**
```bash
# Monitor costs
aws budgets create-budget --account-id YOUR-ACCOUNT-ID \
  --budget file://budget-config.json

# Set up cost alerts
aws cloudwatch put-metric-alarm \
  --alarm-name "Monthly-Cost-Alert" \
  --alarm-description "Alert when monthly costs exceed threshold"

# Use AWS Cost Explorer for analysis
# Regularly review RDS instance sizing
# Monitor Lambda cold starts and optimize memory allocation
```

---

## 🔧 **Ongoing Management**

### **Application Updates**

#### **Backend Updates**
```bash
cd packages/backend

# Update Lambda code
npm run build
sam deploy

# Database schema changes
npm run db:migrate
# or for development
npm run db:push
```

#### **Frontend Updates**
```bash
# Automatic deployment via Git
git add .
git commit -m "Update frontend features"
git push origin main

# Amplify will automatically detect and deploy
# Check build status in Amplify Console
```

#### **Infrastructure Updates**
```bash
cd infrastructure

# Update CDK code as needed
npm run build

# Preview changes
npx cdk diff

# Deploy changes
npm run deploy:all
```

### **Monitoring and Maintenance**

#### **View Application Logs**
```bash
# Lambda function logs
aws logs tail /aws/lambda/mile-quest-activities --follow

# API Gateway logs
aws logs tail mile-quest-api-gateway-logs --follow

# RDS logs
aws rds describe-db-log-files --db-instance-identifier mile-quest-staging
```

#### **Database Maintenance**
```bash
# Check database performance
aws rds describe-db-instances \
  --db-instance-identifier mile-quest-staging \
  --query 'DBInstances[0].DBInstanceStatus'

# Monitor connections
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=mile-quest-staging \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300 \
  --statistics Average,Maximum
```

#### **Performance Monitoring**
```bash
# Lambda performance
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=mile-quest-activities \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300 \
  --statistics Average,Maximum

# API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300 \
  --statistics Average,Maximum
```

### **Scaling Considerations**

#### **When to Scale Database**
- Connection limit reached (>80% of max_connections)
- CPU utilization consistently >70%
- Memory usage >80%
- Query response times >500ms

```bash
# Upgrade RDS instance
aws rds modify-db-instance \
  --db-instance-identifier mile-quest-staging \
  --db-instance-class db.t3.small \
  --apply-immediately
```

#### **When to Scale Lambda Functions**
- Cold start times >3 seconds
- Memory usage >80% of allocated
- Timeout errors occurring

```bash
# Update Lambda memory/timeout in template.yaml
# Then redeploy with sam deploy
```

#### **When to Enable Provisioned Concurrency**
- Consistent traffic patterns
- Cold starts affecting user experience
- Cost-effective at high request volumes

---

## 🚨 **Troubleshooting**

### **Common Deployment Issues**

#### **CDK Bootstrap Errors**
```bash
# Error: "Need to perform AWS CDK bootstrap"
# Solution: Bootstrap with specific permissions
npx cdk bootstrap \
  --trust=YOUR-ACCOUNT-ID \
  --cloudformation-execution-policies arn:aws:iam::aws:policy/PowerUserAccess

# Error: "Account has not been bootstrapped"
# Solution: Check you're using the correct region
aws configure get region
npx cdk bootstrap aws://ACCOUNT/CORRECT-REGION
```

#### **RDS Connection Issues**
```bash
# Error: "Connection refused" or "timeout"
# Check security groups
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=*mile-quest*"

# Check if RDS is accessible from Lambda subnet
aws rds describe-db-instances \
  --db-instance-identifier mile-quest-staging \
  --query 'DBInstances[0].DBSubnetGroup'

# Test connection from Lambda
aws lambda invoke \
  --function-name mile-quest-health \
  --payload '{}' \
  response.json && cat response.json
```

#### **Lambda Permission Errors**
```bash
# Error: "AccessDenied" or "Role not found"
# Check IAM roles created by SAM
aws iam list-roles --query 'Roles[?contains(RoleName, `mile-quest`)]'

# Check Lambda execution role permissions
aws lambda get-function \
  --function-name mile-quest-activities \
  --query 'Configuration.Role'

# Update permissions if needed via SAM template
```

#### **API Gateway CORS Errors**
```bash
# Error: "CORS policy" in browser
# Check API Gateway CORS configuration
aws apigateway get-resources --rest-api-id YOUR-API-ID

# Update CORS in CDK template if needed
# Redeploy API stack
cd infrastructure && npm run deploy:api
```

#### **Amplify Build Failures**
```bash
# Check build logs in Amplify Console
# Common issues:
# 1. Environment variables missing
# 2. Build commands incorrect
# 3. Node.js version mismatch

# Fix build settings in amplify.yml
# Ensure all required env vars are set
# Check build output in Amplify Console → Build settings
```

### **Database Issues**

#### **Slow Query Performance**
```bash
# Enable query logging
aws rds modify-db-parameter-group \
  --db-parameter-group-name mile-quest-staging-params \
  --parameters "ParameterName=log_statement,ParameterValue=all,ApplyMethod=immediate"

# Check slow query log
aws rds download-db-log-file-portion \
  --db-instance-identifier mile-quest-staging \
  --log-file-name error/postgresql.log

# Analyze queries with Prisma Studio or pgAdmin
```

#### **Connection Pool Exhaustion**
```bash
# Check current connections
# Connect to RDS and run:
# SELECT count(*) FROM pg_stat_activity;

# Increase max_connections in parameter group
aws rds modify-db-parameter-group \
  --db-parameter-group-name mile-quest-staging-params \
  --parameters "ParameterName=max_connections,ParameterValue=200,ApplyMethod=pending-reboot"

# Optimize Lambda connection pooling in code
```

### **Performance Issues**

#### **High Lambda Cold Starts**
```bash
# Monitor cold start metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name InitDuration \
  --dimensions Name=FunctionName,Value=mile-quest-activities

# Solutions:
# 1. Increase memory allocation
# 2. Enable provisioned concurrency for critical functions
# 3. Optimize bundle size and dependencies
```

#### **API Gateway Latency**
```bash
# Check latency metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name IntegrationLatency

# Solutions:
# 1. Enable API Gateway caching
# 2. Optimize Lambda function performance
# 3. Review database query efficiency
```

### **Security Issues**

#### **Authentication Failures**
```bash
# Check Cognito configuration
aws cognito-idp describe-user-pool --user-pool-id YOUR-POOL-ID

# Verify JWT token configuration
aws cognito-idp describe-user-pool-client \
  --user-pool-id YOUR-POOL-ID \
  --client-id YOUR-CLIENT-ID

# Test authentication flow manually
curl -X POST https://YOUR-COGNITO-DOMAIN/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=YOUR-CLIENT-ID"
```

#### **VPC Security Group Issues**
```bash
# Check security group rules
aws ec2 describe-security-groups \
  --group-ids sg-xxxxxxxxx

# Verify Lambda can reach RDS
aws ec2 describe-vpc-endpoints \
  --vpc-endpoint-ids vpce-xxxxxxxxx

# Test network connectivity
```

### **Recovery Procedures**

#### **Database Recovery**
```bash
# List available snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier mile-quest-staging

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier mile-quest-staging-restored \
  --db-snapshot-identifier mile-quest-staging-backup-snapshot
```

#### **Application Recovery**
```bash
# Rollback to previous deployment
cd packages/backend
sam deploy --parameter-overrides \
  Version=previous-stable-version

# Rollback infrastructure
cd infrastructure
git checkout previous-stable-commit
npm run deploy:all
```

#### **Complete Environment Recreation**
```bash
# Destroy everything (careful!)
cd infrastructure
npm run destroy:all

# Recreate from scratch
npm run deploy:all
cd ../packages/backend
sam deploy --guided
```

---

## 📞 **Support and Resources**

### **Documentation Links**
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [AWS Amplify Documentation](https://docs.aws.amazon.com/amplify/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

### **Project-Specific Documentation**
- **Architecture Overview**: `docs/agents/01-architecture/current/mvp-architecture.md`
- **API Documentation**: `docs/agents/04-api-designer/current/`
- **Database Schema**: `packages/backend/prisma/schema.prisma`
- **Frontend Components**: `packages/frontend/src/components/`

### **Getting Help**

1. **Check AWS Service Health**: [AWS Status Page](https://status.aws.amazon.com/)
2. **Review CloudWatch Logs**: Check function-specific logs for errors
3. **AWS Support**: Use AWS Support Center if you have a support plan
4. **Community Resources**: AWS forums, Stack Overflow, GitHub issues

### **Emergency Contacts**
```bash
# Set up emergency notification
aws sns create-topic --name mile-quest-emergency
aws sns subscribe --topic-arn arn:aws:sns:REGION:ACCOUNT:mile-quest-emergency \
  --protocol sms --notification-endpoint +1234567890
```

---

## 🎯 **Next Steps After Deployment**

1. **Set up monitoring alerts** for critical metrics
2. **Configure automated backups** and test recovery procedures  
3. **Set up CI/CD pipeline** for automated deployments
4. **Performance testing** with realistic load
5. **Security review** and penetration testing
6. **Cost optimization** review after 1 month of usage
7. **Documentation updates** based on deployment experience

---

**Last Updated**: January 2025  
**Version**: 1.0  
**Deployment Guide Maintainer**: DevOps Team

For questions or issues with this deployment guide, please check the troubleshooting section above or refer to the project-specific documentation in the `docs/` directory.