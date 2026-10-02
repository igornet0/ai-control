/** @vitest-environment jsdom */

import React from 'react';
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  applyDashboardProposal,
  classifyDashboardIntent,
  extractJsonObject,
  formatModelSchemaForPrompt,
  needsModelSchema,
  parseDashboardAiReply,
  summarizeDashboardSheet,
} from '../ai/dashboardCanvasAi.js';

vi.mock('../../../services/dashboardFilterTransport.js', () => ({
  getDashboardFilterSnapshot: vi.fn(() => ({
    descriptors: [
      {
        modelId: 1,
        table: 'orders',
        field: 'region',
        selectedValues: ['EU'],
        excludedValues: [],
        pattern: '',
      },
    ],
    sqlPredicates: [{ modelId: 1, table: 'orders', column: 'region', op: 'in', values: ['EU'] }],
  })),
}));

vi.mock('../../../services/dashboardFilterUtils.js', () => ({
  applyDataFieldToWidget: vi.fn(() => 'default'),
}));

vi.mock('../../../services/aiAgentService', () => ({
  aiAgentService: {
    getAgentInfo: vi.fn(async () => ({ name: 'AI' })),
    getHistory: vi.fn(async () => ({ messages: [] })),
    listFaqs: vi.fn(async () => []),
    saveMessages: vi.fn(),
    clearHistory: vi.fn(async () => {}),
    sendMessage: vi.fn(),
    appendFaqExchange: vi.fn(),
  },
}));

vi.mock('../../../components/MarkdownContent', () => ({
  default: ({ children }) => React.createElement('div', null, children),
}));

function makeWidget(overrides = {}) {
  return {
    id: 'w1',
    type: 'kpi',
    x: 10,
    y: 20,
    width: 200,
    height: 120,
    settings: { title: 'Revenue', value: '42' },
    styles: {},
    dataSource: { modelId: 1, table: 'orders', field: 'amount' },
    render: vi.fn(),
    applyStyles: vi.fn(),
    setPosition: vi.fn(function setPosition(x, y) {
      this.x = x;
      this.y = y;
    }),
    setSize: vi.fn(function setSize(w, h) {
      this.width = w;
      this.height = h;
    }),
    setStyles: vi.fn(function setStyles(patch) {
      this.styles = { ...this.styles, ...patch };
    }),
    ...overrides,
  };
}

function makeEngine(widgets = []) {
  const map = new Map(widgets.map((w) => [String(w.id), w]));
  return {
    mode: 'editor',
    widgetClasses: { kpi: true, text: true },
    widgetManager: {
      getAllWidgets: () => widgets,
      getWidget: (id) => map.get(String(id)) || null,
      deleteWidget: vi.fn((id) => {
        const idx = widgets.findIndex((w) => String(w.id) === String(id));
        if (idx >= 0) widgets.splice(idx, 1);
        map.delete(String(id));
      }),
    },
    addWidget: vi.fn((type, config) => {
      const w = makeWidget({
        id: `new_${widgets.length + 1}`,
        type,
        ...config,
        settings: { ...(config.settings || {}) },
        styles: { ...(config.styles || {}) },
      });
      widgets.push(w);
      map.set(String(w.id), w);
      return w;
    }),
    getRuntimeParams: () => ({}),
    dashboardVariables: {},
  };
}

describe('classifyDashboardIntent', () => {
  test('editor act on explicit verbs', () => {
    expect(classifyDashboardIntent('добавь KPI сверху', { surface: 'editor' })).toBe('act');
    expect(classifyDashboardIntent('сделай красивый layout', { surface: 'editor' })).toBe('act');
  });

  test('editor act on design verbs', () => {
    expect(classifyDashboardIntent('оформи виджеты красиво', { surface: 'editor' })).toBe('act');
    expect(classifyDashboardIntent('скопируй стиль на остальные', { surface: 'editor' })).toBe('act');
  });

  test('editor help by default', () => {
    expect(classifyDashboardIntent('как добавить фильтр?', { surface: 'editor' })).toBe('help');
  });

  test('viewer prefers analyze and never act', () => {
    expect(classifyDashboardIntent('проанализируй значения', { surface: 'viewer' })).toBe('analyze');
    expect(classifyDashboardIntent('добавь KPI', { surface: 'viewer' })).toBe('analyze');
  });
});

describe('parseDashboardAiReply', () => {
  test('parses fenced json and keeps proposals only for act+editor', () => {
    const raw = '```json\n{"mode":"act","summary":"Ок","proposals":[{"op":"add_widget","widget_type":"kpi","temp_id":"t1"}]}\n```';
    const parsed = parseDashboardAiReply(raw, 'act', 'editor');
    expect(parsed.structured).toBe(true);
    expect(parsed.mode).toBe('act');
    expect(parsed.proposals).toHaveLength(1);
    expect(parsed.proposals[0].op).toBe('add_widget');
  });

  test('strips proposals in viewer even if model returns act', () => {
    const raw = JSON.stringify({
      mode: 'act',
      summary: 'Нельзя',
      proposals: [{ op: 'delete_widget', widget_id: 'w1' }],
    });
    const parsed = parseDashboardAiReply(raw, 'analyze', 'viewer');
    expect(parsed.mode).toBe('analyze');
    expect(parsed.proposals).toEqual([]);
  });

  test('strips proposals for help mode', () => {
    const raw = JSON.stringify({
      mode: 'help',
      summary: 'Совет',
      proposals: [{ op: 'add_widget', widget_type: 'kpi' }],
    });
    const parsed = parseDashboardAiReply(raw, 'help', 'editor');
    expect(parsed.proposals).toEqual([]);
  });

  test('extractJsonObject handles plain text', () => {
    expect(extractJsonObject('просто текст')).toBeNull();
  });
});

describe('summarizeDashboardSheet', () => {
  test('includes widgets, live values and filters without huge data dumps', () => {
    const big = Array.from({ length: 40 }, (_, i) => ({ x: i, y: i * 2 }));
    const engine = makeEngine([
      makeWidget({
        settings: { title: 'Revenue', value: '42', data: big },
      }),
    ]);
    const text = summarizeDashboardSheet(engine, {
      dashboardName: 'Sales',
      dashboardId: 9,
      sheetId: 3,
      includeLive: true,
    });
    expect(text).toContain('Sales');
    expect(text).toContain('Revenue');
    expect(text).toContain('live=');
    expect(text).toContain('region');
    expect(text).toContain('Подключённые модели данных');
    expect(text).toContain('модель данных #1');
    expect(text).not.toMatch(/"y":78/);
  });

  test('prefers named linked models from engine cache', () => {
    const engine = makeEngine([makeWidget()]);
    engine.__linkedDataModels = [{ id: 12, name: 'Демо модель' }];
    const text = summarizeDashboardSheet(engine, {
      dashboardName: 'Демо',
      dashboardId: 6,
      sheetId: 1,
    });
    expect(text).toContain('Демо модель');
    expect(text).toContain('id=12');
  });

  test('includes styles in sheet snapshot for design context', () => {
    const engine = makeEngine([
      makeWidget({
        styles: {
          appearance: { backgroundType: 'solid', backgroundColor: '#112233' },
          typography: { fontFamily: 'Inter', color: '#E4E6EB' },
        },
      }),
    ]);
    const text = summarizeDashboardSheet(engine, { dashboardName: 'D', dashboardId: 1, sheetId: 1 });
    expect(text).toContain('styles=');
    expect(text).toContain('#112233');
  });

  test('includes model field schema without row data when requested', () => {
    const engine = makeEngine([makeWidget()]);
    const schema = {
      models: [{ id: 12, name: 'Демо модель', schemaOk: true, schemaError: null }],
      tables: [{ modelId: 12, modelName: 'Демо модель', tableName: 'orders' }],
      fields: [
        { modelId: 12, modelName: 'Демо модель', tableName: 'orders', name: 'amount', type: 'float', sqliteType: 'REAL' },
        { modelId: 12, modelName: 'Демо модель', tableName: 'orders', name: 'region', type: 'string', sqliteType: 'TEXT' },
      ],
    };
    const text = summarizeDashboardSheet(engine, {
      dashboardName: 'Демо',
      dashboardId: 6,
      sheetId: 1,
      includeModelSchema: true,
      modelSchema: schema,
    });
    expect(text).toContain('Схема полей');
    expect(text).toContain('таблица orders');
    expect(text).toContain('amount: REAL');
    expect(text).toContain('region: TEXT');
    expect(text).toMatch(/строк данных НЕТ/i);
    expect(text).not.toContain('row_data');
    // schema block must not dump table rows — only field:type lines
    expect(text).toMatch(/amount: REAL/);
    expect(text).not.toMatch(/таблица orders:[\s\S]*?\b\d+\.\d+\b/);
  });
});

describe('needsModelSchema / formatModelSchemaForPrompt', () => {
  test('detects detailed field/schema questions', () => {
    expect(needsModelSchema('какие поля и типы в модели?')).toBe(true);
    expect(needsModelSchema('покажи схему таблиц')).toBe(true);
    expect(needsModelSchema('добавь KPI по сумме продаж', { intent: 'act' })).toBe(true);
    expect(needsModelSchema('сделай красивый дизайн', { intent: 'act' })).toBe(false);
    expect(needsModelSchema('как открыть панель?', { intent: 'help' })).toBe(false);
  });

  test('formats names and types only', () => {
    const text = formatModelSchemaForPrompt({
      models: [{ id: 1, name: 'Sales', schemaOk: true }],
      tables: [{ modelId: 1, modelName: 'Sales', tableName: 'orders' }],
      fields: [
        { modelId: 1, modelName: 'Sales', tableName: 'orders', name: 'id', sqliteType: 'INTEGER' },
        { modelId: 1, modelName: 'Sales', tableName: 'orders', name: 'total', type: 'float' },
      ],
    });
    expect(text).toContain('Sales');
    expect(text).toContain('id: INTEGER');
    expect(text).toContain('total: float');
    expect(text).not.toMatch(/\b100\b/);
  });
});

describe('buildDashboardResponseProtocol', () => {
  test('documents copy_styles and design guide', async () => {
    const { buildDashboardResponseProtocol } = await import('../ai/dashboardCanvasAi.js');
    const protocol = buildDashboardResponseProtocol('act', 'editor');
    expect(protocol).toContain('copy_styles');
    expect(protocol).toContain('appearance');
    expect(protocol).toContain('kpi');
  });
});

describe('applyDashboardProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('update_settings merges and emits render', async () => {
    const widget = makeWidget();
    const engine = makeEngine([widget]);
    const result = await applyDashboardProposal(engine, {
      op: 'update_settings',
      widget_id: 'w1',
      settings_patch: { title: 'New' },
    });
    expect(result.status).toBe('applied');
    expect(widget.settings.title).toBe('New');
    expect(widget.render).toHaveBeenCalled();
  });

  test('move_resize updates geometry', async () => {
    const widget = makeWidget();
    const engine = makeEngine([widget]);
    const result = await applyDashboardProposal(engine, {
      op: 'move_resize',
      widget_id: 'w1',
      x: 100,
      y: 50,
      width: 320,
      height: 180,
    });
    expect(result.status).toBe('applied');
    expect(widget.setSize).toHaveBeenCalledWith(320, 180, engine.widgetManager);
    expect(widget.setPosition).toHaveBeenCalledWith(100, 50, engine.widgetManager);
  });

  test('rejects mutations in viewer mode', async () => {
    const engine = makeEngine([makeWidget()]);
    engine.mode = 'viewer';
    await expect(
      applyDashboardProposal(engine, {
        op: 'delete_widget',
        widget_id: 'w1',
      }),
    ).rejects.toThrow(/просмотр/i);
  });

  test('add_widget uses engine.addWidget and temp_id map', async () => {
    const widgets = [];
    const engine = makeEngine(widgets);
    const result = await applyDashboardProposal(engine, {
      op: 'add_widget',
      temp_id: 't1',
      widget_type: 'kpi',
      settings: { title: 'A' },
      x: 40,
      y: 40,
    });
    expect(result.status).toBe('applied');
    expect(engine.addWidget).toHaveBeenCalled();
    expect(widgets).toHaveLength(1);
  });

  test('copy_styles transfers styles and visual settings', async () => {
    const source = makeWidget({
      id: 'src',
      styles: {
        appearance: { backgroundType: 'solid', backgroundColor: '#00E0FF' },
        typography: { fontFamily: 'Inter', color: '#fff' },
      },
      settings: {
        title: 'Source KPI',
        valueColor: '#00E0FF',
        backgroundColor: '#111',
      },
      dataSource: { modelId: 1, table: 'orders', field: 'amount' },
    });
    const target = makeWidget({
      id: 'dst',
      styles: { appearance: { backgroundType: 'solid', backgroundColor: '#ffffff' } },
      settings: {
        title: 'Target KPI',
        valueColor: '#999',
        backgroundColor: '#eee',
      },
      dataSource: { modelId: 1, table: 'orders', field: 'qty' },
    });
    const engine = makeEngine([source, target]);
    const result = await applyDashboardProposal(engine, {
      op: 'copy_styles',
      source_widget_id: 'src',
      target_widget_ids: ['dst'],
      include_visual_settings: true,
    });
    expect(result.status).toBe('applied');
    expect(target.styles.appearance.backgroundColor).toBe('#00E0FF');
    expect(target.settings.valueColor).toBe('#00E0FF');
    expect(target.settings.title).toBe('Target KPI');
    expect(target.dataSource.field).toBe('qty');
    expect(target.applyStyles).toHaveBeenCalled();
    expect(target.render).toHaveBeenCalled();
  });
});

describe('DashboardAiAssistant mount', () => {
  afterEach(() => {
    cleanup();
  });

  test('renders FAB in editor and viewer', async () => {
    const { default: DashboardAiAssistant } = await import('../ai/DashboardAiAssistant.jsx');
    const engineRef = { current: makeEngine([]) };

    const { unmount } = render(
      React.createElement(DashboardAiAssistant, {
        engineRef,
        dashboardId: 1,
        sheetId: 2,
        dashboardName: 'Test',
        mode: 'editor',
      }),
    );
    expect(screen.getByLabelText('Открыть AI помощника')).toBeTruthy();
    unmount();

    render(
      React.createElement(DashboardAiAssistant, {
        engineRef,
        dashboardId: 1,
        sheetId: 2,
        dashboardName: 'Test',
        mode: 'viewer',
      }),
    );
    expect(screen.getByLabelText('Открыть AI помощника')).toBeTruthy();
  });
});
