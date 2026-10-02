import { describe, expect, it, vi } from 'vitest';
import {
  buildDefaultConnectionSettings,
  syncConnectionFieldsFromUpstream,
} from './connectionSettingsUtils.js';

describe('connectionSettingsUtils', () => {
  it('copies upstream columns into new connection settings', () => {
    const fromWidget = {
      id: '10',
      type: 'data-source',
      settings: {
        selectedColumns: ['id', 'name'],
      },
    };

    expect(buildDefaultConnectionSettings(fromWidget)).toEqual({
      filterType: 'all',
      selectedSource: '10',
      selectedFields: ['id', 'name'],
    });
  });

  it('syncs missing selectedFields on existing connection', () => {
    const connection = {
      id: 'conn-1',
      from: '10',
      to: '20',
      settings: {},
    };
    const fromWidget = {
      id: '10',
      settings: { fileColumns: ['amount', 'region'] },
    };
    const widgetManager = {
      getAllWidgets: () => [{ connections: [connection] }],
      updateConnectionSettings: vi.fn(),
    };

    const synced = syncConnectionFieldsFromUpstream(widgetManager, 'conn-1', fromWidget);

    expect(synced).toBe(true);
    expect(widgetManager.updateConnectionSettings).toHaveBeenCalledWith('conn-1', {
      filterType: 'all',
      selectedSource: '10',
      selectedFields: ['amount', 'region'],
    });
  });
});
