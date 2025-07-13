# Data Model Agent - Quick Reference

## Core Tables

### User & Team Management
- **User** - Core user accounts (UUID, email, name)
- **Team** - Walking teams (name unique, max 50 members)
- **TeamMember** - User-Team relationship (includes role)
- **TeamInvite** - Pending invitations (unique code)

### Activity Tracking
- **Activity** - Individual walks/runs (distance, duration, timestamps)
- **TeamGoal** - Team challenges with routes (target distance, waypoints)
- **TeamProgress** - Aggregated goal progress
- **UserStats** - Aggregated user statistics

### Gamification
- **Achievement** - Available badges/rewards
- **UserAchievement** - Earned achievements

## Key Design Decisions

1. **UUIDs** for all primary keys
2. **Soft deletes** for User and Team
3. **JSON fields** for route data and criteria
4. **UTC timestamps** throughout
5. **Prisma ORM** for type safety

## Common Queries

```typescript
// User's active teams
await prisma.team.findMany({
  where: {
    members: {
      some: { userId, leftAt: null }
    }
  }
});

// Team activity feed
await prisma.activity.findMany({
  where: { teamId },
  include: { user: true },
  orderBy: { startTime: 'desc' },
  take: 20
});

// Create activity (with stats update)
await prisma.$transaction(async (tx) => {
  const activity = await tx.activity.create({ data });
  await tx.userStats.update({
    where: { userId },
    data: {
      totalDistance: { increment: distance },
      totalActivities: { increment: 1 }
    }
  });
});
```

## Performance Tips

1. **Use selective includes** - Only fetch needed relations
2. **Cursor pagination** - For large lists
3. **Aggregate tables** - UserStats, TeamProgress
4. **Indexes exist for** - All FKs, unique fields, common queries

## Migration Commands

```bash
# Create migration
npx prisma migrate dev --name add_feature

# Apply migrations
npx prisma migrate deploy

# Generate client
npx prisma generate

# Seed database
npx prisma db seed
```