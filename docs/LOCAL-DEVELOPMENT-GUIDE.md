# Mile Quest Local Development Guide

## 🎯 Overview

This guide enables full local development of Mile Quest, avoiding AWS infrastructure costs until deployment is necessary. Perfect for solo development with Claude Code.

## 🐳 Local Service Stack

### 1. PostgreSQL Database (via Docker)

```bash
# Start PostgreSQL with PostGIS support
docker run -d \
  --name milequest-postgres \
  -e POSTGRES_PASSWORD=localdev \
  -e POSTGRES_DB=milequest \
  -p 5432:5432 \
  postgis/postgis:14-3.3-alpine

# Connection string
DATABASE_URL="postgresql://postgres:localdev@localhost:5432/milequest"
```

### 2. Local Authentication (Mock Cognito)

For Sprint 0-2, use the mock auth service already created:
```typescript
// Backend uses MockAuthService automatically when AWS_COGNITO_USER_POOL_ID is not set
// Frontend can use a simple JWT implementation
```

### 3. Local WebSocket (Development Mode)

Options:
- Use mock WebSocket service for testing
- Or run local Socket.io server (no Pusher needed)

```bash
# Optional: Simple WebSocket server
npm install -g @soketi/soketi
soketi start --config=soketi.json
```

### 4. Local Email (Development Mode)

```typescript
// MockEmailService logs emails to console
// Or use Ethereal Email for testing: https://ethereal.email
```

## 📁 Project Setup

### Backend Setup

```bash
cd packages/backend

# Create .env.local file
cat > .env.local << EOF
NODE_ENV=development
DATABASE_URL=postgresql://postgres:localdev@localhost:5432/milequest
JWT_SECRET=local-development-secret-change-in-production
CORS_ORIGIN=http://localhost:3000
SERVICE_IMPLEMENTATIONS=mock
LOG_LEVEL=debug
EOF

# Install dependencies
npm install

# Run Prisma migrations
npx prisma migrate dev --name init
npx prisma generate

# Seed database (when seed file is ready)
npx prisma db seed

# Start local API server
npm run dev
```

### Frontend Setup

```bash
cd packages/frontend

# Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:6001
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token-here
EOF

# Install and run
npm install
npm run dev
```

## 🔧 Development Workflow

### Daily Development

1. **Start Services**
   ```bash
   # Terminal 1: Ensure Docker is running
   docker start milequest-postgres
   
   # Terminal 2: Backend
   cd packages/backend && npm run dev
   
   # Terminal 3: Frontend
   cd packages/frontend && npm run dev
   ```

2. **Database Management**
   ```bash
   # View database
   npx prisma studio
   
   # Reset database
   npx prisma migrate reset
   
   # Create migration
   npx prisma migrate dev --name your-migration-name
   ```

### Testing

```bash
# Backend tests (uses mock services)
cd packages/backend
npm test

# Frontend tests
cd packages/frontend
npm test
```

## 💰 Cost Comparison

### Local Development (Current)
- **Monthly Cost**: $0
- **Services**: PostgreSQL, Mock Auth, Mock Email, Local Storage

### AWS Development Environment
- **RDS PostgreSQL**: ~$15/month (t3.micro)
- **Cognito**: ~$0 (free tier)
- **API Gateway**: ~$3.50/month (1M requests)
- **Lambda**: ~$0 (free tier)
- **Total**: ~$20-30/month

### Production Environment
- **RDS PostgreSQL**: ~$50/month (t3.small, Multi-AZ)
- **API Gateway**: ~$10-50/month (depends on traffic)
- **Lambda**: ~$5-20/month (depends on usage)
- **CloudFront**: ~$5-10/month
- **Total**: ~$70-150/month

## 🚀 Migration Path

### When to Move to AWS:

1. **Authentication Testing**: When you need real user flows
2. **Performance Testing**: When you need production-like conditions
3. **Team Collaboration**: When others need access
4. **Beta Testing**: When external users test
5. **Production Launch**: Obviously!

### Migration Steps:

1. **Database Migration**
   ```bash
   # Export local data
   pg_dump milequest > backup.sql
   
   # Deploy RDS
   cd infrastructure
   npm run deploy:database
   
   # Import to RDS
   psql $RDS_URL < backup.sql
   ```

2. **Update Environment**
   ```bash
   # Simply update .env files with AWS endpoints
   DATABASE_URL=<RDS-URL>
   AWS_COGNITO_USER_POOL_ID=<POOL-ID>
   # etc...
   ```

## 📋 Local Development Task Adjustments

### Modified Sprint 0 Tasks:

- **DB-001**: ✅ Use Docker PostgreSQL (not RDS)
- **INT-002**: Use MockAuthService (not Cognito)
- **INT-003**: Use MockWebSocketService (not Pusher)
- **INT-004**: Use MockEmailService (not SES)
- **INT-005**: Use local .env files (not SSM)

### What This Enables:

- ✅ Full development without AWS account
- ✅ Complete testing of business logic
- ✅ Rapid iteration and experimentation
- ✅ Zero infrastructure costs
- ✅ Easy reset and cleanup

## 🔄 Quick Commands

```bash
# Start everything
./scripts/start-local.sh

# Stop everything
./scripts/stop-local.sh

# Reset database
./scripts/reset-local-db.sh

# View logs
docker logs milequest-postgres
```

## 📝 Notes

- All mock services implement the same interfaces as real services
- Business logic remains identical between local and AWS
- Can switch between local/AWS by changing environment variables
- Perfect for solo development with Claude Code

---
Last Updated: 2025-01-18
Purpose: Enable cost-free local development for Mile Quest