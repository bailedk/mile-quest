# Prisma Schema for Mile Quest

## Overview

This is the complete Prisma schema for Mile Quest, implementing all core entities with proper relationships, constraints, and indexes. The schema includes a comprehensive notification system and optimized indexing strategy for performance.

## Schema Definition

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "linux-arm64-openssl-3.0.x", "darwin-arm64"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Core Enums
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

// Notification Enums
enum NotificationType {
  ACTIVITY_CREATED
  ACTIVITY_MILESTONE
  TEAM_MEMBER_JOINED
  TEAM_GOAL_CREATED
  TEAM_GOAL_COMPLETED
  TEAM_GOAL_MILESTONE
  ACHIEVEMENT_EARNED
  ACHIEVEMENT_STREAK
  SYSTEM_ANNOUNCEMENT
  SYSTEM_UPDATE
  SYSTEM_MAINTENANCE
  REMINDER_ACTIVITY
  REMINDER_GOAL_DEADLINE
  INVITE_RECEIVED
  INVITE_ACCEPTED
  LEADERBOARD_POSITION
}

enum NotificationCategory {
  ACTIVITY
  TEAM
  ACHIEVEMENT
  SYSTEM
  REMINDER
  SOCIAL
}

enum NotificationPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum NotificationChannel {
  REALTIME
  EMAIL
  PUSH
}

enum NotificationStatus {
  PENDING
  SCHEDULED
  SENT
  DELIVERED
  READ
  CLICKED
  FAILED
  EXPIRED
  CANCELLED
}

enum NotificationBatchStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}

// Core Models
model User {
  id                      String                    @id @default(uuid())
  email                   String                    @unique
  name                    String
  avatarUrl               String?
  emailVerified           Boolean                   @default(false)
  cognitoId               String                    @unique
  createdAt               DateTime                  @default(now())
  updatedAt               DateTime                  @updatedAt
  deletedAt               DateTime?

  // Relations
  activities              Activity[]
  createdGoals            TeamGoal[]                @relation("GoalCreator")
  sentInvites             TeamInvite[]              @relation("InviteSender")
  receivedInvites         TeamInvite[]              @relation("InviteRecipient")
  teamMemberships         TeamMember[]
  createdTeams            Team[]                    @relation("TeamCreator")
  achievements            UserAchievement[]
  stats                   UserStats?
  notifications           Notification[]
  notificationPreferences NotificationPreference[]

  @@index([email])
  @@index([cognitoId])
  @@map("users")
}

model Team {
  id          String       @id @default(uuid())
  name        String       @unique
  description String?
  avatarUrl   String?
  isPublic    Boolean      @default(true)
  createdById String
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  deletedAt   DateTime?

  // Relations
  goals       TeamGoal[]
  invites     TeamInvite[]
  members     TeamMember[]
  createdBy   User         @relation("TeamCreator", fields: [createdById], references: [id])

  @@index([isPublic])
  @@index([createdById])
  @@index([name, deletedAt])
  @@index([isPublic, createdAt(sort: Desc)])
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
  team     Team      @relation(fields: [teamId], references: [id])
  user     User      @relation(fields: [userId], references: [id])

  @@unique([teamId, userId, leftAt])
  @@index([userId])
  @@index([teamId])
  @@index([userId, leftAt, joinedAt(sort: Desc)])
  @@index([teamId, userId, role])
  @@map("team_members")
}

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

  @@index([teamId])
  @@index([status])
  @@index([teamId, status])
  @@index([startDate, endDate])
  @@map("team_goals")
}

model Activity {
  id                 String            @id @default(uuid())
  userId             String
  distance           Float             // Distance in meters
  duration           Int               // Duration in seconds
  timestamp          DateTime          // Single timestamp for the activity
  notes              String?
  source             ActivitySource    @default(MANUAL)
  externalId         String?
  isPrivate          Boolean           @default(false)
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  // Relations
  user               User              @relation(fields: [userId], references: [id])
  achievementsEarned UserAchievement[]

  @@unique([source, externalId])
  // Single column indexes
  @@index([userId])
  @@index([timestamp])
  @@index([isPrivate])
  @@index([createdAt])
  
  // Compound indexes for common query patterns
  // For user activity lists with date filtering
  @@index([userId, timestamp(sort: Desc)])
  // For daily aggregations (using date function on timestamp)
  @@index([userId, timestamp, isPrivate])
  // For cursor-based pagination
  @@index([createdAt(sort: Desc), id])
  
  @@map("activities")
}

model TeamProgress {
  id                  String    @id @default(uuid())
  teamGoalId          String    @unique
  totalDistance       Float     @default(0)
  totalActivities     Int       @default(0)
  totalDuration       Int       @default(0)
  currentSegmentIndex Int       @default(0)
  segmentProgress     Float     @default(0)
  lastActivityAt      DateTime?
  updatedAt           DateTime  @updatedAt

  // Relations
  teamGoal            TeamGoal  @relation(fields: [teamGoalId], references: [id])

  @@map("team_progress")
}

model UserStats {
  id              String    @id @default(uuid())
  userId          String    @unique
  totalDistance   Float     @default(0)
  totalActivities Int       @default(0)
  totalDuration   Int       @default(0)
  currentStreak   Int       @default(0)
  longestStreak   Int       @default(0)
  lastActivityAt  DateTime?
  updatedAt       DateTime  @updatedAt

  // Relations
  user            User      @relation(fields: [userId], references: [id])

  @@map("user_stats")
}

model TeamInvite {
  id              String       @id @default(uuid())
  teamId          String
  invitedByUserId String
  email           String?
  userId          String?
  code            String       @unique @default(cuid())
  status          InviteStatus @default(PENDING)
  expiresAt       DateTime
  createdAt       DateTime     @default(now())
  acceptedAt      DateTime?

  // Relations
  invitedBy       User         @relation("InviteSender", fields: [invitedByUserId], references: [id])
  team            Team         @relation(fields: [teamId], references: [id])
  user            User?        @relation("InviteRecipient", fields: [userId], references: [id])

  @@index([teamId])
  @@index([email])
  @@index([userId])
  @@index([status])
  @@index([code])
  @@index([code, status, expiresAt])
  @@map("team_invites")
}

model Achievement {
  id               String              @id @default(uuid())
  key              String              @unique
  name             String
  description      String
  iconUrl          String
  category         AchievementCategory
  criteria         Json
  points           Int                 @default(10)
  createdAt        DateTime            @default(now())

  // Relations
  userAchievements UserAchievement[]

  @@index([category])
  @@map("achievements")
}

model UserAchievement {
  id            String      @id @default(uuid())
  userId        String
  achievementId String
  earnedAt      DateTime    @default(now())
  teamId        String?
  activityId    String?

  // Relations
  achievement   Achievement @relation(fields: [achievementId], references: [id])
  activity      Activity?   @relation(fields: [activityId], references: [id])
  user          User        @relation(fields: [userId], references: [id])

  @@unique([userId, achievementId])
  @@index([userId])
  @@index([earnedAt])
  @@map("user_achievements")
}

// Notification Models
model NotificationTemplate {
  id           String                 @id @default(uuid())
  key          String                 @unique
  name         String
  description  String?
  category     NotificationCategory
  priority     NotificationPriority   @default(MEDIUM)
  subject      String
  content      String
  emailContent String?
  variables    Json                   @default("[]")
  isActive     Boolean                @default(true)
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt

  // Relations
  notifications Notification[]

  @@index([category])
  @@index([isActive])
  @@map("notification_templates")
}

model Notification {
  id               String                @id @default(uuid())
  userId           String
  templateId       String?
  type             NotificationType
  category         NotificationCategory
  priority         NotificationPriority  @default(MEDIUM)
  title            String
  content          String
  data             Json?
  channels         NotificationChannel[] @default([REALTIME])
  status           NotificationStatus    @default(PENDING)
  scheduledFor     DateTime?
  sentAt           DateTime?
  readAt           DateTime?
  clickedAt        DateTime?
  expiresAt        DateTime?
  retryCount       Int                   @default(0)
  maxRetries       Int                   @default(3)
  lastError        String?
  createdAt        DateTime              @default(now())
  updatedAt        DateTime              @updatedAt

  // Relations
  user             User                  @relation(fields: [userId], references: [id])
  template         NotificationTemplate? @relation(fields: [templateId], references: [id])

  @@index([userId])
  @@index([type])
  @@index([category])
  @@index([status])
  @@index([scheduledFor])
  @@index([userId, status])
  @@index([userId, createdAt(sort: Desc)])
  @@index([status, scheduledFor])
  @@index([expiresAt])
  @@map("notifications")
}

model NotificationPreference {
  id               String               @id @default(uuid())
  userId           String
  category         NotificationCategory
  channels         NotificationChannel[]
  isEnabled        Boolean              @default(true)
  quietHoursStart  String?              // Format: "HH:MM"
  quietHoursEnd    String?              // Format: "HH:MM"
  timezone         String?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  // Relations
  user             User                 @relation(fields: [userId], references: [id])

  @@unique([userId, category])
  @@index([userId])
  @@index([category])
  @@map("notification_preferences")
}

model NotificationBatch {
  id               String                  @id @default(uuid())
  name             String?
  description      String?
  type             NotificationType
  category         NotificationCategory
  totalCount       Int                     @default(0)
  sentCount        Int                     @default(0)
  failedCount      Int                     @default(0)
  status           NotificationBatchStatus @default(PENDING)
  scheduledFor     DateTime?
  startedAt        DateTime?
  completedAt      DateTime?
  createdAt        DateTime                @default(now())
  updatedAt        DateTime                @updatedAt

  @@index([status])
  @@index([scheduledFor])
  @@index([type])
  @@index([category])
  @@map("notification_batches")
}
```

## Key Changes from Previous Version

### 1. Unit Standardization
- **Distance**: Changed from miles to meters for consistency
- **Time**: Timestamps simplified to single `timestamp` field for activities

### 2. Enhanced TeamGoal Model
- Added `startDate` and `endDate` for tracking periods
- Added `startLocation` and `endLocation` as JSON objects
- Added `waypoints` array for intermediate points
- Added `routePolyline` for route visualization
- Enhanced `routeData` for additional metadata

### 3. Simplified Activity Model
- Removed direct team and teamGoal associations
- Activities are now user-centric with team association handled at query time
- Changed `startTime`/`endTime` to single `timestamp`
- Distance now in meters

### 4. Comprehensive Notification System
- **NotificationTemplate**: Reusable templates for consistent messaging
- **Notification**: Individual notification instances with multi-channel support
- **NotificationPreference**: User preferences including quiet hours
- **NotificationBatch**: Batch processing for mass notifications

### 5. Performance Optimizations
- Extensive compound indexes for common query patterns
- Optimized indexes for cursor-based pagination
- Binary targets for cross-platform compatibility
- Strategic indexing for time-based queries

## Migration Notes

### Binary Targets
The schema now includes binary targets for deployment compatibility:
```prisma
binaryTargets = ["native", "linux-arm64-openssl-3.0.x", "darwin-arm64"]
```

### Index Strategy
Compound indexes have been added to optimize common query patterns:
- User activity lists with date filtering
- Daily/weekly aggregations
- Cursor-based pagination
- Team member queries with role filtering

## Query Examples

### Get User Activities with Privacy Filter
```typescript
const publicActivities = await prisma.activity.findMany({
  where: {
    userId: userId,
    isPrivate: false,
    timestamp: {
      gte: startDate,
      lte: endDate
    }
  },
  orderBy: { timestamp: 'desc' }
});
```

### Team Goal Progress Calculation
```typescript
// Calculate team progress including ALL activities (private + public)
const teamProgress = await prisma.$queryRaw`
  SELECT 
    SUM(a.distance) as total_distance,
    COUNT(a.id) as activity_count,
    SUM(a.duration) as total_duration
  FROM activities a
  JOIN users u ON a.user_id = u.id
  JOIN team_members tm ON tm.user_id = u.id
  WHERE tm.team_id = ${teamId}
    AND tm.left_at IS NULL
    AND a.timestamp >= ${goal.startDate}
    AND a.timestamp <= ${goal.endDate}
`;
```

### Create Notification with Template
```typescript
const notification = await prisma.notification.create({
  data: {
    userId: userId,
    templateId: template.id,
    type: 'TEAM_GOAL_MILESTONE',
    category: 'TEAM',
    priority: 'HIGH',
    title: 'Team Milestone Reached!',
    content: 'Your team has completed 50% of the goal!',
    channels: ['REALTIME', 'EMAIL'],
    data: {
      teamId: teamId,
      goalId: goalId,
      progress: 50
    }
  }
});
```

## Privacy Considerations

The schema implements privacy controls:
- `isPrivate` flag on activities for user privacy
- Public leaderboards exclude private activities
- Team progress includes ALL activities (respecting team goals)
- Notification preferences allow users to control communication

## Performance Considerations

1. **Indexing**: Comprehensive indexes reduce query time
2. **JSON Fields**: Used for flexible data that doesn't need relational queries
3. **Compound Indexes**: Optimized for specific query patterns
4. **Binary Targets**: Ensures compatibility across deployment environments

Last Updated: 2025-01-20