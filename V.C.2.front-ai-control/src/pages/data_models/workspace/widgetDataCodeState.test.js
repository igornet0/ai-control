import { describe, expect, it } from 'vitest';
import { planMissingWidgetDataCodeSaves } from './widgetDataCodeState.js';

describe('planMissingWidgetDataCodeSaves', () => {
  it('plans a save when a configured widget has no stored DataCode', () => {
    const widget = {
      id: 215,
      type: 'data-model',
      settings: {
        name: 'HR',
        sourceModelId: 27,
        selectedTables: [{ name: 'employees', alias: 'employees', columns: ['id'] }],
      },
    };

    const plans = planMissingWidgetDataCodeSaves([widget], {});
    expect(plans).toHaveLength(1);
    expect(plans[0].widgetId).toBe(215);
    expect(plans[0].content).toContain('source_table("employees"');
  });

  it('does not overwrite already saved DataCode', () => {
    const widget = {
      id: 10,
      type: 'data-source',
      settings: {
        name: 'Sales',
        sourceType: 'file',
        selectedFile: { name: 'sales.csv' },
        selectedColumns: ['id'],
      },
    };

    const plans = planMissingWidgetDataCodeSaves(
      [widget],
      { 10: 'global sales = read(path("old.csv"))' },
    );
    expect(plans).toEqual([]);
  });

  it('skips widgets that cannot generate code yet', () => {
    const widget = {
      id: 11,
      type: 'data-source',
      settings: { name: 'Empty file', sourceType: 'file' },
    };

    expect(planMissingWidgetDataCodeSaves([widget], {})).toEqual([]);
  });
});
