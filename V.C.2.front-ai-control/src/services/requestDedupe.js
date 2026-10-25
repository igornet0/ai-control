/**
 * Дедупликация одинаковых GET-запросов метаданных.
 *
 * При монтировании дашборда несколько независимых компонентов запрашивают
 * одни и те же ресурсы (dashboard, data-models, sheets). Одновременные вызовы
 * делят один промис, а результат держится короткое время (TTL), чтобы
 * последовательные вызовы в рамках одной загрузки не шли в сеть повторно.
 * Мутации вызывают invalidateDedupe(prefix).
 */

const DEFAULT_TTL_MS = 2000;

/** @type {Map<string, { promise: Promise<any>, expires: number, settled: boolean }>} */
const _entries = new Map();

function clone(value) {
  if (value == null || typeof value !== 'object') return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

/**
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fetcher
 * @param {{ ttlMs?: number, force?: boolean }} [opts]
 * @returns {Promise<T>}
 */
export function dedupeGet(key, fetcher, { ttlMs = DEFAULT_TTL_MS, force = false } = {}) {
  const now = Date.now();
  const hit = _entries.get(key);
  if (!force && hit && (!hit.settled || hit.expires > now)) {
    return hit.promise.then(clone);
  }
  const entry = { promise: null, expires: Infinity, settled: false };
  entry.promise = Promise.resolve()
    .then(fetcher)
    .then(
      (value) => {
        entry.settled = true;
        entry.expires = Date.now() + ttlMs;
        return value;
      },
      (err) => {
        if (_entries.get(key) === entry) _entries.delete(key);
        throw err;
      },
    );
  _entries.set(key, entry);
  return entry.promise.then(clone);
}

/** Сбрасывает записи, ключ которых начинается с prefix (без аргумента — все). */
export function invalidateDedupe(prefix) {
  if (prefix == null) {
    _entries.clear();
    return;
  }
  for (const key of [..._entries.keys()]) {
    if (key.startsWith(prefix)) _entries.delete(key);
  }
}
