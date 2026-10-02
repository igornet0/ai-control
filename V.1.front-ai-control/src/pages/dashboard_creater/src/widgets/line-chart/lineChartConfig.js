/**
 * Конфигурация линейного графика (Canvas): нормализация и обратная совместимость.
 */

import { LINE_TIMEFRAME_PRESETS, LINE_TIMEFRAME_PRESET_ORDER, decodeTimeframeSlot } from './lineChartTimeframe.js';
import { normalizeLineFormulaFields } from '../common/widgetFormulaSchema.js';
import { ensureBindingMeasures } from './lineChartSeries.js';
import { normalizeLineReferences } from './lineChartReferenceFormula.js';

function deepMerge(base, over) {
    if (!over || typeof over !== 'object') return { ...base };
    const out = { ...base };
    for (const k of Object.keys(over)) {
        const v = over[k];
        if (
            v != null &&
            typeof v === 'object' &&
            !Array.isArray(v) &&
            typeof base[k] === 'object' &&
            base[k] != null &&
            !Array.isArray(base[k])
        ) {
            out[k] = deepMerge(base[k], v);
        } else if (v !== undefined) {
            out[k] = v;
        }
    }
    return out;
}

function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
}

export const LINE_CHART_DEFAULTS = {
    data: [],
    xField: 'x',
    yField: 'y',
    showTitle: false,
    title: 'Линейный график',
    titleSize: 14,
    titleColor: '#8B5CF6',
    line: {
        color: '#4DA3FF',
        width: 2,
        smooth: true,
        style: 'solid',
        opacity: 0.95,
        gradient: {
            enabled: false,
            from: '#005DFF',
            to: '#00E0FF',
            mode: 'x',
        },
    },
    points: {
        enabled: false,
        radius: 3,
        hoverRadius: 6,
        color: null,
        opacity: 1,
    },
    labels: {
        enabled: false,
        mode: 'last_point',
        position: 'auto',
        format: 'auto',
        customFormat: null,
        fontSize: null,
        color: null,
        collisionAvoid: true,
    },
    axis: {
        x: {
            enabled: true,
            type: 'auto',
            format: 'auto',
            tickCount: 'auto',
            rotate: 0,
        },
        y: {
            enabled: true,
            format: 'auto',
            tickCount: 5,
        },
    },
    grid: {
        enabled: true,
        density: 5,
        opacity: 0.14,
        color: '#00E0FF',
    },
    tooltip: {
        enabled: true,
        /** Показывать числовое значение Y в подсказке при наведении (дата всегда, если тултип включён). */
        showValue: true,
        format: 'auto',
        customFormat: null,
        showPctChange: true,
        /** Доп. поля из строки данных (имена колонок). */
        extraFields: [],
    },
    crosshair: {
        enabled: true,
    },
    legend: {
        enabled: true,
    },
    /** line | area | step | spline */
    chartType: 'spline',
    /** Stacked area (только chartType=area). */
    stack: false,
    zoom: {
        enabled: true,
        x: true,
        y: true,
        wheel: true,
        dragSelect: true,
        doubleClickReset: true,
        showToolbar: true,
    },
    pan: {
        enabled: true,
        inertia: false,
    },
    miniMap: {
        enabled: true,
        height: 60,
    },
    /**
     * Авто-LOD по ширине plot (см. lineChartLOD.downsampleForViewport).
     * Порог / maxRenderPoints больше не используются — оставлены только mode.
     */
    lod: {
        enabled: true,
        mode: 'minmax',
    },
    stats: {
        showLast: false,
        showMinMax: false,
        showAvg: false,
        showMedian: false,
        showSum: false,
    },
    /** @type {Array<{ id: string, type: string, value?: number, yMin?: number, yMax?: number, label?: string, color?: string, style?: string }>} */
    references: [],
    analytics: {
        ma: { enabled: false, window: 7, seriesId: 'all' },
        trend: { enabled: false, degree: 1, seriesId: 'all' },
        compare: {
            enabled: false,
            mode: 'previous_period',
            shiftMs: null,
            seriesId: null,
        },
        forecast: {
            enabled: false,
            horizon: 30,
            method: 'linear',
            confidence: 0.8,
            showBand: true,
            seriesId: null,
        },
        anomalies: { enabled: false, zThresh: 2.5, seriesId: null },
    },
    padding: {
        top: 24,
        right: 16,
        bottom: 32,
        left: 48,
    },
    /** Таймфрейм: агрегация по оси времени (сервер при preferServerAggregation и ненулевом интервале). */
    timeframe: {
        enabled: false,
        id: 'raw',
        customIntervalMs: null,
        availableIds: ['1m', '5m', '15m', '1h', '1d', '1w', '1mo', '1y'],
        allowCustom: true,
        aggregation: 'avg',
        autoSuggest: false,
        syncGroupId: '',
        /** true: при ненулевом интервале запрашивать уже забакетенные ряды с SQLite API */
        preferServerAggregation: true,
        /** 'column' — кнопки таймфрейма вертикальной колонкой; 'row' — в одну (несколько) строк. */
        barLayout: 'column',
        /** 'comfortable' | 'compact' — размер кнопок полосы таймфрейма на виджете */
        barDensity: 'comfortable',
    },
    /** Начальный вид по оси X: с какого конца ряда и какая доля диапазона (1 = весь загруженный ряд). */
    dataWindow: {
        anchor: 'start',
        initialSpan: 1,
    },
    /** При pan/zoom у края загруженного окна — подгружать соседние страницы с сервера. */
    auto_refetch_on_pan: true,
};

/**
 * @param {Record<string, unknown>} settings
 * @returns {typeof LINE_CHART_DEFAULTS & Record<string, unknown>}
 */
export function normalizeLineConfig(settings = {}) {
    const raw = { ...settings };
    const nestedLine = raw.line && typeof raw.line === 'object' ? raw.line : {};
    const nestedPoints = raw.points && typeof raw.points === 'object' ? raw.points : {};
    const nestedLabels = raw.labels && typeof raw.labels === 'object' ? raw.labels : {};
    const nestedAxis = raw.axis && typeof raw.axis === 'object' ? raw.axis : {};
    const nestedGrid = raw.grid && typeof raw.grid === 'object' ? raw.grid : {};
    const nestedTooltip = raw.tooltip && typeof raw.tooltip === 'object' ? raw.tooltip : {};
    const nestedZoom = raw.zoom && typeof raw.zoom === 'object' ? raw.zoom : {};
    const nestedPan = raw.pan && typeof raw.pan === 'object' ? raw.pan : {};
    const nestedMiniMap = raw.miniMap && typeof raw.miniMap === 'object' ? raw.miniMap : {};
    const nestedLod = raw.lod && typeof raw.lod === 'object' ? raw.lod : {};
    const nestedDataWindow = raw.dataWindow && typeof raw.dataWindow === 'object' ? raw.dataWindow : {};
    const nestedTimeframe = raw.timeframe && typeof raw.timeframe === 'object' ? raw.timeframe : {};
    const nestedCrosshair = raw.crosshair && typeof raw.crosshair === 'object' ? raw.crosshair : {};
    const nestedLegend = raw.legend && typeof raw.legend === 'object' ? raw.legend : {};
    const nestedStats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
    const nestedAnalytics = raw.analytics && typeof raw.analytics === 'object' ? raw.analytics : {};

    let merged = deepMerge(LINE_CHART_DEFAULTS, {
        line: deepMerge(LINE_CHART_DEFAULTS.line, nestedLine),
        points: deepMerge(LINE_CHART_DEFAULTS.points, nestedPoints),
        labels: deepMerge(LINE_CHART_DEFAULTS.labels, nestedLabels),
        axis: {
            x: deepMerge(
                LINE_CHART_DEFAULTS.axis.x,
                nestedAxis.x && typeof nestedAxis.x === 'object' ? nestedAxis.x : {},
            ),
            y: deepMerge(
                LINE_CHART_DEFAULTS.axis.y,
                nestedAxis.y && typeof nestedAxis.y === 'object' ? nestedAxis.y : {},
            ),
        },
        grid: deepMerge(LINE_CHART_DEFAULTS.grid, nestedGrid),
        tooltip: deepMerge(LINE_CHART_DEFAULTS.tooltip, nestedTooltip),
        crosshair: deepMerge(LINE_CHART_DEFAULTS.crosshair, nestedCrosshair),
        legend: deepMerge(LINE_CHART_DEFAULTS.legend, nestedLegend),
        stats: deepMerge(LINE_CHART_DEFAULTS.stats, nestedStats),
        analytics: deepMerge(LINE_CHART_DEFAULTS.analytics, {
            ma: deepMerge(
                LINE_CHART_DEFAULTS.analytics.ma,
                nestedAnalytics.ma && typeof nestedAnalytics.ma === 'object' ? nestedAnalytics.ma : {},
            ),
            trend: deepMerge(
                LINE_CHART_DEFAULTS.analytics.trend,
                nestedAnalytics.trend && typeof nestedAnalytics.trend === 'object'
                    ? nestedAnalytics.trend
                    : {},
            ),
            compare: deepMerge(
                LINE_CHART_DEFAULTS.analytics.compare,
                nestedAnalytics.compare && typeof nestedAnalytics.compare === 'object'
                    ? nestedAnalytics.compare
                    : {},
            ),
            forecast: deepMerge(
                LINE_CHART_DEFAULTS.analytics.forecast,
                nestedAnalytics.forecast && typeof nestedAnalytics.forecast === 'object'
                    ? nestedAnalytics.forecast
                    : {},
            ),
            anomalies: deepMerge(
                LINE_CHART_DEFAULTS.analytics.anomalies,
                nestedAnalytics.anomalies && typeof nestedAnalytics.anomalies === 'object'
                    ? nestedAnalytics.anomalies
                    : {},
            ),
        }),
        zoom: deepMerge(LINE_CHART_DEFAULTS.zoom, nestedZoom),
        pan: deepMerge(LINE_CHART_DEFAULTS.pan, nestedPan),
        miniMap: deepMerge(LINE_CHART_DEFAULTS.miniMap, nestedMiniMap),
        lod: deepMerge(LINE_CHART_DEFAULTS.lod, nestedLod),
        padding: deepMerge(LINE_CHART_DEFAULTS.padding, raw.padding && typeof raw.padding === 'object' ? raw.padding : {}),
        dataWindow: deepMerge(LINE_CHART_DEFAULTS.dataWindow, nestedDataWindow),
        timeframe: deepMerge(LINE_CHART_DEFAULTS.timeframe, nestedTimeframe),
    });

    if (raw.xField != null) merged.xField = String(raw.xField);
    if (raw.yField != null) merged.yField = String(raw.yField);
    if (Array.isArray(raw.data)) merged.data = raw.data;

    if (typeof raw.lineColor === 'string' && raw.lineColor.trim()) {
        merged.line.color = raw.lineColor.trim();
    }
    if (raw.colors && typeof raw.colors === 'object' && raw.colors.line) {
        merged.line.color = String(raw.colors.line);
    }
    if (raw.showGrid === false) merged.grid.enabled = false;
    if (raw.showGrid === true) merged.grid.enabled = true;

    if (typeof raw.zoom === 'boolean') merged.zoom.enabled = raw.zoom;
    if (typeof raw.pan === 'boolean') merged.pan.enabled = raw.pan;
    if (typeof raw.miniMap === 'boolean') merged.miniMap.enabled = raw.miniMap;

    if (raw.showLabels === true) merged.labels.enabled = true;
    if (raw.showLabels === false) merged.labels.enabled = false;
    if (raw.labelMode != null) {
        const m = String(raw.labelMode);
        if (['none', 'last_point', 'all', 'extremes'].includes(m)) merged.labels.mode = m;
    }
    if (raw.labelPosition != null) {
        const p = String(raw.labelPosition);
        if (['above', 'below', 'auto'].includes(p)) merged.labels.position = p;
    }

    merged.line.width = clamp(Number(merged.line.width) || 2, 0.5, 12);
    merged.line.smooth = merged.line.smooth !== false;
    const st = String(merged.line.style || 'solid').toLowerCase();
    merged.line.style = ['solid', 'dashed', 'dotted'].includes(st) ? st : 'solid';
    merged.line.opacity = clamp(Number(merged.line.opacity) || 0.95, 0.05, 1);
    if (merged.line.gradient && typeof merged.line.gradient === 'object') {
        merged.line.gradient.enabled = !!merged.line.gradient.enabled;
        const gm = String(merged.line.gradient.mode || 'x').toLowerCase();
        merged.line.gradient.mode = gm === 'y' ? 'y' : 'x';
    }

    merged.points.enabled = !!merged.points.enabled;
    merged.points.radius = clamp(Number(merged.points.radius) || 3, 0, 16);
    merged.points.hoverRadius = clamp(Number(merged.points.hoverRadius) || 6, 0, 24);
    merged.points.opacity = clamp(Number(merged.points.opacity) || 1, 0.05, 1);

    merged.labels.enabled = !!merged.labels.enabled;
    const lm = String(merged.labels.mode || 'last_point');
    merged.labels.mode = ['none', 'last_point', 'all', 'extremes'].includes(lm) ? lm : 'last_point';
    const lp = String(merged.labels.position || 'auto');
    merged.labels.position = ['above', 'below', 'auto'].includes(lp) ? lp : 'auto';
    const lf = String(merged.labels.format || 'auto');
    merged.labels.format = ['auto', 'number', 'date', 'custom'].includes(lf) ? lf : 'auto';
    merged.labels.collisionAvoid = merged.labels.collisionAvoid !== false;

    const xt = String(merged.axis.x.type || 'auto');
    merged.axis.x.type = ['auto', 'linear', 'time', 'category'].includes(xt) ? xt : 'auto';

    if (Object.prototype.hasOwnProperty.call(raw, 'crossFilterBrushX')) {
        merged.crossFilterBrushX = !!raw.crossFilterBrushX;
    } else {
        merged.crossFilterBrushX = merged.axis.x.type === 'time';
    }
    merged.axis.x.enabled = merged.axis.x.enabled !== false;
    merged.axis.y.enabled = merged.axis.y.enabled !== false;
    let xtc = merged.axis.x.tickCount;
    if (xtc !== 'auto') {
        xtc = clamp(parseInt(xtc, 10) || 6, 2, 24);
        merged.axis.x.tickCount = xtc;
    }
    let ytc = parseInt(merged.axis.y.tickCount, 10);
    if (!Number.isFinite(ytc)) ytc = 5;
    merged.axis.y.tickCount = clamp(ytc, 2, 20);
    merged.axis.x.rotate = clamp(Number(merged.axis.x.rotate) || 0, -90, 90);

    merged.grid.enabled = merged.grid.enabled !== false;
    merged.grid.density = clamp(parseInt(merged.grid.density, 10) || 5, 2, 20);
    merged.grid.opacity = clamp(Number(merged.grid.opacity) || 0.14, 0, 1);

    merged.tooltip.enabled = merged.tooltip.enabled !== false;
    merged.tooltip.showValue = merged.tooltip.showValue !== false;
    merged.tooltip.showPctChange = merged.tooltip.showPctChange !== false;
    if (!Array.isArray(merged.tooltip.extraFields)) merged.tooltip.extraFields = [];
    else {
        merged.tooltip.extraFields = merged.tooltip.extraFields.map(String).filter(Boolean).slice(0, 12);
    }
    const tf = String(merged.tooltip.format || 'auto');
    merged.tooltip.format = ['auto', 'number', 'date', 'custom'].includes(tf) ? tf : 'auto';

    merged.crosshair.enabled = merged.crosshair?.enabled !== false;
    merged.legend.enabled = merged.legend?.enabled !== false;

    let ct = String(
        Object.prototype.hasOwnProperty.call(raw, 'chartType') ? raw.chartType : merged.chartType || 'spline',
    ).toLowerCase();
    if (ct === 'smooth') ct = 'spline';
    if (!['line', 'area', 'step', 'spline'].includes(ct)) {
        ct = merged.line?.smooth === false ? 'line' : 'spline';
    }
    merged.chartType = ct;
    if (Object.prototype.hasOwnProperty.call(raw, 'stack')) merged.stack = !!raw.stack;
    if (ct === 'spline') merged.line.smooth = true;
    else if (ct === 'line' || ct === 'step') merged.line.smooth = false;
    merged.stack = !!merged.stack && ct === 'area';

    merged.stats = merged.stats || {};
    merged.stats.showLast = !!merged.stats.showLast;
    merged.stats.showMinMax = !!merged.stats.showMinMax;
    merged.stats.showAvg = !!merged.stats.showAvg;
    merged.stats.showMedian = !!merged.stats.showMedian;
    merged.stats.showSum = !!merged.stats.showSum;

    // references не входят в deepMerge-оверрайд выше — берём из raw.
    const rawRefs = Array.isArray(raw.references)
        ? raw.references
        : Array.isArray(merged.references)
          ? merged.references
          : [];
    merged.references = normalizeLineReferences(rawRefs);

    merged.analytics = merged.analytics || { ...LINE_CHART_DEFAULTS.analytics };
    merged.analytics.ma.enabled = !!merged.analytics.ma?.enabled;
    merged.analytics.ma.window = clamp(parseInt(merged.analytics.ma?.window, 10) || 7, 2, 365);
    merged.analytics.ma.seriesId = String(merged.analytics.ma?.seriesId || 'all');
    merged.analytics.trend.enabled = !!merged.analytics.trend?.enabled;
    merged.analytics.trend.degree = merged.analytics.trend?.degree === 2 ? 2 : 1;
    merged.analytics.trend.seriesId = String(merged.analytics.trend?.seriesId || 'all');
    merged.analytics.compare.enabled = !!merged.analytics.compare?.enabled;
    const cm = String(merged.analytics.compare?.mode || 'previous_period');
    merged.analytics.compare.mode = ['previous_period', 'previous_year', 'custom_shift'].includes(cm)
        ? cm
        : 'previous_period';
    merged.analytics.compare.shiftMs =
        merged.analytics.compare?.shiftMs != null && Number.isFinite(Number(merged.analytics.compare.shiftMs))
            ? Number(merged.analytics.compare.shiftMs)
            : null;
    merged.analytics.forecast.enabled = !!merged.analytics.forecast?.enabled;
    merged.analytics.forecast.horizon = clamp(parseInt(merged.analytics.forecast?.horizon, 10) || 30, 1, 500);
    const fm = String(merged.analytics.forecast?.method || 'linear');
    merged.analytics.forecast.method = ['linear', 'ma'].includes(fm) ? fm : 'linear';
    const conf = Number(merged.analytics.forecast?.confidence);
    merged.analytics.forecast.confidence = conf >= 0.95 ? 0.95 : 0.8;
    merged.analytics.forecast.showBand = merged.analytics.forecast?.showBand !== false;
    merged.analytics.anomalies.enabled = !!merged.analytics.anomalies?.enabled;
    merged.analytics.anomalies.zThresh = clamp(Number(merged.analytics.anomalies?.zThresh) || 2.5, 1.5, 6);

    merged.zoom.enabled = merged.zoom.enabled !== false;
    merged.zoom.showToolbar = merged.zoom.showToolbar !== false;
    merged.zoom.x = merged.zoom.x !== false;
    merged.zoom.y = merged.zoom.y !== false;
    merged.zoom.wheel = merged.zoom.wheel !== false;
    merged.zoom.dragSelect = merged.zoom.dragSelect !== false;
    merged.zoom.doubleClickReset = merged.zoom.doubleClickReset !== false;

    merged.pan.enabled = merged.pan.enabled !== false;

    merged.miniMap.enabled = merged.miniMap.enabled !== false;
    merged.miniMap.height = clamp(Number(merged.miniMap.height) || 60, 32, 160);

    // LOD всегда включён: отрисовка ограничивается шириной viewport.
    merged.lod.enabled = true;
    delete merged.lod.threshold;
    delete merged.lod.maxRenderPoints;
    let lodm = String(merged.lod.mode || 'minmax').toLowerCase();
    if (lodm === 'none') lodm = 'minmax';
    merged.lod.mode = ['lttb', 'minmax'].includes(lodm) ? lodm : 'minmax';

    if (!merged.timeframe || typeof merged.timeframe !== 'object') merged.timeframe = { ...LINE_CHART_DEFAULTS.timeframe };
    merged.timeframe.enabled = !!merged.timeframe.enabled;
    let tfId = String(merged.timeframe.id || 'raw').toLowerCase();
    if (!LINE_TIMEFRAME_PRESETS[tfId] && tfId !== 'custom') tfId = 'raw';
    merged.timeframe.id = tfId;
    const cim = merged.timeframe.customIntervalMs;
    merged.timeframe.customIntervalMs =
        cim != null && Number.isFinite(Number(cim)) ? Math.round(Number(cim)) : null;
    const presetKeys = new Set(Object.keys(LINE_TIMEFRAME_PRESETS));
    let avail = Array.isArray(merged.timeframe.availableIds) ? merged.timeframe.availableIds.map(String) : [];
    avail = avail.filter((slot) => decodeTimeframeSlot(slot) != null);
    if (!avail.length) {
        avail = LINE_TIMEFRAME_PRESET_ORDER.filter((id) => presetKeys.has(id) && id !== 'raw');
    }
    merged.timeframe.availableIds = avail;
    merged.timeframe.allowCustom = merged.timeframe.allowCustom !== false;
    const ag = String(merged.timeframe.aggregation || 'avg').toLowerCase();
    merged.timeframe.aggregation = ['sum', 'avg', 'min', 'max', 'count'].includes(ag) ? ag : 'avg';
    merged.timeframe.autoSuggest = !!merged.timeframe.autoSuggest;
    merged.timeframe.syncGroupId = String(merged.timeframe.syncGroupId || '').trim().slice(0, 120);
    merged.timeframe.preferServerAggregation = merged.timeframe.preferServerAggregation !== false;
    const tbl = String(merged.timeframe.barLayout || '').toLowerCase();
    merged.timeframe.barLayout = tbl === 'row' ? 'row' : 'column';
    const tbd = String(merged.timeframe.barDensity || '').toLowerCase();
    merged.timeframe.barDensity = tbd === 'compact' ? 'compact' : 'comfortable';

    merged.padding.top = clamp(Number(merged.padding.top) || 24, 0, 120);
    merged.padding.right = clamp(Number(merged.padding.right) || 16, 0, 120);
    merged.padding.bottom = clamp(Number(merged.padding.bottom) || 32, 0, 160);
    merged.padding.left = clamp(Number(merged.padding.left) || 48, 0, 200);

    // Top-level title fields живут в settings, но deepMerge выше мержит только nested-объекты —
    // без явного копирования из raw showTitle всегда остаётся false из LINE_CHART_DEFAULTS.
    if (Object.prototype.hasOwnProperty.call(raw, 'showTitle')) {
        merged.showTitle = raw.showTitle === true;
    } else if (typeof merged.showTitle !== 'boolean') {
        merged.showTitle = false;
    } else {
        merged.showTitle = merged.showTitle === true;
    }
    {
        const titleSrc = raw.title !== undefined ? raw.title : merged.title;
        const t = titleSrc != null ? String(titleSrc).trim() : '';
        merged.title = t || 'Линейный график';
        let ts = parseInt(
            raw.titleSize !== undefined ? raw.titleSize : merged.titleSize,
            10,
        );
        if (!Number.isFinite(ts)) ts = 14;
        merged.titleSize = Math.min(48, Math.max(8, ts));
        const c = String(
            (raw.titleColor !== undefined ? raw.titleColor : merged.titleColor) || '',
        ).trim();
        merged.titleColor = /^#[0-9a-fA-F]{6}$/i.test(c) ? c : '#8B5CF6';
    }

    const da = String(merged.dataWindow?.anchor || 'start').toLowerCase();
    merged.dataWindow = merged.dataWindow || {};
    merged.dataWindow.anchor = da === 'end' ? 'end' : 'start';
    let sp = Number(merged.dataWindow.initialSpan);
    if (!Number.isFinite(sp)) sp = 1;
    merged.dataWindow.initialSpan = clamp(sp, 0.1, 1);
    // По умолчанию true; явно false в сохранённых настройках отключает подгрузку.
    if (Object.prototype.hasOwnProperty.call(raw, 'auto_refetch_on_pan')) {
        merged.auto_refetch_on_pan = raw.auto_refetch_on_pan !== false;
    } else {
        merged.auto_refetch_on_pan = true;
    }

    // Метаданные привязки к модели и brush-фильтр (не входят в LINE_CHART_DEFAULTS).
    for (const key of ['bindingDimension', 'bindingMeasure', 'bindingError', 'dashboardBrushX']) {
        if (Object.prototype.hasOwnProperty.call(raw, key)) {
            const v = raw[key];
            if (v != null && typeof v === 'object' && !Array.isArray(v)) {
                merged[key] = { ...v };
            } else {
                merged[key] = v;
            }
        }
    }
    if (Array.isArray(raw.bindingMeasures)) {
        merged.bindingMeasures = raw.bindingMeasures
            .filter((b) => b && typeof b === 'object')
            .map((b) => ({ ...b }));
    }
    ensureBindingMeasures(merged);

    for (const key of ['_resolvedLineThreshold']) {
        if (Object.prototype.hasOwnProperty.call(raw, key)) {
            const v = raw[key];
            merged[key] = v != null && Number.isFinite(Number(v)) ? Number(v) : null;
        }
    }

    for (const key of ['lineThresholdFormula', 'lineThresholdHighColor', 'lineThresholdLowColor']) {
        if (Object.prototype.hasOwnProperty.call(raw, key)) {
            merged[key] = raw[key];
        }
    }

    normalizeLineFormulaFields(merged);

    return merged;
}
