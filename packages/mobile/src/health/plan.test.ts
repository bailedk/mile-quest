import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lengthToMeters, quantityToMeters } from './quantity.ts';
import {
  healthSourceForPlatform,
  planHealthImports,
  syncHealthWalks,
  type ActivityDraft,
  type HealthDistanceSample,
} from './plan.ts';

const start = '2026-10-20T15:00:00.000Z';
const end = '2026-10-20T15:40:00.000Z';

function sample(overrides: Partial<HealthDistanceSample> & Pick<HealthDistanceSample, 'externalId'>): HealthDistanceSample {
  return {
    kind: 'distance',
    distanceMeters: 1200,
    start,
    end,
    ...overrides,
  };
}

describe('health import dedupe', () => {
  it('keeps a workout and drops the distance samples inside it', () => {
    const plan = planHealthImports({
      source: 'APPLE_HEALTH',
      existing: [],
      samples: [
        sample({ externalId: 'distance:inside', kind: 'distance', distanceMeters: 800, start: '2026-10-20T15:10:00.000Z', end: '2026-10-20T15:20:00.000Z' }),
        sample({ externalId: 'workout:1', kind: 'workout', distanceMeters: 3200 }),
        sample({ externalId: 'distance:outside', start: '2026-10-21T12:00:00.000Z', end: '2026-10-21T12:20:00.000Z', distanceMeters: 500 }),
      ],
    });

    assert.deepEqual(plan.imports.map((item) => item.externalId), ['workout:1', 'distance:outside']);
    assert.equal(plan.imports[0]?.distanceMeters, 3200);
    assert.equal(plan.imports[0]?.durationSeconds, 40 * 60);
    assert.equal(plan.imports[0]?.notes, 'Imported from Apple Health');
    assert.equal(plan.skipped.find((item) => item.externalId === 'distance:inside')?.reason, 'covered-by-workout');
  });

  it('sums distance samples into a workout that has no distance of its own', () => {
    const plan = planHealthImports({
      source: 'HEALTH_CONNECT',
      existing: [],
      samples: [
        sample({ externalId: 'exercise:1', kind: 'workout', distanceMeters: 0 }),
        sample({ externalId: 'distance:a', distanceMeters: 400, start: '2026-10-20T15:05:00.000Z', end: '2026-10-20T15:15:00.000Z' }),
        sample({ externalId: 'distance:b', distanceMeters: 600, start: '2026-10-20T15:15:00.000Z', end: '2026-10-20T15:30:00.000Z' }),
      ],
    });

    assert.equal(plan.imports.length, 1);
    assert.equal(plan.imports[0]?.externalId, 'exercise:1');
    assert.equal(plan.imports[0]?.distanceMeters, 1000);
    assert.equal(plan.imports[0]?.source, 'HEALTH_CONNECT');
    assert.deepEqual(plan.skipped.map((item) => item.reason), ['covered-by-workout', 'covered-by-workout']);
  });

  it('does not import a sample that was already saved for this source', () => {
    const plan = planHealthImports({
      source: 'APPLE_HEALTH',
      existing: [
        { source: 'APPLE_HEALTH', externalId: 'workout:saved' },
        { source: 'HEALTH_CONNECT', externalId: 'distance:other-user-source' },
        { source: 'MANUAL', externalId: null },
      ],
      samples: [
        sample({ externalId: 'workout:saved', kind: 'workout', distanceMeters: 2000 }),
        sample({ externalId: 'distance:inside', start: '2026-10-20T15:05:00.000Z', end: '2026-10-20T15:15:00.000Z' }),
        sample({ externalId: 'distance:other-user-source', start: '2026-10-22T12:00:00.000Z', end: '2026-10-22T12:10:00.000Z' }),
      ],
    });

    assert.deepEqual(plan.imports.map((item) => item.externalId), ['distance:other-user-source']);
    assert.equal(plan.skipped.find((item) => item.externalId === 'workout:saved')?.reason, 'already-imported');
    assert.equal(plan.skipped.find((item) => item.externalId === 'distance:inside')?.reason, 'covered-by-workout');
  });

  it('skips duplicates, empty ids, and samples the API would reject', () => {
    const plan = planHealthImports({
      source: 'APPLE_HEALTH',
      existing: [],
      samples: [
        sample({ externalId: 'distance:ok' }),
        sample({ externalId: 'distance:ok', start: '2026-10-22T12:00:00.000Z', end: '2026-10-22T12:10:00.000Z' }),
        sample({ externalId: '   ' }),
        sample({ externalId: 'distance:zero', distanceMeters: 0 }),
        sample({ externalId: 'distance:far', distanceMeters: 100_001 }),
        sample({ externalId: 'distance:long', end: '2026-10-22T15:00:00.000Z' }),
        sample({ externalId: 'distance:backwards', start: end, end: start }),
      ],
    });

    assert.deepEqual(plan.imports.map((item) => item.externalId), ['distance:ok']);
    assert.deepEqual(plan.skipped.map((item) => item.reason), [
      'duplicate',
      'invalid',
      'invalid',
      'invalid',
      'invalid',
      'invalid',
    ]);
  });

  it('posts only the planned walks and counts server dedupe separately', async () => {
    const created: ActivityDraft[] = [];
    const report = await syncHealthWalks({
      source: 'APPLE_HEALTH',
      existing: [{ source: 'APPLE_HEALTH', externalId: 'distance:old' }],
      samples: [
        sample({ externalId: 'distance:old' }),
        sample({ externalId: 'distance:new', start: '2026-10-21T12:00:00.000Z', end: '2026-10-21T12:30:00.000Z' }),
        sample({ externalId: 'distance:race', start: '2026-10-22T12:00:00.000Z', end: '2026-10-22T12:30:00.000Z' }),
      ],
      create: async (draft) => {
        created.push(draft);
        return { deduped: draft.externalId === 'distance:race' };
      },
    });

    assert.deepEqual(created.map((item) => item.externalId), ['distance:new', 'distance:race']);
    assert.equal(report.imported, 1);
    assert.equal(report.deduped, 1);
    assert.equal(report.skipped, 1);
    assert.equal(report.failed.length, 0);
    assert.equal(report.considered, 3);
  });

  it('keeps going when one import fails', async () => {
    const report = await syncHealthWalks({
      source: 'HEALTH_CONNECT',
      existing: [],
      samples: [
        sample({ externalId: 'distance:bad' }),
        sample({ externalId: 'distance:good', start: '2026-10-21T12:00:00.000Z', end: '2026-10-21T12:20:00.000Z' }),
      ],
      create: async (draft) => {
        if (draft.externalId === 'distance:bad') throw new Error('Cannot find native module');
        return { deduped: false };
      },
    });

    assert.equal(report.imported, 1);
    assert.equal(report.failed.length, 1);
    assert.match(report.failed[0]?.message ?? '', /development build/);
  });

  it('maps phone platforms onto activity sources', () => {
    assert.equal(healthSourceForPlatform('ios'), 'APPLE_HEALTH');
    assert.equal(healthSourceForPlatform('android'), 'HEALTH_CONNECT');
    assert.equal(healthSourceForPlatform('web'), null);
  });
});

describe('health length units', () => {
  it('converts HealthKit and Health Connect lengths to meters', () => {
    assert.equal(quantityToMeters({ unit: 'm', quantity: 1500 }), 1500);
    assert.equal(quantityToMeters({ unit: 'mi', quantity: 1 }), 1609.344);
    assert.equal(quantityToMeters({ unit: 'km', quantity: 2 }), 2000);
    assert.equal(lengthToMeters({ unit: 'miles', value: 1 }), 1609.344);
    assert.equal(lengthToMeters({ unit: 'kilometers', value: 0.5 }), 500);
    assert.equal(lengthToMeters({ unit: 'feet', value: 10 }), 3.048);
    assert.equal(lengthToMeters({ inMeters: 42 }), 42);
    assert.equal(quantityToMeters(undefined), 0);
  });
});
