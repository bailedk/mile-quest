# Code Sharing in Mile Quest Monorepo

## Overview

Yes, you can absolutely share code between frontend (Next.js) and backend (Lambda functions) using pnpm workspaces. This is one of the main benefits of a monorepo structure.

## Shared Package Structure

```
mile-quest/
├── apps/
│   └── web/                    # Next.js frontend
├── packages/
│   ├── @mile-quest/shared/     # Types, constants, utilities
│   ├── @mile-quest/validators/ # Zod schemas for validation
│   ├── @mile-quest/api-types/  # API request/response types
│   └── @mile-quest/utils/      # Business logic, helpers
└── infrastructure/
    └── lambdas/               # Backend Lambda functions
```

## What Can Be Shared

### 1. TypeScript Types & Interfaces

```typescript
// packages/shared/src/types/activity.ts
export interface Activity {
  id: string;
  userId: string;
  teamId: string;
  distance: number;
  duration: number;
  createdAt: Date;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface Team {
  id: string;
  name: string;
  goalDistance: number;
  currentDistance: number;
  members: TeamMember[];
}

export interface TeamMember {
  userId: string;
  name: string;
  role: 'admin' | 'member';
  joinedAt: Date;
}
```

### 2. Validation Schemas (Zod)

```typescript
// packages/validators/src/activity.ts
import { z } from 'zod';

export const activitySchema = z.object({
  distance: z.number().min(0).max(1000), // max 1000 miles per activity
  duration: z.number().min(0), // in seconds
  timestamp: z.string().datetime(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
});

export const createTeamSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().max(500).optional(),
  goalDistance: z.number().min(10).max(10000),
  isPublic: z.boolean().default(true),
});

// Type inference
export type ActivityInput = z.infer<typeof activitySchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
```

### 3. Business Logic & Utilities

```typescript
// packages/utils/src/distance.ts
export function metersToMiles(meters: number): number {
  return meters * 0.000621371;
}

export function milesToMeters(miles: number): number {
  return miles * 1609.344;
}

export function calculatePace(miles: number, seconds: number): string {
  const minutes = seconds / 60;
  const paceMinutes = Math.floor(minutes / miles);
  const paceSeconds = Math.round((minutes / miles - paceMinutes) * 60);
  return `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`;
}

export function formatDistance(miles: number): string {
  return miles < 1 
    ? `${Math.round(miles * 1760)} yards`
    : `${miles.toFixed(1)} miles`;
}
```

### 4. API Constants & Configurations

```typescript
// packages/shared/src/constants/index.ts
export const API_ENDPOINTS = {
  activities: '/api/activities',
  teams: '/api/teams',
  users: '/api/users',
  auth: '/api/auth',
} as const;

export const LIMITS = {
  MAX_TEAM_SIZE: 50,
  MAX_TEAMS_PER_USER: 10,
  MAX_ACTIVITY_DISTANCE: 1000, // miles
  MIN_ACTIVITY_DISTANCE: 0.1,
} as const;

export const ERROR_CODES = {
  TEAM_FULL: 'TEAM_FULL',
  INVALID_DISTANCE: 'INVALID_DISTANCE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
} as const;
```

## Usage Examples

### Frontend (Next.js)

```typescript
// apps/web/src/components/ActivityForm.tsx
import { useState } from 'react';
import { activitySchema, type ActivityInput } from '@mile-quest/validators';
import { formatDistance, calculatePace } from '@mile-quest/utils';
import { API_ENDPOINTS, LIMITS } from '@mile-quest/shared';

export function ActivityForm({ onSubmit }: { onSubmit: (data: ActivityInput) => void }) {
  const [activity, setActivity] = useState<ActivityInput>({
    distance: 0,
    duration: 0,
    timestamp: new Date().toISOString(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate using shared schema
    const result = activitySchema.safeParse(activity);
    if (!result.success) {
      console.error(result.error);
      return;
    }
    
    onSubmit(result.data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="number"
        value={activity.distance}
        onChange={(e) => setActivity({ ...activity, distance: Number(e.target.value) })}
        max={LIMITS.MAX_ACTIVITY_DISTANCE}
      />
      <div>Pace: {calculatePace(activity.distance, activity.duration)}</div>
      <div>Distance: {formatDistance(activity.distance)}</div>
    </form>
  );
}
```

### Backend (Lambda)

```typescript
// infrastructure/lambdas/create-activity/index.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { activitySchema } from '@mile-quest/validators';
import { metersToMiles } from '@mile-quest/utils';
import { Activity } from '@mile-quest/shared/types';
import { ERROR_CODES, LIMITS } from '@mile-quest/shared';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    
    // Use same validation as frontend
    const validated = activitySchema.parse(body);
    
    // Apply same business logic
    if (validated.distance > LIMITS.MAX_ACTIVITY_DISTANCE) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: ERROR_CODES.INVALID_DISTANCE,
          message: `Distance cannot exceed ${LIMITS.MAX_ACTIVITY_DISTANCE} miles`,
        }),
      };
    }
    
    // Save to database...
    const activity: Activity = {
      id: generateId(),
      userId: event.requestContext.authorizer?.userId,
      teamId: body.teamId,
      distance: validated.distance,
      duration: validated.duration,
      createdAt: new Date(),
    };
    
    return {
      statusCode: 201,
      body: JSON.stringify(activity),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'VALIDATION_ERROR',
          details: error.errors,
        }),
      };
    }
    throw error;
  }
};
```

## Package Configuration

### Shared Package Setup

```json
// packages/shared/package.json
{
  "name": "@mile-quest/shared",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

```json
// packages/shared/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"]
}
```

### Using in Frontend

```json
// apps/web/package.json
{
  "name": "@mile-quest/web",
  "dependencies": {
    "@mile-quest/shared": "workspace:*",
    "@mile-quest/validators": "workspace:*",
    "@mile-quest/utils": "workspace:*",
    "next": "^14.0.0",
    "react": "^18.0.0"
  }
}
```

### Using in Lambda

```json
// infrastructure/lambdas/create-activity/package.json
{
  "name": "@mile-quest/lambda-create-activity",
  "dependencies": {
    "@mile-quest/shared": "workspace:*",
    "@mile-quest/validators": "workspace:*",
    "@mile-quest/utils": "workspace:*",
    "aws-lambda": "^1.0.7"
  }
}
```

## Benefits of This Approach

### 1. **Type Safety Across Stack**
- Frontend and backend use exact same types
- TypeScript catches mismatches at compile time
- No runtime type errors from API changes

### 2. **Single Source of Truth**
- Validation logic defined once
- Business rules consistent everywhere
- Constants shared across all packages

### 3. **Easier Refactoring**
- Change a type in one place
- TypeScript shows all places to update
- Tests run across all packages

### 4. **Better Developer Experience**
- IntelliSense works across packages
- Go-to-definition jumps to shared code
- Automatic imports with proper paths

### 5. **Reduced Bugs**
- Frontend/backend can't diverge
- Validation always matches
- Business logic stays consistent

## Development Workflow

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm run build

# Development mode (watches all packages)
pnpm run dev

# Run tests across all packages
pnpm test

# Type check everything
pnpm run type-check
```

## Best Practices

1. **Keep shared packages focused** - Don't dump everything in one package
2. **Version together** - Keep all packages at same version for simplicity
3. **Build order matters** - Shared packages must build before apps
4. **Use TypeScript paths** - Configure paths in tsconfig for clean imports
5. **Avoid circular dependencies** - Structure packages in clear hierarchy

## Example Package Hierarchy

```
┌─────────────┐     ┌─────────────┐
│  Next.js    │     │   Lambda    │
│    App      │     │  Functions  │
└──────┬──────┘     └──────┬──────┘
       │                   │
       └─────────┬─────────┘
                 │
         ┌───────┴────────┐
         │   Validators   │
         └───────┬────────┘
                 │
         ┌───────┴────────┐
         │     Utils      │
         └───────┬────────┘
                 │
         ┌───────┴────────┐
         │    Shared      │
         │  Types/Consts  │
         └────────────────┘
```

This structure ensures clean dependencies and maximum code reuse between frontend and backend.