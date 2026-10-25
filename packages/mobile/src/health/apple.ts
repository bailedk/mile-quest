import {
  WorkoutActivityType,
  WorkoutTypeIdentifier,
  isHealthDataAvailableAsync,
  queryQuantitySamples,
  queryWorkoutSamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { HealthSyncError } from './errors';
import type { HealthDistanceSample } from './plan';
import { quantityToMeters } from './quantity';

const WALKING_TYPES = new Set<number>([
  WorkoutActivityType.walking,
  WorkoutActivityType.running,
  WorkoutActivityType.hiking,
  WorkoutActivityType.wheelchairWalkPace,
  WorkoutActivityType.wheelchairRunPace,
]);

export async function readAppleHealthSamples(since: Date): Promise<HealthDistanceSample[]> {
  const available = await isHealthDataAvailableAsync();
  if (!available) {
    throw new HealthSyncError('Apple Health is not available here. The iOS Simulator has no walk history until you add samples in the Health app.');
  }

  await requestAuthorization({
    toRead: ['HKQuantityTypeIdentifierDistanceWalkingRunning', WorkoutTypeIdentifier],
  });

  const until = new Date();
  const [workouts, distances] = await Promise.all([
    queryWorkoutSamples({
      limit: -1,
      filter: { date: { startDate: since, endDate: until } },
    }),
    queryQuantitySamples('HKQuantityTypeIdentifierDistanceWalkingRunning', {
      limit: -1,
      unit: 'm',
      filter: { date: { startDate: since, endDate: until } },
    }),
  ]);

  const samples: HealthDistanceSample[] = [];
  for (const workout of workouts) {
    if (!WALKING_TYPES.has(workout.workoutActivityType)) continue;
    samples.push({
      externalId: `workout:${workout.uuid}`,
      kind: 'workout',
      distanceMeters: quantityToMeters(workout.totalDistance),
      start: workout.startDate.toISOString(),
      end: workout.endDate.toISOString(),
    });
  }
  for (const distance of distances) {
    samples.push({
      externalId: `distance:${distance.uuid}`,
      kind: 'distance',
      distanceMeters: distance.quantity,
      start: distance.startDate.toISOString(),
      end: distance.endDate.toISOString(),
    });
  }
  return samples;
}
