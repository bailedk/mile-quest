# Mile Quest MVP Infrastructure Diagrams (Simplified)

## High-Level Architecture (MVP)

```mermaid
graph TB
    subgraph "Users"
        U[Mobile/Desktop Users]
    end
    
    subgraph "Edge Layer"
        R53[Route 53<br/>mile-quest.com]
        CF[CloudFront CDN]
    end
    
    subgraph "Frontend"
        VERCEL[Vercel<br/>Next.js App]
    end
    
    subgraph "API Layer"
        APIG[API Gateway<br/>REST API]
    end
    
    subgraph "Compute Layer"
        subgraph "Lambda Functions"
            LAUTH[Auth Lambdas]
            LAPI[API Lambdas]
            LJOB[Job Lambdas]
        end
    end
    
    subgraph "Data Layer"
        RDS[RDS PostgreSQL<br/>Multi-AZ]
        DDB[DynamoDB<br/>Sessions & Hot Data]
        S3[S3: Images]
    end
    
    subgraph "External Services"
        COG[Cognito<br/>Auth]
        PUSHER[Pusher<br/>WebSockets]
        REK[Rekognition<br/>Image Moderation]
    end
    
    U --> R53
    R53 --> CF
    CF --> VERCEL
    VERCEL --> APIG
    APIG --> LAUTH
    APIG --> LAPI
    LAUTH --> COG
    LAPI --> RDS
    LAPI --> DDB
    LAPI --> S3
    LAPI --> PUSHER
    S3 --> REK
    REK --> LJOB
    LJOB --> RDS
```

## Simplified Data Flow

```mermaid
graph LR
    subgraph "Activity Logging Flow"
        CLIENT[Mobile App]
        IDB[IndexedDB<br/>Offline Queue]
        API[API Gateway]
        LAMBDA[Lambda]
        RDS[PostgreSQL]
        PUSHER[Pusher]
        TEAM[Team Members]
    end
    
    CLIENT --> IDB
    IDB --> API
    API --> LAMBDA
    LAMBDA --> RDS
    LAMBDA --> PUSHER
    PUSHER --> TEAM
```

## MVP Cost Architecture

```mermaid
graph TB
    subgraph "Fixed Costs (~$50/month)"
        RDS[RDS PostgreSQL<br/>t3.micro Multi-AZ<br/>$40/month]
        R53[Route 53<br/>$0.50/month]
        S3[S3 Storage<br/>~$5/month]
        DDB[DynamoDB<br/>On-Demand<br/>~$5/month]
    end
    
    subgraph "Usage-Based (~$20/month)"
        LAMBDA[Lambda<br/>~$10/month]
        APIG[API Gateway<br/>~$3.50/month]
        CF[CloudFront<br/>~$5/month]
    end
    
    subgraph "Free Tier"
        COG[Cognito<br/>50k users free]
        PUSHER[Pusher<br/>200 connections free]
        VERCEL[Vercel<br/>Hobby plan free]
        REK[Rekognition<br/>5k images free]
    end
    
    subgraph "Total: ~$70/month"
    end
```

## Deployment Architecture (MVP)

```mermaid
graph LR
    subgraph "Simple CI/CD"
        GH[GitHub]
        GA[GitHub Actions]
        VERCEL[Vercel<br/>Auto-Deploy]
        SAM[AWS SAM<br/>Deploy]
    end
    
    subgraph "Environments"
        DEV[Development<br/>Local]
        STAGE[Staging<br/>AWS]
        PROD[Production<br/>AWS]
    end
    
    GH --> GA
    GA --> VERCEL
    GA --> SAM
    SAM --> DEV
    SAM --> STAGE
    STAGE --> PROD
```

## Security Architecture (MVP)

```mermaid
graph TB
    subgraph "Basic Security"
        HTTPS[HTTPS Everywhere<br/>CloudFront + Vercel]
        COG[Cognito<br/>Email + Google Auth]
        APIK[API Keys<br/>Service-to-Service]
    end
    
    subgraph "Data Security"
        RDS_E[RDS Encryption<br/>At Rest]
        S3_E[S3 Encryption<br/>Default]
        SSL[SSL/TLS<br/>In Transit]
    end
    
    subgraph "Application Security"
        RATE[Rate Limiting<br/>API Gateway]
        VAL[Input Validation<br/>Lambda]
        MOD[Image Moderation<br/>Rekognition]
    end
    
    HTTPS --> COG
    COG --> APIK
    RDS_E --> SSL
    S3_E --> SSL
    RATE --> VAL
    VAL --> MOD
```

## Image Upload Flow (MVP)

```mermaid
sequenceDiagram
    participant User
    participant App
    participant API
    participant Lambda
    participant S3
    participant Rekognition
    
    User->>App: Select Image
    App->>API: Request Presigned URL
    API->>Lambda: Generate URL
    Lambda->>App: Return Presigned URL
    App->>S3: Direct Upload
    S3->>Lambda: Trigger Processing
    Lambda->>Rekognition: Check Content
    Rekognition->>Lambda: Safe/Unsafe
    Lambda->>S3: Resize & Save
    Lambda->>API: Update Activity
```

## Offline Support Architecture (MVP)

```mermaid
graph TB
    subgraph "Client Side"
        APP[PWA App]
        SW[Service Worker]
        IDB[IndexedDB]
        QUEUE[Offline Queue]
    end
    
    subgraph "Sync Process"
        SYNC[Sync Manager]
        RETRY[Retry Logic]
        CONFLICT[Last-Write-Wins]
    end
    
    subgraph "Server Side"
        API[API Gateway]
        LAMBDA[Lambda]
        RDS[PostgreSQL]
    end
    
    APP --> SW
    SW --> IDB
    IDB --> QUEUE
    QUEUE --> SYNC
    SYNC --> RETRY
    RETRY --> API
    API --> LAMBDA
    LAMBDA --> CONFLICT
    CONFLICT --> RDS
```

## Monitoring Architecture (MVP)

```mermaid
graph LR
    subgraph "Basic Monitoring"
        CW[CloudWatch<br/>Logs & Metrics]
        ALARM[Basic Alarms<br/>Errors & Latency]
        GA4[Google Analytics<br/>User Behavior]
    end
    
    subgraph "Alerting"
        EMAIL[Email Alerts]
        BUDGET[Budget Alerts<br/>$150 threshold]
    end
    
    subgraph "Dashboards"
        CWD[CloudWatch<br/>Dashboard]
        GA4D[GA4 Dashboard]
    end
    
    CW --> ALARM
    ALARM --> EMAIL
    CW --> BUDGET
    BUDGET --> EMAIL
    CW --> CWD
    GA4 --> GA4D
```

## Migration Path Architecture

```mermaid
graph LR
    subgraph "MVP (Now)"
        RDS1[RDS PostgreSQL]
        PUSHER1[Pusher]
        CF1[CloudFront Only]
        REST1[REST API]
    end
    
    subgraph "Scale (Later)"
        AURORA[Aurora Serverless]
        IOT[AWS IoT Core]
        REDIS[ElastiCache]
        GQL[GraphQL]
    end
    
    subgraph "Triggers"
        T1[">10k users"]
        T2[">1k concurrent"]
        T3[">50 req/sec"]
        T4[">60% mobile"]
    end
    
    RDS1 -.-> T1
    T1 -.-> AURORA
    PUSHER1 -.-> T2
    T2 -.-> IOT
    CF1 -.-> T3
    T3 -.-> REDIS
    REST1 -.-> T4
    T4 -.-> GQL
```

## Key Differences from Original

| Component | Original | MVP | Savings |
|-----------|----------|-----|---------|
| Database | Aurora Serverless v2 | RDS PostgreSQL | 60% |
| WebSocket | Custom Lambda + ALB | Pusher (managed) | 80% |
| Caching | ElastiCache + DynamoDB | CloudFront only | 100% |
| API | REST + GraphQL planned | REST only | Simpler |
| Monitoring | X-Ray + Full Stack | Basic CloudWatch | 90% |
| Security | WAF + Shield | Basic rate limiting | $100/mo |
| Frontend | S3 + CloudFront | Vercel | Faster deploys |

## Total MVP Infrastructure

- **Services Used**: 10 (vs 20+ in original)
- **Monthly Cost**: ~$70 (vs $250-600)
- **Setup Time**: 1 week (vs 3-4 weeks)
- **Maintenance**: Minimal (mostly managed services)

---

*This simplified architecture maintains all core functionality while dramatically reducing complexity and cost.*