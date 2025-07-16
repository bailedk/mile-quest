# Mile Quest Achievement Notification Patterns

## Overview

This document defines the notification patterns for achievements and gamification features in Mile Quest. It focuses on creating delightful, non-intrusive notifications that celebrate user progress while maintaining a positive user experience.

## Notification Philosophy

1. **Celebrate, Don't Interrupt**: Notifications enhance the experience without disrupting flow
2. **Progressive Disclosure**: Start subtle, allow users to explore details
3. **Contextual Timing**: Show notifications at natural transition points
4. **Inclusive Language**: Positive reinforcement for all achievement levels
5. **Visual Hierarchy**: Important achievements get more prominent treatment

## Notification Types

### 1. In-App Achievement Unlocked

**When**: Immediately after achievement criteria are met
**Duration**: 4 seconds (auto-dismiss) or manual dismiss

```
┌─────────────────────────────────────┐
│                                     │
│         🎉 Achievement Unlocked!    │
│                                     │
│              🏃 Runner              │
│         You've walked 50 miles!     │
│                                     │
│         [View Badge]  [Dismiss]     │
│                                     │
└─────────────────────────────────────┘
```

**Animation Sequence**:
1. Slide in from top (300ms ease-out)
2. Confetti burst animation (optional for major achievements)
3. Badge icon scales up with bounce effect
4. Auto-dismiss fade out or swipe to dismiss

**Specifications**:
```typescript
interface AchievementNotification {
  id: string;
  type: 'achievement_unlocked';
  achievement: {
    id: string;
    name: string;
    description: string;
    icon: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
  };
  timestamp: Date;
  viewed: boolean;
}
```

### 2. Progress Update Notifications

**When**: At milestone percentages (25%, 50%, 75%, 90%)
**Format**: Subtle toast notification

```
┌─────────────────────────────────────┐
│ 📊 50% Complete!                    │
│ Halfway to Century Club (100 mi)    │
└─────────────────────────────────────┘
```

**Specifications**:
- Position: Bottom of screen (mobile) or bottom-right (desktop)
- Duration: 3 seconds
- Animation: Slide up + fade in

### 3. Team Achievement Notifications

**When**: Team reaches collective milestone
**Format**: Full-width banner

```
┌─────────────────────────────────────┐
│    🎊 Team Achievement Unlocked!    │
│                                     │
│         Walking Warriors            │
│    just completed Route to NYC!     │
│                                     │
│    [Celebrate Together] [Dismiss]   │
└─────────────────────────────────────┘
```

**Special Features**:
- Team member avatars shown
- Shared celebration reactions
- Option to notify all team members

### 4. Streak Notifications

**When**: Daily at first activity log or reminder time
**Format**: Motivational card

```
┌─────────────────────────────────────┐
│         🔥 7 Day Streak!            │
│                                     │
│    Keep it going! Log today's       │
│    activity to extend your streak   │
│                                     │
│         [Log Activity]              │
└─────────────────────────────────────┘
```

### 5. Social Achievement Notifications

**When**: Teammates unlock achievements
**Format**: Feed item with celebration option

```
┌─────────────────────────────────────┐
│ [Avatar] Sarah just unlocked        │
│          🌍 Globe Trotter!          │
│          1000 miles walked          │
│                                     │
│    🎉 👏 ❤️  [Send Congrats]        │
└─────────────────────────────────────┘
```

## Notification Delivery Patterns

### Immediate Notifications

Shown instantly for:
- Personal achievement unlocks
- Streak milestones
- Team goal completion

### Batched Notifications

Grouped and shown at natural breaks:
- Multiple team member achievements
- Progress updates for multiple goals
- End-of-day summaries

### Notification Center Design

```
┌─────────────────────────────────────┐
│ Notifications                    ⚙️  │
├─────────────────────────────────────┤
│ Today                               │
│                                     │
│ 🎉 Achievement Unlocked!            │
│    Century Club - 100 miles         │
│    2 hours ago                      │
│                                     │
│ 📊 Weekly Progress                  │
│    You're 75% to your goal!         │
│    Yesterday                        │
│                                     │
│ 👥 Team Update                      │
│    3 members logged activities      │
│    Yesterday                        │
└─────────────────────────────────────┘
```

## Visual Design Specifications

### Color Coding by Achievement Rarity

```css
.achievement-common {
  background: linear-gradient(135deg, #E5E7EB, #F3F4F6);
  border: 1px solid #D1D5DB;
}

.achievement-rare {
  background: linear-gradient(135deg, #3B82F6, #2563EB);
  border: 1px solid #1D4ED8;
}

.achievement-epic {
  background: linear-gradient(135deg, #8B5CF6, #7C3AED);
  border: 1px solid #6D28D9;
}

.achievement-legendary {
  background: linear-gradient(135deg, #F59E0B, #F97316);
  border: 1px solid #EA580C;
  animation: shimmer 2s infinite;
}
```

### Animation Library

```typescript
// Entrance animations
const slideInTop = keyframes`
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const bounceIn = keyframes`
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.05); }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
`;

// Celebration effects
const confettiBurst = keyframes`
  0% { transform: scale(0) rotate(0deg); }
  100% { transform: scale(1) rotate(360deg); }
`;

// Continuous animations
const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;
```

## Push Notification Patterns

### Achievement Push Notifications

**Title**: "🎉 Achievement Unlocked!"
**Body**: "You just earned {achievement_name} - {description}"
**Action**: Deep link to achievement detail

### Streak Reminder Notifications

**Title**: "🔥 Keep your {n}-day streak alive!"
**Body**: "Log today's activity to maintain your streak"
**Timing**: Configurable by user (default: 7 PM)

### Team Milestone Notifications

**Title**: "🎊 Team milestone reached!"
**Body**: "{team_name} just hit {milestone}"
**Action**: Deep link to team celebration

## Sound Design (Optional)

### Achievement Unlock Sounds

- **Common**: Subtle chime (0.5s)
- **Rare**: Musical flourish (1s)
- **Epic**: Orchestral hit (1.5s)
- **Legendary**: Fanfare (2s)

### Settings
```typescript
interface NotificationSettings {
  soundEnabled: boolean;
  hapticEnabled: boolean;
  achievementNotifications: boolean;
  progressNotifications: boolean;
  teamNotifications: boolean;
  streakReminders: boolean;
  reminderTime?: string; // "19:00"
}
```

## Implementation Guidelines

### 1. Notification Queue System

```typescript
class NotificationQueue {
  private queue: Notification[] = [];
  private isShowing = false;
  
  add(notification: Notification) {
    // Add priority scoring
    const priority = this.calculatePriority(notification);
    this.queue.push({ ...notification, priority });
    this.queue.sort((a, b) => b.priority - a.priority);
    
    if (!this.isShowing) {
      this.showNext();
    }
  }
  
  private calculatePriority(notification: Notification): number {
    // Legendary achievements: 100
    // Team milestones: 80
    // Personal achievements: 60
    // Progress updates: 40
    // Social updates: 20
  }
}
```

### 2. Animation Performance

- Use CSS transforms only (no layout changes)
- Implement will-change for predictable animations
- Remove animations on low-end devices
- Respect prefers-reduced-motion

### 3. Accessibility

- Screen reader announcements for all notifications
- Keyboard navigation for notification actions
- High contrast mode support
- Alternative text for all achievement icons

## Notification Scenarios

### Scenario 1: First Achievement

**Context**: User completes their first mile
**Pattern**: 
1. Full celebration animation
2. Onboarding tooltip about achievement system
3. Prompt to view all available achievements

### Scenario 2: Multiple Achievements

**Context**: User unlocks 3 achievements in one activity
**Pattern**:
1. Show most important achievement first
2. Stack remaining as "+2 more achievements"
3. Allow expansion to see all

### Scenario 3: Near Miss

**Context**: User is 0.1 miles from achievement
**Pattern**:
1. Encouraging message: "So close!"
2. Show exact distance remaining
3. Motivational prompt to continue

## A/B Testing Opportunities

1. **Animation intensity**: Subtle vs. celebratory
2. **Notification timing**: Immediate vs. end of session
3. **Social sharing prompts**: Automatic vs. optional
4. **Sound effects**: On by default vs. opt-in
5. **Streak reminder timing**: Morning vs. evening

## Metrics to Track

```typescript
interface NotificationMetrics {
  achievementViewRate: number;      // % who tap to view
  dismissRate: number;              // % who dismiss immediately
  shareRate: number;                // % who share achievements
  notificationDisableRate: number;  // % who turn off
  engagementLift: number;          // Activity increase post-notification
}
```

---

*Last Updated: 2025-01-15*
*UI/UX Design Agent - Achievement Notification Patterns v1.0*