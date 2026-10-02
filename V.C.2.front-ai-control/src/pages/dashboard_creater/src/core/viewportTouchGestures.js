/**
 * Pure helpers for touch pan/pinch and long-press drag.
 */

export const MIN_PINCH_DISTANCE_PX = 8;
export const LONG_PRESS_MS = 400;
export const POINTER_MOVE_TOLERANCE_PX = 12;

/**
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @returns {number}
 */
export function pointerDistance(a, b) {
    const dx = (a?.x || 0) - (b?.x || 0);
    const dy = (a?.y || 0) - (b?.y || 0);
    return Math.hypot(dx, dy);
}

/**
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @returns {{ x: number, y: number }}
 */
export function pointerMidpoint(a, b) {
    return {
        x: ((a?.x || 0) + (b?.x || 0)) / 2,
        y: ((a?.y || 0) + (b?.y || 0)) / 2,
    };
}

/**
 * @param {number} zoom
 * @param {number} minZoom
 * @param {number} maxZoom
 * @returns {number}
 */
export function clampZoom(zoom, minZoom, maxZoom) {
    const z = Number(zoom);
    if (!Number.isFinite(z)) return minZoom;
    return Math.max(minZoom, Math.min(maxZoom, z));
}

/**
 * Zoom around a viewport-local point, keeping the workspace point under it stable.
 * @param {{ offsetX: number, offsetY: number, zoom: number }} state
 * @param {number} newZoom
 * @param {{ x: number, y: number }} point viewport-local
 * @returns {{ offsetX: number, offsetY: number, zoom: number }}
 */
export function zoomAroundPoint(state, newZoom, point) {
    const zoom = Number(state?.zoom);
    const offsetX = Number(state?.offsetX);
    const offsetY = Number(state?.offsetY);
    const px = Number(point?.x);
    const py = Number(point?.y);
    if (!(zoom > 0) || !Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
        return { offsetX: 0, offsetY: 0, zoom: newZoom };
    }
    const workspaceX = (px - offsetX) / zoom;
    const workspaceY = (py - offsetY) / zoom;
    return {
        zoom: newZoom,
        offsetX: px - workspaceX * newZoom,
        offsetY: py - workspaceY * newZoom,
    };
}

/**
 * @param {{ startDistance: number, currentDistance: number, startZoom: number, minZoom: number, maxZoom: number }} params
 * @returns {number}
 */
export function pinchZoomFromDistance({
    startDistance,
    currentDistance,
    startZoom,
    minZoom,
    maxZoom,
}) {
    if (!(startDistance > 0) || !Number.isFinite(currentDistance)) {
        return clampZoom(startZoom, minZoom, maxZoom);
    }
    return clampZoom(startZoom * (currentDistance / startDistance), minZoom, maxZoom);
}

/**
 * @param {{ x: number, y: number }} start
 * @param {{ x: number, y: number }} current
 * @param {number} [tolerance]
 * @returns {boolean}
 */
export function pointerMovedBeyondTolerance(start, current, tolerance = POINTER_MOVE_TOLERANCE_PX) {
    return pointerDistance(start, current) > tolerance;
}

/**
 * True when the event comes from a finger or stylus (not a mouse).
 * @param {{ pointerType?: string } | null | undefined} e
 * @returns {boolean}
 */
export function isTouchLikePointer(e) {
    const type = e?.pointerType;
    return type === 'touch' || type === 'pen';
}

/**
 * Widget-internal controls that should keep native pointer behavior.
 */
export const VIEWPORT_INTERACTIVE_SELECTOR = [
    'input',
    'textarea',
    'select',
    'button',
    'option',
    'a[href]',
    '[contenteditable="true"]',
    '.line-widget-overlay',
    '.line-widget-plot-row',
    '.line-widget-minimap',
    '.line-widget-tf-btn',
    '.line-widget-tf-custom-input',
    '.pie-chart-svg',
    '.pie-widget-chart-host',
    '.pie-widget-legend',
    '.pie-staging-top',
    '.widget--profile-interactive',
    '.button-widget-canvas',
    '.widget-profile-pin-btn',
].join(', ');

/**
 * True if target sits in a widget subtree that can still scroll.
 * @param {EventTarget|null} target
 * @returns {boolean}
 */
export function isInsideScrollableWidget(target) {
    if (!target || !(target instanceof Element)) return false;
    const widget = target.closest('.widget');
    if (!widget) return false;

    let node = target;
    while (node && node !== widget) {
        if (node.nodeType === 1) {
            const el = /** @type {HTMLElement} */ (node);
            const style = window.getComputedStyle(el);
            const oy = style.overflowY;
            const ox = style.overflowX;
            const scrollY =
                (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
                el.scrollHeight > el.clientHeight + 1;
            const scrollX =
                (ox === 'auto' || ox === 'scroll' || ox === 'overlay') &&
                el.scrollWidth > el.clientWidth + 1;
            if (scrollY || scrollX) return true;
        }
        node = node.parentElement;
    }
    return false;
}
