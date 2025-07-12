# Mile Quest Notification Patterns

## Overview

This document defines the notification system for Mile Quest, covering push notifications, in-app messages, and interaction patterns. The design prioritizes relevance, timing, and user control while driving engagement without being intrusive.

## Notification Philosophy

1. **Respectful**: Never spam or overwhelm users
2. **Actionable**: Every notification has a clear purpose
3. **Contextual**: Right message at the right time
4. **Controllable**: Users decide what they receive
5. **Valuable**: Each notification provides genuine value

## Notification Categories

### Activity Reminders
**Purpose**: Encourage daily logging
**Frequency**: Maximum once per day
**Timing**: User-customizable (default: 7 PM)

```
┌─────────────────────────────────────┐
│ 🚶 Mile Quest                       │
│                                     │
│ Time for your evening walk?         │
│ Your team has logged 45 miles today │
│                                     │
│ [Log Activity]  [Not Now]           │
└─────────────────────────────────────┘
```

### Team Updates
**Purpose**: Foster team engagement
**Frequency**: Real-time (batched if frequent)
**Priority**: Medium

```
┌─────────────────────────────────────┐
│ 👥 Walking Warriors                 │
│                                     │
│ Sarah just logged 5.2 miles!        │
│ "Beautiful sunset walk 🌅"          │
│                                     │
│ [View] [Cheer]                      │
└─────────────────────────────────────┘
```

### Achievement Unlocked
**Purpose**: Celebrate milestones
**Frequency**: As earned
**Priority**: High

```
┌─────────────────────────────────────┐
│ 🏆 Achievement Unlocked!            │
│                                     │
│ Century Club - 100 miles walked     │
│ You're in the top 10% of walkers   │
│                                     │
│ [View Badge] [Share]                │
└─────────────────────────────────────┘
```

### Goal Progress
**Purpose**: Maintain momentum
**Frequency**: Weekly or at milestones
**Priority**: Medium

```
┌─────────────────────────────────────┐
│ 📊 Weekly Progress Update           │
│                                     │
│ You're 75% to your goal!            │
│ Just 25 miles to reach Boston       │
│                                     │
│ [View Progress]                     │
└─────────────────────────────────────┘
```

## Push Notification Design

### Anatomy of a Push Notification

```
App Icon | App Name              Time
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Title (Bold, 1 line)
Body text (2-3 lines max)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Action 1]        [Action 2]
```

### Content Guidelines

#### Title Length
- iOS: 30-40 characters
- Android: 40-50 characters

#### Body Length
- iOS: 80-100 characters
- Android: 90-120 characters

#### Emoji Usage
- Maximum 1-2 per notification
- Use for visual scanning
- Must make sense without emoji

### Deep Linking

Each notification should deep link to relevant content:

```javascript
{
  "notification": {
    "title": "New team member joined!",
    "body": "Welcome Lisa to Walking Warriors",
    "data": {
      "type": "team_update",
      "deepLink": "/teams/123/members",
      "teamId": "123",
      "memberId": "456"
    }
  }
}
```

## In-App Notifications

### Toast Messages

**Use for**: Transient success/error feedback

```
┌─────────────────────────────────────┐
│ ✅ Activity logged successfully     │
└─────────────────────────────────────┘
```

**Specifications**:
- Position: Top of screen
- Duration: 3 seconds
- Animation: Slide down → pause → slide up
- Dismissible: Swipe up or auto-dismiss

### Banner Notifications

**Use for**: Important but non-blocking updates

```
┌─────────────────────────────────────┐
│ 🎉 Your team reached a waypoint!   │
│ Times Square ✓                   [×]│
└─────────────────────────────────────┘
```

**Specifications**:
- Position: Below navigation
- Persistent until dismissed
- Tappable for more details
- Manual dismiss required

### Modal Alerts

**Use for**: Critical actions requiring response

```
┌─────────────────────────────────────┐
│          Streak at Risk!            │
│                                     │
│   You haven't logged activity       │
│   today. Don't lose your            │
│   12-day streak!                    │
│                                     │
│  ┌───────────┐  ┌───────────┐      │
│  │    Log    │  │   Later   │      │
│  └───────────┘  └───────────┘      │
└─────────────────────────────────────┘
```

## Notification Preferences

### Settings Structure

```
Notification Settings
├─ Push Notifications [Toggle]
│  ├─ Daily Reminders
│  │  ├─ Enabled [Toggle]
│  │  └─ Time [7:00 PM ▼]
│  ├─ Team Updates
│  │  ├─ New Members [✓]
│  │  ├─ Member Activities [✓]
│  │  └─ Milestones [✓]
│  ├─ Achievements [✓]
│  └─ Weekly Summary [✓]
├─ Email Notifications
│  ├─ Weekly Report [✓]
│  └─ Monthly Summary [✓]
└─ Quiet Hours
   ├─ Enabled [Toggle]
   └─ Hours [10 PM - 7 AM]
```

### Smart Defaults

```javascript
const defaultSettings = {
  push: {
    dailyReminders: {
      enabled: true,
      time: "19:00", // 7 PM local
      smartTiming: true // AI-adjusted
    },
    teamUpdates: {
      newMembers: true,
      activities: true,
      milestones: true,
      maxPerDay: 10
    },
    achievements: true,
    weeklyProgress: true
  },
  quietHours: {
    enabled: true,
    start: "22:00",
    end: "07:00"
  }
};
```

## Notification Timing

### Smart Scheduling

```
Morning (6-9 AM):
- Daily goal reminders
- Streak maintenance
- Weather-based suggestions

Lunch (11 AM-1 PM):
- Midday progress check
- Quick walk reminders
- Team challenges

Evening (6-8 PM):
- Activity logging reminders
- Daily summary
- Social updates

Never Send:
- During quiet hours
- While user is active in app
- More than X per day (user setting)
```

### Batching Logic

```javascript
// Batch similar notifications
if (teamUpdates.length > 3) {
  return {
    title: "Team Walking Warriors",
    body: `${teamUpdates.length} new activities logged`,
    summary: condensedSummary(teamUpdates)
  };
}
```

## Interaction Patterns

### Notification Actions

#### Quick Actions (iOS/Android)

```
Achievement Unlocked:
├─ View Badge → Open achievement detail
└─ Share → Native share sheet

Team Activity:
├─ View → Open activity detail
└─ Cheer → Quick reaction added

Daily Reminder:
├─ Log Now → Activity input screen
└─ Snooze → Remind in 1 hour
```

### Rich Notifications

#### iOS Rich Content

```
┌─────────────────────────────────────┐
│ 🏆 New Achievement!                 │
│                                     │
│ [Badge Image Preview]               │
│                                     │
│ Century Club                        │
│ You've walked 100 miles with your   │
│ team. Amazing progress!             │
│                                     │
│ [View in App]                       │
└─────────────────────────────────────┘
```

#### Android Expanded View

```
┌─────────────────────────────────────┐
│ 📊 Weekly Team Summary       ▼     │
├─────────────────────────────────────┤
│ Total: 156 miles (78% of goal)     │
│                                     │
│ Top Walkers:                        │
│ 1. Sarah - 45 miles                 │
│ 2. You - 38 miles                   │
│ 3. Mike - 35 miles                  │
│                                     │
│ [View Details] [Log Activity]       │
└─────────────────────────────────────┘
```

## Error & Edge Cases

### Failed Delivery Handling

```javascript
// Retry logic for critical notifications
const retryNotification = async (notification, attempts = 3) => {
  for (let i = 0; i < attempts; i++) {
    try {
      await send(notification);
      break;
    } catch (error) {
      if (i === attempts - 1) {
        // Store for next app open
        await storeFailedNotification(notification);
      }
      await delay(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
};
```

### Permission Handling

```
┌─────────────────────────────────────┐
│   Enable Notifications?             │
│                                     │
│   Stay motivated with:              │
│   • Daily activity reminders        │
│   • Team milestone celebrations     │
│   • Personal achievement alerts     │
│                                     │
│   You can customize these anytime   │
│   in settings.                      │
│                                     │
│  ┌───────────┐  ┌───────────┐      │
│  │   Enable  │  │ Not Now   │      │
│  └───────────┘  └───────────┘      │
└─────────────────────────────────────┘
```

## Analytics & Optimization

### Tracking Metrics

```javascript
const notificationMetrics = {
  sent: 1000,
  delivered: 950,
  opened: 425,
  actionTaken: 280,
  dismissed: 145,
  disabled: 23
};

// Calculate engagement rates
const openRate = (opened / delivered) * 100; // 44.7%
const actionRate = (actionTaken / opened) * 100; // 65.9%
```

### A/B Testing Framework

```javascript
const variants = {
  A: {
    title: "Time for your evening walk?",
    body: "Your team needs 10 more miles today"
  },
  B: {
    title: "Keep your streak alive! 🔥",
    body: "Log today's walk before midnight"
  }
};
```

## Platform-Specific Considerations

### iOS
- Provisional authorization for quiet notifications
- Critical alerts for streaks at risk
- Live Activities for ongoing walks
- Focus mode integration

### Android
- Notification channels for categories
- Priority levels for importance
- Custom sounds per category
- Notification dots on app icon

### Web (PWA)
- Service worker for background
- Notification API permissions
- Badge API for counts
- Vibration API for emphasis

## Implementation Checklist

- [ ] Define notification service architecture
- [ ] Implement push token management
- [ ] Create notification templates
- [ ] Build preference management UI
- [ ] Implement smart scheduling
- [ ] Add analytics tracking
- [ ] Create A/B testing framework
- [ ] Test across platforms
- [ ] Document opt-in/out flows
- [ ] Plan for scalability

---

*Last Updated: [Current Date]*
*UI/UX Design Agent*