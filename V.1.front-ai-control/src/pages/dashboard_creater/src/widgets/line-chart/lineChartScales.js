/**
 * Шкалы и форматирование осей для линейного графика.
 */

function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
}

/**
 * @param {[number, number]} domain
 * @param {[number, number]} range - экранные координаты (например [left, right])
 */
export function createLinearScale(domain, range) {
    const [d0, d1] = domain;
    const [r0, r1] = range;
    const span = d1 - d0 || 1;
    const inv = r1 - r0;
    return {
        domain: [d0, d1],
        range: [r0, r1],
        /** @param {number} v */
        toPx(v) {
            return r0 + ((v - d0) / span) * inv;
        },
        /** @param {number} px */
        fromPx(px) {
            return d0 + ((px - r0) / inv) * span;
        },
    };
}

const MS_DAY = 86400000;
const MS_HOUR = 3600000;
const MS_MIN = 60000;

/**
 * @param {number} spanMs
 */
export function formatTimeAuto(spanMs) {
    if (!Number.isFinite(spanMs) || spanMs <= 0) return { pattern: 'datetime' };
    if (spanMs > 400 * MS_DAY) return { pattern: 'year' };
    if (spanMs > 120 * MS_DAY) return { pattern: 'month' };
    if (spanMs > 2 * MS_DAY) return { pattern: 'day' };
    if (spanMs > 2 * MS_HOUR) return { pattern: 'hour' };
    if (spanMs > 2 * MS_MIN) return { pattern: 'minute' };
    return { pattern: 'second' };
}

/**
 * @param {Date} d
 * @param {'year'|'month'|'day'|'hour'|'minute'|'second'|'datetime'} pattern
 * @param {Intl.DateTimeFormatOptions} [localeOpts]
 */
export function formatDateByPattern(d, pattern, localeOpts) {
    const opts = localeOpts || {};
    try {
        if (pattern === 'year') return new Intl.DateTimeFormat('ru-RU', { year: 'numeric', ...opts }).format(d);
        if (pattern === 'month')
            return new Intl.DateTimeFormat('ru-RU', { year: 'numeric', month: 'short', ...opts }).format(d);
        if (pattern === 'day')
            return new Intl.DateTimeFormat('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit', ...opts }).format(d);
        if (pattern === 'hour')
            return new Intl.DateTimeFormat('ru-RU', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', ...opts }).format(d);
        if (pattern === 'minute')
            return new Intl.DateTimeFormat('ru-RU', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', ...opts }).format(d);
        if (pattern === 'second')
            return new Intl.DateTimeFormat('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                ...opts,
            }).format(d);
        return new Intl.DateTimeFormat('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            ...opts,
        }).format(d);
    } catch {
        return String(d);
    }
}

/**
 * @param {number} min
 * @param {number} max
 * @param {number} targetCount
 * @returns {number[]}
 */
export function niceTicks(min, max, targetCount = 5) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
    if (min === max) return [min];
    const n = clamp(Math.round(targetCount), 2, 20);
    const span = max - min;
    const rough = span / (n - 1);
    const pow10 = 10 ** Math.floor(Math.log10(rough));
    const frac = rough / pow10;
    let niceFrac = 1;
    if (frac <= 1) niceFrac = 1;
    else if (frac <= 2) niceFrac = 2;
    else if (frac <= 5) niceFrac = 5;
    else niceFrac = 10;
    const step = niceFrac * pow10;
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    const ticks = [];
    for (let t = niceMin; t <= niceMax + step * 0.5; t += step) {
        ticks.push(t);
        if (ticks.length > 30) break;
    }
    return ticks.length ? ticks : [min, max];
}

/**
 * @param {unknown} v
 * @returns {number|null}
 */
export function parseXToNumber(v) {
    if (v == null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
        const t = Date.parse(v);
        if (!Number.isNaN(t)) return t;
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : null;
    }
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v.getTime();
    return null;
}

/**
 * @param {Record<string, unknown>[]} data
 * @param {string} field
 * @returns {'time'|'linear'|'category'}
 */
export function inferXType(data, field) {
    const rows = Array.isArray(data) ? data.slice(0, 40) : [];
    let num = 0;
    let time = 0;
    let cat = 0;
    for (const row of rows) {
        const raw = row[field];
        if (raw == null) continue;
        if (typeof raw === 'number' && Number.isFinite(raw)) {
            num++;
            continue;
        }
        if (typeof raw === 'string') {
            const t = Date.parse(raw);
            if (!Number.isNaN(t)) time++;
            else if (parseFloat(raw).toString() === String(raw).trim()) num++;
            else cat++;
            continue;
        }
        if (raw instanceof Date) time++;
        else cat++;
    }
    const total = num + time + cat;
    if (!total) return 'linear';
    if (time >= Math.max(1, total * 0.4)) return 'time';
    if (cat >= num && cat >= 2) return 'category';
    return 'linear';
}
