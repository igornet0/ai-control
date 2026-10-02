import { describe, expect, it } from 'vitest';
import {
  connectionPointKey,
  normalizeConnection,
  normalizeWidgetId,
  widgetIdsEqual,
} from './widgetIdUtils.js';

describe('widgetIdUtils', () => {
  it('normalizes widget ids to strings', () => {
    expect(normalizeWidgetId(42)).toBe('42');
    expect(normalizeWidgetId('42')).toBe('42');
  });

  it('compares ids regardless of type', () => {
    expect(widgetIdsEqual(42, '42')).toBe(true);
    expect(widgetIdsEqual('5', 6)).toBe(false);
  });

  it('normalizes connection endpoints', () => {
    expect(normalizeConnection({ from: 1, to: '2', id: 'c1' })).toEqual({
      from: '1',
      to: '2',
      id: 'c1',
    });
  });

  it('builds stable connection point keys', () => {
    expect(connectionPointKey(7, 'output')).toBe('7_output');
    expect(connectionPointKey('7', 'input')).toBe('7_input');
  });
});
