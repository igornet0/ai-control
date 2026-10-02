import { describe, it, expect } from 'vitest';
import {
  buildDataCodeEditorTabs,
  buildEditorSessionPayload,
  collectEditorUploadFiles,
  isUsableEditorSession,
  mergeEditorSessionTabs,
  pruneEditorSessionPayload,
} from './buildDataCodeEditorTabs.js';
import { collectCompilePrefixTabs, joinTabContentsForCompile } from './compileTabPrefix.js';

describe('buildDataCodeEditorTabs', () => {
  it('builds one tab per widget in graph order and selects the opener', () => {
    const source = {
      id: '10',
      type: 'data-source',
      settings: { name: 'Sales', sourceType: 'interactive', interactiveConfig: { table: { columns: [], rows: [] } } },
    };
    const transform = {
      id: '20',
      type: 'processing-block',
      settings: { name: 'Normalize', blockType: 'transform', operations: [] },
      connections: [{ id: 'c1', from: '10', to: '20' }],
    };
    source.connections = transform.connections;

    const result = buildDataCodeEditorTabs({
      widgets: [transform, source],
      connections: transform.connections,
      savedCodeByWidgetId: {
        10: 'global sales = table([])',
        20: 'sales = sales',
      },
      selectedWidgetId: 20,
    });

    expect(result.tabs.map((t) => t.name)).toEqual(['Sales', 'Normalize']);
    expect(result.activeTab).toBe(1);
    expect(result.tabs[0].content).toContain('sales');
    expect(result.tabs[1].widgetId).toBe(20);
  });

  it('fills an empty data-model tab from current settings', () => {
    const linked = {
      id: '215',
      type: 'data-model',
      settings: {
        name: 'Модель данных',
        sourceModelId: 27,
        sourceModelName: 'HR',
        selectedTables: [{ name: 'employees', alias: 'employees', columns: ['id'] }],
      },
    };
    const result = buildDataCodeEditorTabs({
      widgets: [linked],
      savedCodeByWidgetId: {},
      selectedWidgetId: 215,
    });
    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].name).toBe('Модель данных');
    expect(result.tabs[0].content).toContain('source_table("employees"');
  });

  it('does not patch saved code when opening tabs', () => {
    const source = {
      id: '10',
      type: 'data-source',
      settings: {
        name: 'Sales',
        sourceType: 'file',
        selectedFile: { name: 'b.csv' },
        selectedColumns: ['x'],
      },
    };
    const saved = '# manually written\nglobal t = read(path("old.csv"))';
    const result = buildDataCodeEditorTabs({
      widgets: [source],
      savedCodeByWidgetId: { 10: saved },
      selectedWidgetId: 10,
    });
    expect(result.tabs[0].content).toBe(saved);
  });

  it('collects in-memory files from source widgets', () => {
    const file = new File(['x'], 'a.csv', { type: 'text/csv' });
    const widgets = [{
      id: 1,
      type: 'data-source',
      settings: { sourceType: 'file', selectedFile: { name: 'a.csv', file } },
    }];
    const files = collectEditorUploadFiles(widgets);
    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe('a.csv');
  });

  it('restores free tabs and order from a saved editor session', () => {
    const source = {
      id: '10',
      type: 'data-source',
      settings: { name: 'Sales', sourceType: 'interactive', interactiveConfig: { table: { columns: [], rows: [] } } },
    };
    const transform = {
      id: '20',
      type: 'processing-block',
      settings: { name: 'Normalize', blockType: 'transform', operations: [] },
      connections: [{ id: 'c1', from: '10', to: '20' }],
    };
    source.connections = transform.connections;

    const result = buildDataCodeEditorTabs({
      widgets: [transform, source],
      connections: transform.connections,
      savedCodeByWidgetId: {
        10: 'global sales = table([])',
        20: 'sales = sales',
      },
      selectedWidgetId: 20,
      savedEditorSession: {
        editorSession: true,
        activeTab: 1,
        tabs: [
          { name: 'Sales', content: 'stale', widgetId: 10 },
          { name: 'Scratch', content: 'x = 1' },
          { name: 'Normalize', content: 'stale', widgetId: 20 },
        ],
      },
    });

    expect(result.tabs.map((t) => t.name)).toEqual(['Sales', 'Scratch', 'Normalize']);
    expect(result.tabs[0].content).toBe('global sales = table([])');
    expect(result.tabs[1].content).toBe('x = 1');
    expect(result.tabs[1].widgetId).toBeNull();
    expect(result.tabs[2].content).toBe('sales = sales');
    expect(result.activeTab).toBe(2);
  });
});

describe('editor session helpers', () => {
  it('ignores legacy empty Tab 1 stubs', () => {
    expect(isUsableEditorSession({
      tabs: [{ name: 'Tab 1', content: '' }],
      activeTab: 0,
    })).toBe(false);
    expect(isUsableEditorSession({
      editorSession: true,
      tabs: [{ name: 'Вкладка 2', content: '' }],
      activeTab: 0,
    })).toBe(true);
  });

  it('appends widgets that appeared after the session was saved', () => {
    const merged = mergeEditorSessionTabs({
      widgetTabs: [
        { name: 'A', content: 'a', widgetId: 1 },
        { name: 'B', content: 'b', widgetId: 2 },
      ],
      savedSession: buildEditorSessionPayload([
        { name: 'A', content: 'old-a', widgetId: 1 },
        { name: 'Extra', content: 'extra' },
      ], 0),
    });
    expect(merged.tabs.map((t) => [t.name, t.content, t.widgetId])).toEqual([
      ['A', 'a', 1],
      ['Extra', 'extra', null],
      ['B', 'b', 2],
    ]);
  });

  it('does not restore widget tabs the user closed', () => {
    const merged = mergeEditorSessionTabs({
      widgetTabs: [
        { name: 'A', content: 'a', widgetId: 1 },
        { name: 'B', content: 'b', widgetId: 2 },
      ],
      savedSession: {
        editorSession: true,
        activeTab: 0,
        dismissedWidgetIds: [2],
        tabs: [
          { name: 'A', content: 'old-a', widgetId: 1 },
          { name: 'Scratch', content: 'x = 1' },
        ],
      },
    });
    expect(merged.tabs.map((t) => [t.name, t.widgetId])).toEqual([
      ['A', 1],
      ['Scratch', null],
    ]);
  });

  it('restores a dismissed widget tab when opening from that widget', () => {
    const merged = mergeEditorSessionTabs({
      widgetTabs: [
        { name: 'A', content: 'a', widgetId: 1 },
        { name: 'B', content: 'b', widgetId: 2 },
      ],
      selectedWidgetId: 2,
      savedSession: {
        editorSession: true,
        activeTab: 0,
        dismissedWidgetIds: [2],
        tabs: [{ name: 'A', content: 'old-a', widgetId: 1 }],
      },
    });
    expect(merged.tabs.map((t) => t.widgetId)).toEqual([1, 2]);
    expect(merged.activeTab).toBe(1);
  });

  it('records closed widget ids in the editor session payload', () => {
    const payload = buildEditorSessionPayload(
      [{ name: 'A', content: 'a', widgetId: 1 }],
      0,
      {
        canvasWidgetIds: [1, 2],
        previousDismissed: [],
      },
    );
    expect(payload.dismissedWidgetIds).toEqual([2]);
    expect(payload.tabs.map((t) => t.widgetId)).toEqual([1]);
  });

  it('prunes deleted widgets from the editor session payload', () => {
    const session = {
      editorSession: true,
      activeTab: 2,
      dismissedWidgetIds: [3],
      tabs: [
        { name: 'A', content: 'a', widgetId: 1 },
        { name: 'Scratch', content: 'x = 1' },
        { name: 'B', content: 'b', widgetId: 2 },
      ],
    };
    const pruned = pruneEditorSessionPayload(session, [2, 3]);
    expect(pruned.tabs.map((t) => [t.name, t.widgetId ?? null])).toEqual([
      ['A', 1],
      ['Scratch', null],
    ]);
    expect(pruned.dismissedWidgetIds).toEqual([]);
    expect(pruned.activeTab).toBe(1);
    expect(pruneEditorSessionPayload(session, [99])).toBeNull();
  });
});

describe('compileTabPrefix', () => {
  it('sends tabs from the first through the active tab only', () => {
    const tabs = [
      { name: 'Src', content: 'a = 1' },
      { name: 'Filter', content: 'a = a[true]' },
      { name: 'Later', content: 'unused = 1' },
    ];
    const prefix = collectCompilePrefixTabs(tabs, 1);
    expect(prefix.map((t) => t.name)).toEqual(['Src', 'Filter']);
    const code = joinTabContentsForCompile(prefix);
    expect(code).toContain('a = 1');
    expect(code).toContain('a = a[true]');
    expect(code).not.toContain('unused');
    expect(code).toContain('# ===== Src =====');
    expect(code).not.toContain('//');
  });
});
