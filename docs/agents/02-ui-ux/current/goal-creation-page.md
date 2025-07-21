# Team Goal Creation/Edit Page Design

## Overview

This document outlines the design for the team goal creation and editing feature, allowing team admins to set goals by selecting multiple cities on an interactive map/globe. The system calculates the total route distance automatically.

## Page Structure

### URL Patterns
- Create new goal: `/teams/{teamId}/goals/new`
- Edit existing goal: `/teams/{teamId}/goals/{goalId}/edit`

## Layout Components

### 1. Header Section
```
┌─────────────────────────────────────────┐
│ ← Back to Team                          │
│                                         │
│ Create Team Goal                   [?]  │
│ Set your team's walking challenge       │
└─────────────────────────────────────────┘
```

**Specifications:**
- Back button: Returns to team detail page
- Title: 24px/Semibold
- Subtitle: 14px/Regular, Gray 700
- Help icon: Opens tooltip with instructions

### 2. Goal Information Panel
```
┌─────────────────────────────────────────┐
│ Goal Name                               │
│ ┌─────────────────────────────────────┐ │
│ │ Pacific Coast Adventure              │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Description (optional)                  │
│ ┌─────────────────────────────────────┐ │
│ │ Walk the distance from Seattle to   │ │
│ │ San Diego along the Pacific Coast   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ End Date                                │
│ ┌─────────────────────────────────────┐ │
│ │ 📅 March 31, 2025                   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Specifications:**
- Text inputs: 48px height, 16px padding
- Label: 14px/Medium, Gray 700
- Date picker: Native mobile picker
- Character limit: Name (50), Description (200)

### 3. Interactive Map Section

#### Mobile View (Default)
```
┌─────────────────────────────────────────┐
│ Route Builder                           │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │         [Interactive Map]           │ │
│ │                                     │ │
│ │      🔍 Search for a city...        │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Add Waypoint] [Clear All] [Globe View] │
└─────────────────────────────────────────┘
```

#### Desktop/Tablet View
```
┌─────────────────────────────────────────────────────┐
│ Route Builder                                       │
│ ┌───────────────────────────┬─────────────────────┐ │
│ │                           │ Waypoints (3)       │ │
│ │                           │                     │ │
│ │    [Interactive Map]      │ 1. Seattle, WA  [x] │ │
│ │                           │ 2. Portland, OR [x] │ │
│ │                           │ 3. San Diego, CA[x] │ │
│ │                           │                     │ │
│ │                           │ [+ Add Waypoint]    │ │
│ └───────────────────────────┴─────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Map Specifications:**
- Height: 400px (mobile), 500px (tablet/desktop)
- Controls: Zoom (+/-), Reset view, Toggle globe/flat
- Interaction: Tap/click to add waypoint
- Visual: Blue markers with numbers, connected by lines
- Search: Autocomplete with geocoding results

### 4. Waypoint List (Mobile)
```
┌─────────────────────────────────────────┐
│ Waypoints (3)                           │
│ ┌─────────────────────────────────────┐ │
│ │ 1 ≡ Seattle, WA              174 mi │ │
│ ├─────────────────────────────────────┤ │
│ │ 2 ≡ Portland, OR             635 mi │ │
│ ├─────────────────────────────────────┤ │
│ │ 3 ≡ San Diego, CA              [x] │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 💡 Drag to reorder waypoints            │
└─────────────────────────────────────────┘
```

**Specifications:**
- Drag handle: ≡ icon, 24px
- Distance: Shows cumulative distance to each point
- Delete: [x] button, 24px touch target
- Reorder: Drag and drop with haptic feedback
- Animation: Smooth transitions on reorder

### 5. Route Summary
```
┌─────────────────────────────────────────┐
│ Route Summary                           │
│ ┌─────────────────────────────────────┐ │
│ │ Total Distance:         1,255 miles │ │
│ │ Estimated Days:         42 days     │ │
│ │ Daily Average Needed:   30 miles    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ⚠️ This seems ambitious! Most teams    │
│    complete 15-20 miles per day.        │
└─────────────────────────────────────────┘
```

**Specifications:**
- Card style: White background, border, 8px radius
- Metrics: Large numbers (18px/Semibold)
- Warning: Shows if daily average > 25 miles
- Calculation: Updates in real-time

### 6. Action Buttons
```
┌─────────────────────────────────────────┐
│ [Cancel]          [Save as Draft]       │
│                                         │
│        [Create Goal →]                  │
└─────────────────────────────────────────┘
```

**Specifications:**
- Primary button: Full width on mobile, blue
- Secondary buttons: Ghost style
- States: Loading, disabled (no waypoints)
- Confirmation: Modal for discarding changes

## Interaction Flows

### Adding Waypoints

1. **Search Method:**
   - Tap search bar → Keyboard opens
   - Type city name → Autocomplete appears
   - Select result → Pin drops on map
   - Map centers on new waypoint

2. **Map Click Method:**
   - Tap location on map
   - Popup shows: "Add waypoint here?"
   - Confirm → Reverse geocode for city name
   - Pin appears with number

3. **Globe View (Premium Feature):**
   - 3D globe rotation with touch gestures
   - Same interaction as flat map
   - Visual: Great circle routes between points

### Editing Waypoints

1. **Reorder:**
   - Long press waypoint in list
   - Drag to new position
   - Route recalculates automatically
   - Haptic feedback on drop

2. **Delete:**
   - Tap [x] on waypoint
   - Immediate removal (with undo toast)
   - Route updates instantly

### Route Optimization

Optional feature: "Optimize Route" button that reorders waypoints for shortest total distance.

## Visual Design

### Map Styling
- Base: Light theme with muted colors
- Water: #E0F2FE (Light blue)
- Land: #F3F4F6 (Light gray)
- Borders: #D1D5DB (Subtle)
- Route line: #2563EB (Primary blue), 3px, dashed
- Markers: Blue with white numbers

### Mobile Optimizations
- Fullscreen map mode (landscape)
- Gesture hints on first use
- Pinch to zoom, drag to pan
- Momentum scrolling for waypoint list

### Loading States
- Map: Skeleton with shimmer
- Search: Inline spinner
- Route calculation: Progress bar
- Save: Button spinner

### Error States
- No route possible: "Can't calculate route between these points"
- Network error: "Check connection and try again"
- Invalid location: "Location not found"

## Accessibility

- Keyboard navigation for all controls
- Screen reader announcements for route changes
- High contrast mode support
- Alternative text input for coordinates
- Focus indicators on all interactive elements

## Technical Considerations

### Performance
- Lazy load map library
- Debounce route calculations (500ms)
- Cache geocoding results
- Progressive map detail loading

### Data Validation
- Minimum 2 waypoints required
- Maximum 10 waypoints (configurable)
- Goal name required
- End date must be future date
- Total distance reasonable check (< 10,000 miles)

## Edit Mode Differences

When editing an existing goal:
- Title: "Edit Team Goal"
- Waypoints pre-populated
- "Delete Goal" option in menu
- Change history tracked
- Warning if reducing distance significantly

## Responsive Breakpoints

- Mobile: < 768px (single column)
- Tablet: 768px - 1023px (map + condensed sidebar)
- Desktop: ≥ 1024px (full layout)

## Implementation Notes

1. Use Mapbox GL JS for map rendering
2. Implement service worker for offline map tiles
3. Store draft goals in localStorage
4. Real-time collaboration for future version
5. Analytics: Track waypoint count, route length distribution

---

*Created by UI/UX Design Agent*
*Version: 1.0*
*Date: 2025-01-20*