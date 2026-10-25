import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  combineLocalDateTime,
  distanceToMeters,
  formatMeters,
  formatPaceFromMeters,
  formatWalkDuration,
  preferredUnits,
  progressPercent,
  sourceLabel,
} from './format.ts';

describe('distance display', () => {
  it('reuses the shared mile formatter and pace', () => {
    assert.equal(formatMeters(0, 'miles'), '0 ft');
    assert.equal(formatMeters(1609.344, 'miles'), '1.0 mi');
    assert.equal(formatPaceFromMeters(1609.344, 600, 'miles'), '10:00/mi');
    assert.equal(formatPaceFromMeters(1000, 600, 'kilometers'), '10:00/km');
    assert.equal(formatWalkDuration(3700), '1h 1m');
    assert.equal(progressPercent(500, 1000), 50);
    assert.equal(progressPercent(5000, 1000), 100);
  });

  it('converts a typed distance into meters', () => {
    assert.equal(distanceToMeters(1, 'miles'), 1609.344);
    assert.equal(distanceToMeters(2.5, 'kilometers'), 2500);
    assert.equal(preferredUnits('kilometers'), 'kilometers');
    assert.equal(preferredUnits(undefined), 'miles');
    assert.equal(sourceLabel('HEALTH_CONNECT'), 'Health Connect');
    assert.equal(sourceLabel('MANUAL'), 'Manual');
  });

  it('combines a local date and time', () => {
    const parsed = combineLocalDateTime('2026-10-25', '15:30');
    assert.ok(parsed);
    assert.equal(parsed?.getFullYear(), 2026);
    assert.equal(parsed?.getMonth(), 9);
    assert.equal(parsed?.getDate(), 25);
    assert.equal(parsed?.getHours(), 15);
    assert.equal(parsed?.getMinutes(), 30);
    assert.equal(combineLocalDateTime('10/25/2026', '15:30'), null);
    assert.equal(combineLocalDateTime('2026-10-25', '3:30'), null);
  });
});
