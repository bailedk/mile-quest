# Hydration Migration Guide

This guide explains how to migrate from the old `useHydrated` hook to the new `HydrationContext`.

## Why the Change?

The previous implementation had several issues:
1. Auth store was initialized with a dynamic require() in Providers.tsx
2. Multiple components had their own hydration logic
3. No centralized place to handle auth initialization
4. Potential for hydration mismatches between auth state and UI state

## Migration Steps

### 1. Update Imports

**Old:**
```typescript
import { useHydrated } from '@/hooks/useHydrated';
```

**New:**
```typescript
import { useHydration } from '@/contexts/HydrationContext';
```

### 2. Update Hook Usage

**Old:**
```typescript
const hydrated = useHydrated();
```

**New:**
```typescript
const { isHydrated, isAuthInitialized } = useHydration();
```

### 3. Update Conditional Logic

**Old:**
```typescript
if (!hydrated) {
  return null;
}
```

**New (for general hydration):**
```typescript
if (!isHydrated) {
  return null;
}
```

**New (for auth-dependent components):**
```typescript
if (!isHydrated || !isAuthInitialized) {
  return null;
}
```

### 4. Update Date Formatting

**Old:**
```typescript
formatDateSafe(dateString, format, hydrated);
```

**New:**
```typescript
formatDateSafe(dateString, format, isHydrated);
```

## Benefits

1. **Centralized Initialization**: Auth store is properly initialized in one place
2. **Better Loading States**: Separate tracking for hydration and auth initialization
3. **No Dynamic Imports**: Removed the non-standard require() pattern
4. **Consistent Behavior**: All components use the same hydration logic

## Components Already Migrated

- ✅ Header
- ✅ withAuth HOC
- ✅ Activities pages
- ✅ Dashboard
- ✅ PWAProvider
- ✅ ErrorBoundary

## SSR-Safe Utilities

Use the new SSR-safe utilities from `@/utils/ssr-safe` for browser API access:

```typescript
import { 
  isBrowser,
  safeWindow,
  safeLocalStorage,
  getLocationPathname,
  addEventListener,
  // ... and more
} from '@/utils/ssr-safe';
```

## Example Migration

### Before:
```typescript
'use client';

import { useHydrated } from '@/hooks/useHydrated';

export function MyComponent() {
  const hydrated = useHydrated();
  
  if (!hydrated) {
    return null;
  }
  
  // Access window directly
  const pathname = window.location.pathname;
  
  return <div>{pathname}</div>;
}
```

### After:
```typescript
'use client';

import { useHydration } from '@/contexts/HydrationContext';
import { getLocationPathname } from '@/utils/ssr-safe';

export function MyComponent() {
  const { isHydrated } = useHydration();
  
  if (!isHydrated) {
    return null;
  }
  
  // Use SSR-safe utility
  const pathname = getLocationPathname();
  
  return <div>{pathname}</div>;
}
```

## Deprecation Notice

The `useHydrated` hook is now deprecated and will be removed in a future version. Please migrate all components to use the new `HydrationContext`.