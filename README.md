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
├── infrastructure/        # AWS CDK infrastructure code
├── scripts/               # Deployment and setup scripts
├── docs/                  # Agent documentation
└── package.json           # Monorepo configuration
```

## 🚀 Quick Start

### Prerequisites

- Node.js 22.x or later
- npm 10.x or later
- PostgreSQL 14+ (for local development)
- AWS CLI (for deployment)
- AWS account with appropriate permissions

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd mile-quest
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your local configuration
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

### Infrastructure (`infrastructure/`)
- `npm run build` - Build CDK TypeScript code
- `npm run synth` - Generate CloudFormation templates
- `npm run deploy:all` - Deploy all AWS infrastructure
- `npm run deploy:cognito` - Deploy Cognito user management
- `npm run deploy:database` - Deploy RDS database and VPC
- `npm run deploy:api` - Deploy API Gateway
- `npm run deploy:monitoring` - Deploy CloudWatch monitoring
- `npm run destroy:all` - Remove all AWS infrastructure

## 🌐 Environment Variables

### Local Development

Create a `.env.local` file for local development:

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

### AWS Deployment

For AWS deployment, environment variables are managed through:
- `.env.staging` - Staging environment template
- `.env.production` - Production environment template
- `scripts/setup-environment.sh` - Automated environment configuration

After deploying infrastructure, run:
```bash
./scripts/setup-environment.sh setup staging
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

## Deploy on Vercel

One Vercel project serves the Next.js app and the API (`/api/*` route handlers). Data lives in Neon Postgres from the Vercel Marketplace.

1. Import the Git repository in Vercel.
2. Set **Root Directory** to `packages/frontend`. Vercel installs npm workspaces from the repository root, which builds `@mile-quest/shared` on install.
3. Framework preset: **Next.js**. Node.js **22.x** or newer.
4. In the Vercel Marketplace, add **Neon Postgres** to the project. Copy the pooled connection string into `DATABASE_URL` and the direct connection string into `DIRECT_URL`.
5. Add the rest of the variables from [`.env.example`](./.env.example):
   - `JWT_SECRET` — long random string used to sign access tokens
   - `NEXT_PUBLIC_MAPBOX_TOKEN` — public browser token for maps
   - `MAPBOX_ACCESS_TOKEN` — server-only token for walking directions. Leave empty to use great-circle distances
   - `NEXT_PUBLIC_APP_URL` — the Vercel URL
   - Leave `NEXT_PUBLIC_API_URL` empty so the browser calls this same app
6. Deploy. The frontend build generates the Prisma client and runs `next build`.
7. Apply the schema and optional demo data from a machine that has the Neon URLs:

```bash
cd packages/frontend
npx prisma migrate deploy
npm run db:seed
```

Demo seed accounts, after `db:seed`: `alice@example.com` and `bob@example.com`, password `password123`. Set `SEED_RESET=true` to replace existing rows. Email delivery for verification codes is not wired up; seeded users are already verified, and new accounts can still sign in before they verify.

PostGIS is not required. Coordinates are JSON and distances are numbers.

The AWS CDK project, SAM template, and deploy workflow have been removed. [DEPLOYMENT.md](./DEPLOYMENT.md) describes that retired path.

## 📚 Documentation

Detailed documentation is available in the `docs/` directory:

- **Architecture**: `docs/agents/01-architecture/current/`
- **UI/UX Design**: `docs/agents/02-ui-ux/current/`
- **Data Model**: `docs/agents/03-data-model/current/`
- **API Contracts**: `docs/agents/04-api-designer/current/`
- **DevOps & Infrastructure**: `docs/agents/11-devops/current/`
  - `aws-infrastructure-setup.md` - Infrastructure overview
  - `cdk-deployment-guide.md` - Complete deployment instructions

## 🤝 Contributing

1. Check the agent documentation in `docs/agents/`
2. Follow the established patterns and conventions
3. Update documentation when making significant changes
4. Ensure all tests pass before submitting changes

## 📄 License

UNLICENSED - Private project

---

**Note**: This project uses a living agents documentation system. Check `AGENTS.md` for current development status and `CLAUDE.md` for working with the codebase.
