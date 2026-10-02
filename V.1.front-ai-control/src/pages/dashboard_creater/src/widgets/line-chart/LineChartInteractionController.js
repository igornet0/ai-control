/**
 * Zoom / pan / drag-to-zoom / mini-map / hover для линейного графика.
 */

function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
}

/**
 * Локальные координаты относительно el (как clientWidth/clientHeight),
 * с учётом CSS transform на предках (zoom/pan workspace).
 * @param {HTMLElement} el
 * @param {number} clientX
 * @param {number} clientY
 */
function clientToElementLocal(el, clientX, clientY) {
    const r = el.getBoundingClientRect();
    const rw = r.width || 1;
    const rh = r.height || 1;
    const cw = el.clientWidth || rw;
    const ch = el.clientHeight || rh;
    return {
        x: ((clientX - r.left) * cw) / rw,
        y: ((clientY - r.top) * ch) / rh,
    };
}

/**
 * @typedef {{
 *   overlay: HTMLCanvasElement,
 *   mini: HTMLCanvasElement | null,
 *   root: HTMLElement,
 *   tooltip: HTMLElement | null,
 *   getCfg: () => Record<string, unknown>,
 *   getLayout: () => {
 *     plotLeft: number,
 *     plotTop: number,
 *     plotWidth: number,
 *     plotHeight: number,
 *     mini: { x: number, y: number, w: number, h: number } | null,
 *   },
 *   getView: () => { x0: number, x1: number, y0: number, y1: number },
 *   setView: (v: { x0?: number; x1?: number; y0?: number; y1?: number }) => void,
 *   getFullBounds: () => { minX: number; maxX: number; minY: number; maxY: number },
 *   findNearestByDataX: (dataX: number) => unknown,
 *   pickNearestByPlot?: (ox: number, oy: number) => unknown,
 *   onRedraw: () => void,
 *   onHover?: (hit: unknown, clientX: number, clientY: number) => void,
 *   onBrushXRange?: (range: { xMin: number; xMax: number }) => boolean,
 *   onBrushClear?: () => void,
 * }} LineChartInteractionOpts
 */

export class LineChartInteractionController {
    /**
     * @param {LineChartInteractionOpts} opts
     */
    constructor(opts) {
        this.opts = opts;
        this._boundWheel = this._onWheel.bind(this);
        this._boundDown = this._onPointerDown.bind(this);
        this._boundMove = this._onPointerMove.bind(this);
        this._boundUp = this._onPointerUp.bind(this);
        this._boundLeave = this._onPointerLeave.bind(this);
        this._boundDbl = this._onDblClick.bind(this);

        /** @type {'none'|'pending-pan'|'pan'|'rect'|'mini'} */
        this._mode = 'none';
        /** Мин. сдвиг (px) до старта pan — иначе hover при лёгком клике не срабатывает. */
        this._panDragThreshold = 4;
        this._ptrId = null;
        this._startClient = { x: 0, y: 0 };
        /** Локальные координаты overlay при старте pan */
        this._startLocal = { x: 0, y: 0 };
        this._startView = { x0: 0, x1: 0, y0: 0, y1: 0 };
        /** @type {{ x: number; y: number; w: number; h: number } | null} */
        this.zoomRect = null;
        this._rectByShift = false;
        this._miniDrag = false;
        /** @type {HTMLElement | null} */
        this._captureEl = null;

        const ov = opts.overlay;
        ov.addEventListener('wheel', this._boundWheel, { passive: false });
        ov.addEventListener('pointerdown', this._boundDown);
        if (opts.mini) {
            opts.mini.addEventListener('pointerdown', this._boundDown);
            opts.mini.addEventListener('pointerleave', this._boundLeave);
        }
        window.addEventListener('pointermove', this._boundMove);
        window.addEventListener('pointerup', this._boundUp);
        ov.addEventListener('pointerleave', this._boundLeave);
        ov.addEventListener('dblclick', this._boundDbl);
    }

    destroy() {
        const ov = this.opts.overlay;
        ov.removeEventListener('wheel', this._boundWheel);
        ov.removeEventListener('pointerdown', this._boundDown);
        window.removeEventListener('pointermove', this._boundMove);
        window.removeEventListener('pointerup', this._boundUp);
        ov.removeEventListener('pointerleave', this._boundLeave);
        ov.removeEventListener('dblclick', this._boundDbl);
        if (this.opts.mini) {
            this.opts.mini.removeEventListener('pointerdown', this._boundDown);
            this.opts.mini.removeEventListener('pointerleave', this._boundLeave);
        }
    }

    /**
     * @param {number} ox
     * @param {number} oy
     */
    _inPlot(ox, oy) {
        const L = this.opts.getLayout();
        return (
            ox >= L.plotLeft &&
            ox <= L.plotLeft + L.plotWidth &&
            oy >= L.plotTop &&
            oy <= L.plotTop + L.plotHeight
        );
    }

    /**
     * @param {number} ox
     * @param {number} oy
     */
    _inMini(ox, oy) {
        const m = this.opts.getLayout().mini;
        if (!m) return false;
        return ox >= m.x && ox <= m.x + m.w && oy >= m.y && oy <= m.y + m.h;
    }

    /** @param {WheelEvent} e */
    _onWheel(e) {
        const cfg = this.opts.getCfg();
        if (!cfg.zoom?.enabled || !cfg.zoom?.wheel) return;
        const { x: ox, y: oy } = clientToElementLocal(this.opts.overlay, e.clientX, e.clientY);
        if (!this._inPlot(ox, oy)) return;
        e.preventDefault();
        e.stopPropagation();

        const fb = this.opts.getFullBounds();
        const v = this.opts.getView();
        const L = this.opts.getLayout();
        const spanX = v.x1 - v.x0 || 1;
        const spanY = v.y1 - v.y0 || 1;
        const fx = e.deltaY < 0 ? 0.88 : 1.12;

        const relX = (ox - L.plotLeft) / L.plotWidth;
        const relY = (L.plotTop + L.plotHeight - oy) / L.plotHeight;
        const dataX = v.x0 + relX * spanX;
        const dataY = v.y0 + relY * spanY;

        let nx0 = v.x0;
        let nx1 = v.x1;
        let ny0 = v.y0;
        let ny1 = v.y1;

        if (cfg.zoom.x) {
            const nSpan = spanX * fx;
            nx0 = dataX - relX * nSpan;
            nx1 = dataX + (1 - relX) * nSpan;
        }
        if (cfg.zoom.y) {
            const nSpanY = spanY * fx;
            ny0 = dataY - relY * nSpanY;
            ny1 = dataY + (1 - relY) * nSpanY;
        }

        nx0 = clamp(nx0, fb.minX - spanX * 0.01, fb.maxX + spanX * 0.01);
        nx1 = clamp(nx1, fb.minX - spanX * 0.01, fb.maxX + spanX * 0.01);
        if (nx1 <= nx0) {
            nx1 = nx0 + (fb.maxX - fb.minX) * 0.001;
        }
        ny0 = clamp(ny0, fb.minY - 1, fb.maxY + 1);
        ny1 = clamp(ny1, fb.minY - 1, fb.maxY + 1);
        if (ny1 <= ny0) {
            ny1 = ny0 + (fb.maxY - fb.minY) * 0.001 || 1;
        }

        this.opts.setView({ x0: nx0, x1: nx1, y0: ny0, y1: ny1 });
        this.opts.onRedraw();
    }

    /** @param {PointerEvent} e */
    _onPointerDown(e) {
        const cfg = this.opts.getCfg();
        const target = /** @type {HTMLElement} */ (e.currentTarget);
        const { x: ox, y: oy } = clientToElementLocal(target, e.clientX, e.clientY);
        const isMini = this.opts.mini && target === this.opts.mini;

        if (isMini && cfg.miniMap?.enabled) {
            this._miniDrag = true;
            this._mode = 'mini';
            this._ptrId = e.pointerId;
            target.setPointerCapture(e.pointerId);
            this._captureEl = target;
            this._applyMiniPan(ox);
            return;
        }

        if (!this._inPlot(ox, oy)) {
            this._mode = 'none';
            return;
        }

        const rectEnabled =
            cfg.zoom?.dragSelect !== false && (cfg.zoom?.enabled !== false || cfg.crossFilterBrushX === true);
        const wantRect =
            rectEnabled &&
            (e.shiftKey ||
                e.button === 1 ||
                (e.button === 0 && e.altKey) ||
                cfg.pan?.enabled === false);

        if (wantRect) {
            this._mode = 'rect';
            this._ptrId = e.pointerId;
            this.opts.overlay.setPointerCapture(e.pointerId);
            this._captureEl = this.opts.overlay;
            this._rectByShift = !!e.shiftKey;
            this._startClient = { x: ox, y: oy };
            this.zoomRect = { x: ox, y: oy, w: 0, h: 0 };
            return;
        }

        if (cfg.pan?.enabled !== false) {
            this._mode = 'pending-pan';
            this._ptrId = e.pointerId;
            this._startLocal = { x: ox, y: oy };
            this._startView = { ...this.opts.getView() };
        }
    }

    /**
     * @param {number} ox
     * @param {number} oy
     * @param {number} clientX
     * @param {number} clientY
     */
    _updateHover(ox, oy, clientX, clientY) {
        if (!this._inPlot(ox, oy)) {
            this.opts.onHover?.(null, clientX, clientY);
            return;
        }
        let hit = null;
        if (typeof this.opts.pickNearestByPlot === 'function') {
            hit = this.opts.pickNearestByPlot(ox, oy);
        } else if (typeof this.opts.findNearestByDataX === 'function') {
            const v = this.opts.getView();
            const L = this.opts.getLayout();
            const relX = (ox - L.plotLeft) / L.plotWidth;
            const dataX = v.x0 + relX * (v.x1 - v.x0);
            hit = this.opts.findNearestByDataX(dataX);
        }
        this.opts.onHover?.(hit, clientX, clientY);
    }

    /**
     * @param {number} ox - overlay x
     */
    _applyMiniPan(ox) {
        const cfg = this.opts.getCfg();
        if (!cfg.miniMap?.enabled) return;
        const fb = this.opts.getFullBounds();
        const v = this.opts.getView();
        const L = this.opts.getLayout();
        const mini = L.mini;
        if (!mini) return;
        const pad = 4;
        const innerW = mini.w - pad * 2;
        const spanX = fb.maxX - fb.minX || 1;
        const rel = clamp((ox - mini.x - pad) / innerW, 0, 1);
        const center = fb.minX + rel * spanX;
        const half = (v.x1 - v.x0) / 2;
        let x0 = center - half;
        let x1 = center + half;
        if (x0 < fb.minX) {
            x1 += fb.minX - x0;
            x0 = fb.minX;
        }
        if (x1 > fb.maxX) {
            x0 -= x1 - fb.maxX;
            x1 = fb.maxX;
        }
        this.opts.setView({ x0, x1 });
        this.opts.onRedraw();
    }

    /** @param {PointerEvent} e */
    _onPointerMove(e) {
        const { x: ox, y: oy } = clientToElementLocal(this.opts.overlay, e.clientX, e.clientY);
        const cfg = this.opts.getCfg();

        if (this._mode === 'mini' && this._miniDrag && e.pointerId === this._ptrId && this.opts.mini) {
            const { x: mox } = clientToElementLocal(this.opts.mini, e.clientX, e.clientY);
            this._applyMiniPan(mox);
            return;
        }

        if (this._mode === 'rect' && e.pointerId === this._ptrId && this.zoomRect) {
            this.zoomRect.w = ox - this._startClient.x;
            this.zoomRect.h = oy - this._startClient.y;
            this.zoomRect.x = this._startClient.x + Math.min(0, this.zoomRect.w);
            this.zoomRect.y = this._startClient.y + Math.min(0, this.zoomRect.h);
            this.zoomRect.w = Math.abs(this.zoomRect.w);
            this.zoomRect.h = Math.abs(this.zoomRect.h);
            this.opts.onRedraw();
            return;
        }

        if (this._mode === 'pending-pan' && e.pointerId === this._ptrId) {
            const dx = ox - this._startLocal.x;
            const dy = oy - this._startLocal.y;
            if (Math.hypot(dx, dy) >= this._panDragThreshold) {
                this._mode = 'pan';
                this.opts.overlay.setPointerCapture(e.pointerId);
                this._captureEl = this.opts.overlay;
            } else if (e.buttons === 0) {
                this._mode = 'none';
                this._ptrId = null;
                this._updateHover(ox, oy, e.clientX, e.clientY);
                return;
            } else {
                this._updateHover(ox, oy, e.clientX, e.clientY);
                return;
            }
        }

        if (this._mode === 'pan' && e.pointerId === this._ptrId) {
            const v = this._startView;
            const L = this.opts.getLayout();
            const dx = ox - this._startLocal.x;
            const dy = oy - this._startLocal.y;
            const spanX = v.x1 - v.x0;
            const spanY = v.y1 - v.y0;
            const dataDx = (-dx / L.plotWidth) * spanX;
            const dataDy = (dy / L.plotHeight) * spanY;
            let x0 = v.x0 + dataDx;
            let x1 = v.x1 + dataDx;
            let y0 = v.y0 + dataDy;
            let y1 = v.y1 + dataDy;
            const fb = this.opts.getFullBounds();
            x0 = clamp(x0, fb.minX - spanX, fb.maxX + spanX);
            x1 = clamp(x1, fb.minX - spanX, fb.maxX + spanX);
            y0 = clamp(y0, fb.minY - spanY, fb.maxY + spanY);
            y1 = clamp(y1, fb.minY - spanY, fb.maxY + spanY);
            this.opts.setView({ x0, x1, y0, y1 });
            this.opts.onRedraw();
            return;
        }

        if (this._mode === 'none' && e.buttons === 0) {
            this._updateHover(ox, oy, e.clientX, e.clientY);
        }
    }

    /** @param {PointerEvent} e */
    _onPointerUp(e) {
        if (e.pointerId !== this._ptrId) return;
        const cap = this._captureEl || this.opts.overlay;
        try {
            cap.releasePointerCapture(e.pointerId);
        } catch {
            /* ignore */
        }
        this._captureEl = null;

        if (this._mode === 'rect' && this.zoomRect) {
            const cfg = this.opts.getCfg();
            const L = this.opts.getLayout();
            const v = this.opts.getView();
            const z = this.zoomRect;
            const hasXRect = z.w > 4;
            const hasYRect = z.h > 4;
            const wantsBrushX = cfg.crossFilterBrushX;
            const canApply =
                (wantsBrushX && hasXRect) ||
                (cfg.zoom?.x && hasXRect) ||
                (cfg.zoom?.y && hasYRect);
            if (!canApply) {
                this._mode = 'none';
                this._ptrId = null;
                this._rectByShift = false;
                this._miniDrag = false;
                this.zoomRect = null;
                this.opts.onRedraw();
                return;
            }
            const xData0 = v.x0 + ((z.x - L.plotLeft) / L.plotWidth) * (v.x1 - v.x0);
            const xData1 = v.x0 + ((z.x + z.w - L.plotLeft) / L.plotWidth) * (v.x1 - v.x0);
            const yData1 = v.y0 + ((L.plotTop + L.plotHeight - z.y) / L.plotHeight) * (v.y1 - v.y0);
            const yData0 = v.y0 + ((L.plotTop + L.plotHeight - (z.y + z.h)) / L.plotHeight) * (v.y1 - v.y0);
            const xa = Math.min(xData0, xData1);
            const xb = Math.max(xData0, xData1);
            let brushHandledX = false;
            if (
                cfg.crossFilterBrushX &&
                typeof this.opts.onBrushXRange === 'function' &&
                hasXRect &&
                xb > xa
            ) {
                brushHandledX = !!this.opts.onBrushXRange({ xMin: xa, xMax: xb });
            }
            if (cfg.zoom?.x && hasXRect && !brushHandledX) {
                const a = xa;
                const b = xb;
                if (b > a) this.opts.setView({ x0: a, x1: b });
            }
            if (cfg.zoom?.y && hasYRect) {
                const a = Math.min(yData0, yData1);
                const b = Math.max(yData0, yData1);
                if (b > a) this.opts.setView({ y0: a, y1: b });
            }
        }

        this._mode = 'none';
        this._ptrId = null;
        this._rectByShift = false;
        this._miniDrag = false;
        this.zoomRect = null;
        this.opts.onRedraw();
    }

    /** @param {PointerEvent} e */
    _onPointerLeave(e) {
        if (this._mode === 'none' || this._mode === 'pending-pan') {
            this.opts.onHover?.(null, e.clientX, e.clientY);
        }
    }

    _onDblClick() {
        const cfg = this.opts.getCfg();
        if (!cfg.zoom?.doubleClickReset) return;
        const fb = this.opts.getFullBounds();
        this.opts.setView({
            x0: fb.minX,
            x1: fb.maxX,
            y0: fb.minY,
            y1: fb.maxY,
        });
        this.opts.onRedraw();
    }
}
