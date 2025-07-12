# MVP Wireframes - Simplified for New Architecture

## Overview

These wireframes reflect the simplified MVP architecture with progressive feature rollout and technical constraints in mind.

## Week 1 MVP Screens (Core Only)

### 1. Landing Page (Simplified)

```
┌─────────────────────────────────────┐
│  Mile Quest                    🚶   │
├─────────────────────────────────────┤
│                                     │
│   Walk Together, Go Further         │
│                                     │
│   Track team walking goals          │
│   Build healthy habits              │
│                                     │
│   ┌─────────────────────────┐      │
│   │   Continue with Google   │      │
│   └─────────────────────────┘      │
│                                     │
│   ┌─────────────────────────┐      │
│   │   Sign up with Email    │      │
│   └─────────────────────────┘      │
│                                     │
│   Already have a team? Sign in      │
│                                     │
└─────────────────────────────────────┘
```

### 2. Simple Onboarding (< 2 min)

```
Step 1: Welcome
┌─────────────────────────────────────┐
│  Welcome, Sarah! 👋                 │
├─────────────────────────────────────┤
│                                     │
│   Let's get you walking with        │
│   your team                         │
│                                     │
│   What do you want to do?           │
│                                     │
│   ┌─────────────────────────┐      │
│   │    Create a Team         │      │
│   └─────────────────────────┘      │
│                                     │
│   ┌─────────────────────────┐      │
│   │    Join a Team           │      │
│   └─────────────────────────┘      │
│                                     │
│   Skip for now →                    │
└─────────────────────────────────────┘

Step 2A: Create Team (Minimal)
┌─────────────────────────────────────┐
│  Create Your Team              (1/2)│
├─────────────────────────────────────┤
│                                     │
│   Team Name                         │
│   ┌─────────────────────────┐      │
│   │ Walking Warriors         │      │
│   └─────────────────────────┘      │
│                                     │
│   Goal Distance                     │
│   ┌─────────────────────────┐      │
│   │ 100 miles               │      │
│   └─────────────────────────┘      │
│                                     │
│   ┌─────────────────────────┐      │
│   │      Continue →          │      │
│   └─────────────────────────┘      │
└─────────────────────────────────────┘

Step 2B: Join Team (Simple)
┌─────────────────────────────────────┐
│  Join a Team                        │
├─────────────────────────────────────┤
│                                     │
│   Enter Team Code                   │
│   ┌─────────────────────────┐      │
│   │ _ _ _ _ _ _              │      │
│   └─────────────────────────┘      │
│                                     │
│   or                                │
│                                     │
│   [📷 Scan QR Code]                 │
│                                     │
│   ┌─────────────────────────┐      │
│   │        Join Team         │      │
│   └─────────────────────────┘      │
└─────────────────────────────────────┘
```

### 3. MVP Dashboard (Single API Call)

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

### 4. Activity Logging (Offline Capable)

```
┌─────────────────────────────────────┐
│  ← Back        Log Activity         │
├─────────────────────────────────────┤
│                                     │
│   How far did you walk?             │
│                                     │
│   ┌───────────────────────┐        │
│   │      2.5 miles        │        │
│   └───────────────────────┘        │
│                                     │
│   ┌─────────────────────────┐      │
│   │ -0.5  [Common Distances] +0.5  │      │
│   │  1mi   2mi   3mi   5mi  │      │
│   └─────────────────────────┘      │
│                                     │
│   Add a note (optional)             │
│   ┌─────────────────────────┐      │
│   │ Morning walk with dog   │      │
│   └─────────────────────────┘      │
│                                     │
│   ┌─────────────────────────┐      │
│   │      Save Activity       │      │
│   └─────────────────────────┘      │
│                                     │
│  📵 Offline - Will sync later       │
└─────────────────────────────────────┘
```

### 5. Simple Team View

```
┌─────────────────────────────────────┐
│  ← Back     Walking Warriors        │
├─────────────────────────────────────┤
│                                     │
│  Week Progress                      │
│  32 mi ██████░░░░░░ 100 mi         │
│                                     │
│  Members (4)                        │
│  ┌─────────────────────────┐       │
│  │ Sarah (You)    12.5 mi  │       │
│  │ Mike          10.2 mi   │       │
│  │ Lisa           8.3 mi   │       │
│  │ Tom            6.0 mi   │       │
│  └─────────────────────────┘       │
│                                     │
│  Invite Code: ABC123                │
│  [Copy] [Share]                     │
│                                     │
│  🔒 Achievements - Week 2           │
│  🔒 Photos - Week 2                 │
│  🔒 Leaderboard - Week 3            │
└─────────────────────────────────────┘
```

## Connection Status Indicators

### Online State
```
┌─────────────────────────────────────┐
│ 🟢 Connected · Synced just now      │
└─────────────────────────────────────┘
```

### Offline State
```
┌─────────────────────────────────────┐
│ 📵 Offline · 2 activities pending   │
└─────────────────────────────────────┘
```

### Syncing State
```
┌─────────────────────────────────────┐
│ 🔄 Syncing activities...            │
└─────────────────────────────────────┘
```

## Optimistic Update Examples

### Activity Logging Flow
```
1. User Submits:
┌─────────────────────────────────────┐
│ ✓ Activity saved locally!           │
│ Syncing to team...                  │
└─────────────────────────────────────┘

2. Optimistic Update:
┌─────────────────────────────────────┐
│ You - 2.5 mi - Just now ⏳         │
│ Morning walk with dog               │
└─────────────────────────────────────┘

3. Confirmed:
┌─────────────────────────────────────┐
│ You - 2.5 mi - Just now ✓          │
│ Morning walk with dog               │
└─────────────────────────────────────┘
```

## Progressive Feature Unlock

### Week 2 Unlock Screen
```
┌─────────────────────────────────────┐
│  🎉 New Features Unlocked!          │
├─────────────────────────────────────┤
│                                     │
│  Your team has been active for      │
│  1 week. Here's what's new:         │
│                                     │
│  ✅ Basic Achievements              │
│  ✅ Photo Sharing                   │
│  ✅ Weekly Stats                    │
│                                     │
│  Coming next week:                  │
│  🔒 Leaderboards                    │
│  🔒 Push Notifications              │
│                                     │
│  ┌─────────────────────────┐       │
│  │      Explore New          │       │
│  └─────────────────────────┘       │
└─────────────────────────────────────┘
```

## Error States (Simplified)

### Network Error
```
┌─────────────────────────────────────┐
│  😕 Can't Connect                   │
├─────────────────────────────────────┤
│                                     │
│  Check your internet connection     │
│                                     │
│  Your activities are saved and      │
│  will sync automatically            │
│                                     │
│  ┌─────────────────────────┐       │
│  │        Try Again         │       │
│  └─────────────────────────┘       │
└─────────────────────────────────────┘
```

### Sync Conflict
```
┌─────────────────────────────────────┐
│  ⚠️ Sync Issue                      │
├─────────────────────────────────────┤
│                                     │
│  This activity may be duplicate     │
│                                     │
│  Today's total: 5.5 miles           │
│  This activity: 2.5 miles           │
│                                     │
│  ┌─────────┬───────────────┐       │
│  │ Keep It │ Remove It     │       │
│  └─────────┴───────────────┘       │
└─────────────────────────────────────┘
```

## Performance Indicators

### Loading States
```
┌─────────────────────────────────────┐
│  Walking Warriors                   │
│  ░░░░░░░░░░░░░░░░░░░░░░░░          │
│                                     │
│  Loading team data...               │
│  ░░░░░░░░░░░░░░░░░░░░░░░░          │
│  ░░░░░░░░░░░░░░░░░░░░░░░░          │
│  ░░░░░░░░░░░░░░░░░░░░░░░░          │
└─────────────────────────────────────┘
```

### Stale Data Indicator
```
┌─────────────────────────────────────┐
│  Team Progress                   ↻  │
│  Updated 5 minutes ago              │
│  Tap to refresh                     │
└─────────────────────────────────────┘
```

## Key Differences from Original Wireframes

1. **Simpler Onboarding**: Just team name and goal (no map selection)
2. **Basic Dashboard**: Single screen with all key info
3. **Minimal Logging**: Just distance and optional note
4. **No Complex Features**: No maps, charts, or advanced stats
5. **Clear Feature Locks**: Shows what's coming in future weeks
6. **Connection Awareness**: Always shows sync status
7. **Optimistic UI**: Immediate feedback for all actions

## Implementation Notes

- Use React with Zustand for state
- Pusher for real-time updates
- Service Worker for offline
- CSS animations only (no complex libraries)
- Mobile-first responsive design
- Progressive enhancement approach

---

*These simplified wireframes align with the MVP architecture and 2-minute onboarding goal*