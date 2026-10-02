import { describe, expect, it, vi } from 'vitest';
import { loadUpstreamFieldsAsync } from './upstreamFieldsLoader.js';

describe('loadUpstreamFieldsAsync', () => {
  it('returns immediate fields from widget settings', async () => {
    const sourceWidget = {
      id: '10',
      type: 'data-source',
      settings: { selectedColumns: ['id', 'name'] },
    };
    const widgetManager = {
      getWidget: (id) => (String(id) === '10' ? sourceWidget : null),
    };
    const incoming = { id: 'c1', from: '10', to: '20', settings: {} };

    const fields = await loadUpstreamFieldsAsync({
      incomingConnection: incoming,
      widgetManager,
      modelId: 1,
    });

    expect(fields).toEqual(['id', 'name']);
  });

  it('loads columns from saved DataCode when settings are empty', async () => {
    const sourceWidget = {
      id: '10',
      type: 'data-source',
      settings: { sourceType: 'file', sourcePath: 'sales.csv' },
    };
    const widgetManager = {
      getWidget: (id) => (String(id) === '10' ? sourceWidget : null),
      getAllWidgets: () => [{ connections: [incoming] }],
      updateConnectionSettings: vi.fn(),
    };
    const incoming = { id: 'c1', from: '10', to: '20', settings: {} };

    const dataModelService = {
      getModelCode: vi.fn().mockResolvedValue({
        code: 'sales = read(path("sales.csv"), header_row=0, header=["Region", "Amount"])\n',
      }),
      getModelFiles: vi.fn(),
    };

    const fields = await loadUpstreamFieldsAsync({
      incomingConnection: incoming,
      widgetManager,
      modelId: 1,
      dataModelService,
    });

    expect(fields).toEqual(['Region', 'Amount']);
    expect(sourceWidget.settings.selectedColumns).toEqual(['Region', 'Amount']);
  });
});
