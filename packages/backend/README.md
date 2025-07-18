# Mile Quest Backend

AWS Lambda-based backend for the Mile Quest application.

## Architecture

The backend is organized as a modular serverless application using AWS Lambda and API Gateway.

### Directory Structure

```
src/
├── config/          # Environment configuration
├── handlers/        # Lambda function handlers
│   ├── auth/       # Authentication endpoints
│   ├── users/      # User management endpoints
│   ├── teams/      # Team management endpoints
│   ├── activities/ # Activity tracking endpoints
│   ├── dashboard/  # Dashboard data endpoint
│   └── health/     # Health check endpoint
├── services/        # Business logic services
├── middleware/      # Request/response middleware
├── utils/          # Utility functions
│   ├── lambda-handler.ts  # Lambda handler factory
│   └── router.ts          # Path-based routing
└── types/          # TypeScript type definitions
```

### Lambda Functions

Each Lambda function handles a specific domain:

- **Health**: GET /health - System health check
- **Auth**: /auth/* - Registration, login, logout, email verification
- **Users**: /users/* - User profile management
- **Teams**: /teams/* - Team CRUD operations
- **Activities**: /activities/* - Activity logging and management
- **Dashboard**: GET /dashboard - Aggregated dashboard data

## Development

### Prerequisites

- Node.js 20.x
- AWS SAM CLI
- Docker (for local testing)

### Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Build Lambda functions
npm run build
```

### Local Development

```bash
# Start local API Gateway (port 3001)
npm run dev

# Test health endpoint
curl http://localhost:3001/health
```

### Environment Variables

Create a `.env` file:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/milequest
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:3000
STAGE=dev
```

## API Routes

### Health
- `GET /health` - Health check endpoint

### Authentication (Sprint 1)
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh tokens
- `POST /auth/logout` - User logout
- `POST /auth/verify-email` - Email verification

### Users (Sprint 1)
- `GET /users/me` - Get current user
- `PATCH /users/me` - Update current user

### Teams (Sprint 2)
- `POST /teams` - Create team
- `GET /teams/:id` - Get team details
- `PATCH /teams/:id` - Update team
- `DELETE /teams/:id` - Delete team
- `POST /teams/:id/members` - Add member
- `DELETE /teams/:id/members/:userId` - Remove member
- `POST /teams/join` - Join team with code

### Activities (Sprint 3)
- `POST /activities` - Log activity
- `GET /activities` - List activities
- `PATCH /activities/:id` - Update activity
- `DELETE /activities/:id` - Delete activity

### Dashboard (Sprint 4)
- `GET /dashboard` - Get dashboard data

## Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Type checking
npm run type-check
```

## Deployment

Deployment is handled via SAM:

```bash
# Build for production
npm run build

# Deploy to AWS
sam deploy --guided
```

## Lambda Handler Pattern

All Lambda functions use a consistent handler pattern:

```typescript
import { createHandler } from '@/utils/lambda-handler';
import { createRouter } from '@/utils/router';

const router = createRouter();

router.get('/path', async (event, context, params) => {
  // Handler logic
  return { data: 'response' };
});

export const handler = createHandler(router.handle.bind(router));
```

## Error Handling

The framework provides consistent error handling:

```typescript
throw new BadRequestError('Invalid input');
throw new UnauthorizedError('Not authenticated');
throw new NotFoundError('Resource not found');
throw new ValidationError('Validation failed', errors);
```

## Sprint Progress

- **Sprint 0**: ✅ Lambda structure, routing, error handling
- **Sprint 1**: 🔄 Authentication endpoints
- **Sprint 2**: ⏳ Team management
- **Sprint 3**: ⏳ Activity tracking
- **Sprint 4**: ⏳ Dashboard
- **Sprint 5**: ⏳ Real-time features