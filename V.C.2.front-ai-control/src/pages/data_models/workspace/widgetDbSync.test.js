import { describe, expect, it, vi } from 'vitest';
import {
  buildWidgetApiPayload,
  mapWorkspaceWidgetToApi,
  parseDbWidgetId,
  remapWidgetId,
} from './widgetDbSync.js';

describe('parseDbWidgetId', () => {
  it('reads numeric string ids', () => {
    expect(parseDbWidgetId({ id: '12' })).toBe(12);
  });

  it('ignores temporary widget ids', () => {
    expect(parseDbWidgetId({ id: 'widget_123' })).toBeNull();
  });
});

describe('buildWidgetApiPayload', () => {
  it('maps workspace widget fields to API payload', () => {
    const payload = buildWidgetApiPayload({
      type: 'data-source',
      x: 10,
      y: 20,
      width: 250,
      settings: { sourceType: 'file' },
    });
    expect(payload.widget_type).toBe('data-source');
    expect(payload.position_x).toBe(10);
    expect(payload.widget_config.settings.sourceType).toBe('file');
  });
});

describe('mapWorkspaceWidgetToApi', () => {
  it('maps workspace widget with numeric string id', () => {
    const mapped = mapWorkspaceWidgetToApi({
      id: '5',
      type: 'data-model',
      x: 100,
      y: 200,
      settings: { name: 'Модель данных' },
    });
    expect(mapped.id).toBe(5);
    expect(mapped.widget_type).toBe('data-model');
    expect(mapped.widget_config.settings.name).toBe('Модель данных');
  });

  it('strips File object from selectedFile before API payload', () => {
    const mapped = mapWorkspaceWidgetToApi({
      id: '5',
      type: 'data-source',
      settings: {
        sourcePath: 'sample.csv',
        selectedFile: {
          name: 'sample.csv',
          file: new File(['a'], 'sample.csv', { type: 'text/csv' }),
        },
      },
    });
    expect(mapped.widget_config.settings.sourcePath).toBe('sample.csv');
    expect(mapped.widget_config.settings.selectedFile.file).toBeUndefined();
    expect(mapped.widget_config.settings.selectedFile.name).toBe('sample.csv');
  });
});

describe('remapWidgetId', () => {
  it('updates widget map and connection endpoints', () => {
    const widget = { id: '1', connections: [{ id: 'c1', from: '1', to: '2' }] };
    const other = { id: '2', connections: [{ id: 'c1', from: '1', to: '2' }] };
    const engineRef = {
      current: {
        widgetManager: {
          widgets: new Map([
            ['1', widget],
            ['2', other],
          ]),
          selectedWidgets: new Set(['1']),
          getAllWidgets: () => [widget, other],
        },
      },
    };

    remapWidgetId(engineRef, widget, '1', 99);

    expect(widget.id).toBe('99');
    expect(engineRef.current.widgetManager.widgets.has('99')).toBe(true);
    expect(other.connections[0].from).toBe('99');
    expect(widget.connections[0].from).toBe('99');
  });
});
