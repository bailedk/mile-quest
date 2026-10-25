import { Platform } from 'react-native';
import { friendlyHealthError } from './errors';
import type { HealthDistanceSample } from './plan';

export async function readPlatformSamples(since: Date): Promise<HealthDistanceSample[]> {
  try {
    if (Platform.OS === 'ios') {
      const { readAppleHealthSamples } = await import('./apple');
      return await readAppleHealthSamples(since);
    }
    if (Platform.OS === 'android') {
      const { readHealthConnectSamples } = await import('./android');
      return await readHealthConnectSamples(since);
    }
    throw new Error('Health sync is available on iPhone and Android.');
  } catch (error) {
    throw friendlyHealthError(error);
  }
}
