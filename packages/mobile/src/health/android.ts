import {
  ExerciseType,
  SdkAvailabilityStatus,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';
import type { RecordResult } from 'react-native-health-connect';
import { HealthSyncError } from './errors';
import type { HealthDistanceSample } from './plan';
import { lengthToMeters } from './quantity';

const WALKING_TYPES = new Set<number>([
  ExerciseType.WALKING,
  ExerciseType.RUNNING,
  ExerciseType.RUNNING_TREADMILL,
  ExerciseType.HIKING,
  ExerciseType.WHEELCHAIR,
]);

export async function readHealthConnectSamples(since: Date): Promise<HealthDistanceSample[]> {
  const status = await getSdkStatus();
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    throw new HealthSyncError('Update Health Connect, then try the sync again.');
  }
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    throw new HealthSyncError('Health Connect is not available on this device. Android 13 and earlier need the Health Connect app. Android 14 and later include it.');
  }

  const ready = await initialize();
  if (!ready) throw new HealthSyncError('Health Connect could not be opened.');

  const granted = await requestPermission([
    { accessType: 'read', recordType: 'Distance' },
    { accessType: 'read', recordType: 'ExerciseSession' },
  ]);
  const grantedTypes = new Set(granted.flatMap((permission) => (
    'recordType' in permission && permission.accessType === 'read' ? [permission.recordType] : []
  )));
  if (!grantedTypes.has('Distance') && !grantedTypes.has('ExerciseSession')) {
    throw new HealthSyncError('Allow Mile Quest to read exercise and distance in Health Connect, then try again.');
  }

  const until = new Date();
  const [sessions, distances] = await Promise.all([
    grantedTypes.has('ExerciseSession') ? readExerciseSessions(since, until) : Promise.resolve([]),
    grantedTypes.has('Distance') ? readDistanceRecords(since, until) : Promise.resolve([]),
  ]);

  const samples: HealthDistanceSample[] = [];
  for (const session of sessions) {
    if (!WALKING_TYPES.has(session.exerciseType)) continue;
    samples.push({
      externalId: recordExternalId('exercise', session),
      kind: 'workout',
      distanceMeters: 0,
      start: session.startTime,
      end: session.endTime,
    });
  }
  for (const distance of distances) {
    samples.push({
      externalId: recordExternalId('distance', distance),
      kind: 'distance',
      distanceMeters: lengthToMeters(distance.distance),
      start: distance.startTime,
      end: distance.endTime,
    });
  }
  return samples;
}

async function readDistanceRecords(since: Date, until: Date): Promise<Array<RecordResult<'Distance'>>> {
  const records: Array<RecordResult<'Distance'>> = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const response = await readRecords('Distance', pageOptions(since, until, pageToken));
    records.push(...response.records);
    if (!response.pageToken) break;
    pageToken = response.pageToken;
  }
  return records;
}

async function readExerciseSessions(since: Date, until: Date): Promise<Array<RecordResult<'ExerciseSession'>>> {
  const records: Array<RecordResult<'ExerciseSession'>> = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const response = await readRecords('ExerciseSession', pageOptions(since, until, pageToken));
    records.push(...response.records);
    if (!response.pageToken) break;
    pageToken = response.pageToken;
  }
  return records;
}

function pageOptions(since: Date, until: Date, pageToken: string | undefined) {
  return {
    timeRangeFilter: {
      operator: 'between' as const,
      startTime: since.toISOString(),
      endTime: until.toISOString(),
    },
    pageSize: 100,
    pageToken,
  };
}

function recordExternalId(prefix: string, record: { metadata?: { id?: string; clientRecordId?: string | null }; startTime: string; endTime: string }): string {
  const id = record.metadata?.id || record.metadata?.clientRecordId;
  if (id) return `${prefix}:${id}`;
  return `${prefix}:${record.startTime}:${record.endTime}`;
}
