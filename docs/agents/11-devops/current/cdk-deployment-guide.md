# CDK Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Mile Quest AWS infrastructure using AWS CDK. The infrastructure is organized into separate stacks for modularity and easier management.

## Prerequisites

### Required Tools

1. **AWS CLI** (version 2.0+)
   ```bash
   # Install AWS CLI
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   
   # Configure AWS credentials
   aws configure
   ```

2. **Node.js** (version 20.x+)
   ```bash
   # Check version
   node --version
   npm --version
   ```

3. **Git**
   ```bash
   git --version
   ```

### AWS Account Setup

1. **AWS Account** with appropriate permissions
2. **IAM User** with the following policies:
   - `PowerUserAccess` (for initial setup)
   - Or custom policy with specific permissions (see Security section)

### AWS Permissions Required

The deploying user/role needs these permissions:
- CloudFormation full access
- IAM role creation and management
- VPC, EC2, RDS, Cognito, API Gateway, CloudWatch
- Systems Manager Parameter Store
- SNS topic creation

## Initial Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd mile-quest

# Install root dependencies
npm install

# Install infrastructure dependencies
cd infrastructure
npm install
```

### 2. Bootstrap CDK (One-time setup)

```bash
# Bootstrap CDK in your AWS account and region
npx cdk bootstrap aws://YOUR-ACCOUNT-ID/us-east-1

# Example:
npx cdk bootstrap aws://123456789012/us-east-1
```

**What bootstrapping does:**
- Creates an S3 bucket for CDK assets
- Creates IAM roles for CDK deployments
- Sets up the CDK toolkit stack

### 3. Verify CDK Setup

```bash
# Build the TypeScript code
npm run build

# Generate CloudFormation templates (dry run)
npm run synth

# List all stacks
npx cdk list
```

You should see:
```
MileQuest-staging-Cognito
MileQuest-staging-Database
MileQuest-staging-Api
MileQuest-staging-Monitoring
```

## Deployment Options

### Option 1: Deploy All Stacks at Once (Recommended for new deployments)

```bash
# Deploy everything
npm run deploy:all

# Or with explicit approval
npx cdk deploy --all
```

### Option 2: Deploy Individual Stacks (Recommended for updates)

```bash
# Deploy in dependency order
npm run deploy:cognito    # User authentication
npm run deploy:database   # RDS and VPC
npm run deploy:api        # API Gateway
npm run deploy:monitoring # CloudWatch dashboards
```

### Option 3: Production Deployment

```bash
# Deploy to production environment
npx cdk deploy --all --context stage=production
```

## Deployment Process

### Step 1: Deploy Cognito Stack

```bash
npm run deploy:cognito
```

**What this creates:**
- Cognito User Pool for authentication
- User Pool Client for web applications
- Custom attributes for user preferences
- SSM parameters for configuration

**Expected output:**
```
Outputs:
MileQuest-staging-Cognito.UserPoolId = us-east-1_xxxxxxxxx
MileQuest-staging-Cognito.UserPoolClientId = xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 2: Deploy Database Stack

```bash
npm run deploy:database
```

**What this creates:**
- VPC with public/private/database subnets
- RDS PostgreSQL instance with PostGIS
- Security groups and network ACLs
- Database credentials in Secrets Manager

**Expected output:**
```
Outputs:
MileQuest-staging-Database.DatabaseEndpoint = mile-quest-staging.xxxxxxxxx.us-east-1.rds.amazonaws.com
MileQuest-staging-Database.VpcId = vpc-xxxxxxxxx
```

**⚠️ Note:** Database creation takes 10-15 minutes

### Step 3: Deploy API Stack

```bash
npm run deploy:api
```

**What this creates:**
- API Gateway REST API
- Resource structure for endpoints
- CORS configuration
- Access logging setup

**Expected output:**
```
Outputs:
MileQuest-staging-Api.ApiGatewayUrl = https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/staging/
```

### Step 4: Deploy Monitoring Stack

```bash
npm run deploy:monitoring
```

**What this creates:**
- CloudWatch dashboard
- Alarms for API and database metrics
- SNS topic for alerts
- Log groups with retention policies

**Expected output:**
```
Outputs:
MileQuest-staging-Monitoring.DashboardUrl = https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=mile-quest-staging-dashboard
```

## Post-Deployment Configuration

### 1. Configure Environment Variables

```bash
# Run the environment setup script
cd ../scripts
./setup-environment.sh setup staging
```

This will:
- Extract outputs from CloudFormation stacks
- Populate environment template files
- Store configuration in `.env.staging.populated`

### 2. Verify Deployment

```bash
# Check API health endpoint
curl https://your-api-gateway-url/health

# Expected response:
# {"status": "healthy", "timestamp": "2024-01-16T..."}
```

### 3. Set Up Database Schema

```bash
# Navigate to backend package
cd ../packages/backend

# Run database migrations
npm run db:push

# Verify database connection
npm run db:studio
```

## Managing the Infrastructure

### Viewing Current Status

```bash
# Check what's deployed
npx cdk list

# Compare local code with deployed stacks
npx cdk diff

# See stack dependencies
npx cdk tree
```

### Updating Infrastructure

```bash
# Make changes to CDK code
# Build and test
npm run build
npm run synth

# Deploy changes
npx cdk deploy --all

# Or deploy specific stack
npx cdk deploy MileQuest-staging-Database
```

### Rolling Back Changes

```bash
# CDK doesn't have built-in rollback, but you can:

# 1. Revert code changes and redeploy
git checkout HEAD~1 -- lib/
npm run deploy:all

# 2. Use CloudFormation console to rollback
# 3. Restore from RDS snapshot if needed
```

## Cost Management

### Monitoring Costs

The monitoring stack includes budget alarms:
- **Staging**: $50/month threshold
- **Production**: $150/month threshold

### Cost Optimization Tips

```bash
# Delete stacks when not needed
npx cdk destroy --all

# Or destroy specific stacks
npx cdk destroy MileQuest-staging-Database
```

**⚠️ Warning:** Database destruction will delete all data unless you have snapshots!

## Troubleshooting

### Common Issues

**1. Bootstrap Error**
```bash
# Error: CDK bootstrap is required
npx cdk bootstrap aws://ACCOUNT-ID/REGION
```

**2. Permission Denied**
```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify IAM permissions
aws iam get-user
```

**3. Stack Already Exists**
```bash
# If stack exists but not tracked by CDK
npx cdk import MileQuest-staging-Cognito
```

**4. Dependency Errors**
```bash
# Rebuild dependencies
rm -rf node_modules package-lock.json
npm install
```

### Debug Commands

```bash
# Verbose CDK output
CDK_DEBUG=true npx cdk deploy

# CloudFormation events
aws cloudformation describe-stack-events --stack-name MileQuest-staging-Database

# Check parameter store values
aws ssm get-parameters-by-path --path "/mile-quest/staging/"
```

## Security Considerations

### Secrets Management

- Database passwords stored in AWS Secrets Manager
- API keys should be added to Parameter Store manually
- Never commit secrets to Git

### Network Security

- Database in private subnets only
- Security groups restrict access to necessary ports
- VPC Flow Logs can be enabled for auditing

### IAM Best Practices

- Use least privilege principles
- Rotate access keys regularly
- Enable CloudTrail for audit logging

## Production Deployment

### Additional Steps for Production

1. **Custom Domain Setup**
   ```bash
   # After deployment, configure Route 53
   # Point api.mile-quest.com to API Gateway
   ```

2. **SSL Certificates**
   ```bash
   # Request ACM certificate
   aws acm request-certificate --domain-name api.mile-quest.com
   ```

3. **Backup Strategy**
   ```bash
   # Enable automated RDS backups (already configured)
   # Set up cross-region backup replication
   ```

4. **Enhanced Monitoring**
   ```bash
   # Enable detailed CloudWatch metrics
   # Set up AWS X-Ray tracing
   # Configure log aggregation
   ```

## Advanced Topics

### Multi-Environment Deployment

```bash
# Deploy to different environments
npx cdk deploy --all --context stage=development
npx cdk deploy --all --context stage=staging
npx cdk deploy --all --context stage=production
```

### Custom Configuration

```bash
# Override default values
npx cdk deploy --context stage=production --context instanceType=t3.small
```

### Integration with CI/CD

```yaml
# GitHub Actions example
- name: Deploy Infrastructure
  run: |
    cd infrastructure
    npm install
    npm run deploy:all
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## Support and Resources

### Documentation Links

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CDK API Reference](https://docs.aws.amazon.com/cdk/api/v2/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

### Getting Help

1. Check CDK documentation for construct usage
2. Review CloudFormation events in AWS Console
3. Use AWS Support if you have a support plan
4. CDK GitHub issues for bugs

---

**Last Updated**: 2025-01-16
**Version**: 1.0
**Owner**: DevOps Agent

**Next Steps**: After successful deployment, proceed to deploy the Lambda functions using SAM in the backend package.