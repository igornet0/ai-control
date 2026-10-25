import { defaultTextColor, defaultFontFamily } from '../../theme/themeRuntime.js';
/**
 * Статистика по высотам столбцов и SVG-оверлей (среднее / медиана / сумма).
 */

function escXml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** @param {number} v @param {'raw'|'int'|'compact'} [mode] */
function formatStatNumber(v, mode) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    if (mode === 'int') return String(Math.round(n));
    const fmt = mode === 'raw' ? 'raw' : 'compact';
    if (fmt === 'compact') {
        try {
            return new Intl.NumberFormat('ru-RU', {
                notation: 'compact',
                maximumFractionDigits: 2,
            }).format(n);
        } catch {
            return String(Math.round(n * 100) / 100);
        }
    }
    if (Number.isInteger(n)) return String(n);
    return String(Math.round(n * 100) / 100);
}

/**
 * @param {number[]} values
 * @returns {{ count: number, avg: number|null, median: number|null, sum: number|null }}
 */
export function computeBarCategoryStats(values) {
    const nums = [];
    for (const v of values || []) {
        if (v == null || v === '') continue;
        const n = Number(v);
        if (Number.isFinite(n)) nums.push(n);
    }
    if (!nums.length) {
        return { count: 0, avg: null, median: null, sum: null };
    }
    let sum = 0;
    for (const n of nums) sum += n;
    const sorted = nums.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
        sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return {
        count: nums.length,
        avg: sum / nums.length,
        median,
        sum,
    };
}

/**
 * Линии среднего/медианы и бейдж суммы поверх столбцов.
 * @param {ReturnType<typeof computeBarCategoryStats>} stats
 * @param {{ showAvg?: boolean, showMedian?: boolean, showSum?: boolean }} flags
 * @param {object} geom
 * @param {'raw'|'int'|'compact'} [valueFmt]
 */
export function buildBarStatsOverlaySvg(stats, flags, geom, valueFmt, fontFamily, textColor) {
    if (!stats || !flags) return '';
    const showAvg = !!flags.showAvg && stats.avg != null && Number.isFinite(stats.avg);
    const showMed = !!flags.showMedian && stats.median != null && Number.isFinite(stats.median);
    const showSum = !!flags.showSum && stats.sum != null && Number.isFinite(stats.sum);
    if (!showAvg && !showMed && !showSum) return '';

    const {
        isVert,
        orient,
        plotLeft,
        plotTop,
        plotRight,
        plotBottom,
        innerWPlot,
        innerHPlot,
        maxV,
    } = geom;
    const max = Number(maxV) > 0 ? Number(maxV) : 1;
    const fs = 10;
    const fam = escXml(fontFamily || defaultFontFamily());
    const fill = escXml(textColor || defaultTextColor());

    const valueToPx = (val) => {
        const frac = Math.max(0, Math.min(1, Number(val) / max));
        if (isVert) {
            return orient === 'top'
                ? plotTop + frac * innerHPlot
                : plotBottom - frac * innerHPlot;
        }
        return orient === 'right'
            ? plotRight - frac * innerWPlot
            : plotLeft + frac * innerWPlot;
    };

    let html = '';
    const drawLine = (val, label, color) => {
        const c = escXml(color);
        const lab = escXml(label);
        if (isVert) {
            const y = valueToPx(val);
            html += `<line pointer-events="none" x1="${plotLeft}" y1="${y}" x2="${plotRight}" y2="${y}" stroke="${c}" stroke-width="1.25" stroke-dasharray="4 3" opacity="0.9"/>`;
            html += `<text pointer-events="none" x="${plotRight - 4}" y="${y - 3}" text-anchor="end" font-size="${fs}" font-weight="600" fill="${c}" font-family="${fam}, sans-serif">${lab}</text>`;
        } else {
            const x = valueToPx(val);
            html += `<line pointer-events="none" x1="${x}" y1="${plotTop}" x2="${x}" y2="${plotBottom}" stroke="${c}" stroke-width="1.25" stroke-dasharray="4 3" opacity="0.9"/>`;
            html += `<text pointer-events="none" x="${x + 4}" y="${plotTop + 12}" text-anchor="start" font-size="${fs}" font-weight="600" fill="${c}" font-family="${fam}, sans-serif">${lab}</text>`;
        }
    };

    if (showAvg) {
        drawLine(stats.avg, `avg ${formatStatNumber(stats.avg, valueFmt)}`, '#34d399');
    }
    if (showMed) {
        drawLine(stats.median, `med ${formatStatNumber(stats.median, valueFmt)}`, '#a78bfa');
    }
    if (showSum) {
        html += `<text pointer-events="none" x="${plotLeft + 4}" y="${plotTop + 12}" text-anchor="start" font-size="${fs}" font-weight="600" fill="${fill}" font-family="${fam}, sans-serif">Σ ${escXml(formatStatNumber(stats.sum, valueFmt))}</text>`;
    }
    return html;
}
