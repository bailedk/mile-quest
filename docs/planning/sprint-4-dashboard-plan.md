# Sprint 4 - Dashboard Implementation Plan

## Overview

Sprint 4 focuses on creating the unified dashboard experience that brings together all Mile Quest data into a single, performant view. This plan details the component breakdown, data requirements, and implementation order for the dashboard features.

**Sprint Duration**: 5 days (Week 5)  
**Goal**: Complete dashboard with visualizations, leaderboards, and real-time updates  
**Current Status**: Sprint 3 at 50% complete (Activity tracking)

## Dashboard Wireframe Analysis

Based on the MVP wireframes, the dashboard should display:

```
┌─────────────────────────────────────┐
│  Mile Quest             👤 Sarah    │
├─────────────────────────────────────┤
│                                     │
│  Walking Warriors                   │
│  32 mi ██████░░░░░░ 100 mi         │
│                                     │
│  This Week: 12.5 miles              │
│  Your Best: Monday (4.2 mi)         │
│                                     │
│  Team Activity                      │
│  ┌─────────────────────────┐       │
│  │ Mike - 3.5 mi - 1h ago  │       │
│  │ Lisa - 2.8 mi - 3h ago  │       │
│  │ You - 4.2 mi - Today    │       │
│  └─────────────────────────┘       │
│                                     │
│  ┌─────────────────────────┐       │
│  │    Log Today's Walk      │       │
│  └─────────────────────────┘       │
└─────────────────────────────────────┘
```

## Component Hierarchy

### 1. Dashboard Container (`DashboardPage`)
- **Purpose**: Main dashboard page with data fetching and state management
- **Location**: `/packages/frontend/src/app/dashboard/page.tsx`
- **Responsibilities**:
  - Fetch dashboard data from API
  - Handle loading/error states
  - Manage refresh logic
  - Coordinate child components

### 2. Team Progress Card (`TeamProgressCard`)
- **Purpose**: Display team's overall progress toward goal
- **Data Requirements**:
  - Team name, goal distance, current distance
  - Progress percentage
  - Visual progress bar
- **Props**:
  ```typescript
  interface TeamProgressCardProps {
    team: {
      id: string;
      name: string;
      goalDistance: number;
    };
    progress: {
      totalDistance: number;
      percentComplete: number;
    };
  }
  ```

### 3. User Stats Card (`UserStatsCard`)
- **Purpose**: Show user's personal statistics
- **Data Requirements**:
  - Weekly distance
  - Best day performance
  - Current streak
- **Props**:
  ```typescript
  interface UserStatsCardProps {
    stats: {
      weeklyDistance: number;
      bestDay: {
        date: string;
        distance: number;
      };
      currentStreak: number;
    };
  }
  ```

### 4. Team Activity Feed (`TeamActivityFeed`)
- **Purpose**: Real-time feed of team member activities
- **Data Requirements**:
  - Recent activities from team members
  - User info (name, avatar)
  - Relative timestamps
- **Props**:
  ```typescript
  interface TeamActivityFeedProps {
    activities: Array<{
      userId: string;
      userName: string;
      userAvatar?: string;
      distance: number;
      timestamp: string;
      isCurrentUser: boolean;
    }>;
    onLoadMore?: () => void;
  }
  ```

### 5. Quick Actions (`QuickActions`)
- **Purpose**: Primary action buttons for common tasks
- **Components**:
  - Log activity button
  - View team button
  - Invite members button

### 6. Progress Chart (`ProgressChart`)
- **Purpose**: Visualize progress over time
- **Library**: Recharts
- **Data Requirements**:
  - Daily/weekly progress data
  - Goal line visualization
- **Props**:
  ```typescript
  interface ProgressChartProps {
    data: Array<{
      date: string;
      distance: number;
      cumulativeDistance: number;
    }>;
    goalDistance: number;
    period: 'week' | 'month';
  }
  ```

### 7. Team Leaderboard (`TeamLeaderboard`)
- **Purpose**: Rank team members by contribution
- **Data Requirements**:
  - Member rankings
  - Total distances
  - User highlighting
- **Props**:
  ```typescript
  interface TeamLeaderboardProps {
    members: Array<{
      userId: string;
      name: string;
      avatar?: string;
      totalDistance: number;
      rank: number;
      isCurrentUser: boolean;
    }>;
    period: 'week' | 'month' | 'all-time';
  }
  ```

### 8. Achievement Notifications (`AchievementToast`)
- **Purpose**: Display achievement unlocks and milestones
- **Features**:
  - Auto-dismiss
  - Celebration animation
  - Click to view details

## API Endpoint Requirements

### Dashboard Data Endpoint
```typescript
GET /api/v1/dashboard

Response: DashboardData {
  user: {
    id: string;
    name: string;
    profilePictureUrl: string | null;
    stats: {
      totalDistance: number;
      currentStreak: number;
      weeklyDistance: number;
      bestDay: {
        date: string;
        distance: number;
      };
    };
  };
  teams: Array<{
    team: {
      id: string;
      name: string;
      goalDistance: number;
    };
    progress: {
      totalDistance: number;
      percentComplete: number;
      rank: number;
    };
    recentActivities: Array<{
      userId: string;
      userName: string;
      distance: number;
      timestamp: string;
    }>;
    leaderboard: Array<{
      userId: string;
      name: string;
      totalDistance: number;
      rank: number;
    }>;
  }>;
}
```

## Implementation Order

### Day 1: Backend Foundation
1. **BE-401**: Dashboard endpoint implementation (8 hours)
   - Create `/api/v1/dashboard` handler
   - Implement data aggregation service
   - Add response caching
   - Performance optimization

2. **DB-401**: Database view optimization (6 hours)
   - Create materialized views for stats
   - Optimize query performance
   - Add appropriate indexes

### Day 2: Core Dashboard UI
1. **FE-401**: Dashboard page and layout (8 hours)
   - Update existing dashboard page
   - Implement responsive grid layout
   - Add loading states with skeletons
   - Error handling and retry logic
   - Pull-to-refresh functionality

2. **BE-403**: Leaderboard calculations (6 hours)
   - Weekly/monthly leaderboard logic
   - Privacy filter implementation
   - Ranking algorithms

### Day 3: Data Visualizations
1. **FE-402**: Progress charts (8 hours)
   - Install and configure Recharts
   - Create ProgressChart component
   - Add goal line visualization
   - Implement period selector
   - Touch interactions for mobile

### Day 4: Additional Features
1. **FE-403**: Team leaderboard component (6 hours)
   - Create leaderboard UI
   - Add rank change indicators
   - User highlighting
   - Period selector

2. **FE-404**: Activity feed component (6 hours)
   - Real-time activity updates
   - Smooth animations
   - Load more functionality
   - Relative timestamps

### Day 5: Polish and Optimization
1. **FE-405**: Statistics cards (4 hours)
   - Personal record displays
   - Week-over-week comparisons
   - Progress percentages
   - Animated counters

2. **FE-406**: Refresh logic (4 hours)
   - 5-minute auto-refresh
   - Manual refresh button
   - Optimistic updates
   - Conflict resolution

## Component Dependencies

```
DashboardPage
├── TeamProgressCard
├── UserStatsCard
├── ProgressChart
├── TeamActivityFeed
├── TeamLeaderboard
├── QuickActions
└── AchievementToast
```

## State Management

### Dashboard Store (Zustand)
```typescript
interface DashboardStore {
  // Data
  dashboardData: DashboardData | null;
  isLoading: boolean;
  error: Error | null;
  lastRefresh: Date | null;
  
  // Actions
  fetchDashboard: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
  optimisticActivityUpdate: (activity: Activity) => void;
  
  // Websocket
  subscribeToTeamUpdates: (teamId: string) => void;
  unsubscribeFromTeamUpdates: (teamId: string) => void;
}
```

## Performance Considerations

1. **API Response Caching**
   - Cache dashboard data for 5 minutes
   - Use ETags for efficient updates
   - Implement stale-while-revalidate

2. **Component Optimization**
   - Memoize expensive calculations
   - Use React.memo for pure components
   - Virtualize long lists

3. **Progressive Loading**
   - Load critical data first
   - Lazy load charts
   - Defer non-essential features

4. **Mobile Optimization**
   - Reduce chart data points on mobile
   - Simplify animations
   - Optimize touch interactions

## Testing Requirements

### Unit Tests
- Component rendering
- Data transformation
- Error states
- Loading states

### Integration Tests
- API data fetching
- WebSocket updates
- Refresh logic
- Chart interactions

### Performance Tests
- Initial load time < 2s
- Refresh time < 1s
- Smooth 60fps animations
- Memory usage stable

## Success Criteria

1. **Performance**
   - Dashboard loads in < 2 seconds
   - Updates appear in < 500ms
   - Smooth animations (60fps)

2. **Functionality**
   - All data displays correctly
   - Real-time updates work
   - Charts are interactive
   - Mobile responsive

3. **User Experience**
   - Intuitive layout
   - Clear data hierarchy
   - Smooth transitions
   - Helpful loading states

## Risk Mitigation

1. **Performance Risk**: Large teams with many activities
   - Solution: Implement pagination and data limits
   
2. **Real-time Risk**: WebSocket connection issues
   - Solution: Fallback to polling, connection indicators

3. **Mobile Risk**: Complex charts on small screens
   - Solution: Simplified mobile visualizations

4. **Data Risk**: Stale or conflicting data
   - Solution: Clear freshness indicators, conflict resolution

## Next Steps

1. **Backend team**: Start with BE-401 dashboard endpoint
2. **Database team**: Optimize queries with DB-401
3. **Frontend team**: Prepare component structure
4. **All teams**: Review API contracts and data flow

This plan ensures a coordinated effort to deliver a polished, performant dashboard that enhances the Mile Quest user experience.