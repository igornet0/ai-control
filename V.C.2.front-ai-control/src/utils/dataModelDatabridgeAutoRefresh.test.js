import { describe, it, expect } from 'vitest';
import {
  widgetUsesDatabridge,
  dataModelWidgetsUseDatabridge,
  getDatabridgeAutoRefreshEnabled,
  getDatabridgeRefreshIntervalSec,
  buildProcessingConfigWithDatabridgeRefresh,
} from './dataModelDatabridgeAutoRefresh.js';

describe('dataModelDatabridgeAutoRefresh', () => {
  it('detects DataBridge data-source widgets', () => {
    expect(widgetUsesDatabridge(null)).toBe(false);
    expect(widgetUsesDatabridge({ widget_type: 'data-source', widget_config: { settings: { sourceType: 'file' } } })).toBe(false);
    expect(widgetUsesDatabridge({
      widget_type: 'data-source',
      widget_config: { settings: { sourceType: 'databridge', databridgeEntity: 'employees' } },
    })).toBe(true);
    expect(dataModelWidgetsUseDatabridge([
      { widget_type: 'processing-block' },
      { widget_type: 'data-source', widget_config: { settings: { sourceType: 'databridge' } } },
    ])).toBe(true);
  });

  it('reads and merges processing_config.databridge', () => {
    expect(getDatabridgeAutoRefreshEnabled(null)).toBe(false);
    expect(getDatabridgeAutoRefreshEnabled({
      processing_config: { databridge: { auto_refresh: true } },
    })).toBe(true);
    expect(getDatabridgeRefreshIntervalSec({})).toBe(900);
    expect(getDatabridgeRefreshIntervalSec({
      processing_config: { databridge: { refresh_interval_sec: 3600 } },
    })).toBe(3600);

    expect(buildProcessingConfigWithDatabridgeRefresh(
      { processing_config: { ingest: { tables: {} }, databridge: { auto_refresh: false } } },
      { auto_refresh: true, refresh_interval_sec: 1800 },
    )).toEqual({
      ingest: { tables: {} },
      databridge: { auto_refresh: true, refresh_interval_sec: 1800 },
    });
  });
});
