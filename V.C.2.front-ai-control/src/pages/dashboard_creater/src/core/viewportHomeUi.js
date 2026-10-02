/**
 * Точка Home полотна: маркер, apply на engine, сохранение в sheet.layout_config.
 */

import { eventBus } from './EventBus.js';
import {
  mergeViewportHomeIntoLayout,
  parseViewportHomeFromLayout,
} from './viewportClamp.js';
import { sheetService } from '../../../../services/sheetService.js';

const MARKER_CLASS = 'workspace-home-marker';

/**
 * @param {import('./WorkspaceEngine.js').WorkspaceEngine} engine
 * @param {{ x?: number, y?: number, zoom?: number|null }} home
 */
export function applyViewportHomeToEngine(engine, home) {
  if (!engine) return;
  const x = Number(home?.x);
  const y = Number(home?.y);
  const zoom = home?.zoom;
  engine.viewportHome = {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    zoom: zoom == null || zoom === '' ? null : Number.isFinite(Number(zoom)) ? Number(zoom) : null,
  };
  syncHomeMarker(engine);
  eventBus.emit('viewport:home-config', { ...engine.viewportHome });
}

/**
 * @param {unknown} layoutConfig
 * @param {import('./WorkspaceEngine.js').WorkspaceEngine} engine
 */
export function applyViewportHomeFromLayoutConfig(layoutConfig, engine) {
  applyViewportHomeToEngine(engine, parseViewportHomeFromLayout(layoutConfig));
}

/**
 * @param {import('./WorkspaceEngine.js').WorkspaceEngine} engine
 * @returns {HTMLElement | null}
 */
export function ensureHomeMarker(engine) {
  const ws = engine?.workspace;
  if (!ws) return null;
  let el = ws.querySelector(`.${MARKER_CLASS}`);
  if (!el) {
    el = document.createElement('div');
    el.className = MARKER_CLASS;
    el.setAttribute('aria-hidden', 'true');
    el.title = 'Точка Home';
    el.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9 20v-6h6v6"/></svg>';
    ws.appendChild(el);
  }
  return el;
}

/**
 * @param {import('./WorkspaceEngine.js').WorkspaceEngine} engine
 */
export function syncHomeMarker(engine) {
  const el = ensureHomeMarker(engine);
  if (!el) return;
  const home = engine.viewportHome || { x: 0, y: 0 };
  el.style.left = `${home.x}px`;
  el.style.top = `${home.y}px`;
  const show = engine.mode === 'editor';
  el.hidden = !show;
  el.classList.toggle('workspace-home-marker--visible', show);
}

/**
 * @param {import('./WorkspaceEngine.js').WorkspaceEngine} engine
 * @param {boolean} placing
 */
export function setHomePlaceMode(engine, placing) {
  if (!engine) return;
  engine.__placingHomeMark = !!placing;
  const vp = engine.viewport;
  if (vp) {
    vp.classList.toggle('viewport--placing-home', !!placing);
  }
  eventBus.emit('viewport:home-place-mode', { placing: !!placing });
}

/**
 * Один клик по viewport → координаты Home.
 * @param {import('./WorkspaceEngine.js').WorkspaceEngine} engine
 * @param {MouseEvent} e
 * @returns {boolean} true если клик обработан
 */
export function tryConsumeHomePlaceClick(engine, e) {
  if (!engine?.__placingHomeMark) return false;
  if (e.button !== 0) return false;
  e.preventDefault();
  e.stopPropagation();
  const rect = engine.viewport.getBoundingClientRect();
  const pt = engine.viewportController.viewportToWorkspace(
    e.clientX - rect.left,
    e.clientY - rect.top,
  );
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  applyViewportHomeToEngine(engine, {
    x,
    y,
    zoom: engine.viewportHome?.zoom ?? null,
  });
  setHomePlaceMode(engine, false);
  return true;
}

let _saveTimer = null;

/**
 * @param {string|number} sheetId
 * @param {Record<string, unknown>|null|undefined} currentLayout
 * @param {{ x: number, y: number, zoom: number|null }} home
 * @param {{ allowWrite?: boolean }} [opts]
 */
export function schedulePersistViewportHome(sheetId, currentLayout, home, opts = {}) {
  if (opts.allowWrite === false) return;
  if (sheetId == null || sheetId === '') return;
  if (_saveTimer != null) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    _saveTimer = null;
    try {
      let layout = currentLayout;
      if (!layout || typeof layout !== 'object') {
        try {
          const sheet = await sheetService.getSheet(sheetId);
          layout = sheet?.layout_config || {};
        } catch {
          layout = {};
        }
      }
      const next = mergeViewportHomeIntoLayout(layout, home);
      await sheetService.updateSheet(sheetId, { layout_config: next });
      eventBus.emit('viewport:home-saved', { sheetId, home, layout_config: next });
    } catch (err) {
      console.warn('[viewportHome] save failed', err);
    }
  }, 400);
}

export function cancelPersistViewportHome() {
  if (_saveTimer != null) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
}
