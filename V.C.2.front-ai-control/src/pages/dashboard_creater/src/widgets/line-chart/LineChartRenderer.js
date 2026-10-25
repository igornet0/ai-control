/**
 * Canvas-отрисовка линейного графика (без состояния).
 */

import { createLinearScale, formatDateByPattern, formatTimeAuto, niceTicks } from './lineChartScales.js';
import { defaultTextColor, defaultFontFamily } from '../../theme/themeRuntime.js';

/**
 * @typedef {{ plotLeft: number, plotTop: number, plotWidth: number, plotHeight: number }} PlotLayout
 * @typedef {{ x: number, y: number, idx: number, rawX?: unknown }} LinePt
 */

function hexToRgba(hex, alpha) {
    const h = String(hex || '#00E0FF').replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16) || 0;
    const g = parseInt(full.slice(2, 4), 16) || 0;
    const b = parseInt(full.slice(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${alpha})`;
}

function formatNumberPlain(v, mode) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    if (mode === 'int') return String(Math.round(n));
    if (mode === 'compact') {
        try {
            return new Intl.NumberFormat('ru-RU', {
                notation: 'compact',
                maximumFractionDigits: 2,
            }).format(n);
        } catch {
            return String(Math.round(n));
        }
    }
    return String(n);
}

/**
 * Подпись даты/X для тултипа линейного графика.
 * @param {{ x: number, y: number, rawX?: unknown }} p
 * @param {import('./lineChartConfig.js').LINE_CHART_DEFAULTS} cfg
 * @param {'time'|'linear'|'category'} xType
 * @param {number} spanAcrossSorted
 */
export function formatLineChartTooltipDateStr(p, cfg, xType, spanAcrossSorted) {
    void cfg;
    if (xType === 'time') {
        const span = Number.isFinite(spanAcrossSorted) && spanAcrossSorted > 0 ? spanAcrossSorted : 1;
        const pat = formatTimeAuto(span).pattern;
        return formatDateByPattern(new Date(p.x), pat);
    }
    return String(p.rawX != null ? p.rawX : p.x);
}

/**
 * Подпись значения Y для тултипа.
 * @param {{ x: number, y: number, rawX?: unknown }} p
 * @param {import('./lineChartConfig.js').LINE_CHART_DEFAULTS} cfg
 * @param {'time'|'linear'|'category'} xType
 */
export function formatLineChartTooltipValueStr(p, cfg, xType) {
    const tf = cfg.tooltip?.format || 'auto';
    if (tf === 'custom' && cfg.tooltip?.customFormat) {
        const rawX = p.rawX != null ? String(p.rawX) : String(p.x);
        return String(cfg.tooltip.customFormat)
            .replace(/\{value\}/gi, String(p.y))
            .replace(/\{x\}/gi, rawX);
    }
    if (tf === 'number') return formatNumberPlain(p.y, 'raw');
    if (tf === 'date' && xType === 'time' && Number.isFinite(p.y)) {
        const pat = formatTimeAuto(1).pattern;
        return formatDateByPattern(new Date(p.y), pat);
    }
    return formatNumberPlain(p.y, 'compact');
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {PlotLayout} layout
 * @param {import('./lineChartConfig.js').LINE_CHART_DEFAULTS} cfg
 * @param {ReturnType<typeof createLinearScale>} scaleX
 * @param {ReturnType<typeof createLinearScale>} scaleY
 * @param {number[]} xTicks
 * @param {string[]} xTickLabels
 * @param {number[]} yTicks
 */
export function drawGrid(ctx, layout, cfg, scaleX, scaleY, xTicks, yTicks) {
    if (!cfg.grid.enabled) return;
    const { plotLeft, plotTop, plotWidth, plotHeight } = layout;
    const stroke = hexToRgba(cfg.grid.color, cfg.grid.opacity);
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (const y of yTicks) {
        const py = scaleY.toPx(y);
        if (py < plotTop - 1 || py > plotTop + plotHeight + 1) continue;
        ctx.beginPath();
        ctx.moveTo(plotLeft, py);
        ctx.lineTo(plotLeft + plotWidth, py);
        ctx.stroke();
    }
    for (const x of xTicks) {
        const px = scaleX.toPx(x);
        if (px < plotLeft - 1 || px > plotLeft + plotWidth + 1) continue;
        ctx.beginPath();
        ctx.moveTo(px, plotTop);
        ctx.lineTo(px, plotTop + plotHeight);
        ctx.stroke();
    }
    ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {PlotLayout} layout
 * @param {import('./lineChartConfig.js').LINE_CHART_DEFAULTS} cfg
 * @param {ReturnType<typeof createLinearScale>} scaleX
 * @param {ReturnType<typeof createLinearScale>} scaleY
 * @param {'time'|'linear'|'category'} xType
 * @param {number[]} xTicks
 * @param {string[]} xTickLabels
 * @param {number[]} yTicks
 * @param {{ fontFamily: string, textColor: string, labelFs: number }} typo
 */
export function drawAxes(ctx, layout, cfg, scaleX, scaleY, xType, xTicks, xTickLabels, yTicks, typo) {
    const { plotLeft, plotTop, plotWidth, plotHeight } = layout;
    const axisColor = typo.textColor || defaultTextColor();
    const fs = typo.labelFs || 11;
    ctx.save();
    ctx.strokeStyle = axisColor;
    ctx.fillStyle = axisColor;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1;
    ctx.font = `${fs}px ${typo.fontFamily || defaultFontFamily()}, sans-serif`;

    if (cfg.axis.x.enabled) {
        ctx.beginPath();
        ctx.moveTo(plotLeft, plotTop + plotHeight);
        ctx.lineTo(plotLeft + plotWidth, plotTop + plotHeight);
        ctx.stroke();
    }
    if (cfg.axis.y.enabled) {
        ctx.beginPath();
        ctx.moveTo(plotLeft, plotTop);
        ctx.lineTo(plotLeft, plotTop + plotHeight);
        ctx.stroke();
    }

    const rot = ((cfg.axis.x.rotate || 0) * Math.PI) / 180;

    if (cfg.axis.y.enabled) {
        for (let i = 0; i < yTicks.length; i++) {
            const y = yTicks[i];
            const py = scaleY.toPx(y);
            const lab = formatNumberPlain(y, cfg.axis.y.format === 'compact' ? 'compact' : 'raw');
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(lab, plotLeft - 6, py);
        }
    }

    if (cfg.axis.x.enabled) {
        for (let i = 0; i < xTicks.length; i++) {
            const x = xTicks[i];
            const px = scaleX.toPx(x);
            const lab = xTickLabels[i] != null ? String(xTickLabels[i]) : String(x);
            ctx.save();
            ctx.translate(px, plotTop + plotHeight + fs * 0.85);
            ctx.rotate(rot);
            ctx.textAlign = rot ? 'right' : 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(lab, 0, 0);
            ctx.restore();
        }
    }
    ctx.restore();
    void xType;
}

/**
 * @param {{ x: number, y: number }[]} ptsPx - уже в пикселях
 * @param {boolean} smooth
 * @param {'line'|'area'|'step'|'spline'} [chartType]
 */
function strokeLinePath(ctx, ptsPx, smooth, chartType = 'spline') {
    if (ptsPx.length === 0) return;
    if (chartType === 'step') {
        ctx.moveTo(ptsPx[0].x, ptsPx[0].y);
        for (let i = 1; i < ptsPx.length; i++) {
            ctx.lineTo(ptsPx[i].x, ptsPx[i - 1].y);
            ctx.lineTo(ptsPx[i].x, ptsPx[i].y);
        }
        return;
    }
    const useSmooth = chartType === 'spline' || (chartType !== 'line' && chartType !== 'area' && smooth);
    if (!useSmooth || ptsPx.length < 3) {
        ctx.moveTo(ptsPx[0].x, ptsPx[0].y);
        for (let i = 1; i < ptsPx.length; i++) {
            ctx.lineTo(ptsPx[i].x, ptsPx[i].y);
        }
        return;
    }
    const px = ptsPx;
    ctx.moveTo(px[0].x, px[0].y);
    for (let i = 0; i < px.length - 1; i++) {
        const p0 = px[Math.max(0, i - 1)];
        const p1 = px[i];
        const p2 = px[i + 1];
        const p3 = px[Math.min(px.length - 1, i + 2)];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {PlotLayout} layout
 * @param {LinePt[]} points - data space
 * @param {import('./lineChartConfig.js').LINE_CHART_DEFAULTS} cfg
 * @param {ReturnType<typeof createLinearScale>} scaleX
 * @param {ReturnType<typeof createLinearScale>} scaleY
 */
/**
 * @param {object} [seriesStyle] — override color/style/width/opacity/kind
 */
export function drawLine(ctx, layout, points, cfg, scaleX, scaleY, seriesStyle = null) {
    if (!points.length) return;
    const { plotLeft, plotTop, plotWidth, plotHeight } = layout;
    const ptsPx = points.map((p) => ({
        x: scaleX.toPx(p.x),
        y: scaleY.toPx(p.y),
    }));
    const chartType = String(cfg.chartType || (cfg.line.smooth !== false ? 'spline' : 'line'));
    const color = seriesStyle?.color || cfg.line.color || '#4DA3FF';
    const style = seriesStyle?.style || cfg.line.style || 'solid';
    const width = seriesStyle?.width != null ? seriesStyle.width : cfg.line.width;
    const opacity = seriesStyle?.opacity != null ? seriesStyle.opacity : cfg.line.opacity ?? 0.95;
    const isArea = chartType === 'area' || seriesStyle?.kind === 'area';

    ctx.save();
    ctx.beginPath();
    ctx.rect(plotLeft, plotTop, plotWidth, plotHeight);
    ctx.clip();

    if (isArea) {
        ctx.beginPath();
        strokeLinePath(ctx, ptsPx, cfg.line.smooth !== false, chartType === 'area' ? (cfg.line.smooth !== false ? 'spline' : 'line') : chartType);
        const baseY = plotTop + plotHeight;
        ctx.lineTo(ptsPx[ptsPx.length - 1].x, baseY);
        ctx.lineTo(ptsPx[0].x, baseY);
        ctx.closePath();
        ctx.fillStyle = hexToRgba(color, Math.min(0.35, opacity * 0.35));
        ctx.fill();
    }

    if (style === 'dashed') ctx.setLineDash([8, 6]);
    else if (style === 'dotted') ctx.setLineDash([2, 4]);
    else ctx.setLineDash([]);

    ctx.beginPath();
    strokeLinePath(ctx, ptsPx, cfg.line.smooth !== false, chartType);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = width;

    const grad =
        seriesStyle?.gradient?.enabled
            ? seriesStyle.gradient
            : !seriesStyle && cfg.line.gradient?.enabled
              ? cfg.line.gradient
              : null;
    if (grad) {
        const g =
            grad.mode === 'y'
                ? ctx.createLinearGradient(0, plotTop, 0, plotTop + plotHeight)
                : ctx.createLinearGradient(plotLeft, 0, plotLeft + plotWidth, 0);
        g.addColorStop(0, grad.from || '#005DFF');
        g.addColorStop(1, grad.to || '#00E0FF');
        ctx.strokeStyle = g;
    } else {
        ctx.strokeStyle = color;
    }
    ctx.globalAlpha = opacity;
    ctx.stroke();
    ctx.restore();
}

/**
 * Confidence band between lo/hi polylines.
 */
export function drawBand(ctx, layout, pointsLo, pointsHi, color, scaleX, scaleY) {
    if (!pointsLo?.length || !pointsHi?.length) return;
    const { plotLeft, plotTop, plotWidth, plotHeight } = layout;
    ctx.save();
    ctx.beginPath();
    ctx.rect(plotLeft, plotTop, plotWidth, plotHeight);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(scaleX.toPx(pointsLo[0].x), scaleY.toPx(pointsLo[0].y));
    for (let i = 1; i < pointsLo.length; i++) {
        ctx.lineTo(scaleX.toPx(pointsLo[i].x), scaleY.toPx(pointsLo[i].y));
    }
    for (let i = pointsHi.length - 1; i >= 0; i--) {
        ctx.lineTo(scaleX.toPx(pointsHi[i].x), scaleY.toPx(pointsHi[i].y));
    }
    ctx.closePath();
    ctx.fillStyle = hexToRgba(color || '#4DA3FF', 0.15);
    ctx.fill();
    ctx.restore();
}

/**
 * Horizontal reference lines / bands.
 * @param {Array<{ type: string, value?: number|null, yMin?: number|null, yMax?: number|null, label?: string, color?: string, style?: string }>} refs
 * @param {{ avg?: number|null, median?: number|null }} [statsVals]
 */
/**
 * Числа Y из reference lines, которые должны попадать в масштаб оси.
 * @param {Array<{ type?: string, value?: number|null, yMin?: number|null, yMax?: number|null }>} refs
 * @param {{ avg?: number|null, median?: number|null }} [statsVals]
 * @returns {number[]}
 */
export function referenceLineYValues(refs, statsVals = {}) {
    /** @type {number[]} */
    const out = [];
    for (const ref of refs || []) {
        if (!ref) continue;
        if (ref.type === 'band') {
            if (ref.yMin != null && Number.isFinite(Number(ref.yMin))) out.push(Number(ref.yMin));
            if (ref.yMax != null && Number.isFinite(Number(ref.yMax))) out.push(Number(ref.yMax));
            continue;
        }
        let y = ref.value;
        if (ref.type === 'average' && statsVals.avg != null) y = statsVals.avg;
        if (ref.type === 'median' && statsVals.median != null) y = statsVals.median;
        if (y != null && Number.isFinite(Number(y))) out.push(Number(y));
    }
    return out;
}

export function drawReferenceLines(ctx, layout, refs, scaleY, typo, statsVals = {}) {
    if (!refs?.length) return;
    const { plotLeft, plotTop, plotWidth, plotHeight } = layout;
    ctx.save();
    for (const ref of refs) {
        if (ref.type === 'band') {
            let y0 = ref.yMin;
            let y1 = ref.yMax;
            // Один bound → тонкая полоса вокруг значения / линия
            if ((y0 == null || !Number.isFinite(y0)) && (y1 == null || !Number.isFinite(y1))) {
                if (ref.value != null && Number.isFinite(Number(ref.value))) {
                    y0 = Number(ref.value);
                    y1 = Number(ref.value);
                } else {
                    continue;
                }
            } else if (y0 == null || !Number.isFinite(y0)) {
                y0 = y1;
            } else if (y1 == null || !Number.isFinite(y1)) {
                y1 = y0;
            }
            const py0 = scaleY.toPx(Math.max(y0, y1));
            const py1 = scaleY.toPx(Math.min(y0, y1));
            const h = Math.max(y0 === y1 ? 3 : 1, Math.abs(py1 - py0));
            const top = y0 === y1 ? py0 - h / 2 : Math.min(py0, py1);
            ctx.fillStyle = hexToRgba(ref.color || '#34d399', 0.18);
            ctx.fillRect(plotLeft, top, plotWidth, h);
            if (ref.label) {
                ctx.fillStyle = ref.color || '#34d399';
                ctx.font = `600 10px ${typo.fontFamily || defaultFontFamily()}, sans-serif`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'bottom';
                ctx.fillText(ref.label, plotLeft + 4, top - 2);
            }
            continue;
        }
        let y = ref.value;
        if (ref.type === 'average' && statsVals.avg != null) y = statsVals.avg;
        if (ref.type === 'median' && statsVals.median != null) y = statsVals.median;
        if (y == null || !Number.isFinite(Number(y))) continue;
        const py = scaleY.toPx(Number(y));
        if (py < plotTop - 2 || py > plotTop + plotHeight + 2) continue;
        const st = ref.style || 'dashed';
        if (st === 'dashed') ctx.setLineDash([6, 4]);
        else if (st === 'dotted') ctx.setLineDash([2, 3]);
        else ctx.setLineDash([]);
        ctx.strokeStyle = ref.color || '#f59e0b';
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = 1.75;
        ctx.beginPath();
        ctx.moveTo(plotLeft, py);
        ctx.lineTo(plotLeft + plotWidth, py);
        ctx.stroke();
        const lab = ref.label || (ref.type === 'target' ? `Target ${y}` : String(y));
        ctx.setLineDash([]);
        ctx.fillStyle = ref.color || '#f59e0b';
        ctx.font = `600 10px ${typo.fontFamily || defaultFontFamily()}, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(lab, plotLeft + 4, py - 2);
    }
    ctx.restore();
}

/**
 * Stats badges (avg/sum/median lines + last/minmax markers).
 */
export function drawStatsOverlays(ctx, layout, stats, cfg, scaleX, scaleY, typo, color) {
    if (!stats || !cfg.stats) return;
    const { plotLeft, plotTop, plotWidth, plotHeight } = layout;
    ctx.save();
    const col = color || cfg.line.color || '#4DA3FF';

    const drawH = (yVal, label) => {
        if (yVal == null || !Number.isFinite(yVal)) return;
        const py = scaleY.toPx(yVal);
        if (py < plotTop || py > plotTop + plotHeight) return;
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = hexToRgba(col, 0.55);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(plotLeft, py);
        ctx.lineTo(plotLeft + plotWidth, py);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = col;
        ctx.font = `600 10px ${typo.fontFamily || defaultFontFamily()}, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, plotLeft + plotWidth - 4, py - 2);
    };

    if (cfg.stats.showAvg && stats.avg != null) drawH(stats.avg, `avg ${formatNumberPlain(stats.avg, 'compact')}`);
    if (cfg.stats.showMedian && stats.median != null) {
        drawH(stats.median, `med ${formatNumberPlain(stats.median, 'compact')}`);
    }
    if (cfg.stats.showSum && stats.sum != null) {
        ctx.fillStyle = col;
        ctx.font = `600 10px ${typo.fontFamily || defaultFontFamily()}, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Σ ${formatNumberPlain(stats.sum, 'compact')}`, plotLeft + 4, plotTop + 4);
    }

    const mark = (p, tag) => {
        if (!p) return;
        const px = scaleX.toPx(p.x);
        const py = scaleY.toPx(p.y);
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.fillStyle = typo.textColor || '#fff';
        ctx.font = `600 10px ${typo.fontFamily || defaultFontFamily()}, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${tag} ${formatNumberPlain(p.y, 'compact')}`, px, py - 6);
    };

    if (cfg.stats.showMinMax) {
        mark(stats.min, 'min');
        mark(stats.max, 'max');
    }
    if (cfg.stats.showLast) mark(stats.last, '');
    ctx.restore();
}

/**
 * Anomaly markers.
 */
export function drawAnomalyMarkers(ctx, layout, anomalies, scaleX, scaleY) {
    if (!anomalies?.length) return;
    const { plotLeft, plotTop, plotWidth, plotHeight } = layout;
    ctx.save();
    ctx.beginPath();
    ctx.rect(plotLeft, plotTop, plotWidth, plotHeight);
    ctx.clip();
    for (const a of anomalies) {
        const p = a.point;
        if (!p) continue;
        const px = scaleX.toPx(p.x);
        const py = scaleY.toPx(p.y);
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px, py - 12);
        ctx.lineTo(px - 5, py - 4);
        ctx.lineTo(px + 5, py - 4);
        ctx.closePath();
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
    }
    ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {PlotLayout} layout
 * @param {LinePt[]} points
 * @param {import('./lineChartConfig.js').LINE_CHART_DEFAULTS} cfg
 * @param {ReturnType<typeof createLinearScale>} scaleX
 * @param {ReturnType<typeof createLinearScale>} scaleY
 * @param {number | null} hoverIdx
 * @param {{ textColor: string }} typo
 */
export function drawPoints(ctx, layout, points, cfg, scaleX, scaleY, hoverIdx, typo) {
    if (!cfg.points.enabled && hoverIdx == null) return;
    const { plotLeft, plotTop, plotWidth, plotHeight } = layout;
    const baseR = cfg.points.radius || 3;
    const hoverR = cfg.points.hoverRadius || 6;
    const col = cfg.points.color || cfg.line.color || '#4DA3FF';
    const op = cfg.points.opacity ?? 1;
    const thr = cfg._resolvedLineThreshold;
    const hi = cfg.lineThresholdHighColor || '#34d399';
    const lo = cfg.lineThresholdLowColor || '#f87171';
    const useThr = thr != null && Number.isFinite(Number(thr));

    ctx.save();
    ctx.beginPath();
    ctx.rect(plotLeft, plotTop, plotWidth, plotHeight);
    ctx.clip();

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const px = scaleX.toPx(p.x);
        const py = scaleY.toPx(p.y);
        const isHover = hoverIdx != null && p.idx === hoverIdx;
        const r = isHover ? Math.max(baseR, hoverR) : baseR;
        if (!cfg.points.enabled && !isHover) continue;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        const fillCol = useThr ? (p.y >= Number(thr) ? hi : lo) : col;
        ctx.fillStyle = fillCol;
        ctx.globalAlpha = isHover ? 1 : op;
        ctx.fill();
        if (isHover) {
            ctx.strokeStyle = typo.textColor || '#fff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.9;
            ctx.stroke();
        }
    }
    ctx.restore();
}

function formatLabelValue(p, cfg, xType) {
    const lf = cfg.labels.format || 'auto';
    if (lf === 'custom' && cfg.labels.customFormat) {
        return String(cfg.labels.customFormat)
            .replace(/\{value\}/g, String(p.y))
            .replace(/\{x\}/g, String(p.rawX != null ? p.rawX : p.x));
    }
    if (lf === 'date' || (lf === 'auto' && xType === 'time')) {
        const t = typeof p.x === 'number' ? p.x : Number(p.x);
        if (Number.isFinite(t)) {
            const { pattern } = formatTimeAuto(1);
            return formatDateByPattern(new Date(t), pattern);
        }
    }
    if (lf === 'number' || (lf === 'auto' && xType !== 'time')) {
        return formatNumberPlain(p.y, 'compact');
    }
    return formatNumberPlain(p.y, 'compact');
}

function approxTextWidth(text, fontSize) {
    let w = 0;
    const s = String(text);
    for (let i = 0; i < s.length; i++) {
        w += s.charCodeAt(i) < 128 ? fontSize * 0.55 : fontSize * 0.9;
    }
    return w;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {PlotLayout} layout
 * @param {LinePt[]} points
 * @param {LinePt[]} fullSorted
 * @param {import('./lineChartConfig.js').LINE_CHART_DEFAULTS} cfg
 * @param {ReturnType<typeof createLinearScale>} scaleX
 * @param {ReturnType<typeof createLinearScale>} scaleY
 * @param {'time'|'linear'|'category'} xType
 * @param {{ fontFamily: string, textColor: string, labelFs: number }} typo
 */
export function drawValueLabels(ctx, layout, points, fullSorted, cfg, scaleX, scaleY, xType, typo) {
    if (!cfg.labels.enabled || cfg.labels.mode === 'none') return;

    const mode = cfg.labels.mode || 'last_point';
    const fs = cfg.labels.fontSize || typo.labelFs || 11;
    const col = cfg.labels.color || typo.textColor || defaultTextColor();
    const pos = cfg.labels.position || 'auto';
    const gap = 4;

    /** @type {LinePt[]} */
    let candidates = [];
    if (mode === 'last_point' && fullSorted.length) {
        candidates = [fullSorted[fullSorted.length - 1]];
    } else if (mode === 'extremes' && fullSorted.length) {
        let minP = fullSorted[0];
        let maxP = fullSorted[0];
        for (const p of fullSorted) {
            if (p.y < minP.y) minP = p;
            if (p.y > maxP.y) maxP = p;
        }
        candidates = minP.idx === maxP.idx ? [minP] : [minP, maxP];
    } else if (mode === 'all') {
        candidates = points.slice();
    }

    const { plotLeft, plotTop, plotWidth, plotHeight } = layout;
    ctx.save();
    ctx.font = `600 ${fs}px ${typo.fontFamily || defaultFontFamily()}, sans-serif`;
    ctx.fillStyle = col;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let lastRight = -Infinity;

    candidates.sort((a, b) => scaleX.toPx(a.x) - scaleX.toPx(b.x));

    for (const p of candidates) {
        const px = scaleX.toPx(p.x);
        const py = scaleY.toPx(p.y);
        if (px < plotLeft - 20 || px > plotLeft + plotWidth + 20) continue;
        const text = formatLabelValue(p, cfg, xType);
        const tw = approxTextWidth(text, fs);
        const th = fs * 1.2;
        let ty = py - (fs + gap);
        if (pos === 'below') ty = py + fs + gap;
        else if (pos === 'above') ty = py - fs - gap;
        else {
            ty = py < plotTop + plotHeight * 0.5 ? py + fs + gap : py - fs - gap;
        }

        const boxRight = px + tw / 2 + 2;
        const boxLeft = px - tw / 2 - 2;
        if (cfg.labels.collisionAvoid !== false) {
            if (boxLeft < lastRight + gap) continue;
            lastRight = boxRight;
        }
        ctx.fillText(text, px, ty);
    }
    ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, w: number, h: number }} rect
 */
export function drawZoomRect(ctx, rect) {
    ctx.save();
    ctx.strokeStyle = 'rgba(77, 163, 255, 0.95)';
    ctx.fillStyle = 'rgba(77, 163, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {PlotLayout} layout
 * @param {number | null} px
 * @param {number | null} py
 */
export function drawHoverCrosshair(ctx, layout, px, py) {
    if (px == null || py == null) return;
    const { plotLeft, plotTop, plotWidth, plotHeight } = layout;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(px, plotTop);
    ctx.lineTo(px, plotTop + plotHeight);
    ctx.moveTo(plotLeft, py);
    ctx.lineTo(plotLeft + plotWidth, py);
    ctx.stroke();
    ctx.restore();
}

/**
 * Подсказка на overlay-canvas рядом с crosshair.
 * @param {CanvasRenderingContext2D} ctx
 * @param {PlotLayout} layout
 * @param {string[]} lines
 * @param {number} anchorX
 * @param {number} anchorY
 * @param {{ fontFamily: string, textColor: string, labelFs: number }} typo
 */
export function drawHoverTooltip(ctx, layout, lines, anchorX, anchorY, typo) {
    if (!lines?.length) return;
    const { plotLeft, plotTop, plotWidth, plotHeight } = layout;
    const fs = Math.max(11, typo.labelFs || 12);
    const fontFamily = typo.fontFamily || defaultFontFamily();
    const padX = 10;
    const padY = 8;
    const lineH = Math.round(fs * 1.35);

    ctx.save();
    ctx.font = `${fs}px '${fontFamily}', sans-serif`;
    const textW = Math.max(...lines.map((l) => ctx.measureText(l).width), 0);
    const boxW = Math.ceil(textW) + padX * 2;
    const boxH = lines.length * lineH + padY * 2 - Math.round(lineH * 0.35);

    let x = anchorX + 12;
    let y = anchorY + 12;
    if (x + boxW > plotLeft + plotWidth - 4) x = anchorX - boxW - 12;
    if (y + boxH > plotTop + plotHeight - 4) y = anchorY - boxH - 12;
    x = Math.max(plotLeft + 4, Math.min(x, plotLeft + plotWidth - boxW - 4));
    y = Math.max(plotTop + 4, Math.min(y, plotTop + plotHeight - boxH - 4));

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, y, boxW, boxH, 8);
        ctx.fill();
        ctx.stroke();
    } else {
        ctx.fillRect(x, y, boxW, boxH);
        ctx.strokeRect(x, y, boxW, boxH);
    }

    ctx.fillStyle = typo.textColor || '#f4f4f5';
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => {
        ctx.fillText(line, x + padX, y + padY + i * lineH);
    });
    ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, w: number, h: number }} mini
 * @param {LinePt[]} fullSorted
 * @param {import('./lineChartConfig.js').LINE_CHART_DEFAULTS} cfg
 * @param {[number, number]} viewX
 */
export function drawMiniMap(ctx, mini, fullSorted, cfg, viewX) {
    if (!fullSorted.length) return;
    const { x, y, w, h } = mini;
    const pad = 4;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const xs = fullSorted.map((p) => p.x);
    const ys = fullSorted.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;

    const sx = (v) => x + pad + ((v - minX) / spanX) * innerW;
    const sy = (v) => y + pad + innerH - ((v - minY) / spanY) * innerH;

    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.55)';
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    const rr = typeof ctx.roundRect === 'function';
    if (rr) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.fill();
        ctx.stroke();
    } else {
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
    }

    ctx.beginPath();
    ctx.moveTo(sx(fullSorted[0].x), sy(fullSorted[0].y));
    for (let i = 1; i < fullSorted.length; i++) {
        ctx.lineTo(sx(fullSorted[i].x), sy(fullSorted[i].y));
    }
    ctx.strokeStyle = cfg.line.color || '#4DA3FF';
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1;
    ctx.stroke();

    const vx0 = Math.max(minX, Math.min(maxX, viewX[0]));
    const vx1 = Math.max(minX, Math.min(maxX, viewX[1]));
    const rx = x + pad + ((vx0 - minX) / spanX) * innerW;
    const rw = ((vx1 - vx0) / spanX) * innerW;
    ctx.fillStyle = 'rgba(77,163,255,0.22)';
    ctx.strokeStyle = 'rgba(77,163,255,0.7)';
    ctx.lineWidth = 1;
    ctx.fillRect(rx, y + pad, Math.max(2, rw), innerH);
    ctx.strokeRect(rx, y + pad, Math.max(2, rw), innerH);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    if (vx0 > minX) ctx.fillRect(x + pad, y + pad, ((vx0 - minX) / spanX) * innerW, innerH);
    if (vx1 < maxX) ctx.fillRect(rx + Math.max(2, rw), y + pad, ((maxX - vx1) / spanX) * innerW, innerH);

    ctx.restore();
}
