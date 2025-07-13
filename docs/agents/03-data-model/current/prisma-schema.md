# Prisma Schema for Mile Quest

## Overview

This is the complete Prisma schema for Mile Quest, implementing all core entities with proper relationships, constraints, and indexes.

## Schema Definition

```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// Enums
enum TeamRole {
  ADMIN
  MEMBER
}

enum GoalStatus {
  DRAFT
  ACTIVE
  COMPLETED
  CANCELLED
}

enum ActivitySource {
  MANUAL
  STRAVA
  APPLE_HEALTH
  GOOGLE_FIT
}

enum InviteStatus {
  PENDING
  ACCEPTED
  DECLINED
  EXPIRED
}

enum AchievementCategory {
  DISTANCE
  STREAK
  SPEED
  TEAM
  SPECIAL
}

// Models
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String
  avatarUrl     String?
  emailVerified Boolean   @default(false)
  cognitoId     String    @unique
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  // Relations
  teamMemberships TeamMember[]
  activities      Activity[]
  createdTeams    Team[]         @relation("TeamCreator")
  createdGoals    TeamGoal[]     @relation("GoalCreator")
  stats           UserStats?
  achievements    UserAchievement[]
  sentInvites     TeamInvite[]   @relation("InviteSender")
  receivedInvites TeamInvite[]   @relation("InviteRecipient")

  @@index([email])
  @@index([cognitoId])
  @@map("users")
}

model Team {
  id          String    @id @default(uuid())
  name        String    @unique
  description String?
  avatarUrl   String?
  isPublic    Boolean   @default(true)
  maxMembers  Int       @default(50)
  createdById String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  // Relations
  createdBy  User         @relation("TeamCreator", fields: [createdById], references: [id])
  members    TeamMember[]
  goals      TeamGoal[]
  activities Activity[]
  invites    TeamInvite[]

  @@index([isPublic])
  @@index([createdById])
  @@map("teams")
}

model TeamMember {
  id       String    @id @default(uuid())
  teamId   String
  userId   String
  role     TeamRole  @default(MEMBER)
  joinedAt DateTime  @default(now())
  leftAt   DateTime?

  // Relations
  team Team @relation(fields: [teamId], references: [id])
  user User @relation(fields: [userId], references: [id])

  @@unique([teamId, userId, leftAt])
  @@index([userId])
  @@index([teamId])
  @@map("team_members")
}

model TeamGoal {
  id            String      @id @default(uuid())
  teamId        String
  name          String
  description   String?
  targetDistance Float      // in miles
  targetDate    DateTime?
  routeData     Json       // Waypoints and segments
  status        GoalStatus @default(DRAFT)
  createdById   String
  startedAt     DateTime?
  completedAt   DateTime?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  // Relations
  team       Team         @relation(fields: [teamId], references: [id])
  createdBy  User         @relation("GoalCreator", fields: [createdById], references: [id])
  activities Activity[]
  progress   TeamProgress?

  @@index([teamId])
  @@index([status])
  @@map("team_goals")
}

model Activity {
  id          String         @id @default(uuid())
  userId      String
  teamId      String
  teamGoalId  String?
  distance    Float          // in miles
  duration    Int            // in seconds
  startTime   DateTime
  endTime     DateTime
  notes       String?
  source      ActivitySource @default(MANUAL)
  externalId  String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  // Relations
  user              User               @relation(fields: [userId], references: [id])
  team              Team               @relation(fields: [teamId], references: [id])
  teamGoal          TeamGoal?          @relation(fields: [teamGoalId], references: [id])
  achievementsEarned UserAchievement[]

  @@unique([source, externalId])
  @@index([userId])
  @@index([teamId])
  @@index([teamGoalId])
  @@index([startTime])
  @@map("activities")
}

model TeamProgress {
  id                  String    @id @default(uuid())
  teamGoalId          String    @unique
  totalDistance       Float     @default(0)
  totalActivities     Int       @default(0)
  totalDuration       Int       @default(0) // in seconds
  currentSegmentIndex Int       @default(0)
  segmentProgress     Float     @default(0) // miles into current segment
  lastActivityAt      DateTime?
  updatedAt           DateTime  @updatedAt

  // Relations
  teamGoal TeamGoal @relation(fields: [teamGoalId], references: [id])

  @@map("team_progress")
}

model UserStats {
  id              String    @id @default(uuid())
  userId          String    @unique
  totalDistance   Float     @default(0)
  totalActivities Int       @default(0)
  totalDuration   Int       @default(0) // in seconds
  currentStreak   Int       @default(0)
  longestStreak   Int       @default(0)
  lastActivityAt  DateTime?
  updatedAt       DateTime  @updatedAt

  // Relations
  user User @relation(fields: [userId], references: [id])

  @@map("user_stats")
}

model TeamInvite {
  id               String       @id @default(uuid())
  teamId           String
  invitedByUserId  String
  email            String?
  userId           String?
  code             String       @unique @default(cuid())
  status           InviteStatus @default(PENDING)
  expiresAt        DateTime
  createdAt        DateTime     @default(now())
  acceptedAt       DateTime?

  // Relations
  team      Team  @relation(fields: [teamId], references: [id])
  invitedBy User  @relation("InviteSender", fields: [invitedByUserId], references: [id])
  user      User? @relation("InviteRecipient", fields: [userId], references: [id])

  @@index([teamId])
  @@index([email])
  @@index([userId])
  @@index([status])
  @@index([code])
  @@map("team_invites")
}

model Achievement {
  id          String              @id @default(uuid())
  key         String              @unique
  name        String
  description String
  iconUrl     String
  category    AchievementCategory
  criteria    Json                // Rules for earning
  points      Int                 @default(10)
  createdAt   DateTime            @default(now())

  // Relations
  userAchievements UserAchievement[]

  @@index([category])
  @@map("achievements")
}

model UserAchievement {
  id            String   @id @default(uuid())
  userId        String
  achievementId String
  earnedAt      DateTime @default(now())
  teamId        String?
  activityId    String?

  // Relations
  user        User        @relation(fields: [userId], references: [id])
  achievement Achievement @relation(fields: [achievementId], references: [id])
  activity    Activity?   @relation(fields: [activityId], references: [id])

  @@unique([userId, achievementId])
  @@index([userId])
  @@index([earnedAt])
  @@map("user_achievements")
}
```

## Migration Notes

### Initial Migration

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for future geospatial features
CREATE EXTENSION IF NOT EXISTS "postgis";
```

### Seed Data

```typescript
// seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAchievements() {
  const achievements = [
    {
      key: 'first_mile',
      name: 'First Mile',
      description: 'Complete your first mile',
      iconUrl: '/achievements/first-mile.svg',
      category: 'DISTANCE',
      criteria: { distance: { gte: 1 } },
      points: 10,
    },
    {
      key: 'week_streak',
      name: 'Week Warrior',
      description: 'Log activities 7 days in a row',
      iconUrl: '/achievements/week-streak.svg',
      category: 'STREAK',
      criteria: { streak: { gte: 7 } },
      points: 50,
    },
    {
      key: 'team_century',
      name: 'Century Club',
      description: 'Help your team reach 100 miles',
      iconUrl: '/achievements/century.svg',
      category: 'TEAM',
      criteria: { teamDistance: { gte: 100 } },
      points: 100,
    },
  ];

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      update: {},
      create: achievement,
    });
  }
}
```

## Query Examples

### Get User's Teams with Member Count

```typescript
const userTeams = await prisma.team.findMany({
  where: {
    members: {
      some: {
        userId: userId,
        leftAt: null,
      },
    },
  },
  include: {
    _count: {
      select: {
        members: {
          where: { leftAt: null },
        },
      },
    },
  },
});
```

### Get Team Leaderboard

```typescript
const leaderboard = await prisma.$queryRaw`
  SELECT 
    u.id,
    u.name,
    u.avatar_url,
    COALESCE(SUM(a.distance), 0) as total_distance,
    COUNT(a.id) as activity_count
  FROM users u
  JOIN team_members tm ON tm.user_id = u.id
  LEFT JOIN activities a ON a.user_id = u.id 
    AND a.team_id = ${teamId}
    AND a.created_at >= ${startDate}
  WHERE tm.team_id = ${teamId}
    AND tm.left_at IS NULL
  GROUP BY u.id, u.name, u.avatar_url
  ORDER BY total_distance DESC
  LIMIT 10
`;
```

### Update Team Progress (Transaction)

```typescript
await prisma.$transaction(async (tx) => {
  // Create activity
  const activity = await tx.activity.create({
    data: activityData,
  });

  // Update user stats
  await tx.userStats.upsert({
    where: { userId: activity.userId },
    create: {
      userId: activity.userId,
      totalDistance: activity.distance,
      totalActivities: 1,
      totalDuration: activity.duration,
      lastActivityAt: activity.startTime,
    },
    update: {
      totalDistance: { increment: activity.distance },
      totalActivities: { increment: 1 },
      totalDuration: { increment: activity.duration },
      lastActivityAt: activity.startTime,
    },
  });

  // Update team progress if goal exists
  if (activity.teamGoalId) {
    await tx.teamProgress.update({
      where: { teamGoalId: activity.teamGoalId },
      data: {
        totalDistance: { increment: activity.distance },
        totalActivities: { increment: 1 },
        totalDuration: { increment: activity.duration },
        lastActivityAt: activity.startTime,
        // Segment progress calculated separately
      },
    });
  }
});
```

## Performance Optimizations

1. **Composite Indexes** for common query patterns
2. **Partial Indexes** for soft deletes: `WHERE deleted_at IS NULL`
3. **JSON indexing** for route data queries (PostgreSQL GIN indexes)
4. **Connection pooling** with PgBouncer at scale
5. **Read replicas** for leaderboard queries