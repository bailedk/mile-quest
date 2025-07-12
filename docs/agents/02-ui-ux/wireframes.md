# Mile Quest Mobile Wireframes

## Overview

This document contains ASCII-art wireframes and detailed descriptions for key mobile screens. All designs follow mobile-first principles with a primary viewport of 375x667px (iPhone SE).

## Screen Layouts

### 1. Onboarding - Welcome Screen

```
┌─────────────────────────────────┐
│  Status Bar                     │
├─────────────────────────────────┤
│                                 │
│      [App Logo]                 │
│                                 │
│   Walk Together, Go Further     │
│                                 │
│   ┌─────────────────────────┐   │
│   │  [Illustration: Team    │   │
│   │   walking on a map]     │   │
│   └─────────────────────────┘   │
│                                 │
│   Join millions walking         │
│   towards their goals           │
│                                 │
│   ┌─────────────────────────┐   │
│   │    Get Started          │   │
│   └─────────────────────────┘   │
│                                 │
│   ┌─────────────────────────┐   │
│   │    I Have an Account    │   │
│   └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

**Key Elements:**
- Full-screen immersive design
- Primary CTA: 56px height, high contrast
- Secondary CTA: Text button style
- Illustration: 200px height, animated

### 2. Registration Screen

```
┌─────────────────────────────────┐
│  < Back        Sign Up          │
├─────────────────────────────────┤
│                                 │
│   Create Your Account           │
│                                 │
│   ┌─────────────────────────┐   │
│   │ Email                   │   │
│   └─────────────────────────┘   │
│                                 │
│   ┌─────────────────────────┐   │
│   │ Password                │   │
│   └─────────────────────────┘   │
│                                 │
│   [ ] I agree to terms         │
│                                 │
│   ┌─────────────────────────┐   │
│   │    Create Account       │   │
│   └─────────────────────────┘   │
│                                 │
│   ─────── OR ───────           │
│                                 │
│   ┌─────────────────────────┐   │
│   │ 🍎 Continue with Apple  │   │
│   └─────────────────────────┘   │
│                                 │
│   ┌─────────────────────────┐   │
│   │ G  Continue with Google │   │
│   └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

**Key Elements:**
- Input fields: 48px height, 16px padding
- Real-time validation indicators
- Social auth buttons: Platform styling
- Progress auto-saves

### 3. Team Dashboard

```
┌─────────────────────────────────┐
│  ☰             Mile Quest    +  │
├─────────────────────────────────┤
│  ┌─────────────────────────┐   │
│  │  Team: Walking Warriors  │   │
│  │  68 mi ████████░░ 100 mi │   │
│  │  Next: Central Park      │   │
│  └─────────────────────────┘   │
├─────────────────────────────────┤
│  Your Stats                     │
│  ┌──────────┬──────────────┐   │
│  │ Today    │ This Week     │   │
│  │ 2.3 mi   │ 14.7 mi       │   │
│  │ 🔥 3 days │ Rank #2       │   │
│  └──────────┴──────────────┘   │
├─────────────────────────────────┤
│  Team Activity                  │
│  ┌─────────────────────────┐   │
│  │ 👤 Sarah - 3.1 mi       │   │
│  │ Just now                │   │
│  │ "Beautiful morning run!" │   │
│  │ ❤️ 👏 (2)               │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ 👤 Mike - 2.5 mi        │   │
│  │ 1 hour ago              │   │
│  │ 📷 [Photo thumbnail]    │   │
│  │ ❤️ 💪 (5)               │   │
│  └─────────────────────────┘   │
├─────────────────────────────────┤
│  Home  Progress  Log  Profile  │
└─────────────────────────────────┘
```

**Key Elements:**
- Progress card: Visual hierarchy focus
- Stats cards: Glanceable metrics
- Activity feed: Social engagement
- Tab bar: Thumb-reachable icons

### 4. Activity Logging

```
┌─────────────────────────────────┐
│  Cancel       Log Activity   ✓  │
├─────────────────────────────────┤
│                                 │
│   How far did you walk?         │
│                                 │
│   ┌───────┐ ┌─┐ ┌───────────┐  │
│   │   2   │ │.│ │    5      │  │
│   └───────┘ └─┘ └───────────┘  │
│                                 │
│   ○ Miles   ● Kilometers       │
│                                 │
│   ┌─────────────────────────┐   │
│   │ - 1 +  Quick Add  - 5 + │   │
│   └─────────────────────────┘   │
│                                 │
│   When?                         │
│   ┌─────────────────────────┐   │
│   │ Today, 3:30 PM       ▼ │   │
│   └─────────────────────────┘   │
│                                 │
│   Add Details (Optional)        │
│   ┌─────────────────────────┐   │
│   │ Add a note...           │   │
│   │                         │   │
│   └─────────────────────────┘   │
│                                 │
│   ┌─────────────────────────┐   │
│   │ 📷 Add Photo            │   │
│   └─────────────────────────┘   │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Or Sync from Fitness App  │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Key Elements:**
- Large number input: Easy thumb typing
- Quick add buttons: Common distances
- Time picker: Defaults to "now"
- Optional enhancements below fold

### 5. Map Route View

```
┌─────────────────────────────────┐
│  < Back     Route Progress      │
├─────────────────────────────────┤
│  ┌─────────────────────────┐   │
│  │                         │   │
│  │    [Interactive Map]    │   │
│  │                         │   │
│  │    A ═══════●═══ B      │   │
│  │         Current         │   │
│  │         Position        │   │
│  │                         │   │
│  └─────────────────────────┘   │
├─────────────────────────────────┤
│  Progress Details               │
│  ┌─────────────────────────┐   │
│  │ Total: 68 of 100 miles  │   │
│  │ ████████████░░░░░░░░░░ │   │
│  └─────────────────────────┘   │
│                                 │
│  Next Waypoint                  │
│  ┌─────────────────────────┐   │
│  │ 📍 Central Park          │   │
│  │ 12 miles to go          │   │
│  │ ~5 days at current pace │   │
│  └─────────────────────────┘   │
│                                 │
│  Team Positions                 │
│  ┌─────────────────────────┐   │
│  │ You're #2 on the team   │   │
│  │ Sarah: 71 mi (ahead)    │   │
│  │ You: 68 mi              │   │
│  │ Mike: 64 mi             │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

**Key Elements:**
- Map: 40% of screen height
- Visual progress indicator
- Clear next goal messaging
- Competitive element (positions)

### 6. Team Creation Flow

```
Step 1: Basic Info
┌─────────────────────────────────┐
│  Cancel    Create Team   Next   │
├─────────────────────────────────┤
│                                 │
│   Team Name                     │
│   ┌─────────────────────────┐   │
│   │ Walking Warriors        │   │
│   └─────────────────────────┘   │
│   15/30 characters              │
│                                 │
│   Description (Optional)        │
│   ┌─────────────────────────┐   │
│   │ Join us as we virtually │   │
│   │ walk across America!    │   │
│   └─────────────────────────┘   │
│                                 │
│   Team Type                     │
│   ● Public                      │
│   ○ Private (Invite Only)      │
│                                 │
│   Team Size Limit               │
│   ┌─────────────────────────┐   │
│   │ No Limit            ▼ │   │
│   └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘

Step 2: Route Selection
┌─────────────────────────────────┐
│  < Back    Set Route    Next    │
├─────────────────────────────────┤
│                                 │
│   ┌─────────────────────────┐   │
│   │ 🔍 Search location...   │   │
│   └─────────────────────────┘   │
│                                 │
│   ┌─────────────────────────┐   │
│   │                         │   │
│   │    [Map Interface]      │   │
│   │                         │   │
│   │  Tap to add waypoints   │   │
│   │                         │   │
│   │    A ──── B ──── C      │   │
│   │                         │   │
│   └─────────────────────────┘   │
│                                 │
│   Waypoints (2 minimum)         │
│   ┌─────────────────────────┐   │
│   │ 1. Times Square, NYC    │   │
│   │ 2. Central Park, NYC    │   │
│   │ 3. Brooklyn Bridge      │   │
│   │ + Add Waypoint          │   │
│   └─────────────────────────┘   │
│                                 │
│   Total Distance: 8.5 miles     │
│                                 │
└─────────────────────────────────┘
```

## Responsive Breakpoints

### Tablet (768px+)
- Two-column layouts where appropriate
- Side navigation drawer
- Expanded activity cards
- Larger map views

### Desktop (1024px+)
- Three-column dashboard
- Persistent navigation sidebar
- Modal overlays for forms
- Full-screen map option

## Interaction Patterns

### Touch Targets
- Minimum size: 44x44px
- Spacing between targets: 8px minimum
- Thumb-friendly zones prioritized

### Gestures
- Swipe to delete activities
- Pull to refresh feeds
- Pinch to zoom maps
- Long press for context menus

### Transitions
- Screen transitions: 300ms slide
- Loading states: Skeleton screens
- Success feedback: 200ms fade
- Error states: Shake animation

## Navigation Structure

```
├── Onboarding Flow
│   ├── Welcome
│   ├── Register/Login
│   ├── Profile Setup
│   └── Team Choice
├── Main App
│   ├── Dashboard (Home)
│   ├── Progress
│   │   ├── Map View
│   │   ├── Statistics
│   │   └── Achievements
│   ├── Activity Log
│   │   ├── Manual Entry
│   │   └── Sync Options
│   ├── Team
│   │   ├── Members
│   │   ├── Settings
│   │   └── Invite
│   └── Profile
│       ├── Personal Stats
│       ├── Settings
│       └── Integrations
```

## Accessibility Notes

- All interactive elements labeled
- Color not sole indicator
- Focus states clearly visible
- Gesture alternatives provided
- Screen reader optimized flow

---

*Last Updated: [Current Date]*
*UI/UX Design Agent*