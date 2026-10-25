import { describe, expect, it } from 'vitest';
import type { GoalFormData } from '@/types/goal.types';
import { goalValidation } from './goalValidation';

function isoDate(daysFromToday: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString();
}

function validForm(overrides: Partial<GoalFormData> = {}): GoalFormData {
  return {
    name: 'Coast path',
    description: 'Walk the coast together',
    teamId: 'team-1',
    startDate: isoDate(1),
    targetDate: isoDate(14),
    waypoints: [
      { name: 'Start', address: 'Boston, MA', coordinates: { lat: 42.36, lng: -71.06 }, order: 0 },
      { name: 'Finish', address: 'Portland, ME', coordinates: { lat: 43.66, lng: -70.25 }, order: 1 },
    ],
    ...overrides,
  };
}

describe('goalValidation', () => {
  it('accepts a route with two waypoints and a future window', () => {
    const form = validForm();
    expect(goalValidation.hasErrors(goalValidation.validateForm(form))).toBe(false);
    expect(goalValidation.isFormValid(form)).toBe(true);
  });

  it('requires a name, a team, and at least two waypoints', () => {
    const errors = goalValidation.validateForm(validForm({
      name: '   ',
      teamId: '',
      waypoints: [validForm().waypoints[0]],
    }));

    expect(errors.name).toMatch(/required/i);
    expect(errors.teamId).toMatch(/team/i);
    expect(errors.waypoints).toMatch(/2 waypoints/i);
  });

  it('rejects a target date that is not after the start date', () => {
    const errors = goalValidation.validateForm(validForm({
      startDate: isoDate(10),
      targetDate: isoDate(2),
    }));
    expect(errors.targetDate).toMatch(/after start date/i);
  });

  it('checks waypoint coordinates', () => {
    expect(goalValidation.validateWaypoint({ lat: 10, lng: 20, address: 'Here' })).toBeNull();
    expect(goalValidation.validateWaypoint({ lat: 120, lng: 0, address: 'Here' })).toMatch(/latitude/i);
    expect(goalValidation.validateWaypoint({ lat: 0, lng: 0, address: '  ' })).toMatch(/address/i);
  });
});
