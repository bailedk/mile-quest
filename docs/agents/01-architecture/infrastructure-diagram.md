# AWS Infrastructure Architecture Diagrams

## High-Level Architecture

```mermaid
graph TB
    subgraph "Users"
        U[Mobile/Desktop Users]
        A[Admin Users]
    end
    
    subgraph "Edge Layer"
        R53[Route 53<br/>mile-quest.com]
        CF[CloudFront CDN]
        WAF[AWS WAF]
    end
    
    subgraph "Application Layer"
        AMP[Amplify Hosting<br/>Next.js SSR]
        AMPA[Amplify Admin<br/>Admin Dashboard]
        APIG[API Gateway<br/>REST + WebSocket]
        ALB[Application Load Balancer<br/>for WebSocket scaling]
    end
    
    subgraph "Compute Layer"
        subgraph "Lambda Functions"
            LAPI[API Lambdas]
            LWS[WebSocket Lambdas]
            LJOB[Background Job Lambdas]
        end
    end
    
    subgraph "Data Layer"
        AURORA[Aurora Serverless v2<br/>PostgreSQL + PostGIS]
        REDIS[ElastiCache Serverless<br/>Redis]
        DDB[DynamoDB<br/>Sessions & Real-time]
        S3D[S3: User Data]
    end
    
    subgraph "Integration Layer"
        SQS[SQS Queues]
        SNS[SNS Topics]
        EB[EventBridge]
        COG[Cognito]
    end
    
    subgraph "External Services"
        FIT[Fitbit API]
        GFIT[Google Fit]
        MAP[Mapbox API]
    end
    
    U --> R53
    A --> R53
    R53 --> CF
    CF --> WAF
    WAF --> AMP
    WAF --> AMPA
    WAF --> APIG
    AMP --> APIG
    APIG --> ALB
    APIG --> LAPI
    ALB --> LWS
    LAPI --> COG
    LAPI --> AURORA
    LAPI --> REDIS
    LAPI --> DDB
    LAPI --> S3D
    LAPI --> SQS
    LWS --> DDB
    LWS --> REDIS
    SQS --> LJOB
    EB --> LJOB
    SNS --> LJOB
    LJOB --> AURORA
    LJOB --> FIT
    LJOB --> GFIT
    LAPI --> MAP
```

## Detailed Component Architecture

### Frontend Delivery Architecture

```mermaid
graph LR
    subgraph "Domain & DNS"
        DOMAIN[mile-quest.com]
        R53[Route 53]
    end
    
    subgraph "Amplify Platform"
        AMP_PROD[Amplify App<br/>Production]
        AMP_STAGE[Amplify App<br/>Staging]
        AMP_PR[Amplify App<br/>PR Previews]
    end
    
    subgraph "Content Delivery"
        CF[CloudFront<br/>Managed by Amplify]
        SHIELD[AWS Shield]
        WAF[AWS WAF]
    end
    
    subgraph "Source Control"
        GH[GitHub Repo]
        MAIN[main branch]
        STAGE[staging branch]
        PR[Pull Requests]
    end
    
    DOMAIN --> R53
    R53 --> AMP_PROD
    AMP_PROD --> CF
    CF --> SHIELD
    SHIELD --> WAF
    
    GH --> MAIN
    GH --> STAGE
    GH --> PR
    MAIN --> AMP_PROD
    STAGE --> AMP_STAGE
    PR --> AMP_PR
```

### API Architecture

```mermaid
graph TB
    subgraph "API Gateway"
        REST[REST API<br/>api.mile-quest.com]
        WS[WebSocket API<br/>ws.mile-quest.com]
    end
    
    subgraph "Lambda Functions by Domain"
        subgraph "Auth Functions"
            L_LOGIN[login]
            L_REGISTER[register]
            L_REFRESH[refresh]
        end
        
        subgraph "Team Functions"
            L_TEAM_CREATE[createTeam]
            L_TEAM_UPDATE[updateTeam]
            L_TEAM_INVITE[inviteMembers]
        end
        
        subgraph "Activity Functions"
            L_ACT_LOG[logActivity]
            L_ACT_SYNC[syncActivity]
            L_ACT_AGG[aggregateProgress]
        end
        
        subgraph "Map Functions"
            L_MAP_CALC[calculateRoute]
            L_MAP_GEO[geocodeAddress]
        end
    end
    
    subgraph "Authorizers"
        AUTH[Lambda Authorizer<br/>JWT Validation]
    end
    
    REST --> AUTH
    AUTH --> L_LOGIN
    AUTH --> L_REGISTER
    AUTH --> L_TEAM_CREATE
    AUTH --> L_ACT_LOG
    AUTH --> L_MAP_CALC
    WS --> L_ACT_AGG
```

### Data Flow Architecture

```mermaid
graph LR
    subgraph "Write Path"
        API[API Gateway]
        LAMBDA[Lambda]
        AURORA[Aurora Writer]
        SQS[SQS Queue]
    end
    
    subgraph "Read Path"
        API2[API Gateway]
        LAMBDA2[Lambda]
        CACHE[ElastiCache]
        AURORA_R[Aurora Reader]
    end
    
    subgraph "Real-time Path"
        WS[WebSocket]
        DDB[DynamoDB]
        REDIS[Redis Pub/Sub]
    end
    
    subgraph "Analytics Path"
        EB[EventBridge]
        LJOB[Lambda Jobs]
        S3[S3 Data Lake]
        ATHENA[Athena]
    end
    
    API --> LAMBDA
    LAMBDA --> AURORA
    LAMBDA --> SQS
    LAMBDA --> EB
    
    API2 --> LAMBDA2
    LAMBDA2 --> CACHE
    CACHE -.cache miss.-> AURORA_R
    
    WS --> DDB
    DDB --> REDIS
    
    EB --> LJOB
    LJOB --> S3
    S3 --> ATHENA
```

### Security Architecture

```mermaid
graph TB
    subgraph "Edge Security"
        SHIELD[AWS Shield Standard]
        WAF[AWS WAF]
        RULES[WAF Rules:<br/>- Rate Limiting<br/>- Geo Blocking<br/>- SQL Injection<br/>- XSS]
    end
    
    subgraph "Application Security"
        COG[Cognito User Pools]
        SECRETS[Secrets Manager]
        IAM[IAM Roles]
    end
    
    subgraph "Network Security"
        VPC[VPC]
        SG[Security Groups]
        NACL[Network ACLs]
        PRIV[Private Subnets]
    end
    
    subgraph "Data Security"
        KMS[KMS Keys]
        S3E[S3 Encryption]
        AURORA_E[Aurora Encryption]
    end
    
    SHIELD --> WAF
    WAF --> RULES
    COG --> IAM
    SECRETS --> IAM
    VPC --> SG
    SG --> NACL
    NACL --> PRIV
    KMS --> S3E
    KMS --> AURORA_E
```

## Deployment Architecture

### CI/CD Pipeline

```mermaid
graph LR
    subgraph "Source"
        GH[GitHub<br/>Monorepo]
    end
    
    subgraph "Build"
        CB[CodeBuild]
        TESTS[Unit Tests<br/>Integration Tests]
        LINT[Linting<br/>Type Checking]
    end
    
    subgraph "Package"
        ECR[ECR<br/>Lambda Containers]
        S3B[S3<br/>Lambda Zips]
        LAYER[Lambda Layers<br/>Shared Code]
    end
    
    subgraph "Deploy Staging"
        CP_S[CodePipeline<br/>Staging]
        CFN_S[CloudFormation<br/>Stack Update]
        TEST_S[E2E Tests]
    end
    
    subgraph "Deploy Production"
        APP[Manual Approval]
        CP_P[CodePipeline<br/>Production]
        CFN_P[CloudFormation<br/>Stack Update]
        CANARY[Canary Deploy]
    end
    
    GH --> CB
    CB --> TESTS
    CB --> LINT
    TESTS --> ECR
    TESTS --> S3B
    TESTS --> LAYER
    ECR --> CP_S
    S3B --> CP_S
    LAYER --> CP_S
    CP_S --> CFN_S
    CFN_S --> TEST_S
    TEST_S --> APP
    APP --> CP_P
    CP_P --> CFN_P
    CFN_P --> CANARY
```

## Cost Optimization Architecture

### Resource Utilization

```mermaid
graph TB
    subgraph "Always On (Fixed Cost)"
        R53[Route 53<br/>$0.50/month]
        NAT[NAT Gateway<br/>$45/month]
    end
    
    subgraph "Usage-Based"
        subgraph "Compute"
            LAMBDA[Lambda<br/>$0.20/1M requests]
            APIG[API Gateway<br/>$3.50/1M requests]
        end
        
        subgraph "Storage"
            S3[S3<br/>$0.023/GB]
            CF[CloudFront<br/>$0.085/GB]
        end
        
        subgraph "Database"
            AURORA[Aurora Serverless<br/>$0.12/ACU-hour]
            REDIS[ElastiCache<br/>$0.034/GB-hour]
            DDB[DynamoDB<br/>$0.25/1M requests]
        end
    end
    
    subgraph "Cost Controls"
        BUDGET[AWS Budgets]
        ALARM[Cost Alarms]
        SAVINGS[Savings Plans]
    end
```

## Disaster Recovery Architecture

```mermaid
graph TB
    subgraph "Primary Region (us-east-1)"
        P_CF[CloudFront]
        P_API[API Gateway]
        P_LAMBDA[Lambda]
        P_AURORA[Aurora Primary]
        P_S3[S3 Primary]
    end
    
    subgraph "DR Region (us-west-2)"
        D_API[API Gateway<br/>Standby]
        D_LAMBDA[Lambda<br/>Standby]
        D_AURORA[Aurora Replica]
        D_S3[S3 Cross-Region<br/>Replication]
    end
    
    subgraph "Failover Control"
        R53HC[Route 53<br/>Health Checks]
        R53F[Route 53<br/>Failover Policy]
    end
    
    P_CF --> P_API
    P_API --> P_LAMBDA
    P_LAMBDA --> P_AURORA
    P_LAMBDA --> P_S3
    
    P_AURORA -.replication.-> D_AURORA
    P_S3 -.replication.-> D_S3
    
    R53HC --> P_API
    R53HC --> D_API
    R53F --> P_API
    R53F -.failover.-> D_API
    D_API --> D_LAMBDA
    D_LAMBDA --> D_AURORA
    D_LAMBDA --> D_S3
```

## Monitoring Architecture

```mermaid
graph LR
    subgraph "Metrics Collection"
        CW[CloudWatch Metrics]
        XRAY[X-Ray Traces]
        LOGS[CloudWatch Logs]
    end
    
    subgraph "Aggregation"
        CWD[CloudWatch<br/>Dashboards]
        CWI[CloudWatch<br/>Insights]
        CWA[CloudWatch<br/>Alarms]
    end
    
    subgraph "Alerting"
        SNS[SNS Topics]
        PD[PagerDuty]
        SLACK[Slack]
        EMAIL[Email]
    end
    
    subgraph "Analysis"
        CUR[Cost & Usage<br/>Reports]
        ATHENA[Athena]
        QS[QuickSight]
    end
    
    CW --> CWD
    XRAY --> CWD
    LOGS --> CWI
    CWD --> CWA
    CWI --> CWA
    CWA --> SNS
    SNS --> PD
    SNS --> SLACK
    SNS --> EMAIL
    CW --> CUR
    CUR --> ATHENA
    ATHENA --> QS
```