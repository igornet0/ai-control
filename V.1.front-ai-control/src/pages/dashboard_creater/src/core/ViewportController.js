import { eventBus } from './EventBus.js';
import {
    DEFAULT_BOARD_SIZE,
    clampViewportOffset,
    offsetsForHomePoint,
} from './viewportClamp.js';
import {
    VIEWPORT_INTERACTIVE_SELECTOR,
    isInsideScrollableWidget,
    isTouchLikePointer,
    MIN_PINCH_DISTANCE_PX,
    pinchZoomFromDistance,
    pointerDistance,
    pointerMidpoint,
    zoomAroundPoint,
} from './viewportTouchGestures.js';

/**
 * Find a scrollable ancestor under a widget that can still scroll in the wheel direction.
 * @param {EventTarget|null} target
 * @param {number} deltaX
 * @param {number} deltaY
 * @returns {Element|null}
 */
function findScrollableWidgetAncestor(target, deltaX, deltaY) {
    if (!target || !(target instanceof Element)) return null;
    const widget = target.closest('.widget');
    if (!widget) return null;

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

            if (scrollY || scrollX) {
                const dy = deltaY || 0;
                const dx = deltaX || 0;
                // Prefer vertical when both present (typical mouse wheel)
                if (Math.abs(dy) >= Math.abs(dx) && scrollY) {
                    const max = el.scrollHeight - el.clientHeight;
                    if (dy < 0 && el.scrollTop > 0) return el;
                    if (dy > 0 && el.scrollTop < max - 0.5) return el;
                } else if (scrollX) {
                    const max = el.scrollWidth - el.clientWidth;
                    if (dx < 0 && el.scrollLeft > 0) return el;
                    if (dx > 0 && el.scrollLeft < max - 0.5) return el;
                    // Shift+wheel often maps vertical delta to horizontal scroll
                    if (Math.abs(dy) > 0 && Math.abs(dx) < 1) {
                        if (dy < 0 && el.scrollLeft > 0) return el;
                        if (dy > 0 && el.scrollLeft < max - 0.5) return el;
                    }
                } else if (scrollY) {
                    const max = el.scrollHeight - el.clientHeight;
                    if (dy < 0 && el.scrollTop > 0) return el;
                    if (dy > 0 && el.scrollTop < max - 0.5) return el;
                }
            }
        }
        node = node.parentElement;
    }
    return null;
}

/**
 * ViewportController - Управление viewport и workspace
 * Обрабатывает zoom и pan; offset ограничен границами полотна.
 */
export class ViewportController {
    constructor(viewportElement, workspaceElement) {
        this.viewport = viewportElement;
        this.workspace = workspaceElement;

        this.zoom = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;

        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        this.panStartOffsetX = 0;
        this.panStartOffsetY = 0;

        this.minZoom = 0.1;
        this.maxZoom = 3.0;

        /** Profile/embed: no zoom/pan; wheel only scrolls nested tables. */
        this.staticView = false;

        /** Widget drag/resize owns the pointer; skip pan/pinch. */
        this._exclusiveInteraction = false;

        /** @type {Map<number, { x: number, y: number }>} */
        this._pointers = new Map();
        this.isPinching = false;
        /** @type {{ startDistance: number, startZoom: number, startOffsetX: number, startOffsetY: number } | null} */
        this._pinch = null;
        /** @type {Set<number>} */
        this._capturedPointerIds = new Set();

        /** @type {ResizeObserver | null} */
        this._resizeObserver = null;

        this._onWheel = (e) => this.handleWheel(e);
        this._onMouseDown = (e) => this.handleMouseDown(e);
        this._onMouseMove = (e) => this.handleMouseMove(e);
        this._onMouseUp = (e) => this.handleMouseUp(e);
        this._onPointerDown = (e) => this.handlePointerDown(e);
        this._onPointerMove = (e) => this.handlePointerMove(e);
        this._onPointerUp = (e) => this.handlePointerUp(e);
        this._onKeyDown = (e) => {
            if (e.code === 'Space' && !e.repeat) {
                this.spacePressed = true;
                this.updateCursor();
            }
        };
        this._onKeyUp = (e) => {
            if (e.code === 'Space') {
                this.spacePressed = false;
                this.updateCursor();
            }
        };

        this.init();
    }

    init() {
        this.viewport.addEventListener('wheel', this._onWheel, { passive: false });
        this.viewport.addEventListener('mousedown', this._onMouseDown);
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mouseup', this._onMouseUp);
        this.viewport.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        this.viewport.addEventListener('pointermove', this._onPointerMove, { passive: false });
        this.viewport.addEventListener('pointerup', this._onPointerUp);
        this.viewport.addEventListener('pointercancel', this._onPointerUp);

        this.spacePressed = false;
        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);

        if (typeof ResizeObserver !== 'undefined' && this.viewport) {
            this._resizeObserver = new ResizeObserver(() => {
                this.clampOffset();
                this.updateTransform();
                eventBus.emit('viewport:pan', { offsetX: this.offsetX, offsetY: this.offsetY });
            });
            this._resizeObserver.observe(this.viewport);
        }

        this.clampOffset();
        this.updateTransform();
    }

    /**
     * Размер полотна (workspace) в CSS-пикселях.
     * @returns {{ width: number, height: number }}
     */
    getBoardSize() {
        if (!this.workspace) return { ...DEFAULT_BOARD_SIZE };
        const computedStyle = window.getComputedStyle(this.workspace);
        const width = parseFloat(computedStyle.width);
        const height = parseFloat(computedStyle.height);
        return {
            width: Number.isFinite(width) && width > 0 ? width : DEFAULT_BOARD_SIZE.width,
            height: Number.isFinite(height) && height > 0 ? height : DEFAULT_BOARD_SIZE.height,
        };
    }

    /**
     * Размер видимой области viewport.
     * @returns {{ width: number, height: number }}
     */
    getViewportSize() {
        if (!this.viewport) return { width: 0, height: 0 };
        return {
            width: this.viewport.clientWidth || 0,
            height: this.viewport.clientHeight || 0,
        };
    }

    /**
     * Ограничить offset границами полотна.
     * @returns {boolean} изменился ли offset
     */
    clampOffset() {
        const next = clampViewportOffset(
            { offsetX: this.offsetX, offsetY: this.offsetY, zoom: this.zoom },
            this.getViewportSize(),
            this.getBoardSize(),
        );
        const changed = next.offsetX !== this.offsetX || next.offsetY !== this.offsetY;
        this.offsetX = next.offsetX;
        this.offsetY = next.offsetY;
        return changed;
    }

    handleWheel(e) {
        if (this.staticView) {
            // Never zoom/pan in profile embed. Only scroll table bodies under the cursor.
            const table = this._findScrollableTableAt(e.clientX, e.clientY);
            if (table) {
                const canY = table.scrollHeight > table.clientHeight + 1;
                const canX = table.scrollWidth > table.clientWidth + 1;
                if (canY || canX) {
                    e.preventDefault();
                    if (canY) table.scrollTop += e.deltaY;
                    if (canX) table.scrollLeft += (e.deltaX || (e.shiftKey ? e.deltaY : 0));
                    return;
                }
            }
            e.preventDefault();
            return;
        }

        // Ctrl/Meta+wheel always zooms the board
        const forceZoom = e.ctrlKey || e.metaKey;

        if (!forceZoom) {
            // Let nested scrollable widget content (table, legend, shell) scroll natively
            const scrollable = findScrollableWidgetAncestor(e.target, e.deltaX, e.deltaY);
            if (scrollable) {
                return;
            }
            // Pie chart consumes wheel for slice rotation
            if (
                e.target instanceof Element &&
                e.target.closest('.pie-chart-svg, .pie-widget-chart-host')
            ) {
                return;
            }
        }

        e.preventDefault();

        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom + delta));

        if (newZoom !== this.zoom) {
            const rect = this.viewport.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const workspaceX = (mouseX - this.offsetX) / this.zoom;
            const workspaceY = (mouseY - this.offsetY) / this.zoom;

            this.zoom = newZoom;

            this.offsetX = mouseX - workspaceX * this.zoom;
            this.offsetY = mouseY - workspaceY * this.zoom;
            this.clampOffset();

            this.updateTransform();
            eventBus.emit('viewport:zoom', { zoom: this.zoom });
            eventBus.emit('viewport:pan', { offsetX: this.offsetX, offsetY: this.offsetY });
        }
    }

    handleMouseDown(e) {
        if (this.staticView) {
            // Allow interactive widgets in profile embed to receive clicks.
            if (
              e.target instanceof Element
              && e.target.closest('.widget--profile-interactive, .button-widget-canvas')
            ) {
              return;
            }
            e.preventDefault();
            return;
        }
        if (this.viewport?.classList?.contains('viewport--placing-home')) {
            return;
        }
        if (this._exclusiveInteraction || this.isPinching) {
            return;
        }
        if (e.button === 1 || (e.button === 0 && this.spacePressed)) {
            e.preventDefault();
            this.startPan(e);
            return;
        }

        if (e.button === 0) {
            const target = e.target;
            const isWidget = target.closest('.widget');
            const isResizeHandle = target.closest('.resize-handle');
            const isContainerTab = target.closest('.container-tab');
            const isContainerHeader = target.closest('.container-header');
            const isHomeMarker = target.closest('.workspace-home-marker');

            if (!isWidget && !isResizeHandle && !isContainerTab && !isContainerHeader && !isHomeMarker) {
                // Shift+клик — рамка выделения виджетов (WidgetManager), не pan
                if (e.shiftKey) return;
                e.preventDefault();
                this.startPan(e);
            }
        }
    }

    /**
     * Table body under cursor (works even when widget has pointer-events: none).
     * @param {number} clientX
     * @param {number} clientY
     * @returns {HTMLElement|null}
     */
    _findScrollableTableAt(clientX, clientY) {
        const root = this.workspace || this.viewport;
        if (!root) return null;
        const tables = root.querySelectorAll('.dash-widget-body--table');
        for (const table of tables) {
            if (!(table instanceof HTMLElement)) continue;
            const rect = table.getBoundingClientRect();
            if (
                clientX >= rect.left
                && clientX <= rect.right
                && clientY >= rect.top
                && clientY <= rect.bottom
            ) {
                return table;
            }
        }
        return null;
    }

    startPan(e) {
        this.isPanning = true;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        this.panStartOffsetX = this.offsetX;
        this.panStartOffsetY = this.offsetY;
        this.workspace.classList.add('panning');
        this.updateCursor();
        if (e.pointerId != null && isTouchLikePointer(e)) {
            this._capturePointer(e.pointerId);
        }
    }

    cancelPan() {
        if (!this.isPanning) return;
        this.isPanning = false;
        this.workspace?.classList.remove('panning');
        this.updateCursor();
    }

    beginExclusiveInteraction() {
        this._exclusiveInteraction = true;
        this.cancelPan();
        this._endPinch();
        this._releasePointerCaptures();
    }

    endExclusiveInteraction() {
        this._exclusiveInteraction = false;
    }

    _panelsBlockGestures() {
        const app = this.viewport?.closest?.('#app') || document.getElementById('app');
        if (!app) return false;
        return (
            app.classList.contains('app--style-panel-open') ||
            app.classList.contains('app--widget-panel-open')
        );
    }

    _capturePointer(pointerId) {
        if (pointerId == null || !this.viewport?.setPointerCapture) return;
        try {
            this.viewport.setPointerCapture(pointerId);
            this._capturedPointerIds.add(pointerId);
        } catch {
            /* ignore */
        }
    }

    _releasePointerCaptures() {
        if (!this.viewport?.releasePointerCapture) {
            this._capturedPointerIds.clear();
            return;
        }
        this._capturedPointerIds.forEach((id) => {
            try {
                if (this.viewport.hasPointerCapture?.(id)) {
                    this.viewport.releasePointerCapture(id);
                }
            } catch {
                /* ignore */
            }
        });
        this._capturedPointerIds.clear();
    }

    _shouldIgnoreTouchPanTarget(target, mode) {
        if (!(target instanceof Element)) return false;
        if (target.closest(VIEWPORT_INTERACTIVE_SELECTOR)) return true;
        if (isInsideScrollableWidget(target)) return true;
        if (target.closest('.resize-handle')) return true;
        if (mode === 'viewer' && target.closest('.widget')) return true;
        return false;
    }

    _applyCamera(next, { emitZoom = false } = {}) {
        this.zoom = next.zoom;
        this.offsetX = next.offsetX;
        this.offsetY = next.offsetY;
        this.clampOffset();
        this.updateTransform();
        if (emitZoom) {
            eventBus.emit('viewport:zoom', { zoom: this.zoom });
        }
        eventBus.emit('viewport:pan', { offsetX: this.offsetX, offsetY: this.offsetY });
    }

    _endPinch() {
        this.isPinching = false;
        this._pinch = null;
        this.workspace?.classList.remove('panning');
        this.updateCursor();
    }

    _startPinch() {
        const pts = [...this._pointers.values()];
        if (pts.length < 2) return;
        const distance = pointerDistance(pts[0], pts[1]);
        if (!(distance >= MIN_PINCH_DISTANCE_PX)) return;
        this.cancelPan();
        const rect = this.viewport.getBoundingClientRect();
        const mid = pointerMidpoint(pts[0], pts[1]);
        this.isPinching = true;
        this._pinch = {
            startDistance: distance,
            startZoom: this.zoom,
            startOffsetX: this.offsetX,
            startOffsetY: this.offsetY,
            startLocalX: mid.x - rect.left,
            startLocalY: mid.y - rect.top,
        };
        this.workspace.classList.add('panning');
        this.updateCursor();
    }

    _updatePinch() {
        if (!this.isPinching || !this._pinch) return;
        const pts = [...this._pointers.values()];
        if (pts.length < 2) return;
        const distance = pointerDistance(pts[0], pts[1]);
        const newZoom = pinchZoomFromDistance({
            startDistance: this._pinch.startDistance,
            currentDistance: distance,
            startZoom: this._pinch.startZoom,
            minZoom: this.minZoom,
            maxZoom: this.maxZoom,
        });
        const rect = this.viewport.getBoundingClientRect();
        const mid = pointerMidpoint(pts[0], pts[1]);
        const local = { x: mid.x - rect.left, y: mid.y - rect.top };
        const next = zoomAroundPoint(
            {
                offsetX: this._pinch.startOffsetX,
                offsetY: this._pinch.startOffsetY,
                zoom: this._pinch.startZoom,
            },
            newZoom,
            { x: this._pinch.startLocalX, y: this._pinch.startLocalY },
        );
        next.offsetX += local.x - this._pinch.startLocalX;
        next.offsetY += local.y - this._pinch.startLocalY;
        this._applyCamera(next, { emitZoom: true });
    }

    handlePointerDown(e) {
        if (!isTouchLikePointer(e)) return;
        if (this.staticView) {
            if (
                e.target instanceof Element &&
                e.target.closest('.widget--profile-interactive, .button-widget-canvas')
            ) {
                return;
            }
            e.preventDefault();
            return;
        }
        if (this.viewport?.classList?.contains('viewport--placing-home')) return;
        if (this._exclusiveInteraction) return;
        if (this._panelsBlockGestures()) return;

        this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (this._pointers.size >= 2) {
            e.preventDefault();
            this._capturePointer(e.pointerId);
            this._startPinch();
            return;
        }

        const engineMode = typeof window !== 'undefined' ? window.engine?.mode : null;
        if (this._shouldIgnoreTouchPanTarget(e.target, engineMode)) {
            return;
        }

        e.preventDefault();
        this.startPan(e);
    }

    handlePointerMove(e) {
        if (!isTouchLikePointer(e)) return;
        if (!this._pointers.has(e.pointerId) && !this.isPanning && !this.isPinching) return;
        if (this._pointers.has(e.pointerId)) {
            this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        if (this._exclusiveInteraction) return;

        if (this.isPinching) {
            e.preventDefault();
            this._updatePinch();
            return;
        }

        if (this._pointers.size >= 2 && !this.isPinching) {
            e.preventDefault();
            this._startPinch();
            return;
        }

        if (this.isPanning) {
            e.preventDefault();
            this.offsetX = this.panStartOffsetX + (e.clientX - this.panStartX);
            this.offsetY = this.panStartOffsetY + (e.clientY - this.panStartY);
            this.clampOffset();
            this.updateTransform();
            eventBus.emit('viewport:pan', { offsetX: this.offsetX, offsetY: this.offsetY });
        }
    }

    handlePointerUp(e) {
        if (!isTouchLikePointer(e) && !this._pointers.has(e.pointerId)) return;
        this._pointers.delete(e.pointerId);
        if (this._capturedPointerIds.has(e.pointerId)) {
            try {
                if (this.viewport?.hasPointerCapture?.(e.pointerId)) {
                    this.viewport.releasePointerCapture(e.pointerId);
                }
            } catch {
                /* ignore */
            }
            this._capturedPointerIds.delete(e.pointerId);
        }

        if (this.isPinching && this._pointers.size < 2) {
            this._endPinch();
            if (this._pointers.size === 1) {
                const remaining = this._pointers.entries().next().value;
                if (remaining) {
                    const [, pt] = remaining;
                    this.startPan({
                        clientX: pt.x,
                        clientY: pt.y,
                        pointerId: remaining[0],
                        pointerType: 'touch',
                    });
                }
            }
            return;
        }

        if (this.isPanning && this._pointers.size === 0) {
            this.cancelPan();
        }
    }

    handleMouseMove(e) {
        if (this.isPinching) return;
        if (this.isPanning) {
            const deltaX = e.clientX - this.panStartX;
            const deltaY = e.clientY - this.panStartY;

            this.offsetX = this.panStartOffsetX + deltaX;
            this.offsetY = this.panStartOffsetY + deltaY;
            this.clampOffset();

            this.updateTransform();
            eventBus.emit('viewport:pan', { offsetX: this.offsetX, offsetY: this.offsetY });
        }
    }

    handleMouseUp() {
        if (this.isPanning && this._pointers.size === 0) {
            this.cancelPan();
        }
    }

    updateCursor() {
        if (this.isPanning) {
            this.viewport.style.cursor = 'grabbing';
            this.workspace.style.cursor = 'grabbing';
        } else if (this.spacePressed) {
            this.viewport.style.cursor = 'grab';
            this.workspace.style.cursor = 'grab';
        } else {
            this.viewport.style.cursor = 'default';
            this.workspace.style.cursor = 'default';
        }
    }

    updateTransform() {
        this.workspace.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoom})`;
    }

    setZoom(zoom) {
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
        this.clampOffset();
        this.updateTransform();
        eventBus.emit('viewport:zoom', { zoom: this.zoom });
        eventBus.emit('viewport:pan', { offsetX: this.offsetX, offsetY: this.offsetY });
    }

    setOffset(x, y) {
        this.offsetX = x;
        this.offsetY = y;
        this.clampOffset();
        this.updateTransform();
        eventBus.emit('viewport:pan', { offsetX: this.offsetX, offsetY: this.offsetY });
    }

    /**
     * Вернуть камеру к точке Home (workspace coords).
     * @param {{ x?: number, y?: number, zoom?: number|null }} [home]
     */
    goHome(home = {}) {
        const x = Number.isFinite(Number(home.x)) ? Number(home.x) : 0;
        const y = Number.isFinite(Number(home.y)) ? Number(home.y) : 0;
        if (home.zoom != null && home.zoom !== '') {
            const z = Number(home.zoom);
            if (Number.isFinite(z)) {
                this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, z));
            }
        }
        const off = offsetsForHomePoint(x, y, this.zoom);
        this.offsetX = off.offsetX;
        this.offsetY = off.offsetY;
        this.clampOffset();
        this.updateTransform();
        eventBus.emit('viewport:zoom', { zoom: this.zoom });
        eventBus.emit('viewport:pan', { offsetX: this.offsetX, offsetY: this.offsetY });
        eventBus.emit('viewport:home', { x, y, zoom: this.zoom });
    }

    viewportToWorkspace(viewportX, viewportY) {
        return {
            x: (viewportX - this.offsetX) / this.zoom,
            y: (viewportY - this.offsetY) / this.zoom,
        };
    }

    workspaceToViewport(workspaceX, workspaceY) {
        return {
            x: workspaceX * this.zoom + this.offsetX,
            y: workspaceY * this.zoom + this.offsetY,
        };
    }

    getState() {
        return {
            zoom: this.zoom,
            offsetX: this.offsetX,
            offsetY: this.offsetY,
        };
    }

    setState(state) {
        this.zoom = state.zoom || 1.0;
        this.offsetX = state.offsetX || 0;
        this.offsetY = state.offsetY || 0;
        this.clampOffset();
        this.updateTransform();
    }

    destroy() {
        this._releasePointerCaptures();
        this._pointers.clear();
        this._endPinch();
        this.cancelPan();
        this.viewport?.removeEventListener('wheel', this._onWheel);
        this.viewport?.removeEventListener('mousedown', this._onMouseDown);
        this.viewport?.removeEventListener('pointerdown', this._onPointerDown);
        this.viewport?.removeEventListener('pointermove', this._onPointerMove);
        this.viewport?.removeEventListener('pointerup', this._onPointerUp);
        this.viewport?.removeEventListener('pointercancel', this._onPointerUp);
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
    }
}
