# Mile Quest Data Visualization Design

## Overview

This document outlines the data visualization components used throughout Mile Quest to display progress, statistics, and achievements. All visualizations prioritize clarity, accessibility, and mobile performance.

## Visualization Principles

1. **Glanceable**: Key information visible in under 3 seconds
2. **Progressive Disclosure**: Details on demand
3. **Contextual**: Always show relevant comparisons
4. **Animated**: Smooth transitions to show changes
5. **Accessible**: Never rely solely on color

## Progress Visualizations

### Linear Progress Bar

**Primary Use**: Team route progress, daily goals

```
┌─────────────────────────────────────┐
│ New York to Boston                  │
│ 68 mi ████████████░░░░░░ 100 mi    │
│ 68% Complete • 32 miles to go       │
└─────────────────────────────────────┘
```

**Specifications**:
- Height: 8px (track), 12px (with labels)
- Border Radius: 4px
- Fill Color: Primary Blue (#2563EB)
- Track Color: Gray 200 (#E5E7EB)
- Animation: 500ms ease-out on change
- Label: 14px Regular, Gray 700

**Variations**:
- Segmented: For waypoint-based routes
- Gradient: Shows pace changes
- Stacked: Multiple team members

### Circular Progress Ring

**Primary Use**: Personal daily goals, achievements

```
     ╭─────╮
    ╱       ╲     2.3 mi
   │    68%  │    ────────
   │         │    3.5 mi goal
    ╲       ╱
     ╰─────╯
```

**Specifications**:
- Size: 120px (mobile), 160px (tablet+)
- Stroke Width: 8px
- Start Angle: -90° (top)
- Direction: Clockwise
- Animation: Draw from 0% on load

### Map-Based Progress

**Primary Use**: Route visualization with current position

```
┌─────────────────────────────────────┐
│                                     │
│   A ═══════●═══════════════════ B   │
│        Current: Mile 68             │
│                                     │
│ [Brooklyn]  [Manhattan]  [Boston]   │
└─────────────────────────────────────┘
```

**Specifications**:
- Route Line: 4px, Primary Blue
- Completed: Solid line
- Remaining: Dashed line (8px dash, 4px gap)
- Current Position: 12px circle with pulse
- Waypoints: 8px circles with labels

## Statistical Displays

### Metric Cards

**Primary Use**: Key statistics display

```
┌───────────────┬───────────────┐
│ Today         │ This Week     │
│ 2.3 mi        │ 16.1 mi       │
│ ↑ 15%         │ On track      │
└───────────────┴───────────────┘
```

**Specifications**:
- Value: 24px Semibold
- Label: 12px Regular, Gray 600
- Trend: 14px Medium with arrow
- Positive: Success Green (#10B981)
- Negative: Error Red (#EF4444)

### Activity Chart

**Primary Use**: Weekly/monthly activity trends

```
Daily Activity (Last 7 Days)
│
│ 5 ┤    ██
│ 4 ┤ ██ ██ ██
│ 3 ┤ ██ ██ ██ ██
│ 2 ┤ ██ ██ ██ ██ ██
│ 1 ┤ ██ ██ ██ ██ ██ ██
│ 0 └─┬──┬──┬──┬──┬──┬──┬─
│     M  T  W  T  F  S  S
```

**Specifications**:
- Bar Width: 75% of available space
- Bar Spacing: 25% of bar width
- Height: Dynamic, max 120px
- Colors: Primary Blue with 10% transparency
- Grid Lines: Gray 200, 1px
- Hover: Show exact value tooltip

### Comparison Charts

**Primary Use**: Team member comparisons

```
Team Leaderboard
┌─────────────────────────────────────┐
│ Sarah    ████████████████████ 71 mi │
│ You      ████████████████░░░░ 68 mi │
│ Mike     ██████████████░░░░░░ 64 mi │
│ Lisa     ████████████░░░░░░░░ 52 mi │
└─────────────────────────────────────┘
```

**Specifications**:
- Bar Height: 24px
- Spacing: 12px between bars
- Your Position: Primary Blue
- Others: Gray 400
- Animation: Stagger 100ms per bar

## Gamification Visualizations

### Achievement Badges

**Primary Use**: Milestone celebrations

```
┌─────────┬─────────┬─────────┐
│   🥇    │   🏃    │   🔥    │
│ First   │  100    │   30    │
│ Place   │ Miles   │  Days   │
└─────────┴─────────┴─────────┘
```

**Specifications**:
- Size: 64x64px (badge area)
- Icon: 32px centered
- Border: 2px, varies by rarity
- Locked State: 50% opacity, grayscale
- Unlock Animation: Scale + glow

### Streak Indicator

**Primary Use**: Consecutive day tracking

```
🔥 12 Day Streak!
███████████████░░░░░ 30 days
Keep going for Gold!
```

**Specifications**:
- Flame Icon: Animated on milestones
- Progress: Segmented by milestone
- Colors: Orange to red gradient
- Lost Streak: Gray with recovery message

## Interactive Elements

### Data Tooltips

```
┌──────────────────┐
│ March 15, 2024   │
│ 3.5 miles        │
│ Morning walk 🌅  │
└────────┬─────────┘
         ▼
```

**Specifications**:
- Background: Gray 900, 95% opacity
- Text: White, 14px
- Padding: 8px 12px
- Border Radius: 6px
- Arrow: 8px triangle

### Expandable Details

```
Your Progress ▼
├─ Total Distance: 68 miles
├─ Days Active: 15/30
├─ Average Pace: 4.5 mi/day
└─ Best Day: 7.2 miles
```

**Specifications**:
- Chevron Animation: 180° rotation
- Content Reveal: Slide down, 300ms
- Line Height: 1.5x for readability
- Indent: 16px for hierarchy

## Performance Considerations

### Loading States

```
┌─────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░ ░░░░░░░░░░░░░░░░░░ ░░░░░░ │
└─────────────────────────────────────┘
```

- Skeleton screens for charts
- Shimmer effect, 1.5s duration
- Progressive data loading
- Cached previous values

### Optimization

1. **Canvas vs SVG**:
   - Simple bars: CSS
   - Complex charts: Canvas
   - Interactive: SVG

2. **Animation Performance**:
   - Use transform over position
   - RequestAnimationFrame for smooth updates
   - Will-change on animated properties

3. **Data Density**:
   - Mobile: Show last 7 days
   - Tablet: Show last 14 days  
   - Desktop: Show last 30 days

## Accessibility Features

### Screen Reader Support

- All charts have text alternatives
- Announce value changes
- Table fallback for complex data
- Descriptive ARIA labels

### Keyboard Navigation

- Tab through data points
- Arrow keys for chart exploration
- Enter/Space for details
- Escape to close tooltips

### Visual Alternatives

- Patterns in addition to colors
- High contrast mode support
- Motion reduced option
- Text labels always available

## Color Usage in Data

### Semantic Colors

```
Positive/Success:  #10B981 (Green)
Neutral/Info:      #3B82F6 (Blue)
Warning/Caution:   #F59E0B (Amber)
Negative/Error:    #EF4444 (Red)
```

### Data Series Colors

```
Series 1: #2563EB (Primary Blue)
Series 2: #7C3AED (Purple)
Series 3: #10B981 (Green)
Series 4: #F59E0B (Amber)
Series 5: #6B7280 (Gray)
```

Always pair with patterns or labels.

## Real-Time Updates

### Live Progress

- WebSocket updates every 30 seconds
- Smooth transitions between values
- Pulse animation on update
- Queue updates during offline

### Notifications

```
┌─────────────────────────────────────┐
│ 🎉 Team milestone reached!          │
│ Together you've walked 500 miles    │
└─────────────────────────────────────┘
```

- Slide in from top
- Auto-dismiss after 5 seconds
- Stack multiple notifications
- Swipe or tap to dismiss

---

*Last Updated: [Current Date]*
*UI/UX Design Agent*