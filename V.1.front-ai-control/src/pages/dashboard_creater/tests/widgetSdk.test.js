/**
 * @jest-environment jsdom
 */

import { defineWidget } from '../src/sdk/defineWidget.js';
import { createWidgetContext, resolveWidgetContext } from '../src/sdk/WidgetContext.js';
import { createSettingsPanelApi } from '../src/sdk/createSettingsPanelApi.js';
import { mountSettingsPanelContribution } from '../src/sdk/mountSettingsPanel.js';
import { WorkspaceEngine } from '../src/core/WorkspaceEngine.js';
import { WidgetBase } from '../src/core/WidgetBase.js';
import { htmlDefinition } from '../src/widgets/html/htmlDefinition.js';

class StubWidget extends WidgetBase {
  constructor(config = {}) {
    super({ ...config, type: config.type || 'stub' });
    this.settings = { label: 'x', ...(config.settings || {}) };
  }
  render() {
    const el = this.element.querySelector('.widget-content');
    if (el) el.textContent = this.settings.label || '';
  }
}

describe('defineWidget', () => {
  test('requires type and WidgetClass', () => {
    expect(() => defineWidget({})).toThrow(/type/);
    expect(() => defineWidget({ type: 'a' })).toThrow(/WidgetClass/);
  });

  test('normalizes capabilities defaults', () => {
    const def = defineWidget({ type: 'a', WidgetClass: StubWidget });
    expect(def.capabilities.dataBinding).toBe('none');
    expect(def.displayName).toBe('a');
    expect(typeof def.defaultSettings).toBe('function');
  });
});

describe('WorkspaceEngine.register', () => {
  let engine;

  beforeEach(() => {
    const viewport = document.createElement('div');
    const workspace = document.createElement('div');
    workspace.style.width = '2000px';
    workspace.style.height = '2000px';
    document.body.appendChild(viewport);
    document.body.appendChild(workspace);
    engine = new WorkspaceEngine(viewport, workspace);
  });

  afterEach(() => {
    engine?.destroy?.();
    document.body.innerHTML = '';
  });

  test('register definition + aliases', () => {
    const def = defineWidget({
      type: 'stub-widget',
      aliases: ['stub_widget'],
      displayName: 'Stub',
      WidgetClass: StubWidget,
      settingsPanel: {
        sections: [{ id: 's', title: 'S', render: () => document.createElement('div') }],
      },
    });
    engine.register(def);
    expect(engine.widgetClasses['stub-widget']).toBe(StubWidget);
    expect(engine.widgetClasses.stub_widget).toBe(StubWidget);
    expect(engine.getWidgetDefinition('stub_widget')?.type).toBe('stub-widget');
    expect(engine.getWidgetDefinitions().some((d) => d.type === 'stub-widget')).toBe(true);
  });

  test('addWidget attaches ctx and merges defaults', () => {
    engine.register(
      defineWidget({
        type: 'stub',
        WidgetClass: StubWidget,
        defaultSettings: () => ({ label: 'default' }),
        defaultSize: { width: 111, height: 77 },
      }),
    );
    const w = engine.addWidget('stub', { x: 10, y: 10 });
    expect(w.ctx).toBeTruthy();
    expect(w.ctx.mode).toBe('editor');
    expect(w.settings.label).toBe('default');
    expect(w.width).toBe(111);
  });

  test('setWidgetAdapters updates context', () => {
    let called = false;
    engine.setWidgetAdapters({
      navigation: { goToSheet: () => { called = true; } },
    });
    const ctx = engine.getWidgetContext();
    ctx.navigation.goToSheet(1);
    expect(called).toBe(true);
  });
});

describe('settings panel contribution', () => {
  test('mountSettingsPanelContribution renders sections', () => {
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    const widget = new StubWidget({ settings: { label: 'hi' } });
    const def = defineWidget({
      type: 'stub',
      WidgetClass: StubWidget,
      settingsPanel: {
        sections: [
          {
            id: 'content',
            title: 'Content',
            render(api) {
              const el = document.createElement('div');
              el.className = 'probe';
              el.textContent = api.getSettings().label;
              return el;
            },
          },
        ],
      },
    });
    const { unmount } = mountSettingsPanelContribution(slot, def, { widget, engine: null });
    expect(slot.querySelector('.probe')?.textContent).toBe('hi');
    expect(slot.style.display).toBe('block');
    unmount();
    expect(slot.children.length).toBe(0);
  });

  test('createSettingsPanelApi patchSettings emits', () => {
    const widget = new StubWidget({ settings: { label: 'a' } });
    const api = createSettingsPanelApi({ widget, engine: null });
    api.patchSettings({ label: 'b' });
    expect(widget.settings.label).toBe('b');
    api.destroy();
  });
});

describe('htmlDefinition', () => {
  test('exposes settingsPanel for SDK editor slot', () => {
    expect(htmlDefinition.type).toBe('html');
    expect(htmlDefinition.settingsPanel.sections.length).toBeGreaterThan(0);
    expect(htmlDefinition.WidgetClass).toBeTruthy();
  });
});

describe('WidgetContext', () => {
  test('resolveWidgetContext accepts engine-like and context', () => {
    const ctx = createWidgetContext(null, {});
    expect(resolveWidgetContext(ctx)).toBe(ctx);
    const fakeEngine = { getWidgetContext: () => ctx };
    expect(resolveWidgetContext(fakeEngine)).toBe(ctx);
  });
});
