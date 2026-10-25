import { WidgetBase } from '../core/WidgetBase.js';
import { eventBus } from '../core/EventBus.js';
import { getDashboardDataModelClient } from '../../../../services/dashboardDataModel/DashboardDataModelClient.js';
import { collectDashboardFilters, filtersForModel } from '../../../../services/dashboardFilterUtils.js';
import { hasDataBinding, renderWidgetDataPlaceholder } from '../core/widgetDataBinding.js';
import { normalizeLineConfig } from './line-chart/lineChartConfig.js';
import { aggregateLineChartData } from './line-chart/lineChartAggregate.js';
import {
    resolveActiveTimeframe,
    parseCustomTimeframeInput,
    decodeTimeframeSlot,
    formatTimeframeSlotLabel,
    isTimeframeSlotActive,
} from './line-chart/lineChartTimeframe.js';
import {
    createLinearScale,
    inferXType,
    niceTicks,
    parseXToNumber,
    formatDateByPattern,
    formatTimeAuto,
} from './line-chart/lineChartScales.js';
import { downsampleForViewport } from './line-chart/lineChartLOD.js';
import { createDashWidgetHeadingElement } from './common/widgetTitle.js';
import {
    drawGrid,
    drawAxes,
    drawLine,
    drawPoints,
    drawValueLabels,
    drawMiniMap,
    drawZoomRect,
    drawHoverCrosshair,
    drawHoverTooltip,
    drawBand,
    drawReferenceLines,
    referenceLineYValues,
    drawStatsOverlays,
    drawAnomalyMarkers,
    formatLineChartTooltipDateStr,
    formatLineChartTooltipValueStr,
} from './line-chart/LineChartRenderer.js';
import { LineChartInteractionController } from './line-chart/LineChartInteractionController.js';
import { resolveKpiDataSourceFromFormula } from '../formula/formulaInference.js';
import { runNamedFormulaBundle } from '../formula/widgetFormulaRuntime.js';
import { resolveChartDimension, resolveChartMeasure, mergeChartMeasureFilters } from './common/chartBindingFormula.js';
import {
    buildSortedSeries,
    fullBoundsFromMultiSeries,
    listBindingMeasures,
    resolveLineMeasures,
    mergeSeriesRowsByX,
    LINE_CHART_MAX_VISIBLE_SERIES,
    LINE_SERIES_PALETTE,
    ensureBindingMeasures,
} from './line-chart/lineChartSeries.js';
import {
    buildDerivedSeries,
    viewportStats,
    pctChangeVsPrev,
    detectAnomalies,
    expandViewForForecast,
} from './line-chart/lineChartAnalytics.js';
import {
    collectReferenceNamedFormulas,
    applyResolvedReferenceFormulas,
    normalizeLineReferences,
} from './line-chart/lineChartReferenceFormula.js';
import { defaultTextColor, defaultFontFamily } from '../theme/themeRuntime.js';

/** Совпадает с MAX_ROWS в sqlite_dashboard_query.py */
const LINE_CHART_QUERY_MAX = 5000;

function escXml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fullBoundsFromSeries(pts) {
    return fullBoundsFromMultiSeries([{ kind: 'raw', visible: true, points: pts }]);
}

/**
 * @param {{ x: number; y: number; idx: number; rawX?: unknown }[]} sorted
 * @param {number} x0
 * @param {number} x1
 */
function sliceByX(sorted, x0, x1) {
    const lo = sorted.findIndex((p) => p.x >= x0);
    let hi = -1;
    for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].x <= x1) {
            hi = i;
            break;
        }
    }
    if (lo < 0 || hi < lo) return [];
    return sorted.slice(lo, hi + 1);
}

/**
 * @param {{ minX: number; maxX: number; minY: number; maxY: number }} fb
 * @param {'start'|'end'} anchor
 * @param {number} initialSpan 0.1..1
 */
function computeInitialViewFromDataWindow(fb, anchor, initialSpan) {
    const span = Math.max(fb.maxX - fb.minX, 1e-12);
    const frac = Math.min(1, Math.max(0.1, initialSpan));
    if (frac >= 1 - 1e-12) {
        return { x0: fb.minX, x1: fb.maxX, y0: fb.minY, y1: fb.maxY };
    }
    const w = frac * span;
    if (anchor === 'end') {
        return { x0: fb.maxX - w, x1: fb.maxX, y0: fb.minY, y1: fb.maxY };
    }
    return { x0: fb.minX, x1: fb.minX + w, y0: fb.minY, y1: fb.maxY };
}

/**
 * Линейный график: Canvas2D, zoom/pan, LOD, mini-map.
 */
export class LineChartWidget extends WidgetBase {
    constructor(config = {}) {
        super({
            ...config,
            type: 'line-chart',
            width: config.width || 500,
            height: config.height || 300,
        });

        this.settings = normalizeLineConfig({
            data: config.settings?.data || [],
            xField: config.settings?.xField || 'x',
            yField: config.settings?.yField || 'y',
            ...config.settings,
        });

        /** @type {LineChartInteractionController | null} */
        this._lineController = null;
        /** @type {ResizeObserver | null} */
        this._lineResizeObserver = null;
        this._lineRaf = null;
        /** @type {{ main: boolean; overlay: boolean; mini: boolean }} */
        this._lineDirty = { main: true, overlay: true, mini: true };
        this._dpr = 1;

        /** @type {{ x0: number; x1: number; y0: number; y1: number } | null} */
        this._view = null;
        /** Primary series points (first visible raw) — pan/brush/hover X index space. */
        /** @type {{ x: number; y: number; idx: number; rawX?: unknown }[]} */
        this._sorted = [];
        /** @type {object[]} */
        this._seriesList = [];
        /** @type {object[]} */
        this._anomalies = [];
        /** @type {'time'|'linear'|'category'} */
        this._xType = 'linear';
        /** @type {number | null} */
        this._hoverIdx = null;
        /** Центры точек в последней отрисовке (для попадания курсора по пикселям). */
        this._lineHoverPick = null;

        /** @type {HTMLCanvasElement | null} */
        this._canvasMain = null;
        /** @type {HTMLCanvasElement | null} */
        this._canvasOverlay = null;
        /** @type {HTMLCanvasElement | null} */
        this._canvasMini = null;
        /** @type {HTMLElement | null} */
        this._lineRoot = null;

        /** @type {object | null} */
        this._dashboardEngine = null;
        /** @type {{ canOlder: boolean; canNewer: boolean } | null} */
        this._lineFetch = null;
        this._lineFetchLoading = false;
        /** Разрешаем периодический дозапрос "нового хвоста" (time/timeframe режимы). */
        this._lineCanRefreshNewTail = false;
        /** Ряд уже в бакетах с SQLite (без клиентской aggregateLineChartData). */
        this._lineDataFromServerBuckets = false;
        /** @type {ReturnType<typeof setTimeout> | null} */
        this._viewportFetchTimer = null;
        /** @type {{ x0: number; x1: number; y0: number; y1: number } | null} */
        this._lineRestoreViewAfterData = null;

        /** @type {{ key: string, rows: Record<string, unknown>[] } | null} */
        this._lineAggCache = null;
        /** @type {ReturnType<typeof setTimeout> | null} */
        this._lineTfDebounceTimer = null;
        /** Пользователь менял таймфрейм с панели графика / синхронизация (отключает autoSuggest). */
        this._lineUserTfOverride = false;
        /** Инкремент при каждом reloadFromDataModel — отбрасывает устаревшие async-ответы при быстрой смене таймфрейма. */
        this._lineReloadGeneration = 0;
        /** Сколько раз подряд AbortError на reload — ограничиваем ретраи. */
        this._lineAbortRetries = 0;
        /** @type {(() => void) | null} */
        this._lineTfSyncUnsub = eventBus.on('line-chart:timeframe-sync', (p) => this._onLineTimeframeSync(p));
        /** Перерисовка полосы таймфрейма при переключении editor/viewer (DnD только в редакторе). */
        this._lineModeUnsub = eventBus.on('mode:changed', () => {
            if (normalizeLineConfig(this.settings).timeframe?.enabled) this.update();
        });
    }

    /** Порядок кнопок таймфрейма можно менять перетаскиванием только в режиме редактирования дашборда. */
    _lineTfReorderAllowed() {
        return typeof window !== 'undefined' && window.engine?.mode === 'editor';
    }

    _lineTeardown() {
        if (this._lineTfDebounceTimer != null) {
            clearTimeout(this._lineTfDebounceTimer);
            this._lineTfDebounceTimer = null;
        }
        if (this._viewportFetchTimer != null) {
            clearTimeout(this._viewportFetchTimer);
            this._viewportFetchTimer = null;
        }
        if (this._lineController) {
            this._lineController.destroy();
            this._lineController = null;
        }
        if (this._lineResizeObserver) {
            this._lineResizeObserver.disconnect();
            this._lineResizeObserver = null;
        }
        if (this._lineRaf) {
            cancelAnimationFrame(this._lineRaf);
            this._lineRaf = null;
        }
        this._lineHoverPick = null;
    }

    /**
     * @param {{ idx: number; x: number; y: number; rawX?: unknown }} h
     * @param {ReturnType<typeof normalizeLineConfig>} cfg
     * @returns {string[]}
     */
    _buildLineTooltipLines(h, cfg) {
        const span =
            this._sorted.length >= 2
                ? Math.abs(this._sorted[this._sorted.length - 1].x - this._sorted[0].x)
                : 1;
        const tfFmt = String(cfg.tooltip?.format || 'auto').toLowerCase();
        const hasCustomTpl = !!(cfg.tooltip?.customFormat && String(cfg.tooltip.customFormat).trim());
        if (tfFmt === 'custom' && hasCustomTpl) {
            return [formatLineChartTooltipValueStr(h, cfg, this._xType)];
        }
        const dateStr = formatLineChartTooltipDateStr(h, cfg, this._xType, span);
        /** @type {string[]} */
        const lines = [String(dateStr)];
        const rawSeries = (this._seriesList || []).filter((s) => s.kind === 'raw' && s.visible !== false);
        const seriesForTip = rawSeries.length ? rawSeries : [{ id: 'main', label: 'Значение', points: this._sorted, color: cfg.line.color }];
        for (const s of seriesForTip) {
            const pts = s.points || [];
            if (!pts.length) continue;
            let best = pts[0];
            let bestD = Math.abs(best.x - h.x);
            for (let i = 1; i < pts.length; i++) {
                const d = Math.abs(pts[i].x - h.x);
                if (d < bestD) {
                    best = pts[i];
                    bestD = d;
                }
            }
            if (cfg.tooltip?.showValue !== false) {
                const val = formatLineChartTooltipValueStr(best, { ...cfg, line: { ...cfg.line, color: s.color } }, this._xType);
                lines.push(`${s.label}: ${val}`);
            }
            if (cfg.tooltip?.showPctChange !== false) {
                const pct = pctChangeVsPrev(pts, best);
                if (pct != null && Number.isFinite(pct)) {
                    const sign = pct > 0 ? '+' : '';
                    lines.push(`Δ ${s.label}: ${sign}${pct.toFixed(1)}%`);
                }
            }
        }
        const extras = Array.isArray(cfg.tooltip?.extraFields) ? cfg.tooltip.extraFields : [];
        const row = h.row || (this.settings.data || [])[h.idx];
        if (row && extras.length) {
            for (const f of extras) {
                if (row[f] != null && row[f] !== '') lines.push(`${f}: ${row[f]}`);
            }
        }
        if (this._anomalies?.length) {
            const hit = this._anomalies.find((a) => a.point && Math.abs(a.point.x - h.x) < 1e-9);
            if (hit) {
                lines.push('⚠ Аномалия');
                lines.push(`Ожидаемое: ~${Number(hit.expected).toFixed(2)}`);
                lines.push(`Отклонение: ${hit.pct > 0 ? '+' : ''}${hit.pct.toFixed(1)}%`);
            }
        }
        return lines;
    }

    _scheduleLineDraw() {
        if (this._lineRaf != null) return;
        this._lineRaf = requestAnimationFrame(() => {
            this._lineRaf = null;
            this._lineDrawFrame();
        });
    }

    getWidgetColorFormulaMap() {
        const s = this.settings || {};
        /** @type {Record<string, { hex?: string, formula?: string }>} */
        const map = {
            titleColor: { hex: s.titleColor, formula: s.titleColorFormula },
            pointColor: {
                hex: s.points?.color || s.pointColor,
                formula: s.pointColorFormula || s.points?.colorFormula,
            },
            gridColor: {
                hex: s.grid?.color || s.gridColor,
                formula: s.gridColorFormula || s.grid?.colorFormula,
            },
            refColor: { hex: s.refColor, formula: s.refColorFormula },
            lineThresholdHighColor: {
                hex: s.lineThresholdHighColor,
                formula: s.lineThresholdHighColorFormula,
            },
            lineThresholdLowColor: {
                hex: s.lineThresholdLowColor,
                formula: s.lineThresholdLowColorFormula,
            },
        };
        const measures = Array.isArray(s.bindingMeasures)
            ? s.bindingMeasures
            : s.bindingMeasure
              ? [s.bindingMeasure]
              : [];
        measures.forEach((m, i) => {
            map[`series_${i}_color`] = { hex: m?.color, formula: m?.colorFormula };
            if (m?.gradient) {
                map[`series_${i}_gradFrom`] = {
                    hex: m.gradient.from,
                    formula: m.gradient.fromFormula,
                };
                map[`series_${i}_gradTo`] = {
                    hex: m.gradient.to,
                    formula: m.gradient.toFormula,
                };
            }
        });
        return map;
    }

    _getCfg() {
        const cfg = normalizeLineConfig(this.settings);
        const r = this._resolvedWidgetColors || {};
        if (r.titleColor) cfg.titleColor = r.titleColor;
        if (r.pointColor) cfg.points = { ...cfg.points, color: r.pointColor };
        if (r.gridColor) cfg.grid = { ...cfg.grid, color: r.gridColor };
        if (r.lineThresholdHighColor) cfg.lineThresholdHighColor = r.lineThresholdHighColor;
        if (r.lineThresholdLowColor) cfg.lineThresholdLowColor = r.lineThresholdLowColor;
        if (r.refColor && Array.isArray(cfg.references)) {
            cfg.references = cfg.references.map((ref) =>
                ref && !ref.colorFormula ? { ...ref, color: ref.color || r.refColor } : ref,
            );
        }
        const measures = Array.isArray(this.settings?.bindingMeasures)
            ? this.settings.bindingMeasures
            : [];
        if (measures.length && cfg.line) {
            const c0 = r.series_0_color;
            if (c0) cfg.line = { ...cfg.line, color: c0 };
        }
        return cfg;
    }

    _ensureView(fb) {
        if (!this._view) {
            this._view = { x0: fb.minX, x1: fb.maxX, y0: fb.minY, y1: fb.maxY };
        }
    }

    /**
     * Ближайшая точка ряда по оси X (вертикальный snap) в координатах overlay.
     * Tooltip показывается при наведении на область графика, а не только «в точку».
     * @param {number} ox
     * @param {number} [_oy]
     */
    _linePickNearestByPlot(ox, _oy) {
        const pick = this._lineHoverPick;
        if (!pick?.points?.length || !pick.scaleX) return null;
        const arr = pick.points;
        const dataX = pick.scaleX.fromPx(ox);
        let lo = 0;
        let hi = arr.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (arr[mid].x < dataX) lo = mid + 1;
            else hi = mid;
        }
        const i = lo;
        const a = arr[Math.max(0, i - 1)];
        const b = arr[i];
        if (!a) return b || null;
        if (!b) return a;
        return Math.abs(a.x - dataX) <= Math.abs(b.x - dataX) ? a : b;
    }

    _scheduleLineDataFetch() {
        if (!this._getCfg().auto_refetch_on_pan) return;
        const eg = this._dashboardEngine;
        if (eg && (eg.__dashboardBulkReloadDepth || 0) > 0) return;
        if (this._viewportFetchTimer != null) clearTimeout(this._viewportFetchTimer);
        this._viewportFetchTimer = setTimeout(() => {
            this._viewportFetchTimer = null;
            void this._tryFetchLineDataEdges();
        }, 220);
    }

    /**
     * @param {Record<string, unknown>|undefined} dim
     */
    _isLineTimeDimension(dim) {
        const dt = String(dim?.type || '').toLowerCase();
        return dt.includes('date') || dt.includes('time') || dt === 'timestamp';
    }

    /**
     * @param {Record<string, unknown>|undefined} dim
     * @returns {'iso_text'|'unix_sec'|'unix_ms'}
     */
    _inferLineXEncoding(dim) {
        const t = String(dim?.type || '').toLowerCase();
        if (/\b(int|integer|bigint|long)\b/.test(t)) return 'unix_ms';
        return 'iso_text';
    }

    /**
     * @param {ReturnType<typeof normalizeLineConfig>} cfg
     */
    _lineWantServerBuckets(cfg) {
        const tf = cfg.timeframe;
        if (!tf?.enabled || tf.preferServerAggregation === false) return false;
        const r = resolveActiveTimeframe(tf);
        if (!r.intervalMs || r.intervalMs <= 0) return false;
        if (cfg.axis?.x?.type === 'category') return false;
        return true;
    }

    /**
     * @param {Record<string, unknown>|undefined} dim
     * @param {Record<string, unknown>|undefined} meas
     * @param {ReturnType<typeof normalizeLineConfig>} cfg
     */
    _makeLineTimeBucket(dim, meas, cfg) {
        const tf = cfg.timeframe;
        const r = resolveActiveTimeframe(tf);
        let aggregation = String(tf.aggregation || 'avg').toLowerCase();
        if (meas?.aggFn && ['sum', 'avg', 'min', 'max', 'count'].includes(String(meas.aggFn))) {
            aggregation = String(meas.aggFn).toLowerCase();
        } else if (!['sum', 'avg', 'min', 'max', 'count'].includes(aggregation)) {
            aggregation = 'avg';
        }
        const yCol = meas.field === '*' ? String(dim.field) : String(meas.field);
        return {
            x_column: String(dim.field),
            y_column: yCol,
            interval_ms: r.intervalMs,
            aggregation,
            x_encoding: this._inferLineXEncoding(dim),
        };
    }

    /**
     * @returns {{ dim: import('./common/chartBindingFormula.js').ChartResolvedBinding, meas: import('./common/chartBindingFormula.js').ChartResolvedBinding, measures: object[] } | null}
     */
    _resolveLineDimMeas() {
        ensureBindingMeasures(this.settings);
        const dim = resolveChartDimension(this.settings.bindingDimension);
        const measures = resolveLineMeasures(listBindingMeasures(this.settings));
        if (!dim?.sqlOk || !measures.length) return null;
        if (measures.some((m) => String(dim.modelId) !== String(m.resolved.modelId))) return null;
        if (!dim.field) return null;
        const meas = measures[0].resolved;
        return { dim, meas, measures };
    }

    /**
     * @param {unknown} payload
     */
    _onLineTimeframeSync(payload) {
        if (!payload || payload.sourceWidgetId === this.id) return;
        const myGid = String(this.settings.timeframe?.syncGroupId || '').trim();
        if (!myGid || myGid !== String(payload.groupId || '').trim()) return;
        if (!this.settings.timeframe) return;
        this.settings.timeframe.enabled = true;
        this.settings.timeframe.id = String(payload.id || 'raw');
        this.settings.timeframe.customIntervalMs =
            payload.customIntervalMs != null && Number.isFinite(Number(payload.customIntervalMs))
                ? Math.round(Number(payload.customIntervalMs))
                : null;
        this._lineAggCache = null;
        this._lineUserTfOverride = true;
        if (this._dashboardEngine && hasDataBinding(this) && !this.settings.bindingError) {
            void this.reloadFromDataModel(this._dashboardEngine);
        } else {
            this.update();
        }
    }

    _emitTimeframeSync() {
        const tf = this.settings.timeframe;
        const gid = String(tf?.syncGroupId || '').trim();
        if (!gid) return;
        const res = resolveActiveTimeframe(tf || {});
        eventBus.emit('line-chart:timeframe-sync', {
            groupId: gid,
            sourceWidgetId: this.id,
            id: res.id,
            customIntervalMs: res.isCustom ? res.intervalMs : null,
        });
    }

    /** @param {number} rowCount */
    _maybeAutoSuggestTimeframe(rowCount) {
        const tf = this.settings.timeframe;
        if (!tf?.enabled || !tf.autoSuggest || this._lineUserTfOverride) return;
        /** @type {string|null} */
        let pick = null;
        if (rowCount >= 4000) pick = '1h';
        else if (rowCount >= 2000) pick = '15m';
        else if (rowCount >= 800) pick = '5m';
        else if (rowCount >= 250) pick = '1m';
        if (pick) {
            tf.id = pick;
            tf.customIntervalMs = null;
        }
    }

    /**
     * @param {Function} fn
     */
    _scheduleTfBarApply(fn) {
        if (this._lineTfDebounceTimer != null) clearTimeout(this._lineTfDebounceTimer);
        this._lineTfDebounceTimer = setTimeout(() => {
            this._lineTfDebounceTimer = null;
            fn();
        }, 200);
    }

    /**
     * @param {string} id
     * @param {number|null} customIntervalMs
     */
    _applyTimeframeFromUi(id, customIntervalMs = null) {
        if (!this.settings.timeframe) return;
        this.settings.timeframe.enabled = true;
        if (id === 'custom' && customIntervalMs != null && Number.isFinite(customIntervalMs)) {
            this.settings.timeframe.id = 'custom';
            this.settings.timeframe.customIntervalMs = Math.round(customIntervalMs);
        } else {
            this.settings.timeframe.id = id;
            this.settings.timeframe.customIntervalMs = null;
        }
        this._lineUserTfOverride = true;
        this._lineAggCache = null;
        this._emitTimeframeSync();
        if (this._dashboardEngine && hasDataBinding(this) && !this.settings.bindingError) {
            void this.reloadFromDataModel(this._dashboardEngine);
        } else {
            this.update();
        }
    }

    /**
     * @param {ReturnType<typeof normalizeLineConfig>} cfg
     * @param {'time'|'linear'|'category'} xType
     */
    /**
     * @param {ReturnType<typeof normalizeLineConfig>} cfg
     * @param {'time'|'linear'|'category'} xType
     * @param {string} [yField]
     */
    _getLineWorkingData(cfg, xType, yField) {
        const data = Array.isArray(cfg.data) ? cfg.data : [];
        if (this._lineDataFromServerBuckets) return data;
        const tfCfg = cfg.timeframe;
        if (!tfCfg?.enabled || xType !== 'time') return data;
        const resolved = resolveActiveTimeframe(tfCfg);
        if (!resolved.intervalMs || resolved.intervalMs <= 0) return data;
        const xf = String(cfg.xField || 'x');
        const yf = String(yField || cfg.yField || 'y');
        const key = [
            data.length,
            resolved.id,
            resolved.intervalMs,
            String(tfCfg.aggregation || 'avg'),
            xf,
            yf,
            data.length ? String(data[0]?.[xf]) : '',
            data.length ? String(data[data.length - 1]?.[xf]) : '',
        ].join('\0');
        if (!this._lineAggCache || typeof this._lineAggCache !== 'object') this._lineAggCache = {};
        if (this._lineAggCache[key]) return this._lineAggCache[key];
        const rows = aggregateLineChartData(data, {
            xField: xf,
            yField: yf,
            intervalMs: resolved.intervalMs,
            presetId: resolved.id,
            aggregation: String(tfCfg.aggregation || 'avg'),
        });
        this._lineAggCache[key] = rows;
        return rows;
    }

    /**
     * @param {HTMLElement} shell
     * @param {HTMLElement} plotRow
     */
    _mountTimeframeBar(shell, plotRow) {
        const cfg = this._getCfg();
        const tf = cfg.timeframe;
        if (!tf?.enabled) return;

        const bar = document.createElement('div');
        bar.className = 'line-widget-timeframe-bar';
        if (String(tf.barLayout || '').toLowerCase() === 'row') {
            bar.classList.add('line-widget-timeframe-bar--row');
        } else {
            bar.classList.add('line-widget-timeframe-bar--column');
        }
        if (String(tf.barDensity || '').toLowerCase() === 'compact') {
            bar.classList.add('line-widget-timeframe-bar--compact');
        }

        const resolved = resolveActiveTimeframe(tf);
        const avail = Array.isArray(tf.availableIds) ? tf.availableIds : [];
        const reorderTf = this._lineTfReorderAllowed();
        /** @type {string|null} */
        let dragFromSlot = null;

        for (const slot of avail) {
            const dec = decodeTimeframeSlot(slot);
            if (!dec) continue;
            const row = document.createElement('div');
            row.className = 'line-widget-tf-row';
            row.draggable = reorderTf;
            row.dataset.slot = slot;

            const grip = document.createElement('span');
            grip.className = 'line-widget-tf-grip';
            grip.textContent = '⠿';
            if (reorderTf) {
                grip.title = 'Перетащить для изменения порядка';
            } else {
                grip.setAttribute('aria-hidden', 'true');
                grip.style.display = 'none';
            }

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'line-widget-tf-btn';
            if (isTimeframeSlotActive(slot, resolved)) btn.classList.add('line-widget-tf-btn--active');
            btn.textContent = formatTimeframeSlotLabel(slot);
            btn.addEventListener('click', () => {
                if (dec.kind === 'preset') {
                    this._scheduleTfBarApply(() => this._applyTimeframeFromUi(dec.id, null));
                } else {
                    this._scheduleTfBarApply(() => this._applyTimeframeFromUi('custom', dec.intervalMs));
                }
            });

            if (reorderTf) {
                row.addEventListener('dragstart', (ev) => {
                    dragFromSlot = slot;
                    row.classList.add('line-widget-tf-row--dragging');
                    try {
                        ev.dataTransfer?.setData('text/plain', slot);
                    } catch {
                        /* ignore */
                    }
                    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
                });
                row.addEventListener('dragend', () => {
                    dragFromSlot = null;
                    row.classList.remove('line-widget-tf-row--dragging');
                });
                row.addEventListener('dragover', (ev) => {
                    ev.preventDefault();
                    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
                });
                row.addEventListener('drop', (ev) => {
                    ev.preventDefault();
                    const from =
                        dragFromSlot ||
                        (() => {
                            try {
                                return ev.dataTransfer?.getData('text/plain') || '';
                            } catch {
                                return '';
                            }
                        })();
                    if (!from || from === slot) return;
                    const list = [...(Array.isArray(this.settings.timeframe?.availableIds)
                        ? this.settings.timeframe.availableIds
                        : [])].map(String);
                    const i = list.indexOf(from);
                    const j = list.indexOf(slot);
                    if (i < 0 || j < 0) return;
                    list.splice(i, 1);
                    list.splice(j, 0, from);
                    if (!this.settings.timeframe) return;
                    this.settings.timeframe.availableIds = list;
                    if (typeof window !== 'undefined' && window.engine?.saveSnapshot) window.engine.saveSnapshot();
                    this.update();
                });
            }

            row.appendChild(grip);
            row.appendChild(btn);
            bar.appendChild(row);
        }

        if (tf.allowCustom) {
            const customWrap = document.createElement('div');
            customWrap.className = 'line-widget-tf-custom';
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.className = 'line-widget-tf-custom-input';
            inp.placeholder = '7m';
            inp.title = 'Свой интервал: число + s, m, h, d, w, mo, y';
            if (resolved.isCustom) {
                const ms = resolved.intervalMs;
                if (ms % 86400000 === 0) inp.value = `${ms / 86400000}d`;
                else if (ms % 3600000 === 0) inp.value = `${ms / 3600000}h`;
                else if (ms % 60000 === 0) inp.value = `${ms / 60000}m`;
                else if (ms % 1000 === 0) inp.value = `${ms / 1000}s`;
                else inp.value = String(ms);
            }
            const applyBtn = document.createElement('button');
            applyBtn.type = 'button';
            applyBtn.className = 'line-widget-tf-custom-apply';
            applyBtn.textContent = 'Ок';
            const runCustom = () => {
                const parsed = parseCustomTimeframeInput(inp.value);
                if (parsed.error || !parsed.intervalMs) return;
                this._scheduleTfBarApply(() => this._applyTimeframeFromUi('custom', parsed.intervalMs));
            };
            applyBtn.addEventListener('click', runCustom);
            inp.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') runCustom();
            });
            customWrap.appendChild(inp);
            customWrap.appendChild(applyBtn);
            bar.appendChild(customWrap);
            if (resolved.isCustom) applyBtn.classList.add('line-widget-tf-btn--active');
        }

        shell.insertBefore(bar, plotRow);
    }

    /**
     * @param {Record<string, unknown>[]} extra
     */
    _mergeLineRowsUnique(extra) {
        const xf = this.settings.xField || 'x';
        const key = (r) => String(r?.[xf]);
        const map = new Map();
        for (const r of this.settings.data || []) {
            if (r && typeof r === 'object') map.set(key(r), { ...r });
        }
        for (const r of extra) {
            if (!r || typeof r !== 'object') continue;
            const k = key(r);
            const prev = map.get(k);
            map.set(k, prev ? { ...prev, ...r } : { ...r });
        }
        this.settings.data = Array.from(map.values());
        this._lineAggCache = null;
    }

    /**
     * Привести boundary к формату исходного X-поля (важно для line_time_bucket + text datetime).
     * @param {unknown} boundaryX
     * @param {{ x_encoding?: string|null } | null} lineBucket
     * @returns {unknown}
     */
    _lineEdgeFilterBoundaryValue(boundaryX, lineBucket) {
        if (!lineBucket) return boundaryX;
        const enc = String(lineBucket.x_encoding || '').toLowerCase();
        const xNum = parseXToNumber(boundaryX);
        if (xNum == null || !Number.isFinite(xNum)) return boundaryX;
        if (enc === 'unix_sec') return Math.floor(xNum / 1000);
        if (enc === 'unix_ms') return Math.round(xNum);
        // iso_text: gateway нормализует "T" -> " " в datetime-сравнениях
        return new Date(xNum).toISOString();
    }

    async _tryFetchLineDataEdges() {
        if (this._lineFetchLoading || this._xType === 'category') return;
        const eng = this._dashboardEngine;
        const fs = this._lineFetch;
        if (!eng || !fs || (!fs.canOlder && !fs.canNewer)) return;
        const resolved = this._resolveLineDimMeas();
        if (!resolved) return;
        const { dim, meas } = resolved;

        const sorted = this._sorted;
        if (!sorted.length || !this._view) return;

        const v = this._view;
        const span = Math.max(v.x1 - v.x0, 1e-12);
        const margin = Math.max(span * 0.08, (sorted[sorted.length - 1].x - sorted[0].x) * 0.02 || 1e-9);
        const lmin = sorted[0].x;
        const lmax = sorted[sorted.length - 1].x;

        const needOlder = fs.canOlder && v.x0 < lmin + margin;
        const needNewer = fs.canNewer && v.x1 > lmax - margin;
        if (!needOlder && !needNewer) return;

        const filters = mergeChartMeasureFilters(
            filtersForModel(collectDashboardFilters(eng), dim.modelId),
            meas,
        );
        const xField = dim.field;
        const yField = meas.field;
        const yCols = [
            ...new Set(
                (resolved.measures || [{ resolved: meas }]).map((m) => String(m.resolved?.field || yField)),
            ),
        ];

        let direction = /** @type {'older'|'newer'|null} */ (null);
        if (needOlder && needNewer) {
            direction = v.x0 - lmin < lmax - v.x1 ? 'older' : 'newer';
        } else if (needOlder) direction = 'older';
        else if (needNewer) direction = 'newer';

        if (!direction) return;

        const leftRaw = sorted[0].rawX !== undefined ? sorted[0].rawX : sorted[0].x;
        const rightRaw = sorted[sorted.length - 1].rawX !== undefined ? sorted[sorted.length - 1].rawX : sorted[sorted.length - 1].x;

        this._lineFetchLoading = true;
        try {
            const cfg = this._getCfg();
            const lineBucket = this._lineDataFromServerBuckets
                ? this._makeLineTimeBucket(dim, meas, cfg)
                : null;
            const client = getDashboardDataModelClient(eng);
            const maxBatches = 20;
            let edgeCursor = this._lineEdgeFilterBoundaryValue(direction === 'older' ? leftRaw : rightRaw, lineBucket);
            /** @type {Record<string, unknown>[]} */
            const rows = [];
            let reachedEdgeEnd = false;
            for (let i = 0; i < maxBatches; i++) {
                const q = {
                    mode: 'select',
                    base_table: dim.table,
                    filters: [
                        ...filters,
                        {
                            table: dim.table,
                            column: xField,
                            op: direction === 'older' ? 'lt' : 'gt',
                            value: edgeCursor,
                        },
                    ],
                    order_by: [{ column: xField, dir: direction === 'older' ? 'desc' : 'asc' }],
                    limit: LINE_CHART_QUERY_MAX,
                };
                if (!lineBucket) {
                    q.columns = [xField, ...yCols];
                } else {
                    q.line_time_bucket = lineBucket;
                }
                const res = await client.fetchSelect({ modelId: dim.modelId, ...q });
                let chunk = Array.isArray(res.rows) ? res.rows : [];
                if (direction === 'older') chunk = chunk.slice().reverse();
                if (!chunk.length) {
                    reachedEdgeEnd = true;
                    break;
                }
                rows.push(...chunk);
                edgeCursor = this._lineEdgeFilterBoundaryValue(
                    direction === 'older' ? chunk[0]?.[xField] : chunk[chunk.length - 1]?.[xField],
                    lineBucket,
                );
                if (chunk.length < LINE_CHART_QUERY_MAX) {
                    reachedEdgeEnd = true;
                    break;
                }
            }

            if (!rows.length) {
                if (direction === 'older') {
                    this._lineFetch.canOlder = false;
                } else if (!this._lineCanRefreshNewTail) {
                    this._lineFetch.canNewer = false;
                }
                return;
            }

            if (direction === 'older') {
                this._lineFetch.canOlder = !reachedEdgeEnd;
            } else {
                this._lineFetch.canNewer = this._lineCanRefreshNewTail || !reachedEdgeEnd;
            }

            const prevView = this._view ? { ...this._view } : null;
            this._mergeLineRowsUnique(rows);
            this._lineRestoreViewAfterData = prevView;
            this.update();
        } catch (e) {
            console.error('LineChartWidget _tryFetchLineDataEdges', e);
        } finally {
            this._lineFetchLoading = false;
        }
    }

    _lineDrawFrame() {
        const content = this.element?.querySelector('.widget-content');
        if (!content || !this._canvasMain || !this._canvasOverlay) return;

        const cfg = this._getCfg();
        const typography = this.styles?.typography || {};
        const fontFamily = typography.fontFamily || defaultFontFamily();
        const textColor = typography.color || defaultTextColor();
        const labelFs = typography.fontSize ? Math.max(10, typography.fontSize * 0.85) : 12;

        const sorted = this._sorted;
        const seriesAll = this._seriesList || [];
        const fb = fullBoundsFromMultiSeries(seriesAll.length ? seriesAll : [{ kind: 'raw', visible: true, points: sorted }]);
        this._ensureView(fb);

        const plotRow = content.querySelector('.line-widget-plot-row');
        if (!plotRow) return;

        const miniH = cfg.miniMap?.enabled ? cfg.miniMap.height : 0;
        const stackW = Math.max(80, plotRow.clientWidth || 400);
        const stackH = Math.max(60, plotRow.clientHeight || 200);

        const pad = cfg.padding || { top: 24, right: 16, bottom: 32, left: 48 };
        const plotLeft = pad.left;
        const plotTop = pad.top;
        const plotWidth = Math.max(20, stackW - pad.left - pad.right);
        const plotHeight = Math.max(20, stackH - pad.top - pad.bottom);

        const layout = { plotLeft, plotTop, plotWidth, plotHeight };

        let v = this._view || { x0: fb.minX, x1: fb.maxX, y0: fb.minY, y1: fb.maxY };
        // Recompute derived analytics for current view
        const rawOnly = seriesAll.filter((s) => s.kind === 'raw');
        const derived = buildDerivedSeries(rawOnly, cfg.analytics, v, this._xType);
        this._seriesList = [...rawOnly, ...derived];
        const seriesList = this._seriesList;

        // Forecast лежит правее данных — без расширения X viewport точки срезает sliceByX.
        const expandedFc = expandViewForForecast(v, rawOnly, derived);
        if (expandedFc.expanded) {
            v = expandedFc.view;
            this._view = { ...this._view, ...v };
        }

        const primaryRawEarly = rawOnly.find((s) => s.visible !== false) || rawOnly[0];
        const primaryStatsEarly = viewportStats(primaryRawEarly?.points || sorted, v.x0, v.x1);
        const refsForDraw =
            Array.isArray(this.settings._resolvedReferences) && this.settings._resolvedReferences.length
                ? this.settings._resolvedReferences
                : Array.isArray(cfg.references)
                  ? cfg.references
                  : [];
        const refY = referenceLineYValues(refsForDraw, {
            avg: primaryStatsEarly.avg,
            median: primaryStatsEarly.median,
        });
        if (refY.length) {
            let y0 = v.y0;
            let y1 = v.y1;
            for (const ry of refY) {
                y0 = Math.min(y0, ry);
                y1 = Math.max(y1, ry);
            }
            if (y0 !== v.y0 || y1 !== v.y1) {
                const padY = Math.max((y1 - y0) * 0.04, 1e-9);
                v = { ...v, y0: y0 - padY, y1: y1 + padY };
                this._view = { ...this._view, y0: v.y0, y1: v.y1 };
            }
        }

        const scaleX = createLinearScale([v.x0, v.x1], [plotLeft, plotLeft + plotWidth]);
        const scaleY = createLinearScale([v.y0, v.y1], [plotTop + plotHeight, plotTop]);

        const inView = sliceByX(sorted, v.x0, v.x1);
        this._lineHoverPick = {
            scaleX,
            scaleY,
            points: inView,
        };

        const lodMode = cfg.lod?.mode || 'minmax';
        const yTicks = niceTicks(v.y0, v.y1, cfg.axis.y.tickCount || 5);
        const { xTicks, xTickLabels } = this._computeXTicks(cfg, sorted, v, this._xType);

        const dpr = Math.min(2.5, window.devicePixelRatio || 1);
        this._dpr = dpr;

        const setCanvasSize = (canvas, cssW, cssH) => {
            if (!canvas) return null;
            const bw = Math.max(1, Math.floor(cssW * dpr));
            const bh = Math.max(1, Math.floor(cssH * dpr));
            if (canvas.width !== bw || canvas.height !== bh) {
                canvas.width = bw;
                canvas.height = bh;
            }
            canvas.style.width = `${cssW}px`;
            canvas.style.height = `${cssH}px`;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
            return ctx;
        };

        const ctxMain = setCanvasSize(this._canvasMain, stackW, stackH);
        const ctxOver = setCanvasSize(this._canvasOverlay, stackW, stackH);
        const ctxMini = this._canvasMini && miniH > 0 ? setCanvasSize(this._canvasMini, stackW, miniH) : null;

        if (!ctxMain || !ctxOver) return;

        const typo = { fontFamily, textColor, labelFs };
        const primaryRaw = rawOnly.find((s) => s.visible !== false) || rawOnly[0];
        const primaryStats = viewportStats(primaryRaw?.points || sorted, v.x0, v.x1);

        // Resolve reference values that need stats
        const refs = refsForDraw.slice();
        if (cfg._resolvedLineThreshold != null && Number.isFinite(Number(cfg._resolvedLineThreshold))) {
            if (!refs.some((r) => r.type === 'target' && Number(r.value) === Number(cfg._resolvedLineThreshold))) {
                refs.push({
                    id: 'threshold_target',
                    type: 'target',
                    value: Number(cfg._resolvedLineThreshold),
                    label: `Target ${cfg._resolvedLineThreshold}`,
                    color: '#f59e0b',
                    style: 'dashed',
                });
            }
        }

        if (this._lineDirty.main) {
            ctxMain.clearRect(0, 0, stackW, stackH);
            drawGrid(ctxMain, layout, cfg, scaleX, scaleY, xTicks, yTicks);
            drawReferenceLines(ctxMain, layout, refs, scaleY, typo, {
                avg: primaryStats.avg,
                median: primaryStats.median,
            });

            let drawnRaw = 0;
            /** @type {Map<number, number>} */
            const stackAtX = new Map();
            const useStack = cfg.stack && cfg.chartType === 'area';
            for (const s of seriesList) {
                if (s.visible === false) continue;
                if (s.kind === 'band') {
                    drawBand(ctxMain, layout, s.pointsLo, s.pointsHi, s.color, scaleX, scaleY);
                    continue;
                }
                if (s.kind === 'raw') {
                    if (drawnRaw >= LINE_CHART_MAX_VISIBLE_SERIES) continue;
                    drawnRaw += 1;
                }
                let pts = sliceByX(s.points || [], v.x0, v.x1);
                if (useStack && s.kind === 'raw') {
                    pts = pts.map((p) => {
                        const base = stackAtX.get(p.x) || 0;
                        const y = base + p.y;
                        stackAtX.set(p.x, y);
                        return { ...p, y };
                    });
                }
                const renderPts = downsampleForViewport(pts, plotWidth, lodMode);
                const styleCfg = {
                    ...cfg,
                    line: { ...cfg.line, color: s.color || cfg.line.color },
                    chartType: s.kind === 'raw' ? cfg.chartType : 'line',
                };
                drawLine(ctxMain, layout, renderPts, styleCfg, scaleX, scaleY, {
                    color: s.color,
                    style: s.style || cfg.line.style,
                    kind: cfg.chartType === 'area' && s.kind === 'raw' ? 'area' : undefined,
                    opacity: s.kind === 'raw' ? cfg.line.opacity : 0.75,
                    width: s.kind === 'raw' ? cfg.line.width : Math.max(1, (cfg.line.width || 2) - 0.5),
                    gradient:
                        s.kind === 'raw' && s.gradient?.enabled
                            ? s.gradient
                            : null,
                });
                if (s.kind === 'raw') {
                    drawPoints(ctxMain, layout, renderPts, styleCfg, scaleX, scaleY, null, typo);
                    drawValueLabels(ctxMain, layout, renderPts, s.points || [], styleCfg, scaleX, scaleY, this._xType, typo);
                    drawStatsOverlays(ctxMain, layout, viewportStats(s.points || [], v.x0, v.x1), styleCfg, scaleX, scaleY, typo, s.color);
                }
            }

            if (this._anomalies?.length) {
                drawAnomalyMarkers(ctxMain, layout, this._anomalies, scaleX, scaleY);
            }
            drawAxes(ctxMain, layout, cfg, scaleX, scaleY, this._xType, xTicks, xTickLabels, yTicks, typo);
        }

        if (this._lineDirty.overlay) {
            ctxOver.clearRect(0, 0, stackW, stackH);
            const ctrl = this._lineController;
            if (ctrl?.zoomRect && ctrl.zoomRect.w > 0 && ctrl.zoomRect.h > 0) {
                drawZoomRect(ctxOver, ctrl.zoomRect);
            }
            if (this._hoverIdx != null) {
                const hp =
                    sorted.find((p) => p.idx === this._hoverIdx) || inView.find((p) => p.idx === this._hoverIdx);
                if (hp) {
                    const px = scaleX.toPx(hp.x);
                    const py = scaleY.toPx(hp.y);
                    if (cfg.crosshair?.enabled !== false) {
                        drawHoverCrosshair(ctxOver, layout, px, py);
                    }
                    for (const s of rawOnly) {
                        if (s.visible === false) continue;
                        const pts = s.points || [];
                        let best = null;
                        let bestD = Infinity;
                        for (const p of pts) {
                            const d = Math.abs(p.x - hp.x);
                            if (d < bestD) {
                                best = p;
                                bestD = d;
                            }
                        }
                        if (best) {
                            drawPoints(
                                ctxOver,
                                layout,
                                [best],
                                { ...cfg, line: { ...cfg.line, color: s.color }, points: { ...cfg.points, enabled: true } },
                                scaleX,
                                scaleY,
                                best.idx,
                                typo,
                            );
                        }
                    }
                    if (cfg.tooltip?.enabled !== false) {
                        drawHoverTooltip(ctxOver, layout, this._buildLineTooltipLines(hp, cfg), px, py, typo);
                    }
                }
            }
        }

        if (this._lineDirty.mini && ctxMini && miniH > 0 && cfg.miniMap?.enabled) {
            ctxMini.clearRect(0, 0, stackW, miniH);
            drawMiniMap(ctxMini, { x: 0, y: 0, w: stackW, h: miniH }, sorted, cfg, [v.x0, v.x1]);
        }

        this._lineDirty = { main: false, overlay: false, mini: false };
    }

    /**
     * @param {ReturnType<typeof normalizeLineConfig>} cfg
     * @param {{ x: number; y: number; idx: number; rawX?: unknown }[]} sorted
     * @param {{ x0: number; x1: number; y0: number; y1: number }} view
     */
    _computeXTicks(cfg, sorted, view, xType) {
        const span = view.x1 - view.x0 || 1;
        const target =
            cfg.axis.x.tickCount === 'auto'
                ? Math.max(4, Math.min(12, Math.floor(sorted.length / 8)))
                : cfg.axis.x.tickCount;

        if (xType === 'category' && sorted.length) {
            const n = sorted.length;
            const step = Math.max(1, Math.ceil(n / Math.max(4, typeof target === 'number' ? target : 6)));
            const ticks = [];
            const labels = [];
            for (let i = 0; i < n; i += step) {
                ticks.push(sorted[i].x);
                labels.push(String(sorted[i].rawX != null ? sorted[i].rawX : sorted[i].x));
            }
            return { xTicks: ticks, xTickLabels: labels };
        }

        const ticks = niceTicks(view.x0, view.x1, typeof target === 'number' ? target : 6);
        const { pattern } = formatTimeAuto(xType === 'time' ? span : span);
        const labels = ticks.map((t) => {
            if (xType === 'time') {
                return formatDateByPattern(new Date(t), pattern);
            }
            return String(Math.abs(t) >= 1e6 ? t.toExponential(2) : Math.round(t * 1000) / 1000);
        });
        return { xTicks: ticks, xTickLabels: labels };
    }

    render() {
        const content = this.element.querySelector('.widget-content');
        if (!content) return;

        this._lineTeardown();

        const typography = this.styles?.typography || {};
        const fontFamily = typography.fontFamily || defaultFontFamily();
        const textColor = typography.color || defaultTextColor();

        if (!hasDataBinding(this)) {
            content.innerHTML = renderWidgetDataPlaceholder(this, typography);
            const emptyShell = content.querySelector('.dash-widget-shell');
            if (emptyShell) {
                const heading = createDashWidgetHeadingElement(this._getCfg());
                if (heading) emptyShell.insertBefore(heading, emptyShell.firstChild);
            }
            return;
        }

        if (this.settings.bindingError) {
            const cfgErr = this._getCfg();
            const headingErr = createDashWidgetHeadingElement(cfgErr);
            content.textContent = '';
            const errShell = document.createElement('div');
            errShell.className = 'dash-widget-shell dash-widget-shell--centered-msg';
            errShell.style.fontFamily = `'${escXml(fontFamily)}',sans-serif`;
            errShell.style.color = textColor;
            if (headingErr) errShell.appendChild(headingErr);
            const msg = document.createElement('div');
            msg.className = 'dash-widget-state-message';
            msg.textContent = this.settings.bindingError;
            errShell.appendChild(msg);
            content.appendChild(errShell);
            return;
        }

        const cfg = this._getCfg();
        const { data, xField, yField } = cfg;

        if (!data || data.length === 0) {
            content.textContent = '';
            const emptyShell = document.createElement('div');
            emptyShell.className = 'dash-widget-shell dash-widget-shell--centered-msg';
            emptyShell.style.fontFamily = `'${escXml(fontFamily)}',sans-serif`;
            emptyShell.style.color = textColor;
            const headingEmpty = createDashWidgetHeadingElement(cfg);
            if (headingEmpty) emptyShell.appendChild(headingEmpty);
            const msg = document.createElement('div');
            msg.className = 'dash-widget-state-message';
            msg.textContent = 'Нет строк по текущим фильтрам';
            emptyShell.appendChild(msg);
            content.appendChild(emptyShell);
            return;
        }

        const axTypeRaw =
            cfg.axis.x.type === 'auto'
                ? inferXType(data, xField)
                : cfg.axis.x.type === 'time'
                  ? 'time'
                  : cfg.axis.x.type === 'category'
                    ? 'category'
                    : 'linear';
        let axType = axTypeRaw;
        if (
            this._lineDataFromServerBuckets &&
            cfg.timeframe?.enabled &&
            resolveActiveTimeframe(cfg.timeframe || {}).intervalMs > 0 &&
            cfg.axis.x.type === 'auto'
        ) {
            axType = 'time';
        }
        this._xType = axType === 'time' ? 'time' : axType === 'category' ? 'category' : 'linear';

        ensureBindingMeasures(this.settings);
        const measureMetas = resolveLineMeasures(listBindingMeasures(this.settings));
        /** @type {object[]} */
        const rawSeries = [];
        if (measureMetas.length) {
            let visibleCount = 0;
            measureMetas.forEach((m, ri) => {
                const workingData = this._getLineWorkingData(cfg, this._xType, m.yField);
                const pts = buildSortedSeries(workingData, xField, m.yField, this._xType);
                const vis = m.visible !== false && visibleCount < LINE_CHART_MAX_VISIBLE_SERIES;
                if (m.visible !== false) visibleCount += 1;
                const resolvedColor =
                    this._resolvedWidgetColors?.[`series_${ri}_color`] ||
                    m.color ||
                    LINE_SERIES_PALETTE[rawSeries.length % LINE_SERIES_PALETTE.length];
                let gradient = m.gradient || null;
                if (gradient && this._resolvedWidgetColors) {
                    const gf = this._resolvedWidgetColors[`series_${ri}_gradFrom`];
                    const gt = this._resolvedWidgetColors[`series_${ri}_gradTo`];
                    if (gf || gt) {
                        gradient = {
                            ...gradient,
                            from: gf || gradient.from,
                            to: gt || gradient.to,
                        };
                    }
                }
                rawSeries.push({
                    id: m.id,
                    label: m.label,
                    color: resolvedColor,
                    colorMode: m.colorMode || 'solid',
                    gradient,
                    visible: vis && m.visible !== false,
                    kind: 'raw',
                    yField: m.yField,
                    points: pts,
                });
            });
        } else {
            const workingData = this._getLineWorkingData(cfg, this._xType, yField);
            const paintGrad = cfg.line?.gradient?.enabled ? cfg.line.gradient : null;
            rawSeries.push({
                id: 'main',
                label: String(yField || 'y'),
                color: cfg.line.color || LINE_SERIES_PALETTE[0],
                colorMode: paintGrad ? 'gradient' : 'solid',
                gradient: paintGrad,
                visible: true,
                kind: 'raw',
                yField,
                points: buildSortedSeries(workingData, xField, yField, this._xType),
            });
        }
        this._seriesList = rawSeries;
        this._sorted = (rawSeries.find((s) => s.visible !== false) || rawSeries[0])?.points || [];

        // Anomalies on primary series
        this._anomalies = [];
        if (cfg.analytics?.anomalies?.enabled) {
            const targetId = cfg.analytics.anomalies.seriesId || rawSeries[0]?.id;
            const s = rawSeries.find((x) => x.id === targetId) || rawSeries[0];
            if (s) this._anomalies = detectAnomalies(s.points, cfg.analytics.anomalies.zThresh);
        }

        const fb = fullBoundsFromMultiSeries(rawSeries);
        if (this._lineFetch == null) {
            this._lineFetch = { canOlder: false, canNewer: false };
        }
        const dw = cfg.dataWindow || { anchor: 'start', initialSpan: 1 };
        if (this._lineRestoreViewAfterData) {
            this._view = this._lineRestoreViewAfterData;
            this._lineRestoreViewAfterData = null;
        } else {
            this._view = computeInitialViewFromDataWindow(fb, dw.anchor === 'end' ? 'end' : 'start', dw.initialSpan ?? 1);
        }
        this._hoverIdx = null;

        document.querySelectorAll('.line-widget-tooltip').forEach((el) => el.remove());

        content.textContent = '';
        const shell = document.createElement('div');
        shell.className = 'dash-widget-shell dash-widget-shell--column chart-widget-root line-widget-root';
        shell.style.fontFamily = `'${escXml(fontFamily)}', sans-serif`;
        shell.style.color = textColor;

        const heading = createDashWidgetHeadingElement(cfg);
        if (heading) shell.appendChild(heading);

        const plotRow = document.createElement('div');
        plotRow.className = 'line-widget-plot-row';

        const cMain = document.createElement('canvas');
        cMain.className = 'line-widget-canvas';
        const cOver = document.createElement('canvas');
        cOver.className = 'line-widget-overlay';

        plotRow.appendChild(cMain);
        plotRow.appendChild(cOver);

        if (cfg.zoom?.showToolbar !== false) {
            const tb = document.createElement('div');
            tb.className = 'line-widget-zoom-toolbar';
            const mkBtn = (label, title, fn) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'line-widget-zoom-btn';
                b.textContent = label;
                b.title = title;
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    fn();
                });
                return b;
            };
            const zoomBy = (factor) => {
                if (!this._view) return;
                const midX = (this._view.x0 + this._view.x1) / 2;
                const midY = (this._view.y0 + this._view.y1) / 2;
                const hx = ((this._view.x1 - this._view.x0) / 2) * factor;
                const hy = ((this._view.y1 - this._view.y0) / 2) * factor;
                this._view = { x0: midX - hx, x1: midX + hx, y0: midY - hy, y1: midY + hy };
                this._lineDirty.main = true;
                this._lineDirty.overlay = true;
                this._lineDirty.mini = true;
                this._scheduleLineDraw();
            };
            tb.appendChild(mkBtn('−', 'Отдалить', () => zoomBy(1.25)));
            tb.appendChild(
                mkBtn('Fit', 'Вписать данные', () => {
                    const bounds = fullBoundsFromMultiSeries(this._seriesList);
                    this._view = { x0: bounds.minX, x1: bounds.maxX, y0: bounds.minY, y1: bounds.maxY };
                    this._lineDirty.main = true;
                    this._lineDirty.overlay = true;
                    this._lineDirty.mini = true;
                    this._scheduleLineDraw();
                }),
            );
            tb.appendChild(mkBtn('+', 'Приблизить', () => zoomBy(0.8)));
            tb.appendChild(
                mkBtn('↺', 'Сброс вида и brush', () => {
                    const bounds = fullBoundsFromMultiSeries(this._seriesList);
                    this._view = { x0: bounds.minX, x1: bounds.maxX, y0: bounds.minY, y1: bounds.maxY };
                    if (this.settings.dashboardBrushX) {
                        delete this.settings.dashboardBrushX;
                        if (typeof window !== 'undefined' && window.engine?.saveSnapshot) window.engine.saveSnapshot();
                        eventBus.emit('dashboard:filters-changed', { source: 'line-chart-brush-reset' });
                    }
                    this._lineDirty.main = true;
                    this._lineDirty.overlay = true;
                    this._lineDirty.mini = true;
                    this._scheduleLineDraw();
                }),
            );
            plotRow.appendChild(tb);
        }

        shell.appendChild(plotRow);
        this._mountTimeframeBar(shell, plotRow);

        if (cfg.legend?.enabled !== false && rawSeries.length) {
            const legend = document.createElement('div');
            legend.className = 'line-widget-legend';
            rawSeries.forEach((s) => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'line-widget-legend-item';
                if (s.visible === false) item.classList.add('line-widget-legend-item--off');
                item.title = 'Показать / скрыть серию';
                const sw = document.createElement('span');
                sw.className = 'line-widget-legend-swatch';
                sw.style.background = s.color || '#4DA3FF';
                const lab = document.createElement('span');
                lab.textContent = s.label;
                item.appendChild(sw);
                item.appendChild(lab);
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const measures = listBindingMeasures(this.settings);
                    const m = measures.find((x) => String(x.id) === String(s.id));
                    if (m) m.visible = !(m.visible !== false);
                    else s.visible = !(s.visible !== false);
                    ensureBindingMeasures(this.settings);
                    this.update();
                });
                legend.appendChild(item);
            });
            shell.appendChild(legend);
        }

        let cMini = null;
        if (cfg.miniMap?.enabled) {
            const miniRow = document.createElement('div');
            miniRow.className = 'line-widget-mini-row';
            miniRow.style.height = `${cfg.miniMap.height}px`;
            cMini = document.createElement('canvas');
            cMini.className = 'line-widget-minimap';
            miniRow.appendChild(cMini);
            shell.appendChild(miniRow);
        }

        content.appendChild(shell);

        this._lineRoot = shell;
        this._canvasMain = cMain;
        this._canvasOverlay = cOver;
        this._canvasMini = cMini;

        this._lineDirty = { main: true, overlay: true, mini: true };

        const widget = this;
        this._lineController = new LineChartInteractionController({
            overlay: cOver,
            mini: cMini,
            root: shell,
            getCfg: () => {
                const cfgNow = widget._getCfg();
                // Для axis.x=auto, когда фактически определился time, X-brush должен быть доступен.
                if (cfgNow.axis?.x?.type === 'auto' && widget._xType === 'time') {
                    cfgNow.crossFilterBrushX = true;
                }
                return cfgNow;
            },
            getLayout: () => {
                const c = widget._getCfg();
                const pr = widget.element?.querySelector('.line-widget-plot-row');
                const miniH = c.miniMap?.enabled ? c.miniMap.height : 0;
                const stackW = Math.max(80, pr?.clientWidth || 400);
                const stackH = Math.max(60, pr?.clientHeight || 200);
                const p = c.padding || {};
                const plotLeft = p.left ?? 48;
                const plotTop = p.top ?? 24;
                const plotWidth = Math.max(20, stackW - plotLeft - (p.right ?? 16));
                const plotHeight = Math.max(20, stackH - plotTop - (p.bottom ?? 32));
                return {
                    plotLeft,
                    plotTop,
                    plotWidth,
                    plotHeight,
                    mini:
                        widget._canvasMini && c.miniMap?.enabled
                            ? { x: 0, y: 0, w: widget._canvasMini.clientWidth, h: widget._canvasMini.clientHeight }
                            : null,
                };
            },
            getView: () => ({ ...(widget._view || { x0: 0, x1: 1, y0: 0, y1: 1 }) }),
            setView: (patch) => {
                const v2 = widget._view;
                if (!v2) return;
                const fb2 = fullBoundsFromSeries(widget._sorted);
                if (patch.x0 != null) v2.x0 = patch.x0;
                if (patch.x1 != null) v2.x1 = patch.x1;
                if (patch.y0 != null) v2.y0 = patch.y0;
                if (patch.y1 != null) v2.y1 = patch.y1;
                if (v2.x1 <= v2.x0) v2.x1 = v2.x0 + (fb2.maxX - fb2.minX) * 0.001;
                if (v2.y1 <= v2.y0) v2.y1 = v2.y0 + (fb2.maxY - fb2.minY) * 0.001;
                widget._lineDirty.main = true;
                widget._lineDirty.overlay = true;
                widget._lineDirty.mini = true;
                widget._scheduleLineDataFetch();
            },
            getFullBounds: () => fullBoundsFromSeries(widget._sorted),
            pickNearestByPlot: (plotOx, plotOy) => widget._linePickNearestByPlot(plotOx, plotOy),
            findNearestByDataX: (dataX) => {
                const arr = widget._sorted;
                if (!arr.length) return null;
                let lo = 0;
                let hi = arr.length - 1;
                while (lo < hi) {
                    const mid = (lo + hi) >> 1;
                    if (arr[mid].x < dataX) lo = mid + 1;
                    else hi = mid;
                }
                const i = lo;
                const a = arr[Math.max(0, i - 1)];
                const b = arr[i];
                if (!a) return b;
                if (!b) return a;
                const da = Math.abs(a.x - dataX);
                const db = Math.abs(b.x - dataX);
                return da <= db ? a : b;
            },
            onRedraw: () => {
                widget._lineDirty.main = true;
                widget._lineDirty.overlay = true;
                widget._lineDirty.mini = true;
                widget._scheduleLineDraw();
            },
            onHover: (hit) => {
                widget._hoverIdx = hit ? /** @type {{ idx: number }} */ (hit).idx : null;
                widget._lineDirty.overlay = true;
                widget._scheduleLineDraw();
            },
            onBrushXRange: ({ xMin, xMax }) => {
                const dim = resolveChartDimension(widget.settings.bindingDimension);
                if (!dim?.sqlOk || !dim.modelId || !dim.table || !dim.field) {
                    console.warn('LineChartWidget onBrushXRange: bindingDimension is required', {
                        widgetId: widget.id,
                        bindingDimension: widget.settings.bindingDimension,
                    });
                    return false;
                }
                const dt = String(dim.type || '').toLowerCase();
                const useIsoBounds =
                    widget._xType === 'time' ||
                    dt.includes('date') ||
                    dt.includes('time') ||
                    dt === 'timestamp';
                widget.settings.dashboardBrushX = {
                    modelId: dim.modelId,
                    table: dim.table,
                    field: dim.field,
                    fieldType: dim.type,
                    xMin,
                    xMax,
                    useIsoBounds,
                };
                if (typeof window !== 'undefined' && window.engine?.saveSnapshot) window.engine.saveSnapshot();
                eventBus.emit('dashboard:filters-changed', { source: 'line-chart-brush' });
                return true;
            },
            onBrushClear: () => {
                if (!widget.settings.dashboardBrushX) return;
                delete widget.settings.dashboardBrushX;
                if (typeof window !== 'undefined' && window.engine?.saveSnapshot) window.engine.saveSnapshot();
                eventBus.emit('dashboard:filters-changed', { source: 'line-chart-brush-clear' });
            },
        });

        this._lineResizeObserver = new ResizeObserver(() => {
            this._lineDirty.main = true;
            this._lineDirty.overlay = true;
            this._lineDirty.mini = true;
            this._scheduleLineDraw();
        });
        this._lineResizeObserver.observe(plotRow);
        if (cMini?.parentElement) this._lineResizeObserver.observe(cMini.parentElement);

        this._lineDrawFrame();
        this._scheduleLineDraw();
    }

    /**
     * Scalar Reference formulas → resolved numbers (existing Formula API / filters).
     * Global dataset scope (dashboard filters), не viewport average/median.
     * @param {object} engine
     * @param {{ modelId?: unknown, table?: string } | null} [dimHint]
     */
    async _resolveLineReferenceFormulas(engine, dimHint = null) {
        const refs = normalizeLineReferences(this.settings.references || []);
        this.settings.references = refs;
        const named = collectReferenceNamedFormulas(refs);
        if (!Object.keys(named).length) {
            this.settings._resolvedReferences = refs;
            return;
        }
        if (!engine) {
            this.settings._resolvedReferences = refs;
            return;
        }
        const dim =
            dimHint ||
            resolveChartDimension(this.settings.bindingDimension) ||
            {};
        let mid = dim.modelId;
        let tbl = dim.table;
        try {
            const probe = Object.values(named)[0];
            const resolved = await resolveKpiDataSourceFromFormula(
                engine,
                { modelId: mid, table: tbl },
                probe,
            );
            mid = resolved?.modelId ?? mid;
            tbl = resolved?.table ?? tbl;
        } catch {
            /* keep dim */
        }
        if (mid == null || !tbl) {
            this.settings._resolvedReferences = refs;
            return;
        }
        try {
            const bundle = await runNamedFormulaBundle(engine, mid, String(tbl), named, null);
            this.settings._resolvedReferences = applyResolvedReferenceFormulas(refs, bundle.byId || {});
        } catch (e) {
            console.warn('LineChartWidget reference formulas', e);
            this.settings._resolvedReferences = refs;
        }
    }

    async reloadFromDataModel(engine) {
        ensureBindingMeasures(this.settings);
        const dimR = resolveChartDimension(this.settings.bindingDimension);
        const measureMetas = resolveLineMeasures(listBindingMeasures(this.settings));
        if (!engine || !dimR || !measureMetas.length) return;
        if (!dimR.sqlOk) {
            this.settings.bindingError = dimR.error || 'Ошибка формулы привязки';
            this.update();
            return;
        }
        const bad = measureMetas.find((m) => !m.resolved.sqlOk);
        if (bad) {
            this.settings.bindingError = bad.resolved.error || 'Ошибка формулы меры';
            this.update();
            return;
        }
        if (measureMetas.some((m) => String(dimR.modelId) !== String(m.resolved.modelId))) {
            this.settings.bindingError = 'Измерение и меры должны быть из одной модели данных';
            this.update();
            return;
        }
        if (!dimR.field) return;
        const dim = dimR;
        const meas = measureMetas[0].resolved;
        const sameTable = measureMetas.every((m) => String(m.resolved.table) === String(dim.table));
        const multi = measureMetas.length > 1;
        delete this.settings.bindingError;
        const reloadGen = ++this._lineReloadGeneration;
        const stillCurrent = () => reloadGen === this._lineReloadGeneration;

        this._dashboardEngine = engine;
        this._lineRestoreViewAfterData = null;
        this._lineFetch = { canOlder: false, canNewer: false };
        this._lineDataFromServerBuckets = false;
        const cfg = normalizeLineConfig(this.settings);
        const anchor = cfg.dataWindow?.anchor === 'end' ? 'end' : 'start';
        this._lineCanRefreshNewTail =
            (cfg.timeframe?.enabled && resolveActiveTimeframe(cfg.timeframe || {}).intervalMs > 0) ||
            this._isLineTimeDimension(dim);
        const orderDir = anchor === 'end' ? 'desc' : 'asc';
        // Server time-bucket — только одна мера и одна таблица.
        const wantBucket = sameTable && !multi && this._lineWantServerBuckets(cfg);
        const lineTimeBucket = wantBucket ? this._makeLineTimeBucket(dim, meas, cfg) : null;
        try {
            const filters = mergeChartMeasureFilters(
                filtersForModel(collectDashboardFilters(engine), dim.modelId),
                meas,
            );
            const client = getDashboardDataModelClient(engine);
            const plainSelect = async () => {
                if (!sameTable) {
                    const parts = await Promise.all(
                        measureMetas.map(async (m) => {
                            const mf = mergeChartMeasureFilters(
                                filtersForModel(collectDashboardFilters(engine), dim.modelId),
                                m.resolved,
                            );
                            const { rows: rr } = await client.fetchSelect({
                                modelId: dim.modelId,
                                base_table: dim.table,
                                column_refs: [
                                    { table: dim.table, column: dim.field },
                                    { table: m.resolved.table, column: m.resolved.field },
                                ],
                                filters: mf,
                                limit: LINE_CHART_QUERY_MAX,
                                order_by: [{ column: dim.field, dir: orderDir }],
                            });
                            return {
                                yField: String(m.resolved.field),
                                rows: Array.isArray(rr) ? rr : [],
                            };
                        }),
                    );
                    return mergeSeriesRowsByX(dim.field, parts);
                }
                const yCols = [...new Set(measureMetas.map((m) => String(m.resolved.field)))];
                const { rows: rr } = await client.fetchSelect({
                    modelId: dim.modelId,
                    base_table: dim.table,
                    columns: [dim.field, ...yCols],
                    filters,
                    limit: LINE_CHART_QUERY_MAX,
                    order_by: [{ column: dim.field, dir: orderDir }],
                });
                return Array.isArray(rr) ? rr : [];
            };
            let rows = [];
            if (lineTimeBucket) {
                try {
                    const { rows: rawRows } = await client.fetchSelect({
                        modelId: dim.modelId,
                        base_table: dim.table,
                        filters,
                        limit: LINE_CHART_QUERY_MAX,
                        order_by: [{ column: dim.field, dir: orderDir }],
                        line_time_bucket: lineTimeBucket,
                    });
                    if (!stillCurrent()) return;
                    rows = Array.isArray(rawRows) ? rawRows : [];
                    this._lineDataFromServerBuckets = true;
                } catch (err) {
                    console.warn('LineChartWidget server time-bucket query failed, using raw rows', err);
                    if (!stillCurrent()) return;
                    rows = await plainSelect();
                    if (!stillCurrent()) return;
                    this._lineDataFromServerBuckets = false;
                }
            } else {
                rows = await plainSelect();
                if (!stillCurrent()) return;
            }
            if (!stillCurrent()) return;
            if (orderDir === 'desc') {
                rows = rows.slice().reverse();
            }
            this.settings.xField = dim.field;
            this.settings.yField = meas.field;
            this.settings.data = rows;
            this._lineAggCache = null;

            delete this.settings._resolvedLineThreshold;
            const lnThr = String(this.settings.lineThresholdFormula || '').trim();
            if (lnThr && engine) {
                try {
                    const resolved = await resolveKpiDataSourceFromFormula(
                        engine,
                        { modelId: dim.modelId, table: dim.table },
                        lnThr,
                    );
                    if (!stillCurrent()) return;
                    const mid = resolved?.modelId ?? dim.modelId;
                    const tbl = resolved?.table ?? dim.table;
                    if (mid != null && tbl) {
                        const b = await runNamedFormulaBundle(engine, mid, tbl, { ln_thr: lnThr }, null);
                        if (!stillCurrent()) return;
                        const n = b.byId.ln_thr?.numeric;
                        this.settings._resolvedLineThreshold =
                            n != null && Number.isFinite(n) ? n : null;
                    }
                } catch (e2) {
                    console.warn('LineChartWidget threshold formula', e2);
                    this.settings._resolvedLineThreshold = null;
                }
            }

            if (!stillCurrent()) return;
            await this._resolveLineReferenceFormulas(engine, dim);
            if (!stillCurrent()) return;
            this._lineAbortRetries = 0;
            const n = rows.length;
            const hitLimit = n >= LINE_CHART_QUERY_MAX;
            this._lineFetch = {
                canOlder: anchor === 'end' && hitLimit,
                canNewer: (anchor === 'start' && hitLimit) || this._lineCanRefreshNewTail,
            };
            if (!this._lineDataFromServerBuckets) {
                this._maybeAutoSuggestTimeframe(n);
            }
            this.update();
            // После первой страницы — догрузить край, если окно упёрлось в лимит
            // (и bulk-reload уже не блокирует; иначе kick сработает в конце батча).
            if (
                hitLimit &&
                (!engine.__dashboardBulkReloadDepth || engine.__dashboardBulkReloadDepth <= 0)
            ) {
                queueMicrotask(() => {
                    if (!stillCurrent()) return;
                    void this._tryFetchLineDataEdges();
                });
            }
        } catch (e) {
            if (e?.name === 'AbortError') {
                // Strict Mode / смена фильтров часто abort'ит первый fetch — один-два ретрая.
                if (!stillCurrent() || !engine || engine._destroyed) return;
                if (this._lineAbortRetries >= 2) return;
                this._lineAbortRetries += 1;
                const genAtAbort = reloadGen;
                setTimeout(() => {
                    if (this._lineReloadGeneration !== genAtAbort) return;
                    if (engine._destroyed) return;
                    void this.reloadFromDataModel(engine);
                }, 120);
                return;
            }
            console.error('LineChartWidget reloadFromDataModel', e);
        }
    }

    destroy() {
        if (this._lineTfSyncUnsub) {
            this._lineTfSyncUnsub();
            this._lineTfSyncUnsub = null;
        }
        if (this._lineModeUnsub) {
            this._lineModeUnsub();
            this._lineModeUnsub = null;
        }
        this._lineTeardown();
        super.destroy();
    }

    toJSON() {
        const settings = { ...this.settings };
        delete settings.bindingError;
        delete settings._resolvedLineThreshold;
        delete settings._resolvedReferences;
        return {
            ...super.toJSON(),
            settings,
        };
    }

    fromJSON(json) {
        super.fromJSON(json);
        if (json.settings) {
            this.settings = normalizeLineConfig({ ...this.settings, ...json.settings });
        }
        delete this.settings.bindingError;
        this._lineUserTfOverride = false;
        this._lineAggCache = null;
        this._lineDataFromServerBuckets = false;
        this.render();
    }
}
