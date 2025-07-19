# Achievement Celebration Component

The Achievement Celebration component provides an engaging, animated celebration UI when users unlock achievements in Mile Quest.

## Features

- 🎉 **Animated Celebrations**: Confetti effects with varying intensity based on achievement rarity
- 🎨 **Beautiful UI**: Gradient backgrounds and smooth animations
- 🔊 **Sound Effects**: Optional celebration sounds (respects user preferences)
- 📱 **Mobile Optimized**: Performant animations that respect reduced motion preferences
- 🎯 **Queue Management**: Handles multiple achievements earned simultaneously
- 🔗 **Social Sharing**: Built-in sharing functionality for achievements
- 🌐 **WebSocket Integration**: Listens for real-time achievement events

## Usage

### Basic Implementation

1. **Wrap your app with the AchievementProvider**:

```tsx
import { AchievementProvider } from '@/components/achievements';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AchievementProvider>
          {children}
        </AchievementProvider>
      </body>
    </html>
  );
}
```

2. **The provider automatically handles**:
   - WebSocket subscription to achievement events
   - Celebration triggering
   - User preference persistence
   - Social sharing

### Manual Implementation

If you need more control, use the component directly:

```tsx
import { AchievementCelebration } from '@/components/achievements';

function MyComponent() {
  return (
    <AchievementCelebration
      enableSound={true}
      enableSharing={true}
      autoHideDuration={6000}
      onShare={(achievement) => {
        // Custom share logic
      }}
    />
  );
}
```

### Using the Hook

For programmatic control:

```tsx
import { useAchievements } from '@/components/achievements';

function MyComponent() {
  const { triggerAchievement, enableSound, setEnableSound } = useAchievements();

  const handleManualAchievement = () => {
    triggerAchievement({
      id: '10_MILE_CLUB',
      name: '10 Mile Club',
      description: 'You\'ve walked 10 miles!',
      earnedAt: new Date().toISOString(),
      userId: 'current-user',
    });
  };

  return (
    <button onClick={handleManualAchievement}>
      Test Achievement
    </button>
  );
}
```

### Achievement Badge Component

Display achievement badges separately:

```tsx
import { AchievementBadge } from '@/components/achievements';

<AchievementBadge
  icon="🏆"
  rarity="legendary"
  size="large"
  animated={true}
/>
```

## Achievement Types

The component supports these achievement types from BE-019:

| Achievement | ID | Rarity | Icon |
|------------|-----|---------|------|
| First Walk | FIRST_WALK | Common | 🚶 |
| 10 Mile Club | 10_MILE_CLUB | Common | 🏃 |
| 100 Mile Hero | 100_MILE_HERO | Epic | 🦸 |
| 7-Day Streak | 7_DAY_STREAK | Rare | 🔥 |
| 30-Day Streak | 30_DAY_STREAK | Legendary | 💪 |
| Team Player | TEAM_PLAYER | Rare | 🤝 |
| Early Bird | EARLY_BIRD | Rare | 🌅 |

## Customization

### Celebration Intensity

Different rarities trigger different celebration intensities:
- **Common**: 0.5-0.6 intensity
- **Rare**: 0.7 intensity  
- **Epic**: 0.8 intensity
- **Legendary**: 1.0 intensity (maximum effects)

### Animation Utilities

Use the celebration animations separately:

```tsx
import { celebrationAnimations } from '@/components/achievements';

// Trigger confetti
celebrationAnimations.confetti(0.8);

// Trigger fireworks
celebrationAnimations.fireworks(0.8);

// Trigger stars
celebrationAnimations.stars(0.8);
```

## Accessibility

- Respects `prefers-reduced-motion` for users with motion sensitivity
- Provides manual dismiss options
- Includes proper ARIA labels
- Keyboard navigable

## Performance

- Animations are GPU-accelerated
- Queue system prevents overwhelming the UI
- Auto-cleanup of completed animations
- Efficient WebSocket event handling

## Demo

Visit `/demo/achievements` to see all features in action.