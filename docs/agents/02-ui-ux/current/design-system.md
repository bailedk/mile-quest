# Mile Quest Design System

## Overview

This design system provides a comprehensive guide to the visual language, components, and patterns used throughout Mile Quest. It ensures consistency across all platforms while maintaining flexibility for future growth.

## Design Principles

1. **Clarity First**: Every element should have a clear purpose
2. **Thumb-Friendly**: Optimize for one-handed mobile use
3. **Delightful Progress**: Celebrate achievements and milestones
4. **Inclusive Design**: Accessible to all users
5. **Performance Matters**: Lightweight and fast-loading

## Color Palette

### Primary Colors

```
Primary Blue:    #2563EB (HSL: 217, 91%, 60%)
Primary Dark:    #1D4ED8 (HSL: 217, 91%, 48%)
Primary Light:   #3B82F6 (HSL: 217, 91%, 60%)

Usage: Primary actions, links, progress indicators
```

### Secondary Colors

```
Success Green:   #10B981 (HSL: 160, 84%, 39%)
Warning Amber:   #F59E0B (HSL: 38, 92%, 50%)
Error Red:       #EF4444 (HSL: 0, 84%, 60%)
Info Blue:       #3B82F6 (HSL: 217, 91%, 60%)
```

### Neutral Colors

```
Gray 900:        #111827 (Text primary)
Gray 700:        #374151 (Text secondary)
Gray 500:        #6B7280 (Text muted)
Gray 300:        #D1D5DB (Borders)
Gray 100:        #F3F4F6 (Backgrounds)
Gray 50:         #F9FAFB (Surface)
White:           #FFFFFF (Base)
```

### Semantic Colors

```
Background:      #FFFFFF (Light mode)
Surface:         #F9FAFB
Border:          #E5E7EB
Text Primary:    #111827
Text Secondary:  #6B7280
Text Link:       #2563EB
```

### Dark Mode (Future)

```
Background:      #0F172A
Surface:         #1E293B
Border:          #334155
Text Primary:    #F9FAFB
Text Secondary:  #94A3B8
```

## Typography

### Font Stack

```css
font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', 
             Roboto, Helvetica, Arial, sans-serif;
```

### Type Scale

```
Display:     48px / 56px line-height / -0.02em
H1:          36px / 44px line-height / -0.02em  
H2:          30px / 36px line-height / -0.01em
H3:          24px / 32px line-height / 0
H4:          20px / 28px line-height / 0
Body Large:  18px / 28px line-height / 0
Body:        16px / 24px line-height / 0
Body Small:  14px / 20px line-height / 0
Caption:     12px / 16px line-height / 0
```

### Font Weights

```
Regular:     400 (Body text)
Medium:      500 (Emphasis)
Semibold:    600 (Headings)
Bold:        700 (CTAs)
```

## Spacing System

Based on 4px grid:

```
Space 1:     4px
Space 2:     8px
Space 3:     12px
Space 4:     16px
Space 5:     20px
Space 6:     24px
Space 8:     32px
Space 10:    40px
Space 12:    48px
Space 16:    64px
Space 20:    80px
```

## Layout Grid

### Mobile (Default)
- Columns: 4
- Margin: 16px
- Gutter: 16px

### Tablet
- Columns: 8
- Margin: 24px
- Gutter: 24px

### Desktop
- Columns: 12
- Margin: 32px
- Gutter: 32px

## Components

### Buttons

#### Primary Button
```
Height:          48px (mobile) / 40px (desktop)
Padding:         16px 24px
Border Radius:   8px
Font:            16px / Semibold
Background:      #2563EB
Text:            #FFFFFF
Active:          #1D4ED8
Disabled:        #E5E7EB
```

#### Secondary Button
```
Height:          48px (mobile) / 40px (desktop)
Padding:         16px 24px
Border Radius:   8px
Border:          1px solid #D1D5DB
Font:            16px / Semibold
Background:      #FFFFFF
Text:            #374151
```

#### Text Button
```
Height:          40px
Padding:         8px 16px
Font:            16px / Medium
Color:           #2563EB
Underline:       On hover only
```

### Form Elements

#### Text Input
```
Height:          48px
Padding:         12px 16px
Border:          1px solid #D1D5DB
Border Radius:   8px
Font:            16px / Regular
Focus Border:    2px solid #2563EB
Error Border:    1px solid #EF4444
```

#### Labels
```
Font:            14px / Medium
Color:           #374151
Margin Bottom:   8px
Required (*):    #EF4444
```

### Cards

```
Background:      #FFFFFF
Border:          1px solid #E5E7EB
Border Radius:   12px
Padding:         16px
Shadow:          0 1px 3px rgba(0,0,0,0.1)
```

### Navigation

#### Tab Bar (Mobile)
```
Height:          56px
Background:      #FFFFFF
Border Top:      1px solid #E5E7EB
Icons:           24px
Font:            10px / Medium
Active Color:    #2563EB
Inactive Color:  #9CA3AF
```

#### Top Navigation
```
Height:          56px
Background:      #FFFFFF
Border Bottom:   1px solid #E5E7EB
Title:           18px / Semibold
Icons:           24px
```

## Iconography

### Icon Set
- Primary: Feather Icons
- Size: 24px (default), 20px (small), 32px (large)
- Stroke: 2px
- Color: Inherit from text

### Common Icons
```
Navigation:  menu, arrow-left, x, plus
Actions:     check, edit-2, trash-2, share-2
Status:      check-circle, alert-circle, info
Activities:  activity, trending-up, map-pin
Social:      heart, message-circle, users
```

## Motion & Animation

### Timing Functions
```
Ease:        cubic-bezier(0.4, 0, 0.2, 1)
Ease In:     cubic-bezier(0.4, 0, 1, 1)
Ease Out:    cubic-bezier(0, 0, 0.2, 1)
Spring:      cubic-bezier(0.175, 0.885, 0.32, 1.275)
```

### Durations
```
Instant:     100ms (hover states)
Fast:        200ms (small transitions)
Normal:      300ms (page transitions)
Slow:        500ms (complex animations)
```

### Common Animations
```
Fade In:     opacity 0→1, 200ms ease
Slide Up:    translateY 20px→0, 300ms ease-out
Scale:       scale 0.95→1, 200ms ease
Bounce:      custom spring, 500ms
```

## Elevation System

```
Level 0:     No shadow (flat)
Level 1:     0 1px 3px rgba(0,0,0,0.1)
Level 2:     0 4px 6px rgba(0,0,0,0.1)
Level 3:     0 10px 15px rgba(0,0,0,0.1)
Level 4:     0 20px 25px rgba(0,0,0,0.15)
```

## Component States

### Interactive States
1. **Default**: Base appearance
2. **Hover**: Cursor pointer, subtle elevation
3. **Focus**: 2px outline, high contrast
4. **Active**: Pressed appearance
5. **Disabled**: 50% opacity, no cursor

### Loading States
- Skeleton screens for content
- Spinner for actions
- Progress bars for uploads
- Shimmer effect for cards

### Empty States
- Illustration or icon
- Clear message
- Action to resolve

### Error States
- Red color (#EF4444)
- Error icon
- Clear error message
- Recovery action

## Responsive Behavior

### Breakpoints
```
Mobile:      0-767px
Tablet:      768px-1023px
Desktop:     1024px+
Wide:        1280px+
```

### Scaling Strategy
- Base: 16px (1rem)
- Mobile: 100%
- Tablet: 100%
- Desktop: 112.5% (18px base)

## Accessibility Requirements

### Color Contrast
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- Interactive: 3:1 minimum
- Focus indicators: 3:1 minimum

### Touch Targets
- Minimum: 44x44px
- Spacing: 8px between targets
- Exception: Inline text links

### Focus Management
- Visible focus indicators
- Logical tab order
- Skip links for navigation
- Focus trapping in modals

## Implementation Notes

### CSS Variables
```css
:root {
  --color-primary: #2563EB;
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --space-1: 4px;
  --space-2: 8px;
  --space-4: 16px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

### Component Naming
- Use BEM methodology
- Prefix with `mq-`
- Example: `mq-button--primary`

### Performance Guidelines
- Prefer CSS transitions over JavaScript
- Use will-change sparingly
- Optimize images (WebP with fallbacks)
- Lazy load non-critical assets

---

*Last Updated: [Current Date]*
*UI/UX Design Agent*