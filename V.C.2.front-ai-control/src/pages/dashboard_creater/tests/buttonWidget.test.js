/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { eventBus } from '../src/core/EventBus.js';
import { WidgetButton } from '../src/widgets/WidgetButton.js';
import { normalizeButtonLinkUrl, resolveButtonLinkUrl } from '../src/widgets/button/ButtonAction.js';

vi.mock('../../../services/dashboardFilterTransport.js', () => ({
  invalidateDashboardTransportCaches: vi.fn(),
  getDashboardFilterSnapshot: vi.fn(() => ({ predicatesByModelId: new Map() })),
  reloadDashboardDataWidgetsWithSnapshot: vi.fn(async () => undefined),
  notifyDashboardDataModelFullRefresh: vi.fn(),
}));

vi.mock('../../../services/dataModelService.js', () => ({
  dataModelService: {
    compileModel: vi.fn(async () => ({ success: true })),
  },
}));

vi.mock('../../../services/dashboardService.js', () => ({
  dashboardService: {
    getDashboardDataModels: vi.fn(async () => [{ id: 7, name: 'Orders' }]),
  },
}));

function createCanvasContextMock() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    measureText: vi.fn((text) => ({ width: String(text).length * 8 })),
    lineWidth: 1,
    font: '',
    textBaseline: 'middle',
    fillStyle: '#fff',
    shadowBlur: 0,
    shadowColor: 'transparent',
  };
}

describe('WidgetButton', () => {
  let ctx;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = createCanvasContextMock();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx);
    window.engine = {
      mode: 'viewer',
      widgetManager: { getAllWidgets: () => [] },
      setRuntimeParam: vi.fn(),
      setRuntimeParams: vi.fn(),
    };
  });

  afterEach(() => {
    eventBus.clear();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    delete window.engine;
  });

  function mountWidget(config) {
    const widget = new WidgetButton(config);
    document.body.appendChild(widget.element);
    widget.render();
    widget._canvas.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: widget.width,
      height: widget.height,
    }));
    widget._draw();
    return widget;
  }

  test('update syncs dash-widget-heading when showTitle is toggled', () => {
    const widget = mountWidget({
      settings: {
        showTitle: false,
        title: 'Кнопки',
        buttons: [{ id: 'b1', label: 'Go', action: { type: 'navigate', target: '1' } }],
      },
    });
    expect(widget.element.querySelector('.dash-widget-heading')).toBeNull();

    widget.settings.showTitle = true;
    widget.settings.title = 'Мои кнопки';
    widget.settings.titleSize = 16;
    widget.settings.titleColor = '#AABBCC';
    widget.update();

    const heading = widget.element.querySelector('.dash-widget-heading');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toBe('Мои кнопки');
    expect(heading.style.fontSize).toBe('16px');
    expect(heading.style.color.replace(/\s/g, '')).toMatch(/#AABBCC|rgb\(170,187,204\)/i);
  });

  test('dispatches navigation action for sheet switch', () => {
    const navigateSpy = vi.fn();
    eventBus.on('dashboard:navigate-requested', navigateSpy);

    const widget = mountWidget({
      settings: {
        buttons: [
          {
            id: 'nav_1',
            label: 'Open Sales',
            action: {
              type: 'navigate',
              target: 'dashboard_2',
              payload: { params: { source: 'button' } },
            },
          },
        ],
      },
    });

    widget.onClick('nav_1');

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy.mock.calls[0][0]).toMatchObject({
      targetSheetId: '2',
      payload: { params: { source: 'button' } },
      buttonId: 'nav_1',
    });
  });

  test('link action opens URL in a new tab', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({ opener: window });
    const linkSpy = vi.fn();
    eventBus.on('button:link-open', linkSpy);

    const widget = mountWidget({
      settings: {
        buttons: [
          {
            id: 'lnk',
            label: 'Docs',
            action: { type: 'link', target: 'example.com/docs', payload: { url: 'example.com/docs' } },
          },
        ],
      },
    });

    const result = widget.onClick('lnk');

    expect(result).toMatchObject({ ok: true, url: 'https://example.com/docs' });
    expect(openSpy).toHaveBeenCalledWith('https://example.com/docs', '_blank', 'noopener,noreferrer');
    expect(linkSpy).toHaveBeenCalledTimes(1);
  });

  test('link action rejects javascript URLs', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const widget = mountWidget({
      settings: {
        buttons: [
          {
            id: 'bad',
            label: 'Bad',
            action: { type: 'link', payload: { url: 'javascript:alert(1)' } },
          },
        ],
      },
    });

    const result = widget.onClick('bad');
    expect(result.ok).toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });

  test('normalizeButtonLinkUrl', () => {
    expect(normalizeButtonLinkUrl('https://a.test')).toBe('https://a.test');
    expect(normalizeButtonLinkUrl('example.com')).toBe('https://example.com');
    expect(normalizeButtonLinkUrl('javascript:alert(1)')).toBeNull();
    expect(resolveButtonLinkUrl({ type: 'link', payload: { url: 'https://ok.test' } })).toBe('https://ok.test');
    expect(resolveButtonLinkUrl({ type: 'link', target: 'global' })).toBeNull();
  });

  test('applies filter payload and emits FILTER_UPDATE flow', () => {
    const row = { modelId: 1, table: 'sales', field: 'country', selectedValues: [], excludedValues: [] };
    window.engine.widgetManager.getAllWidgets = () => [{ type: 'filter', settings: { filters: [row] } }];
    const changedSpy = vi.fn();
    eventBus.on('dashboard:filters-changed', changedSpy);

    const widget = mountWidget({
      settings: {
        buttons: [
          {
            id: 'flt',
            label: 'NL',
            action: {
              type: 'filter',
              target: 'global',
              payload: { field: 'country', value: 'Netherlands', debounceMs: 0 },
            },
          },
        ],
      },
    });

    widget.onClick('flt');

    expect(row.selectedValues).toEqual(['Netherlands']);
    expect(changedSpy).toHaveBeenCalled();
  });

  test('accepts qualified field employees.name against filter row', () => {
    const row = {
      modelId: 27,
      table: 'employees',
      field: 'name',
      selectedValues: [],
      excludedValues: [],
    };
    window.engine.widgetManager.getAllWidgets = () => [{ type: 'filter', settings: { filters: [row] } }];

    const widget = mountWidget({
      settings: {
        buttons: [
          {
            id: 'admin',
            label: 'Admin',
            action: {
              type: 'filter',
              target: 'global',
              payload: { field: 'employees.name', value: 'Admin', debounceMs: 0 },
            },
          },
        ],
      },
    });

    widget.onClick('admin');
    expect(row.selectedValues).toEqual(['Admin']);
  });

  test('creates virtual filter when no Filter widget but modelId+table+field present', () => {
    window.engine.widgetManager.getAllWidgets = () => [];
    window.engine.__virtualDashboardFilters = [];

    const widget = mountWidget({
      id: 'btn-w',
      dataSource: { modelId: 27, table: 'employees', field: 'name', fieldType: 'string' },
      settings: {
        buttons: [
          {
            id: 'admin',
            label: 'Admin',
            action: {
              type: 'filter',
              target: 'global',
              payload: { field: 'employees.name', value: 'Admin', debounceMs: 0 },
            },
          },
        ],
      },
    });
    window.engine.widgetManager.getAllWidgets = () => [widget];
    window.engine.widgetManager.getWidget = (id) => (id === 'btn-w' ? widget : null);

    const changedSpy = vi.fn();
    eventBus.on('dashboard:filters-changed', changedSpy);

    widget.onClick('admin');

    expect(window.engine.__virtualDashboardFilters).toHaveLength(1);
    expect(window.engine.__virtualDashboardFilters[0]).toMatchObject({
      modelId: 27,
      table: 'employees',
      field: 'name',
      selectedValues: ['Admin'],
    });
    expect(changedSpy).toHaveBeenCalled();
  });

  test('supports multiple independent buttons', () => {
    window.engine.getModelVariableCatalog = vi.fn(() => [
      { name: 'mode', type: 'String', source: 'dashboard' },
    ]);
    window.engine.setModelVariable = vi.fn();
    const widget = mountWidget({
      settings: {
        buttons: [
          {
            id: 'a',
            label: 'Mode A',
            action: { type: 'set_variable', target: 'global', payload: { key: 'mode', value: 'A' } },
          },
          {
            id: 'b',
            label: 'Mode B',
            action: { type: 'set_variable', target: 'global', payload: { key: 'mode', value: 'B' } },
          },
        ],
      },
    });

    widget.onClick('a');
    widget.onClick('b');

    expect(window.engine.setModelVariable).toHaveBeenNthCalledWith(
      1,
      'mode',
      'A',
      expect.objectContaining({ buttonId: 'a' }),
    );
    expect(window.engine.setModelVariable).toHaveBeenNthCalledWith(
      2,
      'mode',
      'B',
      expect.objectContaining({ buttonId: 'b' }),
    );
  });

  test('set_variable action calls setModelVariable', () => {
    window.engine.setModelVariable = vi.fn();
    window.engine.setModelVariables = vi.fn();
    window.engine.getModelVariableCatalog = vi.fn(() => [
      { name: 'sum_amount_sum', type: 'Number' },
    ]);

    const widget = mountWidget({
      settings: {
        buttons: [
          {
            id: 'bump',
            label: 'Bump',
            action: {
              type: 'set_variable',
              target: 'global',
              payload: { key: 'sum_amount_sum', value: '42' },
            },
          },
        ],
      },
    });

    widget.onClick('bump');

    expect(window.engine.setModelVariable).toHaveBeenCalledWith(
      'sum_amount_sum',
      42,
      expect.objectContaining({ buttonId: 'bump', source: 'button-widget' }),
    );
    expect(window.engine.setRuntimeParam).not.toHaveBeenCalled();
  });

  test('debounces rapid filter switching to last action', () => {
    const row = { modelId: 1, table: 'sales', field: 'country', selectedValues: [], excludedValues: [] };
    window.engine.widgetManager.getAllWidgets = () => [{ type: 'filter', settings: { filters: [row] } }];

    const widget = mountWidget({
      settings: {
        buttons: [
          {
            id: 'a',
            label: 'A',
            action: { type: 'filter', payload: { field: 'country', value: 'A', debounceMs: 120 } },
          },
          {
            id: 'b',
            label: 'B',
            action: { type: 'filter', payload: { field: 'country', value: 'B', debounceMs: 120 } },
          },
        ],
      },
    });

    widget.onClick('a');
    widget.onClick('b');
    vi.advanceTimersByTime(140);

    expect(row.selectedValues).toEqual(['B']);
  });

  test('reload action refreshes dashboard data', async () => {
    const {
      invalidateDashboardTransportCaches,
      reloadDashboardDataWidgetsWithSnapshot,
    } = await import('../../../services/dashboardFilterTransport.js');

    const widget = mountWidget({
      settings: {
        buttons: [
          {
            id: 'reload_1',
            label: 'Refresh',
            action: { type: 'reload', target: 'global', payload: {} },
          },
        ],
      },
    });

    const result = await widget.onClick('reload_1');
    expect(result).toMatchObject({ ok: true });
    expect(invalidateDashboardTransportCaches).toHaveBeenCalled();
    expect(reloadDashboardDataWidgetsWithSnapshot).toHaveBeenCalled();
  });

  test('hard_reload compiles model then refreshes data', async () => {
    const { dataModelService } = await import('../../../services/dataModelService.js');
    const {
      notifyDashboardDataModelFullRefresh,
      reloadDashboardDataWidgetsWithSnapshot,
    } = await import('../../../services/dashboardFilterTransport.js');

    window.engine.dashboardId = 42;
    window.engine.widgetManager.getAllWidgets = () => [
      { type: 'kpi', dataSource: { modelId: 7 } },
    ];

    const widget = mountWidget({
      settings: {
        buttons: [
          {
            id: 'hard_1',
            label: 'Rebuild',
            action: { type: 'hard_reload', target: 'all', payload: {} },
          },
        ],
      },
    });

    const result = await widget.onClick('hard_1');
    expect(result).toMatchObject({ ok: true, modelIds: [7] });
    expect(dataModelService.compileModel).toHaveBeenCalledWith(7, {});
    expect(notifyDashboardDataModelFullRefresh).toHaveBeenCalled();
    expect(reloadDashboardDataWidgetsWithSnapshot).toHaveBeenCalled();
  });

  test('recomputes hitboxes on resize', () => {
    const widget = mountWidget({
      width: 300,
      height: 90,
      settings: {
        buttons: [
          { id: 'left', label: 'Left', action: { type: 'custom', payload: {} } },
          { id: 'right', label: 'Right', action: { type: 'custom', payload: {} } },
        ],
      },
    });

    widget.setSize(140, 140);
    widget._draw();

    const allInside = widget._buttons.every((button) => {
      const r = button.hitbox;
      return r.x >= 0 && r.y >= 0 && r.x + r.width <= 140 && r.y + r.height <= 140;
    });
    expect(allInside).toBe(true);
  });

  test('canvas bitmap ignores viewport zoom from getBoundingClientRect', () => {
    const widget = mountWidget({
      width: 200,
      height: 80,
      settings: {
        buttons: [{ id: 'b1', label: 'Go', action: { type: 'custom', payload: {} } }],
      },
    });

    // Simulate CSS zoom=2: GBR is 2× layout, clientWidth stays layout size.
    Object.defineProperty(widget._canvas, 'clientWidth', { configurable: true, get: () => 200 });
    Object.defineProperty(widget._canvas, 'clientHeight', { configurable: true, get: () => 80 });
    widget._canvas.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 400,
      height: 160,
    }));

    widget._draw();

    expect(widget._canvas.width / widget._dpr).toBeCloseTo(200, 0);
    expect(widget._canvas.height / widget._dpr).toBeCloseTo(80, 0);

    const point = widget._eventPoint({ clientX: 200, clientY: 40 });
    expect(point.x).toBeCloseTo(100, 5);
    expect(point.y).toBeCloseTo(20, 5);
  });

  test('empty label with icon keeps icon-only button', () => {
    const widget = mountWidget({
      width: 200,
      height: 80,
      settings: {
        buttons: [{ id: 'b1', label: '', icon: 'refresh', action: { type: 'reload', payload: {} } }],
      },
    });
    const btn = widget._buttons[0];
    expect(btn.config.label).toBe('');
    expect(btn.hitbox.width).toBeLessThan(50);
    expect(Math.abs(btn.hitbox.width - btn.hitbox.height)).toBeLessThanOrEqual(4);
    const texts = ctx.fillText.mock.calls.map((c) => String(c[0]));
    expect(texts).not.toContain('Button 1');
    expect(texts).not.toContain('Refresh');
    expect(texts.every((t) => t.trim() !== '')).toBe(true);
  });
});
