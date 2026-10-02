import axios from 'axios';
import api from './api';
import { getDashboardShareContext } from './shareLinkContext';
import { getApiBaseUrl } from './apiBaseUrl';
import { getAccessToken } from './tokenRefresh';

/** Согласован с FastAPI/Rust SQLITE_QUERY_RUST__TIMEOUT_SEC по умолчанию (~120). */
const SQLITE_QUERY_TIMEOUT_MS = 120000;
/** Один round-trip для нескольких тел — запас против суммы одиночных запросов и очереди concurrency. */
const SQLITE_QUERY_BATCH_TIMEOUT_MS = 180000;
const SQLITE_COLUMN_DISTINCT_TIMEOUT_MS = 60000;
/** Очередь на клиенте: при большом числе виджетов маленький concurrency даёт хвост > axios timeout. */
const SQLITE_QUERY_MAX_CONCURRENT = 6;
/** Отдельно от данных виджетов: списки фильтра не должны ждать в общей FIFO за query/query-batch. */
const SQLITE_DISTINCT_MAX_CONCURRENT = 4;

const _sqliteQueue = [];
let _sqliteRunning = 0;

const _distinctQueue = [];
let _distinctRunning = 0;

/** Клиентские метрики очереди SQLite (диагностика волн запросов дашборда). */
const _sqliteClientDiag = {
  enqueuedTotal: 0,
  startedTotal: 0,
  completedTotal: 0,
  waitMsSum: 0,
  waitSamples: 0,
  concurrentHighWater: 0,
};

/**
 * @returns {{ enqueuedTotal: number, startedTotal: number, completedTotal: number, waitMsAvg: number | null, concurrentHighWater: number, queued: number, running: number, distinctQueued: number, distinctRunning: number }}
 */
export function getDashboardSqliteClientDiagnostics() {
  const w = _sqliteClientDiag.waitSamples
    ? _sqliteClientDiag.waitMsSum / _sqliteClientDiag.waitSamples
    : null;
  return {
    enqueuedTotal: _sqliteClientDiag.enqueuedTotal,
    startedTotal: _sqliteClientDiag.startedTotal,
    completedTotal: _sqliteClientDiag.completedTotal,
    waitMsAvg: w,
    concurrentHighWater: _sqliteClientDiag.concurrentHighWater,
    queued: _sqliteQueue.length,
    running: _sqliteRunning,
    distinctQueued: _distinctQueue.length,
    distinctRunning: _distinctRunning,
  };
}

/** @internal тестам */
export function __resetDashboardSqliteClientDiagnosticsForTests() {
  _sqliteClientDiag.enqueuedTotal = 0;
  _sqliteClientDiag.startedTotal = 0;
  _sqliteClientDiag.completedTotal = 0;
  _sqliteClientDiag.waitMsSum = 0;
  _sqliteClientDiag.waitSamples = 0;
  _sqliteClientDiag.concurrentHighWater = 0;
}

function queueNowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function runWithSqliteConcurrencyLimit(task, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }
    _sqliteClientDiag.enqueuedTotal += 1;
    _sqliteQueue.push({ task, resolve, reject, enqueuedAt: queueNowMs(), signal });
    _drainSqliteQueue();
  });
}

function _drainSqliteQueue() {
  while (_sqliteRunning < SQLITE_QUERY_MAX_CONCURRENT && _sqliteQueue.length > 0) {
    const item = _sqliteQueue.shift();
    if (item.signal?.aborted) {
      item.reject(new DOMException('aborted', 'AbortError'));
      continue;
    }
    const startedAt = queueNowMs();
    _sqliteRunning += 1;
    _sqliteClientDiag.startedTotal += 1;
    _sqliteClientDiag.concurrentHighWater = Math.max(
      _sqliteClientDiag.concurrentHighWater,
      _sqliteRunning + _distinctRunning,
    );
    const waitMs = Math.max(0, startedAt - item.enqueuedAt);
    _sqliteClientDiag.waitMsSum += waitMs;
    _sqliteClientDiag.waitSamples += 1;
    Promise.resolve()
      .then(item.task)
      .then((result) => item.resolve(result))
      .catch((error) => item.reject(error))
      .finally(() => {
        _sqliteRunning -= 1;
        _sqliteClientDiag.completedTotal += 1;
        _drainSqliteQueue();
      });
  }
}

function runWithDistinctConcurrencyLimit(task, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }
    _distinctQueue.push({ task, resolve, reject, enqueuedAt: queueNowMs(), signal });
    _drainDistinctQueue();
  });
}

function _drainDistinctQueue() {
  while (_distinctRunning < SQLITE_DISTINCT_MAX_CONCURRENT && _distinctQueue.length > 0) {
    const item = _distinctQueue.shift();
    if (item.signal?.aborted) {
      item.reject(new DOMException('aborted', 'AbortError'));
      continue;
    }
    const startedAt = queueNowMs();
    _distinctRunning += 1;
    _sqliteClientDiag.startedTotal += 1;
    _sqliteClientDiag.concurrentHighWater = Math.max(
      _sqliteClientDiag.concurrentHighWater,
      _sqliteRunning + _distinctRunning,
    );
    const waitMs = Math.max(0, startedAt - item.enqueuedAt);
    _sqliteClientDiag.waitMsSum += waitMs;
    _sqliteClientDiag.waitSamples += 1;
    Promise.resolve()
      .then(item.task)
      .then((result) => item.resolve(result))
      .catch((error) => item.reject(error))
      .finally(() => {
        _distinctRunning -= 1;
        _sqliteClientDiag.completedTotal += 1;
        _drainDistinctQueue();
      });
  }
}

function apiRoot() {
  return getApiBaseUrl();
}

/**
 * @param {number|string} modelId
 * @param {object} body — SqliteDashboardQueryRequest
 * @returns {Promise<{ rows: Array, sql: string }>}
 */
export async function postModelSqliteQuery(modelId, body, options = {}) {
  const signal = options.signal;
  return runWithSqliteConcurrencyLimit(async () => {
    const payload =
      options?.bypassCache === true ? { ...(body || {}), cache: false } : body;
    const s = getDashboardShareContext();
    if (s?.token) {
      const jwt = typeof localStorage !== 'undefined' ? getAccessToken() : null;
      const res = await axios.post(
        `${apiRoot()}/api/public/dashboard-links/${encodeURIComponent(s.token)}/data-models/${modelId}/sqlite/query`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          },
          timeout: SQLITE_QUERY_TIMEOUT_MS,
          signal,
        },
      );
      return res.data;
    }
    const res = await api.post(`/api/data-models/${modelId}/sqlite/query`, payload, {
      timeout: SQLITE_QUERY_TIMEOUT_MS,
      signal,
    });
    return res.data;
  }, signal);
}

/**
 * Несколько запросов к одному modelId за один HTTP POST (Rust batch / Python fallback).
 * @param {number|string} modelId
 * @param {object[]} queries — массив тел SqliteDashboardQueryRequest (порядок сохраняется в results)
 */
export async function postModelSqliteQueryBatch(modelId, queries, options = {}) {
  const signal = options.signal;
  return runWithSqliteConcurrencyLimit(async () => {
    const s = getDashboardShareContext();
    const body =
      options?.bypassCache === true ? { queries, cache: false } : { queries };
    if (s?.token) {
      const jwt = typeof localStorage !== 'undefined' ? getAccessToken() : null;
      const res = await axios.post(
        `${apiRoot()}/api/public/dashboard-links/${encodeURIComponent(s.token)}/data-models/${modelId}/sqlite/query-batch`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          },
          timeout: SQLITE_QUERY_BATCH_TIMEOUT_MS,
          signal,
        },
      );
      return res.data;
    }
    const res = await api.post(`/api/data-models/${modelId}/sqlite/query-batch`, body, {
      timeout: SQLITE_QUERY_BATCH_TIMEOUT_MS,
      signal,
    });
    return res.data;
  }, signal);
}

/**
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ values: string[] }>}
 */
export async function postColumnDistinct(modelId, body, options = {}) {
  const signal = options.signal;
  return runWithDistinctConcurrencyLimit(async () => {
    const s = getDashboardShareContext();
    if (s?.token) {
      const jwt = typeof localStorage !== 'undefined' ? getAccessToken() : null;
      const res = await axios.post(
        `${apiRoot()}/api/public/dashboard-links/${encodeURIComponent(s.token)}/data-models/${modelId}/sqlite/column-distinct`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          },
          timeout: SQLITE_COLUMN_DISTINCT_TIMEOUT_MS,
          signal,
        },
      );
      return res.data;
    }
    const res = await api.post(`/api/data-models/${modelId}/sqlite/column-distinct`, body, {
      timeout: SQLITE_COLUMN_DISTINCT_TIMEOUT_MS,
      signal,
    });
    return res.data;
  }, signal);
}
