# Map-Based Route Builder for Team Goals

## Overview

Teams can create walking goals by building custom routes on an interactive map. Users place pins/waypoints in order, creating a route that the team will collectively "walk" along as they log activities.

## Feature Requirements

### Core Functionality

1. **Interactive Map View**
   - Full-screen map interface during route creation
   - Zoom and pan controls
   - Search box for locations/addresses
   - Current location button

2. **Waypoint Management**
   - Click/tap to add waypoints
   - Drag waypoints to adjust position
   - Number badges showing order (1, 2, 3...)
   - Delete waypoints with confirmation
   - Maximum 20 waypoints per route

3. **Route Visualization**
   - Auto-calculate route between waypoints
   - Show walking path (not driving)
   - Display total distance in real-time
   - Highlight current segment being edited

4. **Waypoint Reordering**
   - Drag-and-drop in list view
   - Number badges update automatically
   - Route recalculates after reorder
   - Undo last reorder action

## User Interface Design

### Desktop Layout
```
┌─────────────────────────────────────────────────────────┐
│  Create Team Goal - Route Builder                    X  │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────┬────────────────────────┐   │
│ │                         │  Route Details         │   │
│ │                         ├────────────────────────┤   │
│ │                         │  Total Distance:       │   │
│ │      Interactive        │  25.4 miles           │   │
│ │         Map            ├────────────────────────┤   │
│ │                         │  Waypoints (5)        │   │
│ │    [1]──[2]──[3]       │  ┌─────────────────┐  │   │
│ │     │    │              │  │ ≡ 1. NYC       │  │   │
│ │    [4]──[5]            │  │ ≡ 2. Boston    │  │   │
│ │                         │  │ ≡ 3. Portland  │  │   │
│ │                         │  │ ≡ 4. Montreal  │  │   │
│ │  [Search Box......] 🔍  │  │ ≡ 5. Toronto   │  │   │
│ │                         │  └─────────────────┘  │   │
│ │  [📍 Current Location]  │  [+ Add Waypoint]     │   │
│ └─────────────────────────┴────────────────────────┘   │
│                                                         │
│  Goal Name: [Walk the Northeast Trail...............]   │
│  Description: [Our team will walk from NYC to Toronto] │
│                                                         │
│  [Cancel]                    [Save Route as Team Goal]  │
└─────────────────────────────────────────────────────────┘
```

### Mobile Layout
```
┌─────────────────────┐
│ ← Route Builder     │
├─────────────────────┤
│                     │
│    Interactive      │
│       Map          │
│                     │
│  [1]──[2]──[3]     │
│   │                 │
│  [4]──[5]          │
│                     │
├─────────────────────┤
│ 📍 25.4 miles      │
├─────────────────────┤
│ [View Waypoints] ▼  │
└─────────────────────┘
```

## Technical Implementation

### Map Provider Integration

```typescript
// types/map.types.ts
export interface Waypoint {
  id: string;
  position: {
    lat: number;
    lng: number;
  };
  address?: string;
  order: number;
}

export interface Route {
  id: string;
  waypoints: Waypoint[];
  totalDistance: number;
  segments: RouteSegment[];
}

export interface RouteSegment {
  start: Waypoint;
  end: Waypoint;
  distance: number;
  polyline: string; // Encoded polyline
}
```

### Component Structure

```typescript
// components/RouteBuilder/RouteBuilder.tsx
export function RouteBuilder({ onSave }: RouteBuilderProps) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [route, setRoute] = useState<Route | null>(null);
  const [selectedWaypoint, setSelectedWaypoint] = useState<string | null>(null);

  // Add waypoint on map click
  const handleMapClick = (event: MapClickEvent) => {
    const newWaypoint: Waypoint = {
      id: generateId(),
      position: event.latLng,
      order: waypoints.length + 1,
    };
    setWaypoints([...waypoints, newWaypoint]);
  };

  // Reorder waypoints
  const handleReorder = (startIndex: number, endIndex: number) => {
    const reordered = reorderWaypoints(waypoints, startIndex, endIndex);
    setWaypoints(reordered);
    recalculateRoute(reordered);
  };

  // Delete waypoint
  const handleDelete = (waypointId: string) => {
    const filtered = waypoints.filter(w => w.id !== waypointId);
    const reindexed = filtered.map((w, i) => ({ ...w, order: i + 1 }));
    setWaypoints(reindexed);
    recalculateRoute(reindexed);
  };

  return (
    <div className="route-builder">
      <Map
        waypoints={waypoints}
        route={route}
        onMapClick={handleMapClick}
        onWaypointDrag={handleWaypointDrag}
      />
      <Sidebar
        waypoints={waypoints}
        totalDistance={route?.totalDistance}
        onReorder={handleReorder}
        onDelete={handleDelete}
      />
    </div>
  );
}
```

### Waypoint List Component

```typescript
// components/RouteBuilder/WaypointList.tsx
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export function WaypointList({ waypoints, onReorder, onDelete }) {
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="waypoints">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {waypoints.map((waypoint, index) => (
              <Draggable key={waypoint.id} draggableId={waypoint.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`waypoint-item ${snapshot.isDragging ? 'dragging' : ''}`}
                  >
                    <span {...provided.dragHandleProps}>≡</span>
                    <span className="order">{index + 1}</span>
                    <span className="address">{waypoint.address}</span>
                    <button onClick={() => onDelete(waypoint.id)}>×</button>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
```

## Map Service Abstraction

Following our external service abstraction pattern:

```typescript
// services/maps/types.ts
export interface MapService {
  // Geocoding
  searchAddress(query: string): Promise<SearchResult[]>;
  reverseGeocode(lat: number, lng: number): Promise<string>;
  
  // Routing
  calculateRoute(waypoints: Waypoint[]): Promise<Route>;
  getWalkingDirections(start: Position, end: Position): Promise<RouteSegment>;
  
  // Distance
  calculateDistance(points: Position[]): Promise<number>;
}

// services/maps/mapbox.service.ts
export class MapboxService implements MapService {
  async calculateRoute(waypoints: Waypoint[]): Promise<Route> {
    const coordinates = waypoints.map(w => [w.position.lng, w.position.lat]);
    
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates.join(';')}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }
    );
    
    const data = await response.json();
    return this.transformMapboxRoute(data);
  }
}
```

## User Flow

### Creating a Route

1. **Open Route Builder**
   - Click "Create Goal with Route" from team page
   - Full-screen map interface opens

2. **Add Waypoints**
   - Search for location OR click on map
   - Pin appears with number badge
   - Route automatically draws between pins

3. **Refine Route**
   - Drag pins to adjust positions
   - Reorder in sidebar list
   - Delete unwanted waypoints
   - See real-time distance updates

4. **Save as Goal**
   - Enter goal name and description
   - Confirm total distance
   - Save creates team goal with route

### Mobile Considerations

- **Touch Targets**: 44px minimum for all interactive elements
- **Bottom Sheet**: Waypoint list in collapsible bottom sheet
- **Gesture Support**: Pinch to zoom, long-press to add waypoint
- **Simplified UI**: Hide advanced features on small screens

## Data Model

```typescript
// Database schema additions
interface TeamGoal {
  id: string;
  teamId: string;
  name: string;
  description: string;
  route: {
    waypoints: Waypoint[];
    totalDistance: number;
    segments: RouteSegment[];
  };
  progress: {
    currentSegmentIndex: number;
    segmentProgress: number; // Distance into current segment
    totalProgress: number;   // Total distance completed
  };
  createdBy: string;
  createdAt: Date;
}
```

## Progress Visualization

As team members log activities, their collective distance moves them along the route:

```
NYC ●━━━━━━● Boston ○──────○ Portland ○──────○ Montreal ○──────○ Toronto
    ▲
    Team is here (32.5 miles completed)
```

## Accessibility

- **Keyboard Navigation**: Tab through waypoints, Enter to edit, Delete to remove
- **Screen Reader**: Announce waypoint order changes, distance updates
- **Color Contrast**: WCAG AA compliant pin colors
- **Alternative Input**: Address search for users who can't interact with map

## Performance Considerations

- **Debounce**: Route calculations on waypoint changes (500ms)
- **Caching**: Cache geocoding results in session
- **Lazy Load**: Load map library only when needed
- **Optimize**: Simplify polylines for long routes

## Future Enhancements

1. **Suggested Routes**: Popular trails, city tours, charity walks
2. **Elevation Data**: Show elevation gain/loss
3. **Points of Interest**: Add notes/photos to waypoints
4. **Route Sharing**: Share routes between teams
5. **Virtual Postcards**: Unlock when team reaches waypoints

This feature transforms team goals from simple distance targets into engaging virtual journeys, making the walking challenge more interactive and motivating.