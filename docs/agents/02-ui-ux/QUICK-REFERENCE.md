# UI/UX Design Agent - Quick Reference Card

## Current State (v2.0 - MVP Aligned)

### Design Overview
```
Viewport:    375x667px (iPhone SE baseline)
Framework:   Mobile-first responsive
Updates:     Optimistic UI everywhere
Offline:     Activity logging only
Features:    Progressive rollout over 4 weeks
```

### Core Screens (Week 1)
1. **Landing** - Google Sign-In or Email
2. **Onboarding** - Team name + goal only (<2 min)
3. **Dashboard** - Single API call design
4. **Log Activity** - Quick buttons, offline capable
5. **Team View** - Members + progress + invite

### Design Tokens
```css
/* Colors */
--primary:     #2563EB
--success:     #10B981
--error:       #EF4444
--text:        #111827
--background:  #FFFFFF

/* Spacing (4px grid) */
--space-sm:    8px
--space-md:    16px
--space-lg:    24px

/* Touch targets */
--min-touch:   44px
```

### Progressive Feature Rollout
| Week | Features | Status |
|------|----------|--------|
| 1 | Core: Teams, Logging, Progress | 🟢 Designed |
| 2 | Achievements (3 types), Photos | 🟢 Designed |
| 3 | Leaderboards, Notifications | 🟡 Basic only |
| 4 | Analytics, Full achievements | 🔴 Deferred |

### Key UI Patterns
- **Connection Status**: Always visible indicator
- **Optimistic Updates**: Immediate feedback + sync
- **Loading States**: Skeleton screens everywhere
- **Error Handling**: Friendly messages + retry
- **Offline Mode**: Clear indicators + queue

### Performance Targets
- Onboarding: <2 minutes ✓
- Log activity: <15 seconds ✓
- Perceived load: <500ms (optimistic) ✓
- Actual load: <4 seconds

### Removed from MVP
- ❌ Complex maps/routes
- ❌ Advanced analytics
- ❌ Video uploads
- ❌ Real-time GPS
- ❌ Team challenges

### Accessibility
- WCAG 2.1 AA compliant
- 44px minimum touch targets
- Semantic HTML structure
- Keyboard navigation ready
- Screen reader optimized

### Key Files
- `current/mvp-wireframes.md` - Simplified screens
- `current/design-system.md` - Components
- `current/ui-architecture-alignment.md` - Tech integration
- `STATE.json` - Version tracking

---
*Last Updated: 2025-01-12 | Version: 2.0*