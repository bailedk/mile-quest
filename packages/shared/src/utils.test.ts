import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculatePace,
  calculateProgress,
  formatDistance,
  formatDuration,
  generateInviteCode,
  isValidEmail,
  safeJsonParse,
} from './utils.ts';

describe('distance and pace', () => {
  it('formats short distances in feet and longer ones in miles', () => {
    assert.equal(formatDistance(0), '0 ft');
    assert.equal(formatDistance(0.05), '264 ft');
    assert.equal(formatDistance(1.26), '1.3 mi');
    assert.equal(formatDistance(-3), '0 ft');
  });

  it('formats duration in hours and minutes', () => {
    assert.equal(formatDuration(90), '1m');
    assert.equal(formatDuration(3700), '1h 1m');
  });

  it('calculates pace and refuses a zero distance', () => {
    assert.equal(calculatePace(2, 600), '5:00/mi');
    assert.equal(calculatePace(0, 600), '--');
    assert.equal(calculatePace(-1, 600), '--');
  });
});

describe('progress and validation helpers', () => {
  it('caps progress at 100 and treats an empty target as no progress', () => {
    assert.equal(calculateProgress(25, 100), 25);
    assert.equal(calculateProgress(150, 100), 100);
    assert.equal(calculateProgress(10, 0), 0);
    assert.equal(calculateProgress(-5, 100), 0);
  });

  it('checks email shape', () => {
    assert.equal(isValidEmail('walker@milequest.app'), true);
    assert.equal(isValidEmail('not-an-email'), false);
    assert.equal(isValidEmail('a@b'), false);
  });

  it('builds an 8-character invite code from the allowed alphabet', () => {
    const code = generateInviteCode();
    assert.match(code, /^[A-Z0-9]{8}$/);
  });

  it('parses JSON and falls back when the payload is invalid', () => {
    assert.deepEqual(safeJsonParse('{"ok":true}', { ok: false }), { ok: true });
    assert.deepEqual(safeJsonParse('nope', { ok: false }), { ok: false });
  });
});
