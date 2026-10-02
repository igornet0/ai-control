import { describe, it, expect } from 'vitest';
import {
  collectUniqueConnections,
  computeWidgetLevels,
  findActiveTabIndex,
  orderWidgetsForDataCodeTabs,
  tabNameForWidget,
} from './widgetGraphOrder.js';

function source(id, name = `src-${id}`) {
  return { id, type: 'data-source', settings: { name } };
}

function block(id, name = `block-${id}`, blockType = 'transform') {
  return { id, type: 'processing-block', settings: { name, blockType } };
}

function formula(id, name = `formula-${id}`) {
  return { id, type: 'formula', settings: { name } };
}

function sink(id) {
  return { id, type: 'data-model', settings: { name: 'Модель данных' } };
}

function edge(from, to, id = `${from}->${to}`) {
  return { id, from, to };
}

function withConns(widget, connections) {
  return { ...widget, connections };
}

describe('widgetGraphOrder', () => {
  it('keeps data sources at level 0 even with incoming edges', () => {
    const a = source(1);
    const b = source(2);
    const levels = computeWidgetLevels([a, b], [edge(1, 2)]);
    expect(levels.get('1')).toBe(0);
    expect(levels.get('2')).toBe(0);
  });

  it('assigns longest-path levels along a chain', () => {
    const s = source(1, 'A');
    const f = block(2, 'Filter', 'filter');
    const t = block(3, 'Transform', 'transform');
    const widgets = [t, f, s];
    const connections = [edge(1, 2), edge(2, 3)];
    const levels = computeWidgetLevels(widgets, connections);
    expect(levels.get('1')).toBe(0);
    expect(levels.get('2')).toBe(1);
    expect(levels.get('3')).toBe(2);
  });

  it('uses max of incoming, not sum of edges', () => {
    const s = source(1);
    const left = block(2, 'L');
    const right = block(3, 'R');
    const join = block(4, 'Join');
    const connections = [edge(1, 2), edge(1, 3), edge(2, 4), edge(3, 4)];
    const levels = computeWidgetLevels([s, left, right, join], connections);
    expect(levels.get('4')).toBe(2);
  });

  it('orders tabs: all sources first, then by level, not creation order', () => {
    const laterSource = source(10, 'Beta');
    const firstSource = source(1, 'Alpha');
    const transform = block(2, 'T');
    const filter = block(3, 'F', 'filter');
    const widgets = [transform, laterSource, filter, firstSource];
    const connections = [edge(10, 2), edge(1, 3), edge(3, 2)];
    const { ordered } = orderWidgetsForDataCodeTabs(widgets, connections);
    expect(ordered.map((w) => w.id)).toEqual([1, 10, 3, 2]);
  });

  it('places disconnected processing widgets after sources at level 1', () => {
    const s = source(1, 'Src');
    const orphan = block(9, 'Orphan');
    const { ordered, levels } = orderWidgetsForDataCodeTabs([orphan, s], []);
    expect(levels.get('9')).toBe(1);
    expect(ordered.map((w) => w.id)).toEqual([1, 9]);
  });

  it('treats data-model as a source tab at level 0', () => {
    const s = source(1);
    const t = block(2);
    const dm = sink(99);
    const { ordered, levels } = orderWidgetsForDataCodeTabs(
      [dm, t, s],
      [edge(99, 2)],
    );
    expect(levels.get('99')).toBe(0);
    expect(ordered[ordered.length - 1].id).toBe(2);
    expect(ordered.slice(0, 2).map((w) => w.id).sort((a, b) => a - b)).toEqual([1, 99]);
  });

  it('includes formula widgets in tab order', () => {
    const s = source(1);
    const f = formula(5, 'Profit');
    const { ordered } = orderWidgetsForDataCodeTabs([f, s], [edge(1, 5)]);
    expect(ordered.map((w) => w.id)).toEqual([1, 5]);
  });

  it('deduplicates connections stored on both endpoints', () => {
    const conn = edge(1, 2, 'c1');
    const s = withConns(source(1), [conn]);
    const t = withConns(block(2), [conn]);
    const unique = collectUniqueConnections([s, t]);
    expect(unique).toHaveLength(1);
  });

  it('does not get stuck on a cycle among processing widgets', () => {
    const a = block(2, 'A');
    const b = block(3, 'B');
    const s = source(1);
    const levels = computeWidgetLevels([s, a, b], [edge(1, 2), edge(2, 3), edge(3, 2)]);
    expect(levels.get('1')).toBe(0);
    expect(levels.get('2')).toBeGreaterThanOrEqual(1);
    expect(levels.get('3')).toBeGreaterThanOrEqual(1);
    const { ordered } = orderWidgetsForDataCodeTabs([s, a, b], [edge(1, 2), edge(2, 3), edge(3, 2)]);
    expect(ordered.map((w) => w.id).sort()).toEqual([1, 2, 3]);
  });

  it('finds the active tab of the widget that opened the editor', () => {
    const ordered = [source(1), block(2), block(3)];
    expect(findActiveTabIndex(ordered, 3)).toBe(2);
    expect(findActiveTabIndex(ordered, '2')).toBe(1);
    expect(findActiveTabIndex(ordered, 99)).toBe(0);
  });

  it('falls back to type labels when the widget has no name', () => {
    expect(tabNameForWidget({ type: 'data-source', settings: {} })).toBe('Источник данных');
    expect(tabNameForWidget({
      type: 'processing-block',
      settings: { blockType: 'aggregate' },
    })).toBe('Агрегация');
    expect(tabNameForWidget({
      type: 'processing-block',
      settings: { blockType: 'join' },
    })).toBe('Объединение');
  });

  it('computes levels in O(V+E) on a wide graph', () => {
    const nodes = 4000;
    const widgets = [source(0, 'root')];
    const connections = [];
    for (let i = 1; i <= nodes; i += 1) {
      widgets.push(block(i, `n${i}`));
      connections.push(edge(0, i, `e${i}`));
      if (i > 1) connections.push(edge(i - 1, i, `c${i}`));
    }
    const t0 = performance.now();
    const levels = computeWidgetLevels(widgets, connections);
    const elapsed = performance.now() - t0;
    expect(levels.get('0')).toBe(0);
    expect(levels.get(String(nodes))).toBe(nodes);
    expect(elapsed).toBeLessThan(250);
  });
});
