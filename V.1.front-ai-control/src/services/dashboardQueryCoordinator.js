/**
 * Единая точка запросов к SQLite-модели: дедупликация in-flight и короткий TTL-кэш.
 */

import { postModelSqliteQuery, postModelSqliteQueryBatch } from './dashboardQueryService.js';
import { runDashboardQueryBumpSideEffects } from './dashboardQueryBump.js';

const TTL_MS = 15000;
const MAX_CACHE = 64;

const inflight = new Map();
const cache = new Map();

function cacheKey(modelId, body) {
  return `${String(modelId)}\0${JSON.stringify(body)}`;
}

function trimCache() {
  while (cache.size > MAX_CACHE) {
    const first = cache.keys().next();
    if (first.done) break;
    cache.delete(first.value);
  }
}

/** Сброс кэша при смене фильтров / датасета. */
export function bumpDashboardQueryCoordinator() {
  cache.clear();
  inflight.clear();
  runDashboardQueryBumpSideEffects();
}

/**
 * @param {object} [_engine] — зарезервировано (инвалидация по движку)
 * @param {number|string} modelId
 * @param {object} body
 */
export async function runDashboardModelQuery(_engine, modelId, body) {
  const signal = _engine?.requestSignal;
  if (signal?.aborted) {
    throw new DOMException('aborted', 'AbortError');
  }
  const bypassCache = _engine?.__dashboardBypassCache === true;
  const key = cacheKey(modelId, body);
  const now = Date.now();
  const hit = cache.get(key);
  if (!bypassCache && hit && now - hit.at < TTL_MS) {
    return hit.data;
  }
  const inflightKey = bypassCache ? `${key}\0bypass` : key;
  if (inflight.has(inflightKey)) {
    return inflight.get(inflightKey);
  }
  if (!bypassCache && inflight.has(key)) {
    return inflight.get(key);
  }
  const p = postModelSqliteQuery(modelId, body, { bypassCache, signal })
    .then((data) => {
      if (!bypassCache) {
        cache.set(key, { at: Date.now(), data });
        trimCache();
      }
      inflight.delete(inflightKey);
      return data;
    })
    .catch((err) => {
      inflight.delete(inflightKey);
      throw err;
    });
  inflight.set(inflightKey, p);
  return p;
}

/**
 * Несколько запросов к одной модели за один HTTP POST (Rust query-batch через FastAPI).
 */
export async function runDashboardModelQueryBatch(_engine, modelId, bodies) {
  const signal = _engine?.requestSignal;
  if (signal?.aborted) {
    throw new DOMException('aborted', 'AbortError');
  }
  const bypassCache = _engine?.__dashboardBypassCache === true;
  if (!Array.isArray(bodies) || bodies.length === 0) {
    return { results: [] };
  }
  const data = await postModelSqliteQueryBatch(modelId, bodies, { bypassCache, signal });
  const results = Array.isArray(data?.results) ? data.results : [];
  if (!bypassCache) {
    const ts = Date.now();
    bodies.forEach((body, ix) => {
      const chunk = results[ix];
      if (!chunk) return;
      cache.set(cacheKey(modelId, body), { at: ts, data: chunk });
    });
    trimCache();
  }
  return { results };
}
