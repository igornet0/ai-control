import {
  formatAggTimestampMsForDisplay,
  isSingleMinMaxAggFormula,
} from '../../formula/evaluate.js';

/**
 * @param {number|null|undefined} n
 * @returns {boolean}
 */
export function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * @param {number} n
 * @param {number} decimals
 * @returns {string}
 */
function roundFixed(n, decimals) {
  const d = Math.min(8, Math.max(0, decimals | 0));
  const p = 10 ** d;
  const x = Math.round(n * p) / p;
  if (d === 0) return String(Math.round(x));
  let s = x.toFixed(d);
  if (s.includes('e')) return String(x);
  return s;
}

/**
 * @param {number} n
 * @param {number} decimals
 * @returns {string}
 */
export function formatCompactNumber(n, decimals = 1) {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v < 1000) return sign + roundFixed(v, Math.min(decimals, 2));
  const units = [
    { s: 1e12, k: 'T' },
    { s: 1e9, k: 'B' },
    { s: 1e6, k: 'M' },
    { s: 1e3, k: 'k' },
  ];
  for (const u of units) {
    if (v >= u.s) {
      const t = v / u.s;
      return `${sign}${roundFixed(t, decimals)}${u.k}`;
    }
  }
  return sign + roundFixed(v, decimals);
}

/**
 * @param {number|null|undefined} num
 * @param {{
 *   format?: string,
 *   currency?: string,
 *   decimals?: number,
 *   compact?: boolean,
 *   formula?: string,
 * }} opts
 * @returns {string}
 */
export function formatKpiValue(num, opts = {}) {
  const {
    format = 'number',
    currency = 'USD',
    decimals = 2,
    compact = true,
    formula = '',
  } = opts;
  if (!isFiniteNumber(num)) return '—';

  if (formula && isSingleMinMaxAggFormula(String(formula))) {
    return formatAggTimestampMsForDisplay(num);
  }
  if (format === 'percent') {
    const p = num * 100;
    return `${roundFixed(p, decimals)}%`;
  }

  if (format === 'currency') {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: String(currency || 'USD').slice(0, 3).toUpperCase(),
        minimumFractionDigits: Math.min(4, Math.max(0, decimals | 0)),
        maximumFractionDigits: Math.min(4, Math.max(0, decimals | 0)),
        notation: compact && Math.abs(num) >= 1000 ? 'compact' : 'standard',
        compactDisplay: 'short',
      }).format(num);
    } catch {
      return `${currency} ${roundFixed(num, decimals)}`;
    }
  }

  if (compact && Math.abs(num) >= 1000) {
    return formatCompactNumber(num, Math.min(2, decimals || 1));
  }
  const parts = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals > 0 ? Math.min(decimals, 4) : 0,
    maximumFractionDigits: Math.min(decimals, 4),
  }).formatToParts(num);
  return parts.map((p) => p.value).join('');
}

/**
 * @param {number|null|undefined} delta
 * @param {{ decimals?: number, compact?: boolean }} opts
 * @returns {string}
 */
export function formatDelta(delta, opts = {}) {
  if (!isFiniteNumber(delta)) return '—';
  const { decimals = 0, compact = true } = opts;
  const abs = Math.abs(delta);
  const body =
    compact && abs >= 1000
      ? formatCompactNumber(abs, Math.min(2, decimals || 1))
      : roundFixed(abs, decimals);
  if (delta > 0) return `+${body}`;
  if (delta < 0) return `-${body}`;
  return '0';
}

/**
 * @param {number|null|undefined} percent — e.g. 11.1 for +11.1%
 * @param {{ decimals?: number }} opts
 * @returns {string}
 */
export function formatPercentChange(percent, opts = {}) {
  const { decimals = 1 } = opts;
  if (percent === null || percent === undefined) return '∞';
  if (!Number.isFinite(percent)) return '—';
  const s = percent > 0 ? '+' : '';
  return `${s}${roundFixed(percent, decimals)}%`;
}

/**
 * @param {number|null|undefined} delta
 * @returns {'up'|'down'|'neutral'}
 */
export function chooseTrend(delta) {
  if (!isFiniteNumber(delta)) return 'neutral';
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'neutral';
}

/**
 * @param {number|null|undefined} current
 * @param {number|null|undefined} previous
 * @returns {number|null} — null = infinite / undefined (prev 0, cur non-0)
 */
export function computePercentChange(current, previous) {
  if (!isFiniteNumber(current) || !isFiniteNumber(previous)) return null;
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return ((current - previous) / previous) * 100;
}
