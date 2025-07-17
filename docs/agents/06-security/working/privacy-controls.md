# Privacy Controls Implementation

**Version**: 1.0  
**Date**: 2025-01-17  
**Agent**: Security & Privacy Agent (06)  
**Status**: In Progress

## Overview

This document details the implementation of privacy controls for Mile Quest, ensuring users can manage their data privacy while still contributing to team goals. The implementation follows the Data Model Agent's privacy principles and GDPR requirements.

## Privacy Principles

Based on Data Model Agent specifications:

1. **Private activities always count toward team goals** - Users can contribute without being on leaderboards
2. **User stats respect privacy** - Private activities are excluded from public stats  
3. **Team progress includes all activities** - Both private and public count toward goals
4. **Activity feed excludes private activities** - Only public activities shown in feeds
5. **Users own their data** - Can export, modify privacy, or delete

## Privacy Implementation

### Activity Privacy Model

```typescript
// types/privacy.types.ts

export interface PrivacySettings {
  defaultActivityPrivacy: boolean;
  showOnLeaderboards: boolean;
  shareStatsWithTeam: boolean;
  allowTeamNotifications: boolean;
}

export interface ActivityPrivacy {
  isPrivate: boolean;
  visibleTo: 'self' | 'team' | 'public';
  hideFromLeaderboards: boolean;
  hideFromFeed: boolean;
}

export interface PrivacyAwareQuery {
  viewerId: string;
  includePrivate: boolean;
  respectPrivacy: boolean;
}
```

### Privacy Service

```typescript
// services/privacy/privacy.service.ts

import { prisma } from '@/lib/prisma';
import { Activity, UserStats } from '@prisma/client';

export class PrivacyService {
  /**
   * Get user's complete stats including private activities
   */
  async getUserCompleteStats(userId: string) {
    const [totalStats, publicStats] = await Promise.all([
      // All activities
      prisma.activity.aggregate({
        where: { userId, deletedAt: null },
        _sum: { distance: true, duration: true },
        _count: true
      }),
      // Public activities only
      prisma.activity.aggregate({
        where: { userId, isPrivate: false, deletedAt: null },
        _sum: { distance: true, duration: true },
        _count: true
      })
    ]);

    return {
      total: {
        distance: totalStats._sum.distance || 0,
        activities: totalStats._count,
        duration: totalStats._sum.duration || 0
      },
      public: {
        distance: publicStats._sum.distance || 0,
        activities: publicStats._count,
        duration: publicStats._sum.duration || 0
      },
      private: {
        distance: (totalStats._sum.distance || 0) - (publicStats._sum.distance || 0),
        activities: totalStats._count - publicStats._count,
        duration: (totalStats._sum.duration || 0) - (publicStats._sum.duration || 0)
      }
    };
  }

  /**
   * Get privacy-aware activity feed
   */
  async getTeamActivityFeed(
    teamId: string, 
    viewerId: string,
    limit: number = 20
  ) {
    // Get public activities
    const publicActivities = await prisma.activity.findMany({
      where: {
        teamGoal: { teamId },
        isPrivate: false,
        deletedAt: null
      },
      include: {
        user: {
          select: { id: true, name: true, profilePictureUrl: true }
        }
      },
      orderBy: { startTime: 'desc' },
      take: limit
    });

    // Get viewer's own private activities
    const viewerPrivateActivities = await prisma.activity.findMany({
      where: {
        teamGoal: { teamId },
        userId: viewerId,
        isPrivate: true,
        deletedAt: null
      },
      orderBy: { startTime: 'desc' },
      take: limit
    });

    // Merge and sort
    const allActivities = [...publicActivities, ...viewerPrivateActivities]
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit)
      .map(activity => ({
        ...activity,
        isOwnActivity: activity.userId === viewerId
      }));

    return allActivities;
  }

  /**
   * Get privacy-aware leaderboard
   */
  async getTeamLeaderboard(teamId: string, viewerId: string) {
    // Get team goal for date range
    const teamGoal = await prisma.teamGoal.findFirst({
      where: { teamId, status: 'ACTIVE' }
    });

    if (!teamGoal) {
      return [];
    }

    // Get public activities only for leaderboard
    const leaderboardData = await prisma.activity.groupBy({
      by: ['userId'],
      where: {
        teamGoalId: teamGoal.id,
        isPrivate: false, // Only public activities
        deletedAt: null,
        startTime: { gte: teamGoal.startDate },
        endTime: { lte: teamGoal.endDate || new Date() }
      },
      _sum: {
        distance: true,
        duration: true
      },
      _count: true
    });

    // Get user details
    const userIds = leaderboardData.map(entry => entry.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, profilePictureUrl: true }
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    // Get viewer's private contribution (not shown to others)
    const viewerPrivateStats = await prisma.activity.aggregate({
      where: {
        teamGoalId: teamGoal.id,
        userId: viewerId,
        isPrivate: true,
        deletedAt: null
      },
      _sum: { distance: true }
    });

    const leaderboard = leaderboardData
      .map(entry => ({
        user: userMap.get(entry.userId)!,
        totalDistance: entry._sum.distance || 0,
        totalActivities: entry._count,
        totalDuration: entry._sum.duration || 0,
        isCurrentUser: entry.userId === viewerId
      }))
      .sort((a, b) => b.totalDistance - a.totalDistance);

    // Add viewer's position info if they have private activities
    if (viewerPrivateStats._sum.distance) {
      const viewerPublicEntry = leaderboard.find(e => e.isCurrentUser);
      if (viewerPublicEntry) {
        viewerPublicEntry.privateDistance = viewerPrivateStats._sum.distance;
        viewerPublicEntry.totalContribution = 
          viewerPublicEntry.totalDistance + viewerPrivateStats._sum.distance;
      }
    }

    return leaderboard;
  }

  /**
   * Toggle activity privacy
   */
  async toggleActivityPrivacy(
    activityId: string, 
    userId: string
  ): Promise<Activity> {
    // Verify ownership
    const activity = await prisma.activity.findFirst({
      where: { id: activityId, userId, deletedAt: null }
    });

    if (!activity) {
      throw new Error('Activity not found or unauthorized');
    }

    // Toggle privacy
    return await prisma.activity.update({
      where: { id: activityId },
      data: { isPrivate: !activity.isPrivate }
    });
  }

  /**
   * Bulk update privacy settings
   */
  async updateBulkPrivacy(
    userId: string,
    makePrivate: boolean,
    dateRange?: { start: Date; end: Date }
  ) {
    const where: any = { userId, deletedAt: null };
    
    if (dateRange) {
      where.startTime = { gte: dateRange.start };
      where.endTime = { lte: dateRange.end };
    }

    return await prisma.activity.updateMany({
      where,
      data: { isPrivate: makePrivate }
    });
  }
}
```

### Privacy-Aware API Endpoints

```typescript
// app/api/v1/activities/route.ts

export async function GET(request: NextRequest) {
  const user = (request as any).user;
  const searchParams = request.nextUrl.searchParams;
  const teamId = searchParams.get('teamId');
  const includePrivate = searchParams.get('includePrivate') === 'true';

  const privacyService = new PrivacyService();

  if (teamId) {
    // Team activity feed - privacy aware
    const activities = await privacyService.getTeamActivityFeed(
      teamId,
      user.id
    );
    
    return NextResponse.json({
      success: true,
      data: { activities }
    });
  } else {
    // User's own activities - include private if requested
    const activities = await prisma.activity.findMany({
      where: {
        userId: user.id,
        ...(includePrivate ? {} : { isPrivate: false }),
        deletedAt: null
      },
      orderBy: { startTime: 'desc' },
      take: 50
    });

    return NextResponse.json({
      success: true,
      data: { activities }
    });
  }
}
```

### Privacy Settings Management

```typescript
// app/api/v1/user/privacy/route.ts

import { z } from 'zod';

const privacySettingsSchema = z.object({
  defaultActivityPrivacy: z.boolean(),
  showOnLeaderboards: z.boolean(),
  shareStatsWithTeam: z.boolean(),
  allowTeamNotifications: z.boolean()
});

export async function GET(request: NextRequest) {
  const user = (request as any).user;

  const settings = await prisma.userPreferences.findUnique({
    where: { userId: user.id },
    select: {
      defaultActivityPrivacy: true,
      showOnLeaderboards: true,
      shareStatsWithTeam: true,
      allowTeamNotifications: true
    }
  });

  return NextResponse.json({
    success: true,
    data: settings || {
      defaultActivityPrivacy: false,
      showOnLeaderboards: true,
      shareStatsWithTeam: true,
      allowTeamNotifications: true
    }
  });
}

export async function PATCH(request: NextRequest) {
  const user = (request as any).user;
  const body = await request.json();
  
  const validated = privacySettingsSchema.parse(body);

  const settings = await prisma.userPreferences.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      ...validated
    },
    update: validated
  });

  return NextResponse.json({
    success: true,
    data: settings
  });
}
```

## GDPR Compliance

### Data Export

```typescript
// app/api/v1/user/data-export/route.ts

export async function POST(request: NextRequest) {
  const user = (request as any).user;

  // Gather all user data
  const [
    profile,
    activities,
    teams,
    achievements,
    preferences
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id } }),
    prisma.activity.findMany({ where: { userId: user.id } }),
    prisma.teamMember.findMany({
      where: { userId: user.id },
      include: { team: true }
    }),
    prisma.userAchievement.findMany({
      where: { userId: user.id },
      include: { achievement: true }
    }),
    prisma.userPreferences.findUnique({ where: { userId: user.id } })
  ]);

  const exportData = {
    exportDate: new Date().toISOString(),
    profile,
    activities,
    teams: teams.map(tm => ({
      team: tm.team,
      membership: {
        role: tm.role,
        joinedAt: tm.joinedAt,
        leftAt: tm.leftAt
      }
    })),
    achievements,
    preferences
  };

  // Queue email with download link
  await queueDataExportEmail(user.email, exportData);

  return NextResponse.json({
    success: true,
    data: {
      message: 'Data export initiated. You will receive an email with download link.'
    }
  });
}
```

### Account Deletion

```typescript
// app/api/v1/user/delete-account/route.ts

export async function DELETE(request: NextRequest) {
  const user = (request as any).user;
  const body = await request.json();
  
  // Verify password for security
  const authService = createAuthService();
  try {
    await authService.signIn(user.email, body.password);
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_PASSWORD' } },
      { status: 401 }
    );
  }

  // Soft delete user and anonymize data
  await prisma.$transaction(async (tx) => {
    // Anonymize user data
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: `deleted_${user.id}@milequest.local`,
        name: 'Deleted User',
        profilePictureUrl: null,
        deletedAt: new Date()
      }
    });

    // Remove from all teams
    await tx.teamMember.updateMany({
      where: { userId: user.id, leftAt: null },
      data: { leftAt: new Date() }
    });

    // Anonymize activities but keep for team stats
    await tx.activity.updateMany({
      where: { userId: user.id },
      data: { 
        notes: null,
        // Keep distance/duration for team totals
      }
    });

    // Delete preferences and sensitive data
    await tx.userPreferences.delete({
      where: { userId: user.id }
    });
  });

  // Delete from auth provider
  await authService.deleteAccount();

  return NextResponse.json({
    success: true,
    data: { message: 'Account deleted successfully' }
  });
}
```

## Privacy UI Components

### Privacy Toggle Component

```typescript
// components/privacy/activity-privacy-toggle.tsx

import { Switch } from '@/components/ui/switch';
import { Lock, Globe } from 'lucide-react';

interface ActivityPrivacyToggleProps {
  isPrivate: boolean;
  onChange: (isPrivate: boolean) => void;
  disabled?: boolean;
}

export function ActivityPrivacyToggle({
  isPrivate,
  onChange,
  disabled
}: ActivityPrivacyToggleProps) {
  return (
    <div className="flex items-center space-x-2">
      <Switch
        checked={isPrivate}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-label="Toggle activity privacy"
      />
      <div className="flex items-center space-x-1">
        {isPrivate ? (
          <>
            <Lock className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-500">Private</span>
          </>
        ) : (
          <>
            <Globe className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-blue-500">Public</span>
          </>
        )}
      </div>
    </div>
  );
}
```

### Privacy Settings Page

```typescript
// app/settings/privacy/page.tsx

export default function PrivacySettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PrivacySettings>();

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Privacy Settings</h1>
      
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Activity Privacy</h2>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span>Make new activities private by default</span>
              <Switch
                checked={settings?.defaultActivityPrivacy || false}
                onCheckedChange={(checked) => updateSetting('defaultActivityPrivacy', checked)}
              />
            </label>
            
            <p className="text-sm text-gray-600">
              Private activities count toward team goals but don't appear on leaderboards or in team feeds.
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Visibility Settings</h2>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span>Show me on team leaderboards</span>
              <Switch
                checked={settings?.showOnLeaderboards || true}
                onCheckedChange={(checked) => updateSetting('showOnLeaderboards', checked)}
              />
            </label>
            
            <label className="flex items-center justify-between">
              <span>Share stats with team members</span>
              <Switch
                checked={settings?.shareStatsWithTeam || true}
                onCheckedChange={(checked) => updateSetting('shareStatsWithTeam', checked)}
              />
            </label>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Data Management</h2>
          
          <div className="space-y-4">
            <button
              onClick={exportData}
              className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Export My Data
            </button>
            
            <button
              onClick={showDeleteConfirmation}
              className="w-full py-2 px-4 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Delete My Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Privacy Indicators

### Activity Feed Privacy Indicators

```typescript
// components/activity/activity-feed-item.tsx

export function ActivityFeedItem({ activity }: { activity: Activity }) {
  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <img 
            src={activity.user.profilePictureUrl || '/default-avatar.png'} 
            className="w-8 h-8 rounded-full"
          />
          <span className="font-medium">{activity.user.name}</span>
        </div>
        
        {activity.isPrivate && (
          <div className="flex items-center space-x-1 text-gray-500">
            <Lock className="h-3 w-3" />
            <span className="text-xs">Private</span>
          </div>
        )}
      </div>
      
      <div>
        <span className="text-lg font-semibold">
          {formatDistance(activity.distance)}
        </span>
        <span className="text-gray-600 ml-2">
          in {formatDuration(activity.duration)}
        </span>
      </div>
      
      {activity.isOwnActivity && activity.isPrivate && (
        <p className="text-xs text-gray-500 mt-2">
          Only visible to you
        </p>
      )}
    </div>
  );
}
```

## Testing Privacy Controls

```typescript
// __tests__/services/privacy.test.ts

describe('PrivacyService', () => {
  let privacyService: PrivacyService;

  beforeEach(() => {
    privacyService = new PrivacyService();
  });

  describe('getUserCompleteStats', () => {
    it('should separate private and public stats', async () => {
      const userId = 'test-user';
      
      // Create test activities
      await createActivity({ userId, distance: 1000, isPrivate: false });
      await createActivity({ userId, distance: 2000, isPrivate: true });
      
      const stats = await privacyService.getUserCompleteStats(userId);
      
      expect(stats.total.distance).toBe(3000);
      expect(stats.public.distance).toBe(1000);
      expect(stats.private.distance).toBe(2000);
    });
  });

  describe('getTeamActivityFeed', () => {
    it('should only show public activities to other users', async () => {
      const teamId = 'test-team';
      const viewerId = 'viewer';
      const otherId = 'other-user';
      
      // Create activities
      await createActivity({ userId: otherId, teamId, isPrivate: true });
      await createActivity({ userId: otherId, teamId, isPrivate: false });
      
      const feed = await privacyService.getTeamActivityFeed(teamId, viewerId);
      
      expect(feed).toHaveLength(1);
      expect(feed[0].isPrivate).toBe(false);
    });

    it('should show own private activities', async () => {
      const teamId = 'test-team';
      const viewerId = 'viewer';
      
      await createActivity({ userId: viewerId, teamId, isPrivate: true });
      await createActivity({ userId: viewerId, teamId, isPrivate: false });
      
      const feed = await privacyService.getTeamActivityFeed(teamId, viewerId);
      
      expect(feed).toHaveLength(2);
    });
  });
});
```

## Privacy Monitoring

```typescript
// services/monitoring/privacy-metrics.ts

export class PrivacyMetrics {
  async recordPrivacyToggle(userId: string, newState: boolean) {
    await this.cloudWatch.putMetricData({
      Namespace: 'MileQuest/Privacy',
      MetricData: [{
        MetricName: 'PrivacyToggles',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'NewState', Value: newState ? 'Private' : 'Public' }
        ]
      }]
    });
  }

  async getPrivacyStats() {
    const [totalActivities, privateActivities] = await Promise.all([
      prisma.activity.count(),
      prisma.activity.count({ where: { isPrivate: true } })
    ]);

    return {
      totalActivities,
      privateActivities,
      privatePercentage: (privateActivities / totalActivities) * 100
    };
  }
}
```

## Conclusion

This privacy controls implementation ensures:
- Users maintain control over their activity visibility
- Private activities contribute to team goals without public exposure
- GDPR compliance with data export and deletion
- Clear privacy indicators throughout the UI
- Comprehensive privacy settings management
- Privacy-aware queries respect user preferences

The implementation follows all Data Model Agent specifications while providing a user-friendly privacy experience.