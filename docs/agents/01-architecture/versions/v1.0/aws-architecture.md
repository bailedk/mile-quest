# AWS Architecture for Mile Quest

## Overview
Cost-optimized, serverless-first architecture leveraging AWS usage-based pricing models.

## Core AWS Services Selection

### Frontend Hosting
- **AWS Amplify Hosting** (Primary Choice)
  - Git-based deployments (like Vercel)
  - Automatic builds on push
  - Preview URLs for pull requests
  - Server-side rendering support
  - Pay per build minute + hosting
  - Free tier: 1000 build minutes/month, 15GB transfer/month
  - Integrated with Route 53 for mile-quest.com

### Backend Services
- **AWS Lambda** (Serverless Functions)
  - Pay per request and compute time
  - Free tier: 1M requests/month
  - Perfect for API endpoints
  - Auto-scaling built-in

- **API Gateway** (REST/WebSocket APIs)
  - Pay per API call
  - Free tier: 1M API calls/month
  - WebSocket support for real-time features
  - Built-in authentication

### Database
- **Aurora Serverless v2 PostgreSQL**
  - Pay per ACU hour (scales 0.5-1 ACU minimum)
  - PostGIS extension support
  - Auto-pause after inactivity
  - ~$0.12/hour when active (minimum)

- **DynamoDB** (Alternative for some data)
  - Pay per request pricing available
  - Free tier: 25GB storage
  - Good for user sessions, real-time data

### Caching & Queues
- **ElastiCache Serverless for Redis**
  - Pay per GB-hour
  - Scales down to zero
  - Perfect for real-time leaderboards

- **SQS** (Message Queue)
  - Pay per message
  - Free tier: 1M messages/month
  - For async distance calculations

### Storage
- **S3** (User uploads, maps cache)
  - Pay per GB stored
  - Free tier: 5GB storage
  - Lifecycle policies for cost optimization

### Authentication
- **Cognito**
  - Pay per monthly active user
  - Free tier: 50,000 MAUs
  - Social login support
  - Team-based access control

## Cost Optimization Strategies

### 1. Serverless-First Approach
- No idle compute costs
- Automatic scaling
- Pay only for actual usage

### 2. Smart Caching
- CloudFront for static assets
- ElastiCache for dynamic data
- S3 for map tile caching

### 3. Database Optimization
- Aurora Serverless auto-pause
- DynamoDB on-demand for variable workloads
- Scheduled Lambda for data aggregation

### 4. Free Tier Maximization
- Most services include generous free tiers
- Perfect for MVP and early growth

## Estimated Monthly Costs

### MVP Phase (< 100 users)
- Amplify Hosting: ~$5 (build minutes + hosting)
- Lambda: $0 (within free tier)
- API Gateway: $0 (within free tier)
- Aurora Serverless: ~$30 (assuming 8 hours/day usage)
- Total: **~$35/month**

### Growth Phase (1,000 users)
- Amplify Hosting: ~$20 (increased builds + traffic)
- Lambda: ~$20
- API Gateway: ~$10
- Aurora Serverless: ~$100
- ElastiCache: ~$30
- Total: **~$180/month**

### Scale Phase (10,000 users)
- Amplify Hosting: ~$100 (multiple environments + high traffic)
- Lambda: ~$200
- API Gateway: ~$100
- Aurora Serverless: ~$400
- ElastiCache: ~$100
- Total: **~$900/month**

## Domain Configuration

### Route 53 Setup for mile-quest.com
1. Hosted Zone: $0.50/month
2. A Record → CloudFront distribution
3. AAAA Record → CloudFront (IPv6)
4. MX Records → Email provider

### SSL/TLS
- Free SSL certificate via ACM
- Automatic renewal
- CloudFront integration

## Architecture Diagram

```
┌─────────────────┐
│   mile-quest.com│
└────────┬────────┘
         │
┌────────▼────────┐
│  AWS Amplify    │
│  (Next.js SSR)  │
└────────┬────────┘
         │
┌────────▼────────┐
│   CloudFront    │
│   (CDN + SSL)   │
└─┬──────────────┬┘
  │              │
┌─▼──────────┐  ┌─▼──────────┐
│  Amplify   │  │API Gateway │
│  Hosting   │  │(REST + WS) │
└────────────┘  └─┬──────────┘
                  │
           ┌──────▼──────┐
           │   Lambda    │
           │ Functions   │
           └─┬────────┬──┘
             │        │
      ┌──────▼──┐  ┌─▼────────┐
      │ Aurora  │  │ElastiCache│
      │Serverless  │   Redis   │
      └─────────┘  └──────────┘
```

## Monorepo Deployment Strategy

### Repository Structure
```
mile-quest/
├── apps/
│   ├── web/          → Amplify Hosting
│   ├── api/          → Lambda functions
│   └── admin/        → Amplify Hosting (separate app)
├── packages/
│   └── shared/       → NPM workspace packages
└── infrastructure/
    └── cdk/          → AWS CDK IaC
```

### CI/CD with Amplify
- **Amplify Console** for automatic deployments
- **Monorepo support** with app-specific build settings
- **Preview URLs** for every pull request
- **Environment variables** per branch
- **Custom build specifications** for Next.js

## Security Considerations

### Network Security
- VPC for Aurora (private subnets)
- Security groups limiting access
- API Gateway throttling
- WAF for DDoS protection

### Data Security
- Encryption at rest (default)
- Encryption in transit (TLS)
- IAM roles for service access
- Cognito for user auth

## Monitoring & Observability

### AWS Native Tools
- **CloudWatch** logs and metrics
- **X-Ray** for distributed tracing
- **CloudWatch Alarms** for alerts
- **Cost Explorer** for budget tracking

### Cost Alerts
- Budget alerts at $50, $100, $500
- Anomaly detection enabled
- Weekly cost reports

## Disaster Recovery

### Backup Strategy
- Aurora automated backups (7 days)
- S3 versioning for uploads
- Lambda function versioning
- Infrastructure as Code (CDK)

### Recovery Targets
- RTO: 1 hour
- RPO: 1 hour
- Multi-AZ deployment for HA