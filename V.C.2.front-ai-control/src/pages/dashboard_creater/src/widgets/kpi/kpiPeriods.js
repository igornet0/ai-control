/**
 * KPI calendar periods (browser-local dates).
 * @typedef {{ start: string, end: string }} DateRangeYMD — inclusive YYYY-MM-DD
 */

/**
 * @param {Date} d
 * @returns {string}
 */
export function formatLocalYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {string} s
 * @returns {Date}
 */
export function parseLocalYMD(s) {
  const [y, m, d] = String(s || '')
    .trim()
    .split('-')
    .map((x) => parseInt(x, 10));
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

/**
 * @param {Date} d
 * @param {number} days
 * @returns {Date}
 */
export function addCalendarDays(d, days) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * Monday-based week start (local).
 * @param {Date} d
 * @returns {Date}
 */
export function startOfWeekMonday(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

/**
 * @param {Date} d
 * @returns {Date}
 */
export function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * @param {Date} d
 * @returns {Date}
 */
export function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/**
 * Core calendar current + immediately previous period (local).
 * @param {'day'|'week'|'month'|'custom'} period
 * @param {{ start?: string, end?: string }} customRange
 * @param {Date} n — normalized "today" (date-only)
 */
function computeCurrentAndPreviousCore(period, customRange, n) {
  if (period === 'day') {
    const curStart = n;
    const curEnd = n;
    const prev = addCalendarDays(n, -1);
    return {
      current: { start: formatLocalYMD(curStart), end: formatLocalYMD(curEnd) },
      previous: { start: formatLocalYMD(prev), end: formatLocalYMD(prev) },
    };
  }

  if (period === 'week') {
    const mon = startOfWeekMonday(n);
    const sun = addCalendarDays(mon, 6);
    const prevMon = addCalendarDays(mon, -7);
    const prevSun = addCalendarDays(mon, -1);
    return {
      current: { start: formatLocalYMD(mon), end: formatLocalYMD(sun) },
      previous: { start: formatLocalYMD(prevMon), end: formatLocalYMD(prevSun) },
    };
  }

  if (period === 'month') {
    const sm = startOfMonth(n);
    const em = endOfMonth(n);
    const prevMonthLast = addCalendarDays(sm, -1);
    const psm = startOfMonth(prevMonthLast);
    const pem = endOfMonth(prevMonthLast);
    return {
      current: { start: formatLocalYMD(sm), end: formatLocalYMD(em) },
      previous: { start: formatLocalYMD(psm), end: formatLocalYMD(pem) },
    };
  }

  if (period === 'custom') {
    const startStr = String(customRange?.start || '').trim();
    const endStr = String(customRange?.end || '').trim();
    const a = parseLocalYMD(startStr);
    const b = parseLocalYMD(endStr);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
      const fb = n;
      return {
        current: { start: formatLocalYMD(fb), end: formatLocalYMD(fb) },
        previous: { start: formatLocalYMD(addCalendarDays(fb, -1)), end: formatLocalYMD(addCalendarDays(fb, -1)) },
      };
    }
    let lo = a;
    let hi = b;
    if (lo > hi) {
      const t = lo;
      lo = hi;
      hi = t;
    }
    const daysInclusive =
      Math.round((hi.getTime() - lo.getTime()) / 86400000) + 1;
    const prevEnd = addCalendarDays(lo, -1);
    const prevStart = addCalendarDays(prevEnd, -(daysInclusive - 1));
    return {
      current: { start: formatLocalYMD(lo), end: formatLocalYMD(hi) },
      previous: { start: formatLocalYMD(prevStart), end: formatLocalYMD(prevEnd) },
    };
  }

  return computeCurrentAndPreviousCore('month', {}, n);
}

/**
 * @param {'previous'|'yoy'|'wow'} comparisonMode
 * @param {'day'|'week'|'month'|'custom'} period
 * @param {{ start?: string, end?: string }} customRange
 * @param {Date} [now]
 * @returns {{ current: DateRangeYMD, previous: DateRangeYMD }}
 */
export function computePeriodRanges(period, customRange, now = new Date(), comparisonMode = 'previous') {
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const { current, previous } = computeCurrentAndPreviousCore(period, customRange, n);

  if (comparisonMode === 'wow') {
    const curStart = parseLocalYMD(current.start);
    const curEnd = parseLocalYMD(current.end);
    const prevStart = addCalendarDays(curStart, -7);
    const prevEnd = addCalendarDays(curEnd, -7);
    return {
      current,
      previous: { start: formatLocalYMD(prevStart), end: formatLocalYMD(prevEnd) },
    };
  }

  if (comparisonMode === 'yoy') {
    const curStart = parseLocalYMD(current.start);
    const curEnd = parseLocalYMD(current.end);
    const prevStart = new Date(curStart.getFullYear() - 1, curStart.getMonth(), curStart.getDate());
    const prevEnd = new Date(curEnd.getFullYear() - 1, curEnd.getMonth(), curEnd.getDate());
    return {
      current,
      previous: { start: formatLocalYMD(prevStart), end: formatLocalYMD(prevEnd) },
    };
  }

  return { current, previous };
}

const RANGE_OPS = new Set(['gte', 'lte', 'between', 'gt', 'lt']);

/**
 * @param {unknown} raw
 * @returns {string|null} YYYY-MM-DD in local calendar
 */
export function filterBoundToLocalYmd(raw) {
  if (raw === '' || raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const n = Number(raw);
  if (Number.isFinite(n)) {
    const looksEpochMs = Math.abs(n) > 1e11;
    const looksEpochSec = n > 1e8 && n < 1e11;
    const d = new Date(looksEpochSec ? n * 1000 : looksEpochMs ? n : NaN);
    if (!Number.isNaN(d.getTime())) return formatLocalYMD(d);
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return formatLocalYMD(d);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/**
 * Откуда взят диапазон дат KPI: дашборд, запасной диапазон виджета, или ниоткуда (тогда можно включить авто по данным).
 * @param {Array<{ table: string, column: string, op: string, value?: unknown, values?: unknown[] }>} filters
 * @param {string} table
 * @param {string} dateField
 * @param {{ start?: string, end?: string }} customRange
 * @returns {{ source: 'dashboard'|'widget'|'none', range: { start: string, end: string } | null }}
 */
export function resolveKpiDateRangeWithSource(filters, table, dateField, customRange = {}) {
  const col = String(dateField || '').trim();
  const tbl = String(table || '').trim();
  if (!col || !tbl) return { source: 'none', range: null };

  /** @type {string|null} */
  let lo = null;
  /** @type {string|null} */
  let hi = null;

  const setLo = (ymd) => {
    if (!ymd) return;
    lo = lo == null || ymd > lo ? ymd : lo;
  };
  const setHi = (ymd) => {
    if (!ymd) return;
    hi = hi == null || ymd < hi ? ymd : hi;
  };

  for (const f of filters || []) {
    if (f.table !== tbl || f.column !== col) continue;
    const op = String(f.op || '').toLowerCase();
    if (!RANGE_OPS.has(op)) continue;
    if (op === 'between' && Array.isArray(f.values) && f.values.length >= 2) {
      const a = filterBoundToLocalYmd(f.values[0]);
      const b = filterBoundToLocalYmd(f.values[1]);
      if (a && b) {
        if (a <= b) {
          setLo(a);
          setHi(b);
        } else {
          setLo(b);
          setHi(a);
        }
      }
      continue;
    }
    if (op === 'gte' || op === 'gt') {
      const y = filterBoundToLocalYmd(f.value);
      if (y) setLo(op === 'gt' ? formatLocalYMD(addCalendarDays(parseLocalYMD(y), 1)) : y);
    }
    if (op === 'lte' || op === 'lt') {
      const y = filterBoundToLocalYmd(f.value);
      if (y) setHi(op === 'lt' ? formatLocalYMD(addCalendarDays(parseLocalYMD(y), -1)) : y);
    }
  }

  if (lo && hi) {
    if (lo > hi) {
      const t = lo;
      lo = hi;
      hi = t;
    }
    return { source: 'dashboard', range: { start: lo, end: hi } };
  }

  const cs = String(customRange?.start || '').trim();
  const ce = String(customRange?.end || '').trim();
  const a = parseLocalYMD(cs);
  const b = parseLocalYMD(ce);
  if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
    let loD = a;
    let hiD = b;
    if (loD > hiD) {
      const t = loD;
      loD = hiD;
      hiD = t;
    }
    return { source: 'widget', range: { start: formatLocalYMD(loD), end: formatLocalYMD(hiD) } };
  }

  return { source: 'none', range: null };
}

/**
 * Current KPI window: global gte/lte (or between) on (table, dateField), else customRange.
 * @param {Array<{ table: string, column: string, op: string, value?: unknown, values?: unknown[] }>} filters
 * @param {string} table
 * @param {string} dateField
 * @param {{ start?: string, end?: string }} customRange
 * @returns {{ start: string, end: string } | null}
 */
export function resolveKpiCurrentRange(filters, table, dateField, customRange = {}) {
  return resolveKpiDateRangeWithSource(filters, table, dateField, customRange).range;
}

/**
 * @param {{ start: string, end: string }} currentRange — inclusive YMD
 * @param {'previous_period'|'previous_year'|'custom'} deltaMode
 * @param {{ start?: string, end?: string }} deltaCustomRange
 * @returns {{ start: string, end: string } | null}
 */
export function computeComparisonRange(currentRange, deltaMode, deltaCustomRange = {}) {
  if (!currentRange?.start || !currentRange?.end) return null;
  const mode = String(deltaMode || 'previous_period');

  if (mode === 'custom') {
    const cs = String(deltaCustomRange?.start || '').trim();
    const ce = String(deltaCustomRange?.end || '').trim();
    const a = parseLocalYMD(cs);
    const b = parseLocalYMD(ce);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
    let lo = a;
    let hi = b;
    if (lo > hi) {
      const t = lo;
      lo = hi;
      hi = t;
    }
    return { start: formatLocalYMD(lo), end: formatLocalYMD(hi) };
  }

  const curStart = parseLocalYMD(currentRange.start);
  const curEnd = parseLocalYMD(currentRange.end);
  if (Number.isNaN(curStart.getTime()) || Number.isNaN(curEnd.getTime())) return null;

  if (mode === 'previous_year') {
    const prevStart = new Date(curStart.getFullYear() - 1, curStart.getMonth(), curStart.getDate());
    const prevEnd = new Date(curEnd.getFullYear() - 1, curEnd.getMonth(), curEnd.getDate());
    return { start: formatLocalYMD(prevStart), end: formatLocalYMD(prevEnd) };
  }

  // previous_period: shift back by inclusive span length
  const daysInclusive = Math.round((curEnd.getTime() - curStart.getTime()) / 86400000) + 1;
  const prevEnd = addCalendarDays(curStart, -1);
  const prevStart = addCalendarDays(prevEnd, -(daysInclusive - 1));
  return { start: formatLocalYMD(prevStart), end: formatLocalYMD(prevEnd) };
}

