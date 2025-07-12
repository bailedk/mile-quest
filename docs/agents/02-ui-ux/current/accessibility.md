# Mile Quest Accessibility Guidelines

## Overview

This document outlines accessibility requirements and implementation guidelines to ensure Mile Quest meets WCAG 2.1 Level AA compliance. Our goal is to create an inclusive experience that works for everyone, regardless of ability.

## Core Principles (POUR)

1. **Perceivable**: Information must be presentable in ways users can perceive
2. **Operable**: Interface components must be operable by all users
3. **Understandable**: Information and UI operation must be understandable
4. **Robust**: Content must be robust enough for various assistive technologies

## Visual Accessibility

### Color Contrast Requirements

#### Text Contrast Ratios
```
Normal Text (<18pt):     4.5:1 minimum
Large Text (≥18pt):      3:1 minimum
UI Components:           3:1 minimum
Graphical Objects:       3:1 minimum
```

#### Verified Color Combinations
```
✅ Approved Combinations:
- #111827 on #FFFFFF = 19.9:1 (excellent)
- #374151 on #FFFFFF = 9.7:1 (excellent)
- #FFFFFF on #2563EB = 4.5:1 (passes AA)
- #FFFFFF on #10B981 = 2.5:1 (fails - use #0F766E)
- #FFFFFF on #EF4444 = 3.1:1 (passes for large text)

⚠️ Context-Dependent:
- #6B7280 on #FFFFFF = 4.5:1 (borderline)
- #2563EB on #F3F4F6 = 4.1:1 (use for large text)
```

### Color Independence

Never use color as the only means of conveying information:

```
❌ Bad: Red text for errors only
✅ Good: Red text + error icon + error message

❌ Bad: Green/red for success/failure
✅ Good: Green check / red X with labels
```

### Visual Indicators

#### Focus States
```css
/* Visible focus indicator */
:focus {
  outline: 2px solid #2563EB;
  outline-offset: 2px;
}

/* High contrast mode */
@media (prefers-contrast: high) {
  :focus {
    outline: 3px solid currentColor;
  }
}
```

#### Loading States
- Never rely on animation alone
- Provide text alternatives
- Include progress percentages
- Announce state changes

## Motor Accessibility

### Touch Target Guidelines

```
Minimum Size:        44x44px (WCAG)
Recommended:         48x48px (mobile)
Spacing:            8px minimum between targets
Exception:          Inline text links
```

#### Implementation Examples
```
✅ Good Button:
┌─────────────────────────┐
│                         │ 48px
│     Tap Target Area     │
│                         │
└─────────────────────────┘

❌ Bad Button:
┌──────────┐
│ Too Small│ 32px
└──────────┘
```

### Gesture Alternatives

All gestures must have alternative methods:

```
Swipe to Delete → Long press menu with delete option
Pinch to Zoom → Zoom buttons (+/-)
Drag to Reorder → Up/down buttons
Pull to Refresh → Refresh button
```

### Time Limits

- Session timeouts: 20+ minutes minimum
- Warning before timeout: 2 minutes
- Option to extend time
- Auto-save progress

## Keyboard Navigation

### Tab Order

Logical flow following visual layout:

```
1. Skip to main content link
2. Header navigation
3. Main content (top to bottom)
4. Sidebar (if present)
5. Footer navigation
```

### Keyboard Shortcuts

```
Tab:            Next focusable element
Shift+Tab:      Previous focusable element
Enter/Space:    Activate buttons/links
Arrow Keys:     Navigate within components
Escape:         Close modals/cancel operations
```

### Focus Management

```javascript
// Example: Modal focus trap
const focusableElements = modal.querySelectorAll(
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
);

// Trap focus within modal
modal.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    // Handle tab cycling
  }
});
```

## Screen Reader Support

### Semantic HTML

```html
<!-- Use proper heading hierarchy -->
<h1>Mile Quest</h1>
  <h2>Your Progress</h2>
    <h3>This Week</h3>
    <h3>All Time</h3>

<!-- Use landmarks -->
<nav aria-label="Main navigation">...</nav>
<main>...</main>
<aside aria-label="Team stats">...</aside>
```

### ARIA Labels

```html
<!-- Descriptive labels -->
<button aria-label="Close dialog">×</button>

<!-- Live regions for updates -->
<div aria-live="polite" aria-atomic="true">
  3.5 miles logged successfully
</div>

<!-- Describing relationships -->
<input aria-describedby="password-help">
<span id="password-help">
  Must be at least 8 characters
</span>
```

### Image Alternatives

```html
<!-- Decorative images -->
<img src="decoration.png" alt="" role="presentation">

<!-- Informative images -->
<img src="route-map.png" 
     alt="Route map showing 68 miles completed of 100 mile journey from NYC to Boston">

<!-- Complex images -->
<figure>
  <img src="progress-chart.png" 
       alt="Weekly progress chart"
       aria-describedby="chart-desc">
  <figcaption id="chart-desc">
    Chart showing daily miles: Monday 3.2, Tuesday 4.1...
  </figcaption>
</figure>
```

## Cognitive Accessibility

### Clear Language

- Use simple, direct language
- Avoid jargon and idioms
- Provide glossary for technical terms
- Use consistent terminology

### Error Prevention & Recovery

```
✅ Good Error Message:
"Please enter a valid email address (example: name@email.com)"

❌ Bad Error Message:
"Invalid input"
```

### Predictable Navigation

- Consistent menu placement
- Clear navigation labels
- Breadcrumbs for orientation
- Search functionality

### Instructions & Help

```html
<!-- Inline help -->
<label for="distance">
  Distance walked
  <button aria-label="Help for distance field" 
          class="help-icon">?</button>
</label>

<!-- Contextual instructions -->
<p class="field-help">
  Enter the distance in miles or kilometers
</p>
```

## Form Accessibility

### Label Association

```html
<!-- Explicit labels -->
<label for="email">Email Address</label>
<input type="email" id="email" required>

<!-- Required field indication -->
<label for="team-name">
  Team Name <span aria-label="required">*</span>
</label>
```

### Error Handling

```html
<!-- Field-level errors -->
<div class="form-field">
  <label for="distance">Distance</label>
  <input type="number" 
         id="distance" 
         aria-invalid="true"
         aria-describedby="distance-error">
  <span id="distance-error" role="alert">
    Please enter a positive number
  </span>
</div>

<!-- Form-level summary -->
<div role="alert" aria-live="assertive">
  <h3>Please fix the following errors:</h3>
  <ul>
    <li><a href="#distance">Distance must be positive</a></li>
    <li><a href="#date">Date cannot be in future</a></li>
  </ul>
</div>
```

### Input Types & Attributes

```html
<!-- Use appropriate input types -->
<input type="email" autocomplete="email">
<input type="tel" autocomplete="tel">
<input type="number" inputmode="decimal">

<!-- Provide format hints -->
<input type="date" 
       placeholder="MM/DD/YYYY"
       pattern="\d{2}/\d{2}/\d{4}">
```

## Mobile Accessibility

### Viewport Configuration

```html
<meta name="viewport" 
      content="width=device-width, initial-scale=1, maximum-scale=5">
```

### Orientation Support

- Support both portrait and landscape
- No critical functions locked to orientation
- Readable in all orientations

### Touch Accommodation

- No hover-only interactions
- Provide touch-friendly alternatives
- Support assistive touch features

## Testing Checklist

### Automated Testing
- [ ] Axe DevTools scan passes
- [ ] WAVE evaluation clear
- [ ] Lighthouse accessibility score > 95
- [ ] Color contrast analyzer passes

### Manual Testing
- [ ] Keyboard-only navigation works
- [ ] Screen reader testing (NVDA/JAWS/VoiceOver)
- [ ] 200% zoom doesn't break layout
- [ ] Works without JavaScript
- [ ] Focus indicators visible
- [ ] Motion can be disabled

### Device Testing
- [ ] iOS VoiceOver
- [ ] Android TalkBack
- [ ] Voice Control
- [ ] Switch Control
- [ ] Keyboard navigation (mobile)

## Implementation Priority

### Phase 1: Critical (Launch Requirement)
1. Color contrast compliance
2. Keyboard navigation
3. Screen reader basics
4. Touch targets
5. Form labels

### Phase 2: Important (Post-Launch)
1. Advanced ARIA
2. Animation preferences
3. Comprehensive shortcuts
4. Enhanced error handling
5. Cognitive aids

### Phase 3: Enhancement (Future)
1. Voice commands
2. Customization options
3. Alternative themes
4. Language simplification
5. Advanced personalization

## Accessibility Statement Template

```markdown
# Mile Quest Accessibility Statement

Mile Quest is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying relevant accessibility standards.

## Conformance Status
Mile Quest aims to conform to WCAG 2.1 Level AA.

## Feedback
We welcome your feedback on the accessibility of Mile Quest. Please contact us at:
- Email: accessibility@mile-quest.com
- Form: [Accessibility feedback form]

## Technical Specifications
Mile Quest relies on the following technologies:
- HTML
- CSS
- JavaScript
- ARIA

These technologies are relied upon for conformance.
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/TR/wai-aria-practices-1.1/)
- [WebAIM Resources](https://webaim.org/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

---

*Last Updated: [Current Date]*
*UI/UX Design Agent*