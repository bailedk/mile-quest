# Performance Tracking Configuration

Mile Quest includes optional performance tracking capabilities to monitor Core Web Vitals and custom metrics. This feature can be fully disabled if experiencing issues or if not needed.

## Environment Variables

### `NEXT_PUBLIC_ENABLE_PERFORMANCE_TRACKING`
- **Default**: `true`
- **Purpose**: Master switch for all performance tracking functionality
- **Set to `false` to**: Completely disable all performance monitoring, observers, and metrics collection

### `NEXT_PUBLIC_ENABLE_PERFORMANCE_REPORTING`
- **Default**: `false`
- **Purpose**: Controls whether metrics are sent to external analytics services
- **Set to `true` to**: Enable sending metrics to Google Analytics and custom endpoints
- **Note**: Requires `NEXT_PUBLIC_ENABLE_PERFORMANCE_TRACKING` to be enabled

## Usage Examples

### Disable all performance tracking (recommended for issues)
```env
NEXT_PUBLIC_ENABLE_PERFORMANCE_TRACKING=false
```

### Enable local tracking only (no external reporting)
```env
NEXT_PUBLIC_ENABLE_PERFORMANCE_TRACKING=true
NEXT_PUBLIC_ENABLE_PERFORMANCE_REPORTING=false
```

### Enable full tracking with analytics
```env
NEXT_PUBLIC_ENABLE_PERFORMANCE_TRACKING=true
NEXT_PUBLIC_ENABLE_PERFORMANCE_REPORTING=true
```

## What Gets Tracked

When enabled, the following metrics are monitored:
- **LCP** (Largest Contentful Paint)
- **FID** (First Input Delay)
- **CLS** (Cumulative Layout Shift)
- **FCP** (First Contentful Paint)
- **TTFB** (Time to First Byte)
- Custom timing marks and measures

## Error Handling

All performance API calls are wrapped in try-catch blocks to prevent failures from affecting the application. Errors are logged to the console in development mode only.

## Browser Compatibility

The performance tracking gracefully degrades on browsers that don't support:
- Performance Observer API
- Navigation Timing API
- User Timing API

## Development Tools

In development mode, performance metrics can be viewed:
1. Via console logs (when tracking is enabled)
2. Using the Performance Devtools overlay (Ctrl+Shift+P)
3. In the global `window.__MILE_QUEST_PERFORMANCE__` object