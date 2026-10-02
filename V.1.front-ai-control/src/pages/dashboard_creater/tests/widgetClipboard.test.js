import { describe, expect, it } from 'vitest';
import { WidgetManager } from '../src/core/WidgetManager.js';

describe('widget clipboard paste remap', () => {
  it('assigns new ids and offsets root widgets', () => {
    const src = [
      {
        id: 'widget_1',
        type: 'kpi',
        x: 100,
        y: 80,
        width: 200,
        height: 120,
        settings: {},
      },
    ];
    const out = WidgetManager.remapClipboardWidgetsForPaste(src, 20);
    expect(out).toHaveLength(1);
    expect(out[0].id).not.toBe('widget_1');
    expect(out[0].x).toBe(120);
    expect(out[0].y).toBe(100);
    expect(out[0].type).toBe('kpi');
  });

  it('remaps container children and keeps containment', () => {
    const src = [
      {
        id: 'widget_c',
        type: 'container',
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        containedWidgets: ['widget_a'],
        settings: { containerTabGroups: [['widget_a']] },
      },
      {
        id: 'widget_a',
        type: 'text',
        x: 10,
        y: 10,
        width: 100,
        height: 40,
        settings: {},
      },
    ];
    const out = WidgetManager.remapClipboardWidgetsForPaste(src, 20);
    const container = out.find((w) => w.type === 'container');
    const child = out.find((w) => w.type === 'text');
    expect(container.id).not.toBe('widget_c');
    expect(child.id).not.toBe('widget_a');
    expect(container.containedWidgets).toEqual([child.id]);
    expect(container.settings.containerTabGroups).toEqual([[child.id]]);
    // child inside container is not offset; root container is
    expect(container.x).toBe(20);
    expect(child.x).toBe(10);
  });

  it('two remaps of same payload produce distinct ids', () => {
    const src = [{ id: 'widget_1', type: 'kpi', x: 0, y: 0, width: 10, height: 10, settings: {} }];
    const a = WidgetManager.remapClipboardWidgetsForPaste(src, 20);
    const b = WidgetManager.remapClipboardWidgetsForPaste(src, 20);
    expect(a[0].id).not.toBe(b[0].id);
  });
});
