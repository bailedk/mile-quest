# Enhanced Loading States & Skeleton Screens

A comprehensive loading state system for Mile Quest featuring advanced spinners, skeleton screens, progressive loading patterns, and intelligent caching to create smooth, professional user experiences.

## Features

### 🎯 Core Components
- **Enhanced LoadingSpinner** - Multiple variants (dots, bars, pulse, orbit, wave) with size and color options
- **Comprehensive Skeletons** - Realistic skeleton representations for all major UI components
- **Page-level Loading** - Route transitions with Suspense boundaries
- **Progressive Loading** - Multi-stage loading with progress indication
- **Smart Caching** - Reduces flicker with intelligent data caching

### ⚡ Performance Optimizations
- **Minimum Loading Times** - Prevents flicker on fast operations
- **Delayed Loading States** - Avoids spinner flash for quick operations  
- **GPU Acceleration** - Smooth animations with hardware acceleration
- **Staggered Animations** - Sequential reveals for list items
- **Lazy Loading** - Intersection Observer-based content loading

### ♿ Accessibility Features
- **Screen Reader Support** - Proper ARIA labels and live regions
- **Reduced Motion Support** - Respects `prefers-reduced-motion`
- **Keyboard Navigation** - Focus management during loading states
- **High Contrast** - Color variants for different themes

## Quick Start

```tsx
import { 
  LoadingSpinner, 
  DashboardSkeleton, 
  useEnhancedLoading 
} from '@/components/loading';

// Basic spinner
<LoadingSpinner size="lg" variant="orbit" />

// Dashboard skeleton
<DashboardSkeleton showCharts={true} />

// Enhanced loading hook
const { isLoading, data, execute } = useEnhancedLoading(fetchData, {
  minimumLoadingTime: 300,
  cacheTimeout: 5 * 60 * 1000
});
```

## Component Guide

### LoadingSpinner

Advanced loading spinner with multiple variants and animations.

```tsx
<LoadingSpinner 
  size="lg"           // xs, sm, md, lg, xl, 2xl
  variant="orbit"     // spinner, dots, bars, pulse, orbit, wave
  color="primary"     // primary, white, gray, success, warning, error
  speed="normal"      // slow, normal, fast
/>
```

**Variants:**
- `spinner` - Classic rotating spinner
- `dots` - Bouncing dots animation
- `bars` - Vertical bars with scale animation
- `pulse` - Pulsing circle
- `orbit` - Rotating orbital particles
- `wave` - Wave-like bars animation

### Skeleton Components

Realistic placeholders that match actual content structure.

```tsx
// Dashboard skeleton
<DashboardSkeleton 
  showTeamProgress={true}
  showStats={true}
  showCharts={true}
/>

// Activity list skeleton
<ActivityListSkeleton 
  items={5}
  showAvatar={true}
  staggered={true}
/>

// Custom skeleton
<Skeleton 
  variant="rectangular"  // text, circular, rectangular, rounded
  animation="wave"       // pulse, wave, shimmer, fade
  width="100%"
  height="2rem"
/>
```

### Progressive Loading

Multi-stage loading with progress indication.

```tsx
<ProgressiveLoading
  stages={[
    {
      key: 'auth',
      label: 'Authenticating...',
      loader: () => authenticateUser(),
      delay: 0
    },
    {
      key: 'data',
      label: 'Loading dashboard...',
      loader: () => fetchDashboardData(),
      delay: 500
    }
  ]}
  onComplete={(results) => console.log('All loaded!', results)}
  showProgress={true}
/>
```

### Smart Loading

Intelligent loading component with error handling and caching.

```tsx
<SmartLoading
  data={activities}
  isLoading={isLoading}
  error={error}
  skeleton={<ActivityListSkeleton />}
  empty={<EmptyState />}
  retryButton={true}
  onRetry={handleRetry}
>
  {(data) => <ActivityList activities={data} />}
</SmartLoading>
```

### Loading State Manager

Comprehensive loading state management with caching.

```tsx
const {
  isLoading,
  data,
  error,
  execute,
  retry,
  shouldShowSkeleton,
  canRetry
} = useEnhancedLoading(
  () => fetchDashboardData(),
  {
    minimumLoadingTime: 300,
    delayBeforeLoading: 150,
    retryAttempts: 3,
    cacheTimeout: 5 * 60 * 1000,
    cacheKey: 'dashboard'
  }
);
```

## Specialized Components

### Dashboard Loading

```tsx
import { DashboardLoadingState } from '@/components/loading';

<DashboardLoadingState
  isLoading={isLoading}
  variant="progressive"  // skeleton, progressive, minimal
>
  <DashboardContent />
</DashboardLoadingState>
```

### Activity Loading

```tsx
import { ActivityListLoading } from '@/components/loading';

<ActivityListLoading
  isLoading={isLoading}
  activities={activities}
  error={error}
  variant="wave"  // skeleton, wave, staggered
  onRetry={handleRetry}
>
  {(activities) => <ActivityList activities={activities} />}
</ActivityListLoading>
```

### Form Loading

```tsx
import { ActivityFormLoading } from '@/components/loading';

<ActivityFormLoading isSubmitting={isSubmitting}>
  <ActivityForm onSubmit={handleSubmit} />
</ActivityFormLoading>
```

## Advanced Patterns

### Staggered Reveal

```tsx
<StaggeredReveal 
  staggerDelay={0.1}
  direction="up"
  trigger={isVisible}
>
  {items.map(item => <Card key={item.id} data={item} />)}
</StaggeredReveal>
```

### Skeleton Morphing

```tsx
<SkeletonMorph
  isLoading={isLoading}
  skeleton={<CardSkeleton />}
  morphDuration={0.4}
>
  <Card data={data} />
</SkeletonMorph>
```

### Wave Loading

```tsx
<WaveLoading 
  items={5}
  delay={0.15}
>
  {(index) => <CustomSkeleton key={index} />}
</WaveLoading>
```

### Paginated Loading

```tsx
const {
  items,
  isLoading,
  hasMore,
  loadMore,
  isLoadingMore
} = usePaginatedLoading(
  (page, pageSize) => fetchActivities(page, pageSize),
  { pageSize: 20, cacheKey: 'activities' }
);
```

## Configuration Options

### Loading Hook Options

```tsx
interface LoadingOptions {
  minimumLoadingTime?: number;     // 300ms default
  delayBeforeLoading?: number;     // 150ms default
  retryAttempts?: number;          // 3 default
  retryDelay?: number;             // 1000ms default
  cacheKey?: string;               // No caching by default
  cacheTimeout?: number;           // 5 minutes default
}
```

### Animation Options

```tsx
interface AnimationOptions {
  duration?: number;               // Animation duration
  delay?: number;                  // Start delay
  stagger?: number;                // Stagger delay for lists
  easing?: string;                 // CSS easing function
  respectMotionPreference?: boolean; // True by default
}
```

## Performance Tips

1. **Use appropriate skeleton variants** - Match the content structure
2. **Enable caching** - For data that doesn't change frequently
3. **Set minimum loading times** - Prevents flicker on fast operations
4. **Use progressive loading** - For complex multi-step operations
5. **Implement lazy loading** - For long lists and heavy content
6. **Optimize animations** - Use GPU acceleration for smooth performance

## Accessibility

- All loading states include proper ARIA labels
- Screen readers announce loading state changes
- Respects `prefers-reduced-motion` setting
- Focus management during loading transitions
- High contrast color variants available

## Browser Support

- Modern browsers with ES2020 support
- Graceful degradation for older browsers
- CSS Grid and Flexbox support required
- Intersection Observer API for lazy loading

## Integration Examples

### Dashboard Integration

```tsx
function Dashboard() {
  const { isLoading, data, error } = useEnhancedLoading(
    fetchDashboardData,
    { cacheKey: 'dashboard', minimumLoadingTime: 300 }
  );

  return (
    <DashboardLoadingState isLoading={isLoading} variant="progressive">
      <DashboardContent data={data} />
    </DashboardLoadingState>
  );
}
```

### Activity Feed Integration

```tsx
function ActivityFeed() {
  const {
    items: activities,
    isLoading,
    hasMore,
    loadMore
  } = usePaginatedLoading(fetchActivities, { pageSize: 10 });

  return (
    <ActivityFeedProgressiveLoading
      activities={activities}
      isLoading={isLoading}
      hasMore={hasMore}
      onLoadMore={loadMore}
    >
      {(activities) => (
        <div>
          {activities.map(activity => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </ActivityFeedProgressiveLoading>
  );
}
```

## Migration from Legacy Components

The new loading system maintains backward compatibility:

```tsx
// Legacy (still works)
import { LoadingSpinner } from '@/components/LoadingSpinner';

// Enhanced (recommended)
import { LoadingSpinner } from '@/components/loading';

// Legacy components are re-exported as LegacyLoadingSpinner, etc.
```

## Contributing

When adding new loading components:

1. Follow the established patterns for accessibility
2. Include proper TypeScript types
3. Add animation options and variants
4. Test with reduced motion preferences
5. Document usage examples
6. Add to the main index export

## Testing

```bash
# Test loading components
npm run test:loading

# Test accessibility
npm run test:a11y

# Test performance
npm run test:perf
```