# Mile Quest Component Specifications

## Overview

This document provides implementation-ready specifications for all UI components in Mile Quest. Each component includes props, states, behaviors, and code examples to ensure consistent implementation across the application.

## Component Architecture

### Base Principles

1. **TypeScript First**: All components use strict TypeScript
2. **Composable**: Small, focused components that combine well
3. **Accessible**: ARIA labels and keyboard navigation built-in
4. **Testable**: Clear props interface and predictable behavior
5. **Performant**: Optimized re-renders and lazy loading

### Naming Convention

```typescript
// Component files: PascalCase
Button.tsx
ActivityCard.tsx

// Props interfaces: ComponentNameProps
interface ButtonProps { }
interface ActivityCardProps { }

// Styled components: StyledComponentName
const StyledButton = styled.button``
const StyledCard = styled.div``
```

## Core Components

### 1. Button Component

**Purpose**: Primary interactive element for user actions

```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'text' | 'danger';
  size: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
  children: React.ReactNode;
}

// Usage Example
<Button 
  variant="primary"
  size="large"
  startIcon={<PlusIcon />}
  onClick={handleCreateTeam}
  loading={isCreating}
>
  Create Team
</Button>
```

**States**:
- Default
- Hover (scale: 1.02, elevation change)
- Active (scale: 0.98)
- Focus (2px outline)
- Loading (spinner replaces content)
- Disabled (opacity: 0.5, cursor: not-allowed)

**Specifications**:
```css
/* Sizes */
small: height 32px, padding 8px 16px, font-size 14px
medium: height 40px, padding 12px 20px, font-size 16px
large: height 48px, padding 16px 24px, font-size 18px

/* Colors by variant */
primary: bg #2563EB, text white
secondary: bg white, border #D1D5DB, text #374151
text: bg transparent, text #2563EB
danger: bg #EF4444, text white
```

### 2. Input Component

**Purpose**: Text input for forms and data entry

```typescript
interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel';
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  maxLength?: number;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  ariaLabel?: string;
}

// Usage Example
<Input
  label="Team Name"
  value={teamName}
  onChange={setTeamName}
  placeholder="Enter your team name"
  error={errors.teamName}
  required
  maxLength={50}
/>
```

**States**:
- Default
- Focus (2px blue border)
- Error (red border, error message)
- Disabled (gray background)
- Filled (darker border)

**Specifications**:
```css
height: 48px
padding: 12px 16px
border: 1px solid #D1D5DB
border-radius: 8px
font-size: 16px
transition: border-color 200ms

/* Label */
font-size: 14px
color: #374151
margin-bottom: 8px
font-weight: 500
```

### 3. Card Component

**Purpose**: Container for grouped content

```typescript
interface CardProps {
  variant?: 'elevated' | 'outlined' | 'flat';
  padding?: 'none' | 'small' | 'medium' | 'large';
  interactive?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

// Usage Example
<Card variant="elevated" padding="medium" interactive onClick={handleCardClick}>
  <CardHeader>
    <CardTitle>Today's Progress</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

**Specifications**:
```css
/* Variants */
elevated: box-shadow 0 1px 3px rgba(0,0,0,0.1)
outlined: border 1px solid #E5E7EB
flat: no border or shadow

/* Padding */
none: 0
small: 12px
medium: 16px
large: 24px

/* Interactive */
cursor: pointer
hover: transform scale(1.02)
transition: all 200ms ease
```

### 4. ActivityCard Component

**Purpose**: Display individual activity entries

```typescript
interface ActivityCardProps {
  activity: {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    distance: number;
    duration?: number;
    activityType: 'WALK' | 'RUN' | 'HIKE' | 'BIKE';
    createdAt: string;
    note?: string;
    imageUrl?: string;
    isPrivate: boolean;
  };
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onReact?: (id: string, reaction: string) => void;
  showActions?: boolean;
  compact?: boolean;
}

// Usage Example
<ActivityCard
  activity={activity}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onReact={handleReact}
  showActions={isOwner}
/>
```

**Layout**:
```
┌─────────────────────────────────────┐
│ [Avatar] Sarah Chen          3:45 PM │
│          2.5 miles · 45 min walk     │
│                                      │
│ "Beautiful day for a walk in the     │
│  park! 🌳"                           │
│                                      │
│ [Image placeholder if present]       │
│                                      │
│ ❤️ 12  💬 3  [Edit] [Delete]         │
└─────────────────────────────────────┘
```

### 5. ProgressBar Component

**Purpose**: Visualize completion percentage

```typescript
interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'success' | 'warning';
  animated?: boolean;
  striped?: boolean;
}

// Usage Example
<ProgressBar
  value={65}
  label="Team Progress"
  showPercentage
  size="large"
  animated
  striped
/>
```

**Specifications**:
```css
/* Sizes */
small: height 4px
medium: height 8px
large: height 16px

/* Animation */
striped: 45deg diagonal stripes
animated: stripes move right-to-left
transition: width 500ms ease

/* Colors */
primary: #2563EB
success: #10B981
warning: #F59E0B
```

### 6. Navigation Components

#### TabBar (Mobile)

```typescript
interface TabBarProps {
  tabs: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

// Usage Example
<TabBar
  tabs={[
    { id: 'home', label: 'Home', icon: <HomeIcon /> },
    { id: 'team', label: 'Team', icon: <UsersIcon /> },
    { id: 'activity', label: 'Log', icon: <PlusIcon /> },
    { id: 'profile', label: 'Profile', icon: <UserIcon /> }
  ]}
  activeTab={currentTab}
  onTabChange={setCurrentTab}
/>
```

#### TopBar

```typescript
interface TopBarProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: Array<{
    icon: React.ReactNode;
    onClick: () => void;
    ariaLabel: string;
  }>;
}
```

### 7. Form Components

#### Select Component

```typescript
interface SelectProps<T> {
  options: Array<{
    value: T;
    label: string;
    disabled?: boolean;
  }>;
  value: T;
  onChange: (value: T) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}
```

#### Switch Component

```typescript
interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'small' | 'medium';
}
```

### 8. Loading States

#### Skeleton Component

```typescript
interface SkeletonProps {
  variant: 'text' | 'rect' | 'circle';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

// Usage Example
<Skeleton variant="rect" width="100%" height={200} />
<Skeleton variant="text" width="60%" />
<Skeleton variant="circle" width={40} height={40} />
```

#### Spinner Component

```typescript
interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  fullScreen?: boolean;
}
```

### 9. Feedback Components

#### Toast Notification

```typescript
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number; // ms
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
}

// Usage via hook
const { showToast } = useToast();

showToast({
  message: 'Activity logged successfully!',
  type: 'success',
  duration: 3000
});
```

#### Modal Component

```typescript
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  children: React.ReactNode;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
}
```

### 10. Data Display Components

#### EmptyState Component

```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Usage Example
<EmptyState
  icon={<UsersIcon />}
  title="No team members yet"
  description="Invite your friends to join your walking challenge"
  action={{
    label: 'Invite Members',
    onClick: handleInvite
  }}
/>
```

#### Avatar Component

```typescript
interface AvatarProps {
  src?: string;
  alt: string;
  name?: string; // For initials fallback
  size?: 'small' | 'medium' | 'large';
  shape?: 'circle' | 'square';
  status?: 'online' | 'offline';
}
```

## Composite Components

### TeamProgressCard

Combines multiple base components to show team progress:

```typescript
interface TeamProgressCardProps {
  team: {
    name: string;
    goalDistance: number;
    totalDistance: number;
    memberCount: number;
    daysRemaining?: number;
  };
  onViewDetails?: () => void;
}

// Implementation uses:
// - Card (container)
// - ProgressBar (distance visualization)
// - Button (view details action)
// - Typography components
```

### ActivityLogger

Complex form component for logging activities:

```typescript
interface ActivityLoggerProps {
  onSubmit: (activity: ActivityData) => Promise<void>;
  initialData?: Partial<ActivityData>;
  mode?: 'create' | 'edit';
}

// Implementation uses:
// - Modal (container)
// - Input (distance entry)
// - Select (activity type)
// - Switch (privacy toggle)
// - Button (submit/cancel)
// - Toast (feedback)
```

## Implementation Guidelines

### 1. Component Structure

```typescript
// Component file structure
ComponentName/
├── index.tsx         // Main component
├── styles.ts         // Styled components
├── types.ts          // TypeScript interfaces
├── utils.ts          // Helper functions
└── __tests__/        // Component tests
```

### 2. Performance Optimization

```typescript
// Use React.memo for expensive components
export const ExpensiveComponent = React.memo(({ data }: Props) => {
  // Component implementation
});

// Use useMemo for expensive calculations
const processedData = useMemo(() => {
  return expensiveCalculation(data);
}, [data]);

// Use useCallback for stable function references
const handleClick = useCallback(() => {
  // Handle click
}, [dependency]);
```

### 3. Accessibility Checklist

- [ ] All interactive elements have accessible names
- [ ] Color contrast meets WCAG AA standards
- [ ] Keyboard navigation works correctly
- [ ] Screen reader announcements are clear
- [ ] Focus indicators are visible
- [ ] Error messages are associated with inputs
- [ ] Loading states are announced

### 4. Testing Requirements

```typescript
// Example test structure
describe('Button Component', () => {
  it('renders with correct text', () => {});
  it('calls onClick when clicked', () => {});
  it('shows loading state', () => {});
  it('is disabled when disabled prop is true', () => {});
  it('handles keyboard navigation', () => {});
});
```

## Component Usage Matrix

| Screen | Components Used |
|--------|----------------|
| Dashboard | TopBar, TabBar, TeamProgressCard, ActivityCard, Button, EmptyState |
| Activity Logger | Modal, Input, Select, Switch, Button, Toast |
| Team Management | Card, Avatar, Button, EmptyState, Skeleton |
| Profile | TopBar, Card, Input, Select, Button |
| Onboarding | Button, Input, ProgressBar, Card |

## Theming

All components support theming through CSS variables:

```typescript
interface Theme {
  colors: {
    primary: string;
    secondary: string;
    error: string;
    warning: string;
    success: string;
    text: {
      primary: string;
      secondary: string;
      disabled: string;
    };
    background: {
      default: string;
      paper: string;
    };
  };
  spacing: (factor: number) => string;
  typography: {
    fontFamily: string;
    fontSize: {
      small: string;
      medium: string;
      large: string;
    };
  };
  breakpoints: {
    mobile: string;
    tablet: string;
    desktop: string;
  };
}
```

## Migration Notes

For developers implementing these components:

1. Start with core components (Button, Input, Card)
2. Build composite components using core components
3. Ensure all components are responsive by default
4. Add Storybook stories for each component
5. Document any deviations from specifications

---

*Last Updated: 2025-01-15*
*UI/UX Design Agent - Component Specifications v1.0*