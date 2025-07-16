# AWS Infrastructure Setup Guide

## Overview

This guide provides step-by-step instructions for setting up the AWS infrastructure for Mile Quest using Infrastructure as Code (IaC) with AWS CDK.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Node.js 20.x installed
- AWS CDK CLI installed: `npm install -g aws-cdk`
- Docker installed (for Lambda bundling)

## Infrastructure Components

### Core Services

1. **AWS Cognito** - User authentication and management
2. **Amazon RDS** - PostgreSQL database with PostGIS
3. **AWS Lambda** - Serverless compute functions
4. **API Gateway** - REST API endpoints
5. **AWS Amplify** - Frontend hosting and CI/CD
6. **CloudFront** - CDN for static assets
7. **Route 53** - DNS management

### Supporting Services

1. **CloudWatch** - Logging and monitoring
2. **Systems Manager** - Parameter store for secrets
3. **DynamoDB** - Session storage and hot data
4. **S3** - Asset storage (future use)

## Setup Instructions

### 1. Bootstrap CDK

```bash
# Bootstrap CDK in your AWS account
cdk bootstrap aws://ACCOUNT-NUMBER/us-east-1
```

### 2. Deploy Infrastructure

```bash
# Navigate to infrastructure directory
cd infrastructure

# Install dependencies
npm install

# Deploy all stacks
npm run deploy:all

# Or deploy individually
npm run deploy:cognito
npm run deploy:database
npm run deploy:api
npm run deploy:monitoring
```

### 3. Configure Environment Variables

After deployment, update environment variables with the outputs:

```bash
# Get stack outputs
aws cloudformation describe-stacks --stack-name mile-quest-cognito --query 'Stacks[0].Outputs'
aws cloudformation describe-stacks --stack-name mile-quest-database --query 'Stacks[0].Outputs'
aws cloudformation describe-stacks --stack-name mile-quest-api --query 'Stacks[0].Outputs'
```

## Configuration Files

### Environment Variables by Stage

#### Development (.env.local)
```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/mile_quest_dev"

# AWS Cognito
AWS_REGION="us-east-1"
USER_POOL_ID="local-mock"
USER_POOL_CLIENT_ID="local-mock"

# API
API_BASE_URL="http://localhost:3001"
CORS_ORIGIN="http://localhost:3000"

# WebSocket (Pusher)
NEXT_PUBLIC_PUSHER_APP_KEY="app-key-dev"
NEXT_PUBLIC_PUSHER_CLUSTER="us2"

# External Services
MAPBOX_ACCESS_TOKEN="pk.dev-token"
```

#### Staging (.env.staging)
```bash
# Database (from CloudFormation outputs)
DATABASE_URL="${DATABASE_URL_STAGING}"

# AWS Cognito
AWS_REGION="us-east-1"
USER_POOL_ID="${USER_POOL_ID_STAGING}"
USER_POOL_CLIENT_ID="${USER_POOL_CLIENT_ID_STAGING}"

# API
API_BASE_URL="https://api-staging.mile-quest.com"
CORS_ORIGIN="https://staging.mile-quest.com"

# WebSocket
NEXT_PUBLIC_PUSHER_APP_KEY="${PUSHER_APP_KEY_STAGING}"
NEXT_PUBLIC_PUSHER_CLUSTER="us2"

# External Services
MAPBOX_ACCESS_TOKEN="${MAPBOX_TOKEN_STAGING}"
```

#### Production (.env.production)
```bash
# Database (from CloudFormation outputs)
DATABASE_URL="${DATABASE_URL_PRODUCTION}"

# AWS Cognito
AWS_REGION="us-east-1"
USER_POOL_ID="${USER_POOL_ID_PRODUCTION}"
USER_POOL_CLIENT_ID="${USER_POOL_CLIENT_ID_PRODUCTION}"

# API
API_BASE_URL="https://api.mile-quest.com"
CORS_ORIGIN="https://mile-quest.com"

# WebSocket
NEXT_PUBLIC_PUSHER_APP_KEY="${PUSHER_APP_KEY_PRODUCTION}"
NEXT_PUBLIC_PUSHER_CLUSTER="us2"

# External Services
MAPBOX_ACCESS_TOKEN="${MAPBOX_TOKEN_PRODUCTION}"
```

## Security Configuration

### IAM Roles and Policies

1. **Lambda Execution Role**: Basic execution with VPC and RDS access
2. **API Gateway Role**: CloudWatch logging permissions
3. **Amplify Role**: S3 and CloudFront permissions
4. **RDS Role**: Enhanced monitoring

### Security Groups

1. **Lambda Security Group**: Outbound HTTPS and PostgreSQL
2. **RDS Security Group**: Inbound PostgreSQL from Lambda only
3. **ALB Security Group**: Inbound HTTPS from internet

### Encryption

- **RDS**: Encryption at rest with AWS KMS
- **S3**: Default encryption enabled
- **Lambda**: Environment variables encrypted
- **API Gateway**: TLS 1.2 minimum

## Monitoring and Alerting

### CloudWatch Alarms

1. **Database**: High CPU, connections, disk space
2. **Lambda**: Errors, duration, throttles
3. **API Gateway**: 4xx/5xx errors, latency
4. **Cost**: Monthly spend threshold ($150)

### Log Groups

- `/aws/lambda/mile-quest-*`: Lambda function logs
- `/aws/apigateway/mile-quest`: API Gateway access logs
- `/aws/rds/instance/mile-quest-db/postgresql`: Database logs

## Disaster Recovery

### Backup Strategy

1. **RDS**: Automated backups (7 days retention)
2. **Database Snapshots**: Weekly manual snapshots
3. **Cross-Region Backup**: Monthly snapshots to us-west-2

### Recovery Procedures

1. **Point-in-Time Recovery**: RDS automated backup
2. **Regional Failover**: Manual promotion of read replica
3. **Full Disaster**: Restore from cross-region snapshot

## Cost Management

### Monthly Cost Breakdown

- **RDS t3.micro Multi-AZ**: ~$40
- **Lambda**: ~$10 (1M requests)
- **API Gateway**: ~$3.50 (1M requests)
- **Amplify**: ~$17 (build minutes + hosting)
- **CloudFront**: ~$5 (10GB transfer)
- **Cognito**: Free (under 50k users)
- **CloudWatch**: ~$5 (logs + metrics)

**Total**: ~$80/month

### Cost Optimization

1. **Reserved Instances**: Consider for RDS after 6 months
2. **Lambda Provisioned Concurrency**: Only if cold starts become an issue
3. **CloudWatch Log Retention**: Set to 30 days for most logs
4. **S3 Lifecycle**: Move old data to IA/Glacier

## Troubleshooting

### Common Issues

1. **Lambda Timeout**: Increase timeout for database operations
2. **RDS Connection Pool**: Configure max connections properly
3. **API Gateway CORS**: Ensure proper headers in Lambda responses
4. **Cognito Integration**: Verify JWT token validation

### Debug Commands

```bash
# Check Lambda logs
aws logs tail /aws/lambda/mile-quest-api --follow

# Check RDS status
aws rds describe-db-instances --db-instance-identifier mile-quest-db

# Test API Gateway
curl -X GET https://api.mile-quest.com/health

# Check Cognito users
aws cognito-idp list-users --user-pool-id us-east-1_xxxxxxxxx
```

## Next Steps

1. Set up monitoring dashboards
2. Configure automated deployments
3. Test disaster recovery procedures
4. Implement security scanning
5. Set up performance testing

---

**Last Updated**: 2025-01-16
**Version**: 1.0
**Owner**: DevOps Agent