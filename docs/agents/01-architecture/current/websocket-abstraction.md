# WebSocket Abstraction Layer

## Overview

This document defines the abstraction layer for WebSocket functionality in Mile Quest, enabling seamless migration from Pusher to AWS API Gateway WebSocket (or other providers) in the future.

## Design Principles

1. **Provider Agnostic**: No provider-specific types or methods in the interface
2. **Feature Parity**: Support all features we need, regardless of provider
3. **Type Safe**: Full TypeScript support with proper typing
4. **Testable**: Easy to mock for unit tests
5. **Minimal**: Only include features we actually use

## Core Interfaces

### WebSocket Service Interface

```typescript
// types/websocket.types.ts
export interface WebSocketService {
  // Connection Management
  connect(userId: string, authToken: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Channel Management
  subscribe(channel: string): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
  
  // Messaging
  send(channel: string, event: string, data: any): Promise<void>;
  
  // Event Handling
  on(event: string, callback: EventCallback): void;
  off(event: string, callback?: EventCallback): void;
  
  // Presence (for team online status)
  subscribePresence(channel: string): Promise<void>;
  getPresenceMembers(channel: string): Promise<PresenceMember[]>;
}

export type EventCallback = (data: any) => void;

export interface PresenceMember {
  id: string;
  info: {
    name: string;
    avatar?: string;
  };
}

export interface WebSocketConfig {
  apiUrl: string;
  authEndpoint?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}
```

### Event Types

```typescript
// types/websocket-events.types.ts
export enum WebSocketEvent {
  // Connection Events
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  
  // Team Events
  ACTIVITY_LOGGED = 'activity-logged',
  MEMBER_JOINED = 'member-joined',
  MEMBER_LEFT = 'member-left',
  GOAL_UPDATED = 'goal-updated',
  MILESTONE_REACHED = 'milestone-reached',
  
  // Presence Events
  MEMBER_ONLINE = 'member-online',
  MEMBER_OFFLINE = 'member-offline',
}

export interface ActivityLoggedEvent {
  userId: string;
  activityId: string;
  distance: number;
  duration: number;
  timestamp: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface MemberJoinedEvent {
  userId: string;
  teamId: string;
  memberName: string;
  joinedAt: string;
}

// ... other event interfaces
```

## Implementation Pattern

### Pusher Implementation

```typescript
// services/websocket/pusher.service.ts
import Pusher from 'pusher-js';
import { WebSocketService, WebSocketConfig, PresenceMember } from '@/types/websocket.types';

export class PusherWebSocketService implements WebSocketService {
  private pusher: Pusher | null = null;
  private channels: Map<string, any> = new Map();
  private presenceChannels: Map<string, any> = new Map();
  
  constructor(private config: WebSocketConfig) {}
  
  async connect(userId: string, authToken: string): Promise<void> {
    this.pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      auth: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
      authEndpoint: this.config.authEndpoint,
    });
  }
  
  async disconnect(): Promise<void> {
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
    }
    this.channels.clear();
    this.presenceChannels.clear();
  }
  
  isConnected(): boolean {
    return this.pusher?.connection.state === 'connected';
  }
  
  async subscribe(channel: string): Promise<void> {
    if (!this.pusher) throw new Error('Not connected');
    
    const pusherChannel = this.pusher.subscribe(channel);
    this.channels.set(channel, pusherChannel);
  }
  
  async unsubscribe(channel: string): Promise<void> {
    if (!this.pusher) return;
    
    this.pusher.unsubscribe(channel);
    this.channels.delete(channel);
  }
  
  async send(channel: string, event: string, data: any): Promise<void> {
    // Note: Pusher doesn't support client-to-client directly
    // This would call your backend API which then triggers Pusher
    const response = await fetch('/api/websocket/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify({ channel, event, data }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
  }
  
  on(event: string, callback: (data: any) => void): void {
    // Bind to all subscribed channels
    this.channels.forEach((channel) => {
      channel.bind(event, callback);
    });
  }
  
  off(event: string, callback?: (data: any) => void): void {
    this.channels.forEach((channel) => {
      channel.unbind(event, callback);
    });
  }
  
  async subscribePresence(channel: string): Promise<void> {
    if (!this.pusher) throw new Error('Not connected');
    
    const presenceChannel = this.pusher.subscribe(`presence-${channel}`);
    this.presenceChannels.set(channel, presenceChannel);
  }
  
  async getPresenceMembers(channel: string): Promise<PresenceMember[]> {
    const presenceChannel = this.presenceChannels.get(channel);
    if (!presenceChannel) return [];
    
    const members = presenceChannel.members;
    return Object.keys(members.members).map((id) => ({
      id,
      info: members.members[id],
    }));
  }
  
  private getAuthToken(): string {
    // Retrieve from your auth state management
    return '';
  }
}
```

### Future API Gateway Implementation

```typescript
// services/websocket/api-gateway.service.ts
export class ApiGatewayWebSocketService implements WebSocketService {
  private ws: WebSocket | null = null;
  private messageQueue: any[] = [];
  private eventHandlers: Map<string, Set<EventCallback>> = new Map();
  
  async connect(userId: string, authToken: string): Promise<void> {
    const wsUrl = `${this.config.apiUrl}?token=${authToken}`;
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      this.flushMessageQueue();
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
  }
  
  // ... implementation specific to API Gateway
}
```

## Usage in Components

### React Hook

```typescript
// hooks/useWebSocket.ts
import { useEffect, useRef } from 'react';
import { WebSocketService } from '@/types/websocket.types';
import { createWebSocketService } from '@/services/websocket/factory';

export function useWebSocket() {
  const serviceRef = useRef<WebSocketService | null>(null);
  
  useEffect(() => {
    const initWebSocket = async () => {
      serviceRef.current = createWebSocketService();
      await serviceRef.current.connect(userId, authToken);
    };
    
    initWebSocket();
    
    return () => {
      serviceRef.current?.disconnect();
    };
  }, [userId, authToken]);
  
  return serviceRef.current;
}
```

### Component Example

```typescript
// components/TeamActivity.tsx
export function TeamActivity({ teamId }: { teamId: string }) {
  const ws = useWebSocket();
  const [activities, setActivities] = useState<Activity[]>([]);
  
  useEffect(() => {
    if (!ws) return;
    
    const handleActivity = (event: ActivityLoggedEvent) => {
      setActivities(prev => [...prev, event]);
    };
    
    ws.subscribe(`team-${teamId}`);
    ws.on(WebSocketEvent.ACTIVITY_LOGGED, handleActivity);
    
    return () => {
      ws.off(WebSocketEvent.ACTIVITY_LOGGED, handleActivity);
      ws.unsubscribe(`team-${teamId}`);
    };
  }, [ws, teamId]);
  
  return (
    <div>
      {activities.map(activity => (
        <ActivityItem key={activity.activityId} {...activity} />
      ))}
    </div>
  );
}
```

## Service Factory

```typescript
// services/websocket/factory.ts
import { WebSocketService, WebSocketConfig } from '@/types/websocket.types';
import { PusherWebSocketService } from './pusher.service';
import { ApiGatewayWebSocketService } from './api-gateway.service';

export function createWebSocketService(
  config?: Partial<WebSocketConfig>
): WebSocketService {
  const defaultConfig: WebSocketConfig = {
    apiUrl: process.env.NEXT_PUBLIC_API_URL!,
    authEndpoint: '/api/auth/websocket',
    reconnectInterval: 5000,
    maxReconnectAttempts: 5,
  };
  
  const finalConfig = { ...defaultConfig, ...config };
  
  // This is where you switch providers
  const provider = process.env.NEXT_PUBLIC_WEBSOCKET_PROVIDER || 'pusher';
  
  switch (provider) {
    case 'pusher':
      return new PusherWebSocketService(finalConfig);
    case 'api-gateway':
      return new ApiGatewayWebSocketService(finalConfig);
    default:
      throw new Error(`Unknown WebSocket provider: ${provider}`);
  }
}
```

## Testing

### Mock Implementation

```typescript
// services/websocket/mock.service.ts
export class MockWebSocketService implements WebSocketService {
  private connected = false;
  private subscribers = new Map<string, Set<EventCallback>>();
  
  async connect(): Promise<void> {
    this.connected = true;
  }
  
  async disconnect(): Promise<void> {
    this.connected = false;
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  // ... mock implementations
  
  // Helper for tests to simulate events
  simulateEvent(event: string, data: any): void {
    const handlers = this.subscribers.get(event);
    handlers?.forEach(handler => handler(data));
  }
}
```

### Unit Test Example

```typescript
// __tests__/TeamActivity.test.tsx
import { render, waitFor } from '@testing-library/react';
import { TeamActivity } from '@/components/TeamActivity';
import { MockWebSocketService } from '@/services/websocket/mock.service';

test('displays new activities in real-time', async () => {
  const mockWs = new MockWebSocketService();
  // Inject mock service
  
  const { getByText } = render(<TeamActivity teamId="123" />);
  
  // Simulate incoming activity
  mockWs.simulateEvent('activity-logged', {
    userId: 'user1',
    activityId: 'act1',
    distance: 2.5,
    duration: 1800,
  });
  
  await waitFor(() => {
    expect(getByText('2.5 miles')).toBeInTheDocument();
  });
});
```

## Migration Strategy

### Phase 1: Current (Pusher)
- Use Pusher implementation
- Monitor usage and costs
- Gather performance metrics

### Phase 2: Preparation (When approaching limits)
- Build API Gateway implementation
- Test in development environment
- Create migration utilities

### Phase 3: Migration
```typescript
// Feature flag approach
const provider = await getFeatureFlag('websocket-provider', userId);
const ws = createWebSocketService({ provider });
```

### Phase 4: Cutover
- Gradually roll out to users
- Monitor for issues
- Complete migration
- Remove Pusher code

## Environment Variables

```bash
# .env.local (Pusher - Current)
NEXT_PUBLIC_WEBSOCKET_PROVIDER=pusher
NEXT_PUBLIC_PUSHER_KEY=your-pusher-key
NEXT_PUBLIC_PUSHER_CLUSTER=us2
PUSHER_APP_ID=your-app-id
PUSHER_SECRET=your-secret

# .env.local (API Gateway - Future)
NEXT_PUBLIC_WEBSOCKET_PROVIDER=api-gateway
NEXT_PUBLIC_WS_URL=wss://your-api-gateway-url
```

## Key Benefits

1. **Zero code changes** in components when switching providers
2. **Consistent API** across all providers
3. **Easy testing** with mock implementation
4. **Gradual migration** possible with feature flags
5. **Type safety** throughout the application

## Next Steps

1. Implement the Pusher service following this pattern
2. Use the abstraction in all components
3. Build comprehensive tests using the mock
4. Document any Pusher-specific features we use
5. Monitor usage to determine migration timing