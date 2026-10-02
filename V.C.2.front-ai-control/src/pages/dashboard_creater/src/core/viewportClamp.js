/**
 * Ограничение offset камеры границами полотна (workspace).
 * Чистые функции — без DOM, удобно тестировать.
 */

export const DEFAULT_BOARD_SIZE = { width: 20000, height: 20000 };

/**
 * @param {number} offset
 * @param {number} viewportSize
 * @param {number} boardSize
 * @param {number} zoom
 * @returns {number}
 */
export function clampAxisOffset(offset, viewportSize, boardSize, zoom) {
  const vw = Math.max(0, Number(viewportSize) || 0);
  const bw = Math.max(1, Number(boardSize) || 1);
  const z = Math.max(1e-6, Number(zoom) || 1);
  const scaled = bw * z;
  let next;
  if (scaled >= vw) {
    const min = vw - scaled;
    const max = 0;
    next = Math.max(min, Math.min(max, offset));
  } else {
    next = (vw - scaled) / 2;
  }
  return Object.is(next, -0) ? 0 : next;
}

/**
 * @param {{ offsetX: number, offsetY: number, zoom: number }} state
 * @param {{ width: number, height: number }} viewportSize
 * @param {{ width: number, height: number }} boardSize
 * @returns {{ offsetX: number, offsetY: number }}
 */
export function clampViewportOffset(state, viewportSize, boardSize) {
  const zoom = Number(state?.zoom) || 1;
  return {
    offsetX: clampAxisOffset(state?.offsetX, viewportSize?.width, boardSize?.width, zoom),
    offsetY: clampAxisOffset(state?.offsetY, viewportSize?.height, boardSize?.height, zoom),
  };
}

/**
 * Offset, чтобы точка workspace (x,y) оказалась в левом верхнем углу viewport.
 * @param {number} homeX
 * @param {number} homeY
 * @param {number} zoom
 * @returns {{ offsetX: number, offsetY: number }}
 */
export function offsetsForHomePoint(homeX, homeY, zoom) {
  const z = Math.max(1e-6, Number(zoom) || 1);
  const x = Number(homeX);
  const y = Number(homeY);
  const offsetX = -(Number.isFinite(x) ? x : 0) * z;
  const offsetY = -(Number.isFinite(y) ? y : 0) * z;
  return {
    offsetX: Object.is(offsetX, -0) ? 0 : offsetX,
    offsetY: Object.is(offsetY, -0) ? 0 : offsetY,
  };
}

/**
 * @param {unknown} layoutConfig
 * @returns {{ x: number, y: number, zoom: number|null }}
 */
export function parseViewportHomeFromLayout(layoutConfig) {
  const vp =
    layoutConfig && typeof layoutConfig === 'object' && layoutConfig.viewport
      ? layoutConfig.viewport
      : {};
  let x = Number(vp.homeX);
  let y = Number(vp.homeY);
  if (!Number.isFinite(x)) x = 0;
  if (!Number.isFinite(y)) y = 0;
  let zoom = vp.homeZoom;
  if (zoom != null && zoom !== '') {
    zoom = Number(zoom);
    if (!Number.isFinite(zoom)) zoom = null;
  } else {
    zoom = null;
  }
  return { x, y, zoom };
}

/**
 * @param {Record<string, unknown>|null|undefined} layoutConfig
 * @param {{ x?: number, y?: number, zoom?: number|null }} home
 * @returns {Record<string, unknown>}
 */
export function mergeViewportHomeIntoLayout(layoutConfig, home) {
  const base =
    layoutConfig && typeof layoutConfig === 'object' && !Array.isArray(layoutConfig)
      ? { ...layoutConfig }
      : {};
  const prevVp =
    base.viewport && typeof base.viewport === 'object' && !Array.isArray(base.viewport)
      ? { ...base.viewport }
      : {};
  const x = Number(home?.x);
  const y = Number(home?.y);
  prevVp.homeX = Number.isFinite(x) ? x : 0;
  prevVp.homeY = Number.isFinite(y) ? y : 0;
  if (home?.zoom == null || home.zoom === '') {
    prevVp.homeZoom = null;
  } else {
    const z = Number(home.zoom);
    prevVp.homeZoom = Number.isFinite(z) ? z : null;
  }
  base.viewport = prevVp;
  return base;
}
