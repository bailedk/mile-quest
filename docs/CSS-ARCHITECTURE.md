# Mile Quest CSS Architecture Guidelines

## Overview

This document provides the official CSS architecture guidelines for Mile Quest developers. These guidelines are based on comprehensive analysis by our Architecture and UI/UX agents and represent best practices for our Next.js React application.

## Core Principles

1. **Performance First**: Zero runtime CSS overhead
2. **Mobile Optimized**: Every style decision considers mobile impact
3. **Simple & Maintainable**: Patterns that a small team can manage
4. **Progressive Enhancement**: Base styles work everywhere, enhancements layer on top

## CSS Strategy: Tailwind CSS + CSS Modules

### Primary Approach: Tailwind CSS (90% of styling)

Use Tailwind for:
- Layout (flexbox, grid, spacing, sizing)
- Typography (font sizes, weights, line heights)
- Colors and backgrounds
- Borders and shadows
- Basic animations and transitions
- Responsive design
- State modifiers (hover, focus, active)

```tsx
// ✅ GOOD: Using Tailwind for component styling
export function Button({ children, variant = 'primary' }) {
  const baseClasses = 'px-6 py-3 rounded-lg font-semibold transition-colors';
  const variantClasses = {
    primary: 'bg-primary text-white hover:bg-primary-dark',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
  };
  
  return (
    <button className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </button>
  );
}
```

### Secondary Approach: CSS Modules (10% of styling)

Use CSS Modules ONLY for:
- Complex animations that require keyframes
- Styles that cannot be expressed with utilities
- Third-party component overrides
- Performance-critical CSS (critical path)

```tsx
// ✅ GOOD: CSS Module for complex animation
// MapLoader.module.css
.loader {
  animation: complexMapAnimation 2s ease-in-out infinite;
}

@keyframes complexMapAnimation {
  0%, 100% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.1); }
}

// MapLoader.tsx
import styles from './MapLoader.module.css';

export function MapLoader() {
  return <div className={`${styles.loader} w-12 h-12`} />;
}
```

## File Organization

```
packages/frontend/src/
├── app/
│   ├── globals.css          # Global styles, CSS reset, CSS variables
│   └── layout.tsx           # Root layout with global styles
├── components/
│   ├── ui/                  # Shared UI components
│   │   ├── Button.tsx       # Uses Tailwind classes
│   │   └── Button.module.css # Only if complex styles needed
│   └── features/            # Feature-specific components
└── styles/
    ├── animations.css       # Shared keyframe animations
    └── utilities.css        # Custom utility classes (rare)
```

## Best Practices

### 1. Component Styling Pattern

```tsx
// ✅ GOOD: Composable className pattern
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  className = '',
  children 
}: ButtonProps) {
  const baseClasses = 'font-semibold rounded-lg transition-colors';
  
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };
  
  const variantClasses = {
    primary: 'bg-primary text-white hover:bg-primary-dark',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
  };
  
  return (
    <button 
      className={`
        ${baseClasses} 
        ${sizeClasses[size]} 
        ${variantClasses[variant]} 
        ${className}
      `}
    >
      {children}
    </button>
  );
}
```

### 2. Responsive Design

Always use mobile-first approach:

```tsx
// ✅ GOOD: Mobile-first responsive design
<div className="
  grid grid-cols-1 gap-4 p-4
  sm:grid-cols-2 sm:gap-6 sm:p-6
  lg:grid-cols-3 lg:gap-8 lg:p-8
">
  {/* Content */}
</div>

// ❌ BAD: Desktop-first (requires overrides)
<div className="
  grid grid-cols-3 gap-8 p-8
  lg:grid-cols-2 lg:gap-6 lg:p-6
  sm:grid-cols-1 sm:gap-4 sm:p-4
">
  {/* Content */}
</div>
```

### 3. State Management

Use Tailwind's state modifiers:

```tsx
// ✅ GOOD: Using Tailwind state modifiers
<button className="
  bg-primary text-white
  hover:bg-primary-dark
  focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
  active:scale-95
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Click me
</button>
```

### 4. Dark Mode Preparation

Structure for future dark mode:

```tsx
// ✅ GOOD: Dark mode ready
<div className="
  bg-white text-gray-900
  dark:bg-gray-900 dark:text-gray-100
">
  {/* Content */}
</div>
```

### 5. Performance Optimizations

#### Minimize Layout Shifts
```tsx
// ✅ GOOD: Fixed dimensions prevent layout shift
<img 
  src="/hero.jpg" 
  alt="Hero" 
  className="w-full h-64 object-cover"
/>

// ❌ BAD: No dimensions cause layout shift
<img src="/hero.jpg" alt="Hero" />
```

#### Use CSS Containment
```tsx
// ✅ GOOD: Containment for performance
<div className="contain-layout contain-paint">
  {/* Complex component content */}
</div>
```

## Common Patterns

### Loading States
```tsx
// Skeleton loader pattern
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
  <div className="h-4 bg-gray-200 rounded w-1/2" />
</div>
```

### Error States
```tsx
<div className="rounded-lg border border-error bg-error/10 p-4">
  <p className="text-error font-semibold">Error loading data</p>
  <p className="text-gray-600 text-sm mt-1">Please try again</p>
</div>
```

### Empty States
```tsx
<div className="text-center py-12">
  <p className="text-gray-500 mb-4">No activities yet</p>
  <Button>Log your first walk</Button>
</div>
```

## CSS Variable Usage

Define semantic tokens in globals.css:

```css
:root {
  /* Colors */
  --color-primary: #2563EB;
  --color-primary-dark: #1D4ED8;
  
  /* Spacing */
  --space-unit: 4px;
  
  /* Transitions */
  --transition-base: 200ms ease;
}
```

Use in Tailwind config or CSS Modules:

```css
/* Only in CSS Modules when needed */
.custom-component {
  transition: transform var(--transition-base);
}
```

## Performance Guidelines

### 1. Bundle Size Targets
- Initial CSS: < 20KB (compressed)
- Route-specific CSS: < 10KB per route
- Total CSS: < 50KB (all routes)

### 2. Critical CSS
- Inline critical styles in Next.js
- Use `priority` prop on critical components
- Defer non-critical styles

### 3. Monitoring
Track these metrics:
- First Contentful Paint (FCP) < 1.8s
- Cumulative Layout Shift (CLS) < 0.1
- CSS bundle size per route

## Migration Guide

When refactoring existing styles:

1. **Identify the component's styling needs**
2. **Can it be done with Tailwind?** → Use Tailwind
3. **Need complex animations/overrides?** → Use CSS Module
4. **Test on mobile first**
5. **Verify no layout shifts**
6. **Check bundle size impact**

## Tools & Development

### Recommended VS Code Extensions
- Tailwind CSS IntelliSense
- PostCSS Language Support
- CSS Modules

### Build-time Checks
```bash
# Check CSS bundle size
npm run analyze

# Lint CSS
npm run lint:css

# Check for unused CSS
npm run css:purge
```

## Don'ts

❌ **Never use inline styles** (except for truly dynamic values)
```tsx
// ❌ BAD
<div style={{ margin: '10px', color: 'blue' }}>
```

❌ **Never use global CSS** (except in globals.css)
```css
/* ❌ BAD: Global selector in component */
.my-component h1 { color: blue; }
```

❌ **Never use CSS-in-JS libraries**
```tsx
// ❌ BAD: Runtime CSS
const StyledDiv = styled.div`
  color: blue;
`;
```

❌ **Never use important** (except for third-party overrides)
```css
/* ❌ BAD: Using !important */
.my-class {
  color: blue !important;
}
```

## Examples

### Complete Component Example

```tsx
// TeamCard.tsx
interface TeamCardProps {
  team: Team;
  isActive?: boolean;
  className?: string;
}

export function TeamCard({ team, isActive = false, className = '' }: TeamCardProps) {
  return (
    <article 
      className={`
        group relative overflow-hidden
        rounded-lg border bg-white p-6
        transition-all duration-200
        hover:shadow-lg hover:border-primary
        ${isActive ? 'border-primary shadow-lg' : 'border-gray-200'}
        ${className}
      `}
    >
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">{team.name}</span>
          <span className="text-gray-500">{team.progress}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${team.progress}%` }}
          />
        </div>
      </div>
      
      {/* Team info */}
      <div className="space-y-2">
        <p className="text-gray-600 text-sm">
          {team.memberCount} members · {team.totalDistance} miles
        </p>
        <p className="text-gray-900 font-medium">
          Goal: {team.goalDistance} miles
        </p>
      </div>
      
      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary text-white">
            Active
          </span>
        </div>
      )}
    </article>
  );
}
```

## Summary

1. **Use Tailwind CSS for 90% of styling needs**
2. **Use CSS Modules only when necessary**
3. **Follow mobile-first responsive design**
4. **Keep performance as top priority**
5. **Write maintainable, composable components**

This architecture ensures fast builds, excellent runtime performance, and a maintainable codebase that scales with our team and product needs.

---

*Last Updated: 2025-01-19*
*Based on Architecture and UI/UX Agent analyses*