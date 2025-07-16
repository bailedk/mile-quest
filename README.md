# Mile Quest

A mobile-first team walking challenge platform where teams set geographic goals and track collective walking distances.

## 🏗️ Architecture

Mile Quest is built as a serverless-first application using:

- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS, and PWA support
- **Backend**: AWS Lambda functions with Node.js 20.x
- **Database**: PostgreSQL with PostGIS for geospatial features
- **Authentication**: AWS Cognito
- **Real-time**: Pusher (WebSocket abstraction)
- **Infrastructure**: AWS (API Gateway, Lambda, RDS, CloudFront)

## 📁 Project Structure

```
mile-quest/
├── packages/
│   ├── frontend/          # Next.js application
│   ├── backend/           # AWS Lambda functions
│   └── shared/            # Shared types and utilities
├── docs/                  # Agent documentation
└── package.json           # Monorepo configuration
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x or later
- npm 10.x or later
- PostgreSQL 14+ (for local development)
- AWS CLI (for deployment)

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd mile-quest
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up the database:**
   ```bash
   # Start PostgreSQL (if using Docker)
   docker run --name mile-quest-db -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:14

   # Generate Prisma client and run migrations
   cd packages/backend
   npm run db:generate
   npm run db:push
   ```

4. **Start development servers:**
   ```bash
   # Terminal 1: Start frontend
   npm run dev

   # Terminal 2: Start backend (Lambda local)
   cd packages/backend
   npm run dev
   ```

## 📦 Available Scripts

### Root Commands
- `npm run dev` - Start frontend development server
- `npm run build` - Build all packages
- `npm run test` - Run tests across all packages
- `npm run lint` - Lint all packages
- `npm run type-check` - TypeScript checking

### Frontend (`packages/frontend`)
- `npm run dev` - Start Next.js dev server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - ESLint checking

### Backend (`packages/backend`)
- `npm run dev` - Start SAM Local API
- `npm run build` - Build Lambda functions
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

### Shared (`packages/shared`)
- `npm run build` - Build shared types
- `npm run dev` - Watch mode for development

## 🌐 Environment Variables

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/mile_quest_dev"

# AWS Cognito
AWS_REGION="us-east-1"
USER_POOL_ID="us-east-1_xxxxxxxxx"
USER_POOL_CLIENT_ID="xxxxxxxxxxxxxxxxxxxxxxxxxx"

# API
API_BASE_URL="http://localhost:3001"
CORS_ORIGIN="http://localhost:3000"

# WebSocket (Pusher)
NEXT_PUBLIC_PUSHER_APP_KEY="your-pusher-app-key"
NEXT_PUBLIC_PUSHER_CLUSTER="us2"

# External Services
MAPBOX_ACCESS_TOKEN="pk.xxxxxxxxxxxxxxxxxxxxxxxxxx"
```

## 🏛️ Database Schema

The application uses PostgreSQL with the following main entities:

- **Users** - User profiles and authentication
- **Teams** - Team management and settings
- **TeamGoals** - Geographic routes and distance targets
- **Activities** - Walking/running logged activities
- **Achievements** - Gamification and badges
- **UserStats** - Aggregated user statistics

See `packages/backend/prisma/schema.prisma` for the complete schema.

## 🔧 Development Workflow

### Making Changes

1. **Frontend changes**: Edit files in `packages/frontend/src/`
2. **Backend changes**: Edit files in `packages/backend/src/`
3. **Shared types**: Edit files in `packages/shared/src/`

### Database Changes

1. Update `packages/backend/prisma/schema.prisma`
2. Run `npm run db:push` for development
3. Run `npm run db:migrate` for production migrations

### Testing

```bash
# Run all tests
npm run test

# Run specific package tests
npm run test --workspace=packages/frontend
npm run test --workspace=packages/backend
```

## 🚀 Deployment

### AWS Infrastructure Setup

1. **Configure AWS CLI:**
   ```bash
   aws configure
   ```

2. **Deploy backend:**
   ```bash
   cd packages/backend
   sam build
   sam deploy --guided
   ```

3. **Deploy frontend:**
   ```bash
   cd packages/frontend
   # Configure AWS Amplify or use your preferred deployment method
   ```

## 📚 Documentation

Detailed documentation is available in the `docs/` directory:

- **Architecture**: `docs/agents/01-architecture/current/`
- **UI/UX Design**: `docs/agents/02-ui-ux/current/`
- **Data Model**: `docs/agents/03-data-model/current/`
- **API Contracts**: `docs/agents/04-api-designer/current/`

## 🤝 Contributing

1. Check the agent documentation in `docs/agents/`
2. Follow the established patterns and conventions
3. Update documentation when making significant changes
4. Ensure all tests pass before submitting changes

## 📄 License

UNLICENSED - Private project

---

**Note**: This project uses a living agents documentation system. Check `AGENTS.md` for current development status and `CLAUDE.md` for working with the codebase.
