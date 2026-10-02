import { describe, expect, it } from 'vitest';
import {
  buildLayoutConfigWithDashboardVariables,
  getDashboardVariablesFromDashboard,
  isValidDashboardVariableName,
  normalizeDashboardVariablesList,
} from '../../../utils/dashboardVariables.js';

describe('dashboardVariables layout_config helpers', () => {
  it('normalizes and dedupes variables', () => {
    const list = normalizeDashboardVariablesList([
      { name: 'threshold', type: 'Number', value: '10' },
      { name: 'threshold', type: 'Number', value: '99' },
      { name: 'flag', type: 'Bool', value: 'true' },
      { name: 'bad name!', type: 'String', value: 'x' },
    ]);
    expect(list.map((v) => v.name)).toEqual(['bad_name_', 'flag', 'threshold']);
    expect(list.find((v) => v.name === 'threshold')?.value).toBe(10);
    expect(list.find((v) => v.name === 'flag')?.value).toBe(true);
  });

  it('reads/writes layout_config without dropping other keys', () => {
    const dash = { layout_config: { auto_refresh: true, other: 1 } };
    const layout = buildLayoutConfigWithDashboardVariables(dash, [
      { name: 'x', type: 'Number', value: 3 },
    ]);
    expect(layout.auto_refresh).toBe(true);
    expect(layout.other).toBe(1);
    expect(getDashboardVariablesFromDashboard({ layout_config: layout })).toEqual([
      { name: 'x', type: 'Number', value: 3, description: '' },
    ]);
  });

  it('validates names', () => {
    expect(isValidDashboardVariableName('sum_amount')).toBe(true);
    expect(isValidDashboardVariableName('1bad')).toBe(false);
    expect(isValidDashboardVariableName('a-b')).toBe(false);
  });
});
