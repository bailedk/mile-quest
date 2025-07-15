# Offline-Friendly API Patterns

**Version**: 1.0  
**Date**: 2025-01-15  
**Status**: Draft

## Overview

This document defines patterns for offline-capable API design to support the mobile-first nature of Mile Quest, where users may log activities without network connectivity.

## Core Principles

1. **Optimistic Updates**: Apply changes locally immediately
2. **Conflict Resolution**: Last-write-wins for simple conflicts
3. **Idempotency**: All mutations must be safely retryable
4. **Queue Persistence**: Offline requests survive app restarts

## Offline-Capable Endpoints

### Primary Offline Operations

These endpoints MUST support offline queueing:

1. **Activity Logging**
   - `POST /api/v1/activities`
   - `PATCH /api/v1/activities/:id`
   - `DELETE /api/v1/activities/:id`

2. **User Profile**
   - `PATCH /api/v1/user/profile` (non-critical updates)

### Read Operations

Cached when online, stale data when offline:
- Dashboard data
- Team information
- Recent activities
- User stats

## Implementation Patterns

### 1. Client-Generated IDs

Activities use client-generated UUIDs to enable offline creation:

```typescript
// Client-side activity creation
const createOfflineActivity = () => {
  const activity = {
    id: `temp_${generateUUID()}`, // Prefix identifies offline items
    distance: 5000,
    duration: 1800,
    activityDate: new Date().toISOString(),
    teamIds: ['team123'],
    isPrivate: false,
    _offline: true,
    _createdAt: Date.now()
  };
  
  // Save to local storage
  offlineQueue.add({
    type: 'CREATE_ACTIVITY',
    data: activity,
    retries: 0
  });
  
  return activity;
};
```

### 2. Request Queue Schema

```typescript
interface OfflineRequest {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  endpoint: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  data: any;
  headers: Record<string, string>;
  timestamp: number;
  retries: number;
  lastError?: string;
}

// IndexedDB schema for offline queue
const offlineQueueSchema = {
  requests: '++id, timestamp, type',
  activities: 'id, teamId, activityDate, _offline'
};
```

### 3. Sync Protocol

```typescript
class OfflineSyncManager {
  async syncQueue() {
    const requests = await offlineQueue.getAll();
    
    for (const request of requests) {
      try {
        const response = await this.executeRequest(request);
        
        if (request.type === 'CREATE') {
          // Replace temporary ID with server ID
          await this.replaceTempId(request.data.id, response.data.id);
        }
        
        await offlineQueue.remove(request.id);
      } catch (error) {
        await this.handleSyncError(request, error);
      }
    }
  }
  
  private async executeRequest(request: OfflineRequest) {
    return fetch(request.endpoint, {
      method: request.method,
      headers: {
        ...request.headers,
        'X-Offline-Request': 'true',
        'X-Request-Id': request.id // For idempotency
      },
      body: JSON.stringify(request.data)
    });
  }
}
```

### 4. Conflict Resolution

#### Activity Conflicts
```typescript
// Server-side conflict handling
async function handleActivitySync(request: Request) {
  const { id, _clientTimestamp, ...data } = request.body;
  
  // Check if activity already exists (duplicate sync)
  const existing = await prisma.activity.findUnique({
    where: { id }
  });
  
  if (existing) {
    // Idempotent - return existing
    return { success: true, data: existing };
  }
  
  // Check for duplicate by content hash
  const hash = generateHash(data.userId, data.activityDate, data.distance);
  const duplicate = await prisma.activity.findFirst({
    where: { contentHash: hash }
  });
  
  if (duplicate) {
    return { 
      success: true, 
      data: duplicate,
      merged: true 
    };
  }
  
  // Create new activity
  const activity = await prisma.activity.create({
    data: { ...data, contentHash: hash }
  });
  
  return { success: true, data: activity };
}
```

### 5. Optimistic UI Updates

```typescript
// React component with optimistic updates
function ActivityList({ teamId }) {
  const [activities, setActivities] = useState([]);
  const [pendingActivities, setPendingActivities] = useState([]);
  
  const addActivity = async (data) => {
    // Optimistic update
    const tempActivity = {
      ...data,
      id: `temp_${Date.now()}`,
      _pending: true
    };
    
    setPendingActivities(prev => [...prev, tempActivity]);
    
    try {
      const response = await api.createActivity(data);
      // Replace temp with real
      setPendingActivities(prev => 
        prev.filter(a => a.id !== tempActivity.id)
      );
      setActivities(prev => [...prev, response.data]);
    } catch (error) {
      if (error.code === 'NETWORK_ERROR') {
        // Keep in pending, will sync later
        offlineQueue.add(tempActivity);
      } else {
        // Remove failed activity
        setPendingActivities(prev => 
          prev.filter(a => a.id !== tempActivity.id)
        );
        showError(error);
      }
    }
  };
  
  // Render both real and pending activities
  const allActivities = [...activities, ...pendingActivities];
}
```

### 6. Cache Management

```typescript
// Service Worker caching strategy
const cacheStrategy = {
  // Critical data - cache first, update in background
  '/api/v1/dashboard': 'stale-while-revalidate',
  '/api/v1/teams/*': 'stale-while-revalidate',
  
  // User data - network first, fallback to cache
  '/api/v1/user/profile': 'network-first',
  '/api/v1/activities': 'network-first',
  
  // Static data - cache for 1 hour
  '/api/v1/achievements': 'cache-first',
  
  // Never cache
  '/api/v1/auth/*': 'network-only'
};

// Cache versioning for updates
const CACHE_VERSION = 'v1';
const CACHE_DURATION = {
  dashboard: 5 * 60 * 1000,     // 5 minutes
  teams: 15 * 60 * 1000,        // 15 minutes  
  activities: 10 * 60 * 1000,   // 10 minutes
  achievements: 60 * 60 * 1000  // 1 hour
};
```

## Error Handling

### Retry Strategy
```typescript
const retryConfig = {
  maxRetries: 5,
  backoff: 'exponential',
  initialDelay: 1000,
  maxDelay: 30000,
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT',
    'SERVER_ERROR' // 5xx
  ]
};

async function retryWithBackoff(request, attempt = 0) {
  try {
    return await executeRequest(request);
  } catch (error) {
    if (attempt >= retryConfig.maxRetries || 
        !retryConfig.retryableErrors.includes(error.code)) {
      throw error;
    }
    
    const delay = Math.min(
      retryConfig.initialDelay * Math.pow(2, attempt),
      retryConfig.maxDelay
    );
    
    await sleep(delay);
    return retryWithBackoff(request, attempt + 1);
  }
}
```

## Sync Status UI

```typescript
// Sync status component
function SyncStatus() {
  const { pending, syncing, lastSync, error } = useSyncStatus();
  
  if (error) {
    return (
      <Alert status="error">
        Sync failed. {pending} activities pending.
        <Button onClick={retrySync}>Retry</Button>
      </Alert>
    );
  }
  
  if (syncing) {
    return <Spinner>Syncing {pending} items...</Spinner>;
  }
  
  if (pending > 0) {
    return (
      <Badge status="warning">
        {pending} activities will sync when online
      </Badge>
    );
  }
  
  return (
    <Text fontSize="sm" color="gray.500">
      Last synced {formatRelative(lastSync)}
    </Text>
  );
}
```

## Testing Offline Scenarios

### Test Cases
1. Create activity offline, sync when online
2. Update activity offline, handle conflicts
3. Delete activity offline, verify removal
4. Queue persistence across app restarts
5. Network flakiness during sync
6. Token expiration during offline period

### Testing Tools
```typescript
// Mock offline conditions
class OfflineTestHelper {
  static goOffline() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SET_OFFLINE',
        value: true
      });
    }
  }
  
  static simulateFlaky() {
    // Randomly fail 50% of requests
    window.fetch = new Proxy(window.fetch, {
      apply: (target, thisArg, args) => {
        if (Math.random() > 0.5) {
          return Promise.reject(new Error('Network error'));
        }
        return target.apply(thisArg, args);
      }
    });
  }
}
```

## Summary

This offline-friendly API design ensures:
- Users can log activities anytime
- Data syncs reliably when connected
- UI remains responsive with optimistic updates
- Conflicts resolve predictably
- Failed syncs retry automatically
- Users understand sync status