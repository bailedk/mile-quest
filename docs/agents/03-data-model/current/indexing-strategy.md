# Database Indexing Strategy

## Overview

Mile Quest implements a comprehensive indexing strategy to optimize query performance across common access patterns. This document outlines the rationale behind each index and its performance benefits.

## Core Indexing Principles

1. **Single Column Indexes**: For direct lookups and simple filters
2. **Compound Indexes**: For complex queries with multiple conditions
3. **Covering Indexes**: Include all needed columns to avoid table lookups
4. **Sort Order**: Strategic DESC ordering for time-based queries

## Index Analysis by Model

### User Model
```prisma
@@index([email])      // Email lookups during login
@@index([cognitoId])  // Auth integration lookups
```
- Email index supports user authentication flows
- CognitoId index enables fast auth provider integration

### Team Model
```prisma
@@index([isPublic])                        // Public team discovery
@@index([createdById])                     // User's created teams
@@index([name, deletedAt])                 // Team search with soft delete
@@index([isPublic, createdAt(sort: Desc)]) // Public team listings
```
- Compound indexes optimize team discovery features
- Sort order on createdAt enables efficient pagination

### TeamMember Model
```prisma
@@index([userId])                              // User's team memberships
@@index([teamId])                              // Team's member list
@@index([userId, leftAt, joinedAt(sort: Desc)]) // Active memberships sorted
@@index([teamId, userId, role])                // Role-based queries
```
- Complex compound index for active membership queries
- Role index supports permission checks

### TeamGoal Model
```prisma
@@index([teamId])              // Team's goals
@@index([status])              // Active goal filtering
@@index([teamId, status])      // Team's active goals
@@index([startDate, endDate])  // Date range queries
```
- Supports efficient goal filtering and date-based queries
- Compound index prevents multiple index scans

### Activity Model (Most Complex)
```prisma
// Single column indexes
@@index([userId])      // User's activities
@@index([timestamp])   // Time-based queries
@@index([isPrivate])   // Privacy filtering
@@index([createdAt])   // Recent activities

// Compound indexes
@@index([userId, timestamp(sort: Desc)])     // User activity timeline
@@index([userId, timestamp, isPrivate])      // Privacy-aware aggregations
@@index([createdAt(sort: Desc), id])        // Cursor pagination
```

#### Activity Index Strategy Rationale:

1. **User Activity Timeline**: `[userId, timestamp(sort: Desc)]`
   - Most common query pattern
   - Eliminates sort operation with DESC ordering
   - Covers user dashboard and activity history

2. **Privacy-Aware Aggregations**: `[userId, timestamp, isPrivate]`
   - Supports daily/weekly summaries
   - Enables efficient filtering of private activities
   - Critical for leaderboard calculations

3. **Cursor Pagination**: `[createdAt(sort: Desc), id]`
   - Enables efficient cursor-based pagination
   - ID ensures stable sorting for concurrent inserts
   - Optimizes infinite scroll implementations

### TeamInvite Model
```prisma
@@index([teamId])                      // Team's invites
@@index([email])                       // Email-based lookups
@@index([userId])                      // User's invites
@@index([status])                      // Pending invite counts
@@index([code])                        // Invite code lookups
@@index([code, status, expiresAt])     // Valid invite verification
```
- Compound index optimizes invite validation in single query
- Prevents expired invite acceptance

### Notification Model (Extensive Indexing)
```prisma
@@index([userId])                           // User's notifications
@@index([type])                             // Type filtering
@@index([category])                         // Category filtering
@@index([status])                           // Processing queues
@@index([scheduledFor])                     // Scheduled sends
@@index([userId, status])                   // Unread counts
@@index([userId, createdAt(sort: Desc)])    // Notification timeline
@@index([status, scheduledFor])             // Send queue processing
@@index([expiresAt])                        // Cleanup jobs
```

#### Notification Index Strategy:

1. **User Queries**: Multiple indexes support different access patterns
2. **Queue Processing**: Status and scheduling indexes for batch operations
3. **Maintenance**: ExpiresAt index enables efficient cleanup

## Query Pattern Optimization

### Example: Team Leaderboard Query
```sql
-- Uses indexes: [userId, timestamp, isPrivate] on activities
-- Uses index: [teamId, userId, leftAt] on team_members
SELECT u.id, u.name, SUM(a.distance) as total
FROM users u
JOIN team_members tm ON tm.user_id = u.id
JOIN activities a ON a.user_id = u.id
WHERE tm.team_id = ? 
  AND tm.left_at IS NULL
  AND a.timestamp >= ?
  AND a.timestamp <= ?
  AND a.is_private = false
GROUP BY u.id, u.name
ORDER BY total DESC
```

### Example: User Dashboard Query
```sql
-- Uses index: [userId, timestamp(sort: Desc)] on activities
SELECT * FROM activities
WHERE user_id = ?
ORDER BY timestamp DESC
LIMIT 10
```

## Performance Monitoring

### Key Metrics to Track:
1. **Index Hit Rate**: Should be >95% for primary queries
2. **Query Execution Time**: Sub-100ms for dashboard queries
3. **Index Size**: Monitor growth relative to table size
4. **Index Maintenance Cost**: Track during bulk inserts

### PostgreSQL Commands:
```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1
ORDER BY n_distinct DESC;
```

## Future Considerations

1. **Partial Indexes**: For soft deletes (`WHERE deleted_at IS NULL`)
2. **GIN Indexes**: For JSON field queries (waypoints, route data)
3. **BRIN Indexes**: For time-series data at scale
4. **Index Compression**: For large text fields

## Maintenance Guidelines

1. **Regular ANALYZE**: Keep statistics updated
2. **REINDEX**: Periodically rebuild fragmented indexes
3. **Monitor Bloat**: Use pg_repack for online maintenance
4. **Test Changes**: Always benchmark before production

Last Updated: 2025-01-20