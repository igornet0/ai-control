/**
 * Универсальная временная гранулярность для KPI (локальный календарь).
 * @typedef {'auto'|'minute'|'hour'|'day'|'week'|'month'} KpiGranularity
 */

import { addCalendarDays, formatLocalYMD, parseLocalYMD, startOfWeekMonday } from './kpiPeriods.js';

/**
 * @param {unknown} raw
 * @returns {Date}
 */
export function parseFlexibleToLocalDate(raw) {
  if (raw === '' || raw == null) return new Date(NaN);
  const n = Number(raw);
  if (Number.isFinite(n)) {
    if (Math.abs(n) > 1e11) return new Date(n);
    if (n > 1e8 && n < 1e11) return new Date(n * 1000);
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return parseLocalYMD(s);
  const d = new Date(s);
  return d;
}

/**
 * Inclusive calendar-day bounds for YMD; if string has time, use parsed instant.
 * @param {string} startStr
 * @param {string} endStr
 * @returns {{ loMs: number, hiMs: number } | null}
 */
export function inclusiveRangeToLocalMs(startStr, endStr) {
  const s0 = String(startStr || '').trim();
  const s1 = String(endStr || '').trim();
  const ymd0 = /^\d{4}-\d{2}-\d{2}$/.test(s0);
  const ymd1 = /^\d{4}-\d{2}-\d{2}$/.test(s1);
  if (ymd0 && ymd1) {
    const lo = parseLocalYMD(s0);
    const hi = parseLocalYMD(s1);
    if (Number.isNaN(lo.getTime()) || Number.isNaN(hi.getTime())) return null;
    let a = lo;
    let b = hi;
    if (a > b) {
      const t = a;
      a = b;
      b = t;
    }
    const loMs = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 0, 0, 0, 0).getTime();
    const hiMs = new Date(b.getFullYear(), b.getMonth(), b.getDate(), 23, 59, 59, 999).getTime();
    return { loMs, hiMs };
  }
  const lo = parseFlexibleToLocalDate(s0);
  const hi = parseFlexibleToLocalDate(s1);
  if (Number.isNaN(lo.getTime()) || Number.isNaN(hi.getTime())) return null;
  let a = lo;
  let b = hi;
  if (a > b) {
    const t = a;
    a = b;
    b = t;
  }
  return { loMs: a.getTime(), hiMs: b.getTime() };
}

/**
 * @param {Date} d
 * @returns {string}
 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Нижняя граница окна для SQLite TEXT: без «.000», чтобы `gte` не отсекал строки без дробной части
 * (лексикографически `...12:34:00` < `...12:34:00.000`).
 * @param {Date} d
 */
export function formatLocalSqlDateTimeStart(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  const base = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  const ms = d.getMilliseconds();
  if (ms !== 0) return `${base}.${String(ms).padStart(3, '0')}`;
  return base;
}

/**
 * Верхняя граница окна: всегда с миллисекундами, чтобы `lte` включал конец бакета (напр. …59.999).
 * @param {Date} d
 */
export function formatLocalSqlDateTimeEnd(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  const base = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  const ms = d.getMilliseconds();
  return `${base}.${String(ms).padStart(3, '0')}`;
}

/** @deprecated Используйте formatLocalSqlDateTimeStart / End для диапазонов KPI. */
export function formatLocalSqlDateTime(d) {
  return formatLocalSqlDateTimeStart(d);
}

/**
 * @param {number} durMs
 * @returns {'minute'|'hour'|'day'|'week'|'month'}
 */
export function autoGranularityFromDurationMs(durMs) {
  const d = Math.max(0, durMs) / 86400000;
  if (d < 1) return 'minute';
  if (d <= 14) return 'day';
  if (d <= 90) return 'week';
  return 'month';
}

/**
 * @param {string|undefined} setting
 * @param {number} loMs
 * @param {number} hiMs
 * @returns {'minute'|'hour'|'day'|'week'|'month'}
 */
export function resolveEffectiveGranularity(setting, loMs, hiMs) {
  const s = String(setting || 'auto').toLowerCase();
  if (s === 'minute' || s === 'hour' || s === 'day' || s === 'week' || s === 'month') return /** @type {any} */ (s);
  return autoGranularityFromDurationMs(hiMs - loMs);
}

/**
 * Начало бакета (локально).
 * @param {Date} d
 * @param {'minute'|'hour'|'day'|'week'|'month'} g
 */
export function bucketStartLocal(d, g) {
  const x = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
  if (g === 'month') return new Date(x.getFullYear(), x.getMonth(), 1, 0, 0, 0, 0);
  if (g === 'week') {
    const mon = startOfWeekMonday(x);
    mon.setHours(0, 0, 0, 0);
    return mon;
  }
  if (g === 'day') return new Date(x.getFullYear(), x.getMonth(), x.getDate(), 0, 0, 0, 0);
  if (g === 'hour') return new Date(x.getFullYear(), x.getMonth(), x.getDate(), x.getHours(), 0, 0, 0);
  if (g === 'minute') return new Date(x.getFullYear(), x.getMonth(), x.getDate(), x.getHours(), x.getMinutes(), 0, 0);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate(), 0, 0, 0, 0);
}

/**
 * Начало временного бакета для метки времени (локальная таймзона браузера).
 * @param {number|string|Date} timestamp
 * @param {'minute'|'hour'|'day'|'week'|'month'} granularity
 * @returns {Date}
 */
export function bucket(timestamp, granularity) {
  const d =
    timestamp instanceof Date
      ? new Date(timestamp.getTime())
      : typeof timestamp === 'number'
        ? new Date(timestamp)
        : parseFlexibleToLocalDate(timestamp);
  if (Number.isNaN(d.getTime())) return new Date(NaN);
  const g = String(granularity || 'day').toLowerCase();
  if (!['minute', 'hour', 'day', 'week', 'month'].includes(g)) return new Date(NaN);
  return bucketStartLocal(d, /** @type {'minute'|'hour'|'day'|'week'|'month'} */ (g));
}

/**
 * Последняя миллисекунда бакета, содержащего d (включительно).
 * @param {Date} d
 * @param {'minute'|'hour'|'day'|'week'|'month'} g
 */
export function bucketEndInclusiveLocal(d, g) {
  const s = bucketStartLocal(d, g);
  if (g === 'minute') return new Date(s.getTime() + 60 * 1000 - 1);
  if (g === 'hour') return new Date(s.getTime() + 3600 * 1000 - 1);
  if (g === 'day') return new Date(s.getFullYear(), s.getMonth(), s.getDate(), 23, 59, 59, 999);
  if (g === 'week') {
    const sun = addCalendarDays(s, 6);
    return new Date(sun.getFullYear(), sun.getMonth(), sun.getDate(), 23, 59, 59, 999);
  }
  if (g === 'month') {
    const last = new Date(s.getFullYear(), s.getMonth() + 1, 0, 23, 59, 59, 999);
    return last;
  }
  return new Date(s.getFullYear(), s.getMonth(), s.getDate(), 23, 59, 59, 999);
}

/**
 * @param {Date} d
 * @param {'minute'|'hour'|'day'|'week'|'month'} g
 */
export function toBucketKey(d, g) {
  const b = bucketStartLocal(d, g);
  return `${g}:${b.getTime()}`;
}

/**
 * Выравнивание включительного окна по гранулярности (локально).
 * @param {number} loMs
 * @param {number} hiMs
 * @param {'minute'|'hour'|'day'|'week'|'month'} g
 * @returns {{ loMs: number, hiMs: number }}
 */
export function alignInclusiveRangeMs(loMs, hiMs, g) {
  const lo = bucketStartLocal(new Date(loMs), g).getTime();
  const hi = bucketEndInclusiveLocal(new Date(hiMs), g).getTime();
  if (hi < lo) return { loMs: lo, hiMs: lo };
  return { loMs: lo, hiMs: hi };
}

/**
 * Нормализация сдвига периода KPI (≥ 0, целый).
 * @param {unknown} raw
 * @returns {number}
 */
export function normalizeKpiPeriodShift(raw) {
  const n = parseInt(String(raw ?? '0'), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  // Практический потолок против переполнения Date; в UI верх не навязываем.
  return Math.min(n, 1_000_000);
}

/**
 * Сдвиг включительного окна назад на `steps` шагов гранулярности.
 * steps=0 — без изменений; steps=1 — на один шаг времени назад и т.д.
 *
 * @param {number} loMs
 * @param {number} hiMs
 * @param {'minute'|'hour'|'day'|'week'|'month'|string} granularity
 * @param {unknown} steps
 * @returns {{ loMs: number, hiMs: number }}
 */
export function shiftInclusiveRangeByGranularitySteps(loMs, hiMs, granularity, steps) {
  const n = normalizeKpiPeriodShift(steps);
  if (!n || !Number.isFinite(loMs) || !Number.isFinite(hiMs)) {
    return { loMs, hiMs };
  }
  const g0 = String(granularity || 'day').toLowerCase();
  const g = /** @type {'minute'|'hour'|'day'|'week'|'month'} */ (
    ['minute', 'hour', 'day', 'week', 'month'].includes(g0) ? g0 : 'day'
  );

  /**
   * @param {number} ms
   * @param {number} dir — −1 назад, +1 вперёд
   */
  const shiftPoint = (ms, dir) => {
    const d = new Date(ms);
    if (g === 'week' || g === 'day') {
      const days = g === 'week' ? n * 7 : n;
      const base = addCalendarDays(d, dir * days);
      return new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        d.getHours(),
        d.getMinutes(),
        d.getSeconds(),
        d.getMilliseconds(),
      ).getTime();
    }
    if (g === 'hour') return ms + dir * n * 3600 * 1000;
    if (g === 'minute') return ms + dir * n * 60 * 1000;
    return ms + dir * n * 86400 * 1000;
  };

  if (g === 'month') {
    const loB = bucketStartLocal(new Date(loMs), 'month');
    const hiB = bucketStartLocal(new Date(hiMs), 'month');
    const lo2 = new Date(loB.getFullYear(), loB.getMonth() - n, 1, 0, 0, 0, 0).getTime();
    const hiRef = new Date(hiB.getFullYear(), hiB.getMonth() - n, 1, 0, 0, 0, 0);
    const hi2 = bucketEndInclusiveLocal(hiRef, 'month').getTime();
    if (!Number.isFinite(lo2) || !Number.isFinite(hi2)) return { loMs, hiMs };
    return lo2 <= hi2 ? { loMs: lo2, hiMs: hi2 } : { loMs: hi2, hiMs: lo2 };
  }

  const lo2 = shiftPoint(loMs, -1);
  const hi2 = shiftPoint(hiMs, -1);
  if (!Number.isFinite(lo2) || !Number.isFinite(hi2)) return { loMs, hiMs };
  return alignInclusiveRangeMs(lo2, hi2, g);
}

/**
 * Строки для фильтров gte/lte (локальное время).
 * @param {number} loMs
 * @param {number} hiMs
 */
export function formatAlignedRangeForSql(loMs, hiMs) {
  return {
    start: formatLocalSqlDateTimeStart(new Date(loMs)),
    end: formatLocalSqlDateTimeEnd(new Date(hiMs)),
  };
}

/**
 * Сравнительный период в миллисекундах (согласован с гранулярностью по границам — вызывать после align current).
 * @param {number} curLoMs
 * @param {number} curHiMs
 * @param {'previous_period'|'previous_year'|'custom'} deltaMode
 * @param {{ start?: string, end?: string }} deltaCustomRange
 */
export function computeComparisonRangeFromMs(curLoMs, curHiMs, deltaMode, deltaCustomRange = {}) {
  const mode = String(deltaMode || 'previous_period');

  if (mode === 'custom') {
    const cs = String(deltaCustomRange?.start || '').trim();
    const ce = String(deltaCustomRange?.end || '').trim();
    const b = inclusiveRangeToLocalMs(cs, ce);
    return b;
  }

  if (mode === 'previous_year') {
    const lo = new Date(curLoMs);
    const hi = new Date(curHiMs);
    const pLo = new Date(
      lo.getFullYear() - 1,
      lo.getMonth(),
      lo.getDate(),
      lo.getHours(),
      lo.getMinutes(),
      lo.getSeconds(),
      lo.getMilliseconds(),
    );
    const pHi = new Date(
      hi.getFullYear() - 1,
      hi.getMonth(),
      hi.getDate(),
      hi.getHours(),
      hi.getMinutes(),
      hi.getSeconds(),
      hi.getMilliseconds(),
    );
    return { loMs: pLo.getTime(), hiMs: pHi.getTime() };
  }

  const dur = curHiMs - curLoMs + 1;
  const prevHi = curLoMs - 1;
  const prevLo = prevHi - dur + 1;
  return { loMs: prevLo, hiMs: prevHi };
}

/**
 * Окно сравнения для KPI после выравнивания текущего периода.
 * Для «месяц» — предыдущий календарный месяц (а не сдвиг на ту же длительность в мс).
 * Для «неделя» — сдвиг на длительность текущего окна (уже выровненного по неделям).
 *
 * @param {number} curLoMs
 * @param {number} curHiMs
 * @param {'minute'|'hour'|'day'|'week'|'month'|string} granularityEffective
 * @param {'previous_period'|'previous_year'|'custom'} deltaMode
 * @param {{ start?: string, end?: string }} [deltaCustomRange]
 * @param {{ mode?: 'calendar'|'shift' }} [options] — shift: сдвиг на длину окна (фильтр дашборда); calendar: календарные границы
 */
export function computePreviousKpiWindowMs(
  curLoMs,
  curHiMs,
  granularityEffective,
  deltaMode,
  deltaCustomRange = {},
  options = {},
) {
  const prevMode = options.mode === 'shift' ? 'shift' : 'calendar';
  const mode = String(deltaMode || 'previous_period');
  const g0 = String(granularityEffective || 'day').toLowerCase();
  const g = /** @type {'minute'|'hour'|'day'|'week'|'month'} */ (
    ['minute', 'hour', 'day', 'week', 'month'].includes(g0) ? g0 : 'day'
  );

  if (prevMode === 'shift') {
    if (mode === 'custom') {
      const cs = String(deltaCustomRange?.start || '').trim();
      const ce = String(deltaCustomRange?.end || '').trim();
      const b = inclusiveRangeToLocalMs(cs, ce);
      if (!b) return null;
      return { loMs: b.loMs, hiMs: b.hiMs };
    }
    if (mode === 'previous_year') {
      return computeComparisonRangeFromMs(curLoMs, curHiMs, 'previous_year', {});
    }
    return computeComparisonRangeFromMs(curLoMs, curHiMs, 'previous_period', {});
  }

  if (mode === 'custom') {
    const cs = String(deltaCustomRange?.start || '').trim();
    const ce = String(deltaCustomRange?.end || '').trim();
    const b = inclusiveRangeToLocalMs(cs, ce);
    if (!b) return null;
    const a = alignInclusiveRangeMs(b.loMs, b.hiMs, g);
    return { loMs: a.loMs, hiMs: a.hiMs };
  }

  if (mode === 'previous_year') {
    const r = computeComparisonRangeFromMs(curLoMs, curHiMs, 'previous_year', {});
    if (!r) return null;
    const a = alignInclusiveRangeMs(r.loMs, r.hiMs, g);
    return { loMs: a.loMs, hiMs: a.hiMs };
  }

  if (g === 'month') {
    const lo = new Date(curLoMs);
    const y = lo.getFullYear();
    const m = lo.getMonth();
    const prevStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const prevEnd = new Date(y, m, 0, 23, 59, 59, 999);
    return { loMs: prevStart.getTime(), hiMs: prevEnd.getTime() };
  }

  if (g === 'week') {
    const dur = curHiMs - curLoMs + 1;
    return { loMs: curLoMs - dur, hiMs: curHiMs - dur };
  }

  const r = computeComparisonRangeFromMs(curLoMs, curHiMs, 'previous_period', {});
  if (!r) return null;
  const a = alignInclusiveRangeMs(r.loMs, r.hiMs, g);
  return { loMs: a.loMs, hiMs: a.hiMs };
}
