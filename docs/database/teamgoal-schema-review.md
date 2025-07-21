# TeamGoal Schema Review - Task DB-1.1

**Date**: 2025-01-20
**Agent**: Database Developer (Agent 18)
**Task**: DB-1.1 - Review and Update TeamGoal Schema

## Current Schema Analysis

### TeamGoal Model Structure

The TeamGoal model in `/packages/backend/prisma/schema.prisma` is already well-structured for supporting multi-city routes with waypoints:

```prisma
model TeamGoal {
  id             String        @id @default(uuid())
  teamId         String
  name           String
  description    String?
  targetDistance Float         // Total distance in meters
  targetDate     DateTime?
  startDate      DateTime      // When tracking starts for this goal
  endDate        DateTime      // When tracking ends for this goal
  startLocation  Json          // { lat: number, lng: number, address?: string }
  endLocation    Json          // { lat: number, lng: number, address?: string }
  waypoints      Json[]        // Array of waypoint objects
  routePolyline  String        // Encoded polyline for the entire route
  routeData      Json          // Additional route metadata (segments, bounds, etc.)
  status         GoalStatus    @default(DRAFT)
  createdById    String
  completedAt    DateTime?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  
  // Relations
  createdBy      User          @relation("GoalCreator", fields: [createdById], references: [id])
  team           Team          @relation(fields: [teamId], references: [id])
  progress       TeamProgress?
  
  // Indexes
  @@index([teamId])
  @@index([status])
  @@index([teamId, status])
  @@index([startDate, endDate])
  @@map("team_goals")
}
```

### Key Features Already Supported

1. **Waypoints Array**: ✅ Implemented as `Json[]`
   - Supports multiple waypoints between start and end locations
   - Each waypoint follows the structure defined in `/packages/backend/src/services/map/types.ts`:
     ```typescript
     interface Waypoint {
       id: string;
       position: Position;
       address?: string;
       order: number;
       isLocked?: boolean;
     }
     ```

2. **Route Polyline Storage**: ✅ Implemented as `String`
   - Stores encoded polyline for efficient route visualization
   - Compatible with mapping libraries for rendering

3. **Route Bounds**: ✅ Stored in `routeData` JSON field
   - Contains `bounds` property with southwest/northeast coordinates
   - Used for map viewport adjustments

4. **Total Calculated Distance**: ✅ Implemented as `targetDistance`
   - Stores the total route distance in meters
   - Calculated by the map service during goal creation

### Existing Indexes

The schema includes appropriate indexes for common query patterns:

1. `@@index([teamId])` - Find all goals for a team
2. `@@index([status])` - Filter goals by status
3. `@@index([teamId, status])` - Find active/completed goals for a team
4. `@@index([startDate, endDate])` - Date range queries

### Recommendations for Enhancement

While the current schema is functional, I recommend adding the following indexes for improved waypoint query performance:

1. **GIN Index for JSON Queries** (PostgreSQL-specific):
   ```sql
   CREATE INDEX idx_team_goals_waypoints ON team_goals USING GIN (waypoints);
   CREATE INDEX idx_team_goals_route_data ON team_goals USING GIN (routeData);
   ```

2. **Expression Index for Route Bounds** (if frequently queried):
   ```sql
   CREATE INDEX idx_team_goals_route_bounds ON team_goals USING GIN ((routeData->'bounds'));
   ```

3. **Partial Index for Active Goals**:
   ```sql
   CREATE INDEX idx_team_goals_active ON team_goals (teamId, targetDistance) WHERE status = 'ACTIVE';
   ```

### Type Alignment Verification

The schema aligns perfectly with the types defined in `/packages/backend/src/services/goal/types.ts`:

- `startLocation` and `endLocation` match `Position & { address?: string }`
- `waypoints` array matches `Waypoint[]` interface
- `routePolyline` provides the encoded polyline string
- `routeData` contains additional metadata including bounds

### Migration Requirements

**No schema changes are required** for the TeamGoal model. The current structure fully supports:
- ✅ Multi-city routes with waypoints
- ✅ Route polyline storage for visualization
- ✅ Route bounds for map viewport
- ✅ Total calculated distance

However, I recommend creating a migration to add the performance indexes mentioned above.

## Proposed Migration

```sql
-- Add GIN indexes for JSON column queries
CREATE INDEX CONCURRENTLY idx_team_goals_waypoints ON team_goals USING GIN (waypoints);
CREATE INDEX CONCURRENTLY idx_team_goals_route_data ON team_goals USING GIN (routeData);

-- Add expression index for route bounds if needed
CREATE INDEX CONCURRENTLY idx_team_goals_route_bounds ON team_goals USING GIN ((routeData->'bounds'));

-- Add partial index for active goals with distance
CREATE INDEX CONCURRENTLY idx_team_goals_active ON team_goals (teamId, targetDistance) 
WHERE status = 'ACTIVE';

-- Add index for waypoint count queries (useful for UI)
CREATE INDEX CONCURRENTLY idx_team_goals_waypoint_count ON team_goals ((jsonb_array_length(waypoints)));
```

## Conclusion

The TeamGoal schema is already well-designed and fully supports the requirements for multi-city routes with waypoints. No structural changes are needed. The recommended performance indexes would improve query efficiency for waypoint-based operations and active goal queries.

### Next Steps

1. Create a new migration file for the performance indexes
2. Test the indexes in development environment
3. Monitor query performance improvements
4. Document the index usage patterns for other developers