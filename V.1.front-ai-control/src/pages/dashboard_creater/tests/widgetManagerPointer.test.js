/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventBus } from '../src/core/EventBus.js';
import { WidgetBase } from '../src/core/WidgetBase.js';
import { WidgetManager } from '../src/core/WidgetManager.js';
import { LONG_PRESS_MS } from '../src/core/viewportTouchGestures.js';

function pointerEvent(target, extra = {}) {
  return {
    button: extra.button ?? 0,
    isPrimary: extra.isPrimary ?? true,
    pointerType: extra.pointerType ?? 'mouse',
    pointerId: extra.pointerId ?? 1,
    clientX: extra.clientX ?? 40,
    clientY: extra.clientY ?? 40,
    shiftKey: Boolean(extra.shiftKey),
    target,
    preventDefault() {},
    stopPropagation() {},
  };
}

describe('WidgetManager pointer interaction', () => {
  let workspace;
  let viewport;
  let viewportController;
  let engine;
  let manager;

  beforeEach(() => {
    vi.useFakeTimers();
    viewport = document.createElement('div');
    viewport.id = 'viewport';
    Object.defineProperty(viewport, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    });
    workspace = document.createElement('div');
    workspace.id = 'workspace';
    workspace.style.width = '20000px';
    workspace.style.height = '20000px';
    viewport.appendChild(workspace);
    document.body.appendChild(viewport);

    viewportController = {
      isPanning: false,
      isPinching: false,
      viewport,
      viewportToWorkspace(x, y) {
        return { x, y };
      },
      beginExclusiveInteraction: vi.fn(function beginExclusiveInteraction() {
        this.isPanning = false;
      }),
      endExclusiveInteraction: vi.fn(),
      cancelPan: vi.fn(),
    };

    engine = { mode: 'editor', coarsePointer: true };
    manager = new WidgetManager(workspace, viewportController, engine);
    const widget = new WidgetBase({
      id: 'widget_1',
      type: 'text',
      x: 20,
      y: 20,
      width: 120,
      height: 80,
    });
    manager.addWidget(widget);
  });

  afterEach(() => {
    manager?.destroy();
    eventBus.clear();
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('starts drag immediately on mouse pointerdown', () => {
    const widgetEl = workspace.querySelector('.widget');
    manager.handleWorkspacePointerDown(pointerEvent(widgetEl, { pointerType: 'mouse' }));
    expect(manager.dragging).toBe(true);
    expect(viewportController.beginExclusiveInteraction).toHaveBeenCalled();
  });

  it('selects on touch and starts drag only after long-press', () => {
    const widgetEl = workspace.querySelector('.widget');
    manager.handleWorkspacePointerDown(
      pointerEvent(widgetEl, { pointerType: 'touch', pointerId: 7 }),
    );
    expect(manager.dragging).toBe(false);
    expect(manager.selectedWidgets.has('widget_1')).toBe(true);

    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(manager.dragging).toBe(true);
    expect(widgetEl.classList.contains('widget--touch-lift')).toBe(true);
    expect(viewportController.beginExclusiveInteraction).toHaveBeenCalled();
  });

  it('cancels long-press drag when the finger moves', () => {
    const widgetEl = workspace.querySelector('.widget');
    manager.handleWorkspacePointerDown(
      pointerEvent(widgetEl, { pointerType: 'touch', pointerId: 3, clientX: 40, clientY: 40 }),
    );
    manager.handlePointerMove(
      pointerEvent(widgetEl, { pointerType: 'touch', pointerId: 3, clientX: 80, clientY: 40 }),
    );
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(manager.dragging).toBe(false);
  });
});
