export const HEALTH_SYNC_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_DISTANCE_METERS = 100_000;
export const MAX_DURATION_SECONDS = 86_400;

export type HealthActivitySource = 'APPLE_HEALTH' | 'HEALTH_CONNECT';
export type HealthSampleKind = 'workout' | 'distance';

export interface HealthDistanceSample {
  externalId: string;
  kind: HealthSampleKind;
  distanceMeters: number;
  start: string;
  end: string;
}

export interface ExistingActivityRef {
  source: string;
  externalId: string | null;
}

export interface ActivityDraft {
  source: HealthActivitySource;
  externalId: string;
  distanceMeters: number;
  durationSeconds: number;
  timestamp: string;
  notes: string;
  isPrivate: false;
}

export type SkipReason = 'duplicate' | 'already-imported' | 'invalid' | 'covered-by-workout';

export interface SkippedSample {
  externalId: string;
  reason: SkipReason;
}

export interface HealthImportPlan {
  imports: ActivityDraft[];
  skipped: SkippedSample[];
}

interface NormalizedSample extends HealthDistanceSample {
  durationSeconds: number;
}

export function healthSourceForPlatform(platform: string): HealthActivitySource | null {
  if (platform === 'ios') return 'APPLE_HEALTH';
  if (platform === 'android') return 'HEALTH_CONNECT';
  return null;
}

export function syncWindowStart(now = Date.now()): Date {
  return new Date(now - HEALTH_SYNC_WINDOW_MS);
}

function durationSeconds(startIso: string, endIso: string): number | null {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const seconds = Math.round((end - start) / 1000);
  if (seconds > MAX_DURATION_SECONDS) return null;
  return Math.max(1, seconds);
}

function distanceAllowed(meters: number, allowZero: boolean): boolean {
  if (!Number.isFinite(meters) || meters < 0 || meters > MAX_DISTANCE_METERS) return false;
  return allowZero || meters > 0;
}

function notesFor(source: HealthActivitySource, kind: HealthSampleKind): string {
  const platform = source === 'APPLE_HEALTH' ? 'Apple Health' : 'Health Connect';
  return kind === 'workout' ? `Imported from ${platform}` : `Steps imported from ${platform}`;
}

function toDraft(source: HealthActivitySource, sample: NormalizedSample, distanceMeters: number): ActivityDraft {
  return {
    source,
    externalId: sample.externalId,
    distanceMeters,
    durationSeconds: sample.durationSeconds,
    timestamp: new Date(sample.start).toISOString(),
    notes: notesFor(source, sample.kind),
    isPrivate: false,
  };
}

function overlaps(left: NormalizedSample, right: NormalizedSample): boolean {
  const leftStart = Date.parse(left.start);
  const leftEnd = Date.parse(left.end);
  const rightStart = Date.parse(right.start);
  const rightEnd = Date.parse(right.end);
  return leftStart < rightEnd && rightStart < leftEnd;
}

/**
 * Choose which health samples become activities.
 * Workouts win over the distance samples they already contain, and a sample
 * that was imported before (same source and external id) is not imported again.
 */
export function planHealthImports(options: {
  source: HealthActivitySource;
  samples: HealthDistanceSample[];
  existing: ExistingActivityRef[];
}): HealthImportPlan {
  const known = new Set(
    options.existing
      .filter((item) => item.source === options.source && item.externalId)
      .map((item) => item.externalId as string),
  );
  const skipped: SkippedSample[] = [];
  const seen = new Set<string>();
  const workouts: NormalizedSample[] = [];
  const distances: NormalizedSample[] = [];

  for (const sample of options.samples) {
    const externalId = sample.externalId.trim();
    if (!externalId) {
      skipped.push({ externalId: sample.externalId, reason: 'invalid' });
      continue;
    }
    if (seen.has(externalId)) {
      skipped.push({ externalId, reason: 'duplicate' });
      continue;
    }
    seen.add(externalId);

    const duration = durationSeconds(sample.start, sample.end);
    const allowZero = sample.kind === 'workout';
    if (!duration || !distanceAllowed(sample.distanceMeters, allowZero)) {
      skipped.push({ externalId, reason: 'invalid' });
      continue;
    }
    const normalized: NormalizedSample = { ...sample, externalId, durationSeconds: duration };
    if (sample.kind === 'workout') workouts.push(normalized);
    else distances.push(normalized);
  }

  const covered = new Set<string>();
  const imports: ActivityDraft[] = [];
  const orderedWorkouts = [...workouts].sort((left, right) => left.start.localeCompare(right.start));

  for (const workout of orderedWorkouts) {
    const overlapping = distances.filter((distance) => !covered.has(distance.externalId) && overlaps(workout, distance));
    let meters = workout.distanceMeters;
    if (!(meters > 0)) {
      meters = overlapping.reduce((sum, distance) => sum + distance.distanceMeters, 0);
    }
    const alreadyImported = known.has(workout.externalId);
    const willImport = !alreadyImported && meters > 0 && meters <= MAX_DISTANCE_METERS;
    if (alreadyImported || willImport) {
      for (const distance of overlapping) covered.add(distance.externalId);
    }
    if (alreadyImported) {
      skipped.push({ externalId: workout.externalId, reason: 'already-imported' });
      continue;
    }
    if (!willImport) {
      skipped.push({ externalId: workout.externalId, reason: 'invalid' });
      continue;
    }
    imports.push(toDraft(options.source, workout, meters));
  }

  for (const distance of distances) {
    if (known.has(distance.externalId)) {
      skipped.push({ externalId: distance.externalId, reason: 'already-imported' });
      continue;
    }
    if (covered.has(distance.externalId)) {
      skipped.push({ externalId: distance.externalId, reason: 'covered-by-workout' });
      continue;
    }
    imports.push(toDraft(options.source, distance, distance.distanceMeters));
  }

  imports.sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.externalId.localeCompare(right.externalId));
  return { imports, skipped };
}

export interface CreateActivityResult {
  deduped: boolean;
}

export interface ImportResult {
  imported: number;
  deduped: number;
  failed: Array<{ externalId: string; message: string }>;
}

export async function importPlannedWalks(
  drafts: ActivityDraft[],
  create: (draft: ActivityDraft) => Promise<CreateActivityResult>,
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, deduped: 0, failed: [] };
  for (const draft of drafts) {
    try {
      const created = await create(draft);
      if (created.deduped) result.deduped += 1;
      else result.imported += 1;
    } catch (error) {
      result.failed.push({ externalId: draft.externalId, message: importFailureMessage(error) });
    }
  }
  return result;
}

function importFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Import failed';
  if (/Cannot find native module|NitroModules|native module cannot be null|Expo Go/i.test(message)) {
    return 'Health sync needs a Mile Quest development build. It does not run inside Expo Go.';
  }
  return message || 'Import failed';
}

export interface SyncReport extends ImportResult {
  skipped: number;
  considered: number;
}

export async function syncHealthWalks(options: {
  source: HealthActivitySource;
  samples: HealthDistanceSample[];
  existing: ExistingActivityRef[];
  create: (draft: ActivityDraft) => Promise<CreateActivityResult>;
}): Promise<SyncReport> {
  const plan = planHealthImports(options);
  const imported = await importPlannedWalks(plan.imports, options.create);
  return {
    ...imported,
    skipped: plan.skipped.length,
    considered: options.samples.length,
  };
}
