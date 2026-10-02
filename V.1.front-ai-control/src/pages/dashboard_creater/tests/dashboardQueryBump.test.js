import { describe, expect, it } from 'vitest';
import {
  registerDashboardQueryBumpListener,
  getDashboardQueryBumpGeneration,
} from '../../../services/dashboardQueryBump.js';
import { bumpDashboardQueryCoordinator } from '../../../services/dashboardQueryCoordinator.js';

describe('dashboardQueryBump', () => {
  it('bumpDashboardQueryCoordinator increments generation', () => {
    const g0 = getDashboardQueryBumpGeneration();
    bumpDashboardQueryCoordinator();
    expect(getDashboardQueryBumpGeneration()).toBe(g0 + 1);
    bumpDashboardQueryCoordinator();
    expect(getDashboardQueryBumpGeneration()).toBe(g0 + 2);
  });

  it('bump invokes registered listeners', () => {
    let n = 0;
    const unsub = registerDashboardQueryBumpListener(() => {
      n += 1;
    });
    bumpDashboardQueryCoordinator();
    expect(n).toBe(1);
    bumpDashboardQueryCoordinator();
    expect(n).toBe(2);
    unsub();
  });
});
