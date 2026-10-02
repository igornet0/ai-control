/**
 * Кросс-фильтрация для UI списков значений: один запрос «весь домен» + один с AND-фильтрами.
 * Мемоизация по сигнатуре состояния фильтров модели.
 */

import { collectDashboardFilters, filtersForModel } from './dashboardFilterUtils.js';
import { filtersForModelFromSnapshot, getDashboardFilterSnapshot } from './dashboardFilterTransport.js';

const MEMO_MAX = 48;
const memo = new Map();

function _cmpStr(a, b) {
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });
}

/**
 * Стабильная подпись активных фильтров одной модели (для кэша и сравнения).
 * @param {object} engine
 * @param {number|string} modelId
 */
export function filterStateSignature(engine, modelId) {
  const snap = getDashboardFilterSnapshot(engine);
  const rows =
    snap?.predicatesByModelId != null
      ? filtersForModelFromSnapshot(snap, modelId)
      : filtersForModel(collectDashboardFilters(engine), modelId);
  const norm = [...rows]
    .map((r) => ({
      table: String(r.table || ''),
      column: String(r.column || ''),
      op: String(r.op || 'eq'),
      value: r.value,
      values: r.values != null ? [...r.values].map((x) => String(x)).sort(_cmpStr) : undefined,
    }))
    .sort((a, b) => {
      const k1 = `${a.table}\0${a.column}\0${a.op}`;
      const k2 = `${b.table}\0${b.column}\0${b.op}`;
      return k1.localeCompare(k2);
    });
  return JSON.stringify(norm);
}

/** Согласовано с серверным cap в `run_column_distinct`. */
export const COLUMN_DISTINCT_MAX_LIMIT = 10000;

function _partitionCacheKey(fl, ctxSig) {
  const pat = String(fl.pattern ?? '').trim();
  const lim = Number(fl.limit) || COLUMN_DISTINCT_MAX_LIMIT;
  return JSON.stringify({
    m: fl.modelId,
    t: String(fl.table || ''),
    c: String(fl.field || ''),
    p: pat,
    l: Math.min(COLUMN_DISTINCT_MAX_LIMIT, Math.max(1, lim)),
    ctx: ctxSig,
  });
}

function _memoGet(key) {
  const e = memo.get(key);
  if (!e) return null;
  /** LRU: перенести ключ в конец Map (предпочтение при давлении MEMO_MAX). */
  memo.delete(key);
  memo.set(key, e);
  return e.value;
}

function _memoSet(key, value) {
  if (memo.size >= MEMO_MAX && !memo.has(key)) {
    const first = memo.keys().next();
    if (!first.done) memo.delete(first.value);
  }
  memo.set(key, { value });
}

/** Полный сброс кэша (смена датасета, принудительный refresh). */
export function bumpDashboardCrossFilterMemo() {
  memo.clear();
}

/**
 * Сброс кэша только для указанных data-model — при изменении фильтров другая модель в кэше остаётся валидной.
 * Ключ построения совпадает с `_partitionCacheKey` ({ m, t, c, ... }).
 * @param {Array<string|number>} modelIds
 */
export function purgeDashboardCrossFilterMemoForModels(modelIds) {
  if (!Array.isArray(modelIds) || modelIds.length === 0) return;
  const want = new Set(modelIds.map((x) => String(x)));
  for (const key of memo.keys()) {
    try {
      const o = JSON.parse(key);
      if (want.has(String(o.m))) memo.delete(key);
    } catch {
      memo.delete(key);
    }
  }
}

/** Сообщение в списке значений, если ответ column-distinct усечён по лимиту. */
export function formatDistinctTruncationHint(truncated, totalDistinct, meta = {}) {
  if (!truncated) return '';
  const ctxTruncated = Boolean(meta.ctxTruncated);
  const ctxReturned =
    meta.ctxValuesReturned != null && Number.isFinite(Number(meta.ctxValuesReturned))
      ? Number(meta.ctxValuesReturned)
      : null;
  const td =
    totalDistinct != null && Number.isFinite(Number(totalDistinct))
      ? Number(totalDistinct)
      : null;
  if (ctxTruncated && td != null && ctxReturned != null) {
    return ` Показано ${ctxReturned} из ${td} значений в текущих фильтрах.`;
  }
  return '';
}

/**
 * @param {string[]} allList — distinct без глобальных фильтров (усечённый LIMIT)
 * @param {string[]} ctxVals — distinct с AND-фильтрами (усечённый LIMIT); «доступные» строятся отсюда
 * @param {unknown[]} selectedValues
 * @returns {{ rows: Array<{ value: string, stale: boolean }> }}
 */
export function buildOrderedOptions(allList, ctxVals, selectedValues, excludedValues) {
  const sel = [...(selectedValues || [])].map((x) => String(x));
  const exc = [...(excludedValues || [])].map((x) => String(x));
  const selectedSeen = new Set();
  const selectedSet = new Set();

  const inFiltered = new Set((ctxVals || []).map((x) => String(x)));

  /** Доступные: весь ответ ctx, а не пересечение с усечённым allList. */
  const relevant = [];
  const seenR = new Set();
  for (const v of ctxVals || []) {
    const s = String(v);
    if (!seenR.has(s)) {
      seenR.add(s);
      relevant.push(s);
    }
  }
  relevant.sort(_cmpStr);

  const stale = [];
  const seenS = new Set();
  for (const v of allList || []) {
    const s = String(v);
    if (!inFiltered.has(s) && !seenS.has(s)) {
      seenS.add(s);
      stale.push(s);
    }
  }
  stale.sort(_cmpStr);

  /** 1) Включённые, 2) исключённые, 3) доступные, 4) stale */
  const rows = [];
  for (const s of sel) {
    if (selectedSeen.has(s)) continue;
    selectedSeen.add(s);
    selectedSet.add(s);
    rows.push({ value: s, stale: !inFiltered.has(s) });
  }
  for (const s of exc) {
    if (selectedSeen.has(s)) continue;
    selectedSeen.add(s);
    selectedSet.add(s);
    rows.push({ value: s, stale: !inFiltered.has(s) });
  }

  /** 2) Остальные доступные. 3) Недоступные под кросс-фильтром — в конце. */
  for (const value of relevant) {
    if (selectedSet.has(value)) continue;
    rows.push({ value, stale: false });
  }
  for (const value of stale) {
    if (selectedSet.has(value)) continue;
    rows.push({ value, stale: true });
  }

  return { rows };
}

/**
 * @param {object} options
 * @param {object} options.fl — строка фильтра виджета (modelId, table, field, pattern, selectedValues)
 * @param {object} options.engine — WorkspaceEngine
 * @param {AbortSignal} [options.signal]
 * @param {typeof import('./dashboardQueryService.js').postColumnDistinct} options.postColumnDistinct
 * @returns {Promise<DistinctPartition>}
 */
export async function loadDistinctPartition({ fl, engine, signal, postColumnDistinct }) {
  const effectiveSignal = signal ?? engine?.requestSignal;
  if (effectiveSignal?.aborted) {
    throw new DOMException('aborted', 'AbortError');
  }
  const limit = Math.min(
    COLUMN_DISTINCT_MAX_LIMIT,
    Math.max(1, Number(fl.limit) || COLUMN_DISTINCT_MAX_LIMIT),
  );
  const patternRaw = String(fl.pattern ?? '').trim();
  const bodyBase = {
    table: fl.table,
    column: fl.field,
    pattern: patternRaw || null,
    limit,
    filters: [],
  };

  const snap = getDashboardFilterSnapshot(engine);
  const ctxRows =
    snap?.predicatesByModelId != null
      ? filtersForModelFromSnapshot(snap, fl.modelId)
      : filtersForModel(collectDashboardFilters(engine), fl.modelId);
  const ctxSig = filterStateSignature(engine, fl.modelId);
  const key = _partitionCacheKey({ ...fl, limit }, ctxSig);
  const cached = _memoGet(key);
  if (cached) return cached;
  const ctxFilters = ctxRows;

  let allRes;
  let ctxRes;
  if (!Array.isArray(ctxFilters) || ctxFilters.length === 0) {
    allRes = await postColumnDistinct(fl.modelId, { ...bodyBase, filters: [] }, { signal: effectiveSignal });
    ctxRes = allRes;
  } else {
    [allRes, ctxRes] = await Promise.all([
      postColumnDistinct(fl.modelId, { ...bodyBase, filters: [] }, { signal: effectiveSignal }),
      postColumnDistinct(fl.modelId, { ...bodyBase, filters: ctxFilters }, { signal: effectiveSignal }),
    ]);
  }

  if (effectiveSignal?.aborted) {
    throw new DOMException('aborted', 'AbortError');
  }

  const all = Array.isArray(allRes?.values) ? allRes.values : [];
  const ctxVals = Array.isArray(ctxRes?.values) ? ctxRes.values : [];
  const partition = buildOrderedOptions(all, ctxVals, fl.selectedValues, fl.excludedValues);
  const ctxTrunc = Boolean(ctxRes?.truncated);
  const allTrunc = Boolean(allRes?.truncated);
  const totalDistinct =
    ctxRes?.total_distinct != null && Number.isFinite(Number(ctxRes.total_distinct))
      ? Number(ctxRes.total_distinct)
      : null;
  const out = {
    ...partition,
    truncated: ctxTrunc || allTrunc,
    totalDistinct,
    hintMeta: { ctxTruncated: ctxTrunc, ctxValuesReturned: ctxVals.length },
  };
  _memoSet(key, out);
  return out;
}
