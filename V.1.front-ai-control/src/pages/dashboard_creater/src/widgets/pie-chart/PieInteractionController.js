/**
 * Подсветка сегментов / легенды, hover-анимация, клик по легенде и сегменту.
 * Выделение по клику (staging фильтра) сохраняется до повторного клика / сброса.
 */

import { buildCenterHoverLabel } from './pieChartCenterUtils.js';

export class PieInteractionController {
    /**
     * @param {object} opts
     * @param {Array<{ orderIndex: number, group: SVGGElement, hoverWrap?: SVGGElement, item: object, share: number }>} opts.sliceMetas
     * @param {HTMLElement|null} opts.legendEl
     * @param {object} opts.cfg
     * @param {object} opts.model
     * @param {object|null} opts.centerTextEl
     * @param {{ cx: number, cy: number, sumVal: number }|null} opts.centerMetric
     * @param {SVGGElement|null} [opts.rotatingG] — group with slices+labels (center stays outside)
     * @param {SVGSVGElement|null} [opts.svg]
     * @param {number} [opts.initialRotationDeg]
     * @param {(deg: number) => void} [opts.onRotationChange]
     * @param {function(number): void} [opts.onToggleHidden] — Alt+клик по легенде: косметическое скрытие сегмента
     * @param {function(number): void} [opts.onLegendPrimaryClick] — обычный клик по легенде (фильтр данных)
     * @param {function(number): void} [opts.onSliceClick] — клик по сегменту (staging на круговой)
     * @param {Iterable<number>} [opts.selectedOrderIndices] — начальное выделение (staging)
     */
    constructor(opts) {
        this.cfg = opts.cfg;
        this.model = opts.model;
        this.centerTextEl = opts.centerTextEl;
        this.centerMetric = opts.centerMetric;
        this.rotatingG = opts.rotatingG || null;
        this.svg = opts.svg || this.rotatingG?.ownerSVGElement || null;
        this.onToggleHidden = opts.onToggleHidden;
        this.onLegendPrimaryClick = opts.onLegendPrimaryClick;
        this.onSliceClick = opts.onSliceClick;
        this.onRotationChange = opts.onRotationChange;
        this._dead = false;

        this.sliceMetas = opts.sliceMetas || [];
        /** @type {Map<number, object>} */
        this.metaByIndex = new Map(this.sliceMetas.map((m) => [m.orderIndex, m]));
        this.legendRoot = opts.legendEl;
        this._hoverIdx = null;
        /** @type {Set<number>} */
        this._selected = new Set();
        this._listeners = [];
        this._rotationDeg = Number.isFinite(Number(opts.initialRotationDeg))
            ? Number(opts.initialRotationDeg)
            : 0;
        this._dragRotate = null;
        this._suppressSliceClick = false;

        this._bindSlices();
        this._bindLegend();
        this._bindRotation();
        this._applyRotationTransform();
        if (opts.selectedOrderIndices) {
            this.setSelectedOrderIndices(opts.selectedOrderIndices);
        }
    }

    /**
     * Синхронизировать визуальное выделение с staging / фильтром.
     * @param {Iterable<number>|null|undefined} indices
     */
    setSelectedOrderIndices(indices) {
        if (this._dead) return;
        const next = new Set();
        for (const raw of indices || []) {
            const n = parseInt(/** @type {any} */ (raw), 10);
            if (!Number.isNaN(n)) next.add(n);
        }
        this._selected = next;
        for (const meta of this.sliceMetas) {
            this._applySliceVisual(meta.orderIndex);
        }
    }

    _bindSlices() {
        this.sliceMetas.forEach((meta) => {
            const g = meta.group;
            if (!g) return;
            const enter = () => this._onSliceEnter(meta);
            const leave = () => this._onSliceLeave(meta.orderIndex);
            g.addEventListener('mouseenter', enter);
            g.addEventListener('mouseleave', leave);
            const onClick =
                typeof this.onSliceClick === 'function'
                    ? (e) => {
                        if (this._suppressSliceClick) {
                            this._suppressSliceClick = false;
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                        }
                        e.stopPropagation();
                        this.onSliceClick(meta.orderIndex);
                    }
                    : null;
            if (onClick) g.addEventListener('click', onClick);
            this._listeners.push(() => {
                g.removeEventListener('mouseenter', enter);
                g.removeEventListener('mouseleave', leave);
                if (onClick) g.removeEventListener('click', onClick);
            });
        });
    }

    _bindLegend() {
        if (!this.legendRoot || !this.cfg.legend.interactive) return;
        const list = this.legendRoot.querySelector('.pie-legend-list');
        if (!list) return;

        const onClick = (e) => {
            if (e.target.closest('.pie-legend-search')) return;
            const btn = e.target.closest('.pie-legend-row');
            if (!btn || btn.disabled) return;
            const idx = parseInt(btn.dataset.orderIndex, 10);
            if (Number.isNaN(idx)) return;
            if (e.altKey && typeof this.onToggleHidden === 'function') {
                this.onToggleHidden(idx);
            } else if (typeof this.onLegendPrimaryClick === 'function') {
                this.onLegendPrimaryClick(idx);
            }
        };
        list.addEventListener('click', onClick);

        const delegateHover = (e) => {
            if (e.target.closest('.pie-legend-search')) return;
            const btn = e.target.closest('.pie-legend-row');
            if (!btn || btn.disabled) return;
            const idx = parseInt(btn.dataset.orderIndex, 10);
            if (Number.isNaN(idx)) return;
            if (e.type === 'mouseenter') {
                this._hoverIdx = idx;
                this._applySliceVisual(idx);
                this._highlightLegendRow(idx, true);
            } else {
                if (this._hoverIdx === idx) this._hoverIdx = null;
                this._applySliceVisual(idx);
                this._highlightLegendRow(idx, false);
            }
        };
        list.addEventListener('mouseenter', delegateHover, true);
        list.addEventListener('mouseleave', delegateHover, true);

        this._listeners.push(() => {
            list.removeEventListener('click', onClick);
            list.removeEventListener('mouseenter', delegateHover, true);
            list.removeEventListener('mouseleave', delegateHover, true);
        });
    }

    _onSliceEnter(meta) {
        if (this._dead) return;
        this._hoverIdx = meta.orderIndex;
        this._applySliceVisual(meta.orderIndex);
        this._highlightLegendRow(meta.orderIndex, true);
        this._updateCenterHover(meta);
    }

    _onSliceLeave(orderIndex) {
        if (this._dead) return;
        if (this._hoverIdx === orderIndex) this._hoverIdx = null;
        this._applySliceVisual(orderIndex);
        this._highlightLegendRow(orderIndex, false);
        this._clearCenterHover();
    }

    /**
     * Обновить CSS/transform сектора с учётом hover и selected.
     * @param {number} orderIndex
     */
    _applySliceVisual(orderIndex) {
        const meta = this.metaByIndex.get(orderIndex);
        if (!meta?.group) return;
        const hovered = this._hoverIdx === orderIndex;
        const selected = this._selected.has(orderIndex);
        meta.group.classList.toggle('is-hovered', hovered);
        meta.group.classList.toggle('is-selected', selected);
        const { cx, cy } = this.centerMetric || {};
        const hw = meta.hoverWrap;
        if (hw && cx != null && cy != null) {
            if (hovered || selected) {
                const scale = hovered && selected ? 1.08 : 1.06;
                hw.setAttribute('transform', `translate(${cx},${cy}) scale(${scale}) translate(${-cx},${-cy})`);
            } else {
                hw.removeAttribute('transform');
            }
        }
        const row = this.legendRoot?.querySelector(`.pie-legend-row[data-order-index="${orderIndex}"]`);
        if (row) {
            row.classList.toggle('pie-legend-row--selected', selected);
        }
    }

    _highlightLegendRow(orderIndex, on) {
        if (!this.legendRoot) return;
        const row = this.legendRoot.querySelector(`.pie-legend-row[data-order-index="${orderIndex}"]`);
        if (row) row.classList.toggle('pie-legend-row--hover', on);
    }

    _updateCenterHover(meta) {
        if (!this.centerTextEl || !this.cfg.donut || !this.cfg.center.enabled) return;
        if (this.cfg.center.mode !== 'hover') return;
        if (!meta?.item) return;
        const stats = this.centerMetric?.stats;
        if (!stats) return;
        this.centerTextEl.textContent = buildCenterHoverLabel(
            this.cfg,
            meta.item,
            meta.share,
            this.model.total,
            stats,
            this.centerMetric?.centerMeasureValue,
        );
    }

    _clearCenterHover() {
        if (!this.centerTextEl || !this.cfg.donut || !this.cfg.center.enabled) return;
        if (this.cfg.center.mode !== 'hover') return;
        const fn = this.centerMetric?.getCenterText;
        if (typeof fn === 'function') this.centerTextEl.textContent = fn();
    }

    _applyRotationTransform() {
        if (!this.rotatingG) return;
        const { cx, cy } = this.centerMetric || {};
        if (cx == null || cy == null) return;
        this.rotatingG.setAttribute('transform', `rotate(${this._rotationDeg} ${cx} ${cy})`);
        // Keep segment labels upright: counter-rotate around each label's own center
        this.rotatingG.querySelectorAll('.pie-label-wrap').forEach((wrap) => {
            const lx = wrap.getAttribute('data-label-x') ?? wrap.dataset.labelX;
            const ly = wrap.getAttribute('data-label-y') ?? wrap.dataset.labelY;
            if (lx == null || ly == null) return;
            wrap.setAttribute('transform', `translate(${lx},${ly}) rotate(${-this._rotationDeg})`);
        });
    }

    _setRotation(deg, { emit = true } = {}) {
        this._rotationDeg = ((deg % 360) + 360) % 360;
        if (this._rotationDeg > 180) this._rotationDeg -= 360;
        this._applyRotationTransform();
        if (emit && typeof this.onRotationChange === 'function') {
            this.onRotationChange(this._rotationDeg);
        }
    }

    _bindRotation() {
        const host = this.svg;
        if (!host || !this.rotatingG) return;

        const onWheel = (e) => {
            if (this._dead) return;
            // Don't steal scroll from legend list
            if (e.target instanceof Element && e.target.closest('.pie-legend-scroll, .pie-legend-list')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            const step = e.deltaY > 0 ? 10 : -10;
            this._setRotation(this._rotationDeg + step);
        };
        host.addEventListener('wheel', onWheel, { passive: false });
        this._listeners.push(() => host.removeEventListener('wheel', onWheel));

        const onPointerDown = (e) => {
            if (this._dead || e.button !== 0) return;
            if (
                e.target instanceof Element &&
                e.target.closest('.pie-legend-scroll, .pie-legend-list, .pie-staging-top, .filter-confirm-btn')
            ) {
                return;
            }
            e.stopPropagation();
            this._dragRotate = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                startDeg: this._rotationDeg,
                moved: false,
            };
            // Capture only after the drag threshold — otherwise click never reaches slices.
        };
        const onPointerMove = (e) => {
            if (!this._dragRotate || this._dragRotate.pointerId !== e.pointerId) return;
            const dx = e.clientX - this._dragRotate.startX;
            const dy = e.clientY - this._dragRotate.startY;
            if (!this._dragRotate.moved && Math.hypot(dx, dy) < 4) return;
            if (!this._dragRotate.moved) {
                this._dragRotate.moved = true;
                try {
                    host.setPointerCapture(e.pointerId);
                } catch {
                    /* ignore */
                }
            }
            e.preventDefault();
            e.stopPropagation();
            this._setRotation(this._dragRotate.startDeg + dx * 0.45, { emit: false });
        };
        const onPointerUp = (e) => {
            if (!this._dragRotate || this._dragRotate.pointerId !== e.pointerId) return;
            const moved = this._dragRotate.moved;
            if (moved) {
                this._suppressSliceClick = true;
                if (typeof this.onRotationChange === 'function') {
                    this.onRotationChange(this._rotationDeg);
                }
                try {
                    host.releasePointerCapture(e.pointerId);
                } catch {
                    /* ignore */
                }
            }
            this._dragRotate = null;
        };

        host.addEventListener('pointerdown', onPointerDown);
        host.addEventListener('pointermove', onPointerMove);
        host.addEventListener('pointerup', onPointerUp);
        host.addEventListener('pointercancel', onPointerUp);
        this._listeners.push(() => {
            host.removeEventListener('pointerdown', onPointerDown);
            host.removeEventListener('pointermove', onPointerMove);
            host.removeEventListener('pointerup', onPointerUp);
            host.removeEventListener('pointercancel', onPointerUp);
        });
    }

    destroy() {
        if (this._dead) return;
        this._dead = true;
        this._dragRotate = null;
        this._listeners.forEach((fn) => fn());
        this._listeners = [];
    }
}
