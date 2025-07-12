# UI/UX and Architecture Alignment Document

## Overview

This document ensures complete alignment between the UI/UX design and the simplified MVP architecture, documenting specific technical constraints and opportunities.

## Architecture Constraints → UI Solutions

### 1. RDS PostgreSQL (No Aurora)
**Constraint**: Slower complex queries, no auto-scaling
**UI Solutions**:
- Pagination everywhere (10 items default)
- Progressive data loading
- "Load more" instead of infinite scroll
- Cached calculations in UI state

### 2. Pusher WebSockets (Not Custom)
**Constraint**: Channel-based messaging, connection limits
**UI Solutions**:
- Team-based channels only
- Presence indicators built-in
- Rate limit UI updates (1/second)
- Connection status always visible

### 3. CloudFront Only Caching
**Constraint**: 5-minute cache TTL, no Redis
**UI Solutions**:
- "Last updated X min ago" labels
- Manual refresh buttons
- Stale-while-revalidate pattern
- Local storage for user preferences

### 4. REST API (No GraphQL)
**Constraint**: Potential over-fetching
**UI Solutions**:
- Design screens for single API calls
- Combine related data needs
- Use field filtering params
- Cache navigation data

### 5. Basic Offline (Activities Only)
**Constraint**: Limited offline functionality
**UI Solutions**:
- Clear offline mode indicators
- Disable unavailable features
- Queue visualization for activities
- Sync status prominent

## Technical Integration Points

### 1. Authentication Flow (Cognito)
```javascript
// Simplified auth with Google Sign-In
const signInWithGoogle = async () => {
  // Cognito handles the OAuth flow
  // UI just needs to handle loading/error states
};
```

UI Requirements:
- Loading spinner during auth
- Error messages for failures
- Smooth transition to dashboard

### 2. Real-time Updates (Pusher)
```javascript
// Subscribe to team channel
const channel = pusher.subscribe(`team-${teamId}`);

channel.bind('activity-logged', (data) => {
  // Optimistically updated already
  // Just confirm or reconcile
});
```

UI Requirements:
- Debounce rapid updates
- Show sender info
- Animate new entries

### 3. Image Upload (S3 Presigned)
```javascript
// Simple upload flow
const uploadImage = async (file) => {
  const { presignedUrl } = await getPresignedUrl();
  await uploadToS3(presignedUrl, file);
  // UI shows progress
};
```

UI Requirements:
- Upload progress bar
- Error handling
- Moderation pending state
- Size limit warnings (5MB)

### 4. Offline Queue (IndexedDB)
```javascript
// Activity queue for offline
const queueActivity = async (activity) => {
  await db.activities.add({
    ...activity,
    synced: false,
    timestamp: Date.now()
  });
};
```

UI Requirements:
- Queue count badge
- Sync progress indicator
- Conflict resolution UI
- Clear success feedback

## Performance Budgets

### API Response Times (Actual)
| Operation | Target | Actual | UI Mitigation |
|-----------|--------|--------|---------------|
| Login | 1s | 2s | Show progress steps |
| Dashboard | 200ms | 300ms | Skeleton screen |
| Log Activity | 100ms | 300ms | Optimistic update |
| Load Team | 300ms | 500ms | Progressive load |

### Bundle Sizes
```
Main bundle: <100KB (gzipped)
Lazy chunks: <50KB each
Images: WebP with fallback
Fonts: System fonts only
```

## State Management Architecture

### Zustand Store Structure
```javascript
const useStore = create((set) => ({
  // UI State
  isOnline: true,
  syncStatus: 'idle',
  
  // User Data
  user: null,
  team: null,
  activities: [],
  
  // Optimistic Updates
  pendingActivities: [],
  
  // Actions
  logActivity: async (activity) => {
    // 1. Add to pending
    // 2. Update UI immediately
    // 3. Sync to server
    // 4. Handle success/failure
  }
}));
```

## Component Architecture

### Core Components (Week 1)
```
src/components/
├── auth/
│   ├── GoogleSignIn.jsx
│   └── EmailSignIn.jsx
├── dashboard/
│   ├── TeamProgress.jsx
│   ├── QuickStats.jsx
│   └── ActivityFeed.jsx
├── activity/
│   ├── LogActivity.jsx
│   └── ActivityItem.jsx
└── common/
    ├── ConnectionStatus.jsx
    ├── LoadingStates.jsx
    └── ErrorBoundary.jsx
```

### Progressive Components (Week 2+)
```
src/components/lazy/
├── achievements/
├── photos/
├── analytics/
└── notifications/
```

## Data Flow Patterns

### Dashboard Load
```
1. Show skeleton immediately
2. Check local cache (5 min TTL)
3. Fetch from API if stale
4. Update UI progressively
5. Subscribe to Pusher channel
```

### Activity Logging
```
1. Validate input locally
2. Add to optimistic state
3. Show success immediately
4. Queue for sync
5. Update on confirmation
6. Handle failures gracefully
```

## Error Handling Matrix

| Error Type | User Message | Recovery Action |
|------------|--------------|-----------------|
| Network | "You're offline" | Auto-retry queue |
| Auth | "Please sign in again" | Redirect to login |
| Validation | "Check your input" | Highlight fields |
| Server | "Something went wrong" | Retry button |
| Rate Limit | "Slow down a bit" | Disable for 30s |

## Accessibility Checklist

### MVP Critical
- [ ] Keyboard navigation for all features
- [ ] ARIA labels on interactive elements
- [ ] Focus management in modals
- [ ] Error announcements
- [ ] Loading state announcements

### Progressive Enhancement
- [ ] Screen reader optimizations
- [ ] High contrast mode
- [ ] Reduced motion support
- [ ] Voice input for logging
- [ ] Larger touch targets (48px)

## Testing Strategy

### UI Tests (Jest + React Testing Library)
```javascript
test('optimistic activity logging', async () => {
  const { getByRole, getByText } = render(<LogActivity />);
  
  // User logs activity
  fireEvent.change(getByRole('textbox'), { 
    target: { value: '2.5' } 
  });
  fireEvent.click(getByText('Save Activity'));
  
  // Should show immediately
  expect(getByText('2.5 miles')).toBeInTheDocument();
  expect(getByText('Syncing...')).toBeInTheDocument();
});
```

### E2E Critical Paths (Cypress)
1. Sign up → Create team → Log activity
2. Join team → View progress → Log activity
3. Offline → Log activity → Come online → Sync

## Monitoring & Analytics

### Performance Metrics
```javascript
// Track Core Web Vitals
if ('web-vitals' in window) {
  getCLS(sendToAnalytics);
  getFID(sendToAnalytics);
  getLCP(sendToAnalytics);
}
```

### User Behavior (GA4)
- Onboarding completion rate
- Activity logging frequency
- Feature adoption rates
- Error rates by type

## Migration Considerations

### When to Update UI
1. **Add ElastiCache**: Remove "last updated" labels
2. **Add GraphQL**: Redesign data-heavy screens
3. **Aurora Migration**: Enable real-time aggregations
4. **Native Apps**: Platform-specific UI patterns

---

*This alignment document ensures UI/UX and Architecture work in harmony for successful MVP delivery*