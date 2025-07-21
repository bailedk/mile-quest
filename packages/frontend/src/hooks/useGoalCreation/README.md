# useGoalCreation Hook

A comprehensive React hook for managing team goal creation state, including waypoint management, route calculation, validation, and draft persistence.

## Features

- **Form State Management**: Manages all goal form fields (name, description, team, target date, waypoints)
- **Waypoint Management**: Full CRUD operations for waypoints with drag-and-drop reordering
- **Route Calculation**: Automatic route calculation with debouncing (500ms)
- **Validation**: Real-time form validation with error messages
- **Draft Persistence**: Auto-saves drafts to localStorage with 24-hour expiry
- **Loading States**: Tracks route calculation and submission states
- **Error Handling**: Comprehensive error handling for all operations

## Usage

```typescript
import { useGoalCreation } from '@/hooks/useGoalCreation';

function CreateGoalPage() {
  const {
    // State
    formData,
    isCalculatingRoute,
    routeCalculationError,
    totalDistance,
    validationErrors,
    isDirty,
    hasValidationErrors,
    isValid,
    
    // Actions
    updateField,
    addWaypoint,
    removeWaypoint,
    reorderWaypoints,
    updateWaypoint,
    validate,
    submit,
    clearDraft,
    
    // Mutation state
    isSubmitting,
    submitError,
  } = useGoalCreation({
    teamId: 'optional-default-team-id',
    onSuccess: (goalId) => {
      // Handle successful goal creation
      router.push(`/goals/${goalId}`);
    },
  });

  // Your UI implementation
}
```

## API

### Options

```typescript
interface UseGoalCreationOptions {
  teamId?: string;      // Default team ID to pre-select
  onSuccess?: (goalId: string) => void; // Callback on successful creation
}
```

### State

- `formData`: Current form data including all fields
- `isCalculatingRoute`: Whether route calculation is in progress
- `routeCalculationError`: Error message from route calculation
- `totalDistance`: Total calculated distance in miles
- `validationErrors`: Object containing field-specific validation errors
- `isDirty`: Whether the form has been modified
- `hasValidationErrors`: Boolean indicating if there are any validation errors
- `isValid`: Whether the form is valid and ready for submission

### Actions

- `updateField(field, value)`: Update a specific form field
- `addWaypoint(waypoint)`: Add a new waypoint to the route
- `removeWaypoint(index)`: Remove a waypoint by index
- `reorderWaypoints(fromIndex, toIndex)`: Reorder waypoints (for drag-and-drop)
- `updateWaypoint(index, waypoint)`: Update a specific waypoint
- `validate()`: Manually trigger form validation
- `submit()`: Submit the form (validates first)
- `clearDraft()`: Clear the saved draft and reset form

### Validation Rules

- **Name**: Required, max 100 characters
- **Description**: Optional, max 500 characters
- **Team**: Required
- **Target Date**: Optional, must be in the future
- **Waypoints**: Minimum 2 required, maximum 10 allowed

## Local Storage

Drafts are automatically saved to localStorage with the key `mile-quest-goal-draft`. Features:
- Auto-saves on any form change
- 24-hour expiry
- Restored on component mount
- Cleared on successful submission

## Example Implementation

See `/src/components/goals/GoalCreationExample.tsx` for a complete example implementation.

## TypeScript Types

```typescript
interface GoalFormData {
  name: string;
  description: string;
  teamId: string;
  targetDate?: string;
  waypoints: Waypoint[];
  routeData?: RouteData;
}

interface Waypoint {
  lat: number;
  lng: number;
  address: string;
}
```

## Notes

- The route calculation is currently using a mock implementation. Replace with actual map service integration.
- The submit function uses a placeholder API call. Integrate with actual backend endpoint.
- Debouncing is set to 500ms for route calculations to avoid excessive API calls.