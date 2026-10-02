/**
 * Снимок логических полей фильтра дашборда (синхронизируется с виджетами «Фильтр»).
 */

import { buildFilterDescriptorsFromEngine } from './dashboardFilterUtils.js';

export class DashboardFilterStore {
  constructor() {
    /** @type {object[]} */
    this._descriptors = [];
    this._snapshot = null;
    this._listeners = new Set();
  }

  /**
   * Обновить снимок с виджетов и вернуть актуальные дескрипторы.
   * @param {object} engine
   */
  syncFromEngine(engine) {
    this._descriptors = buildFilterDescriptorsFromEngine(engine);
    return this._descriptors;
  }

  getDescriptors() {
    return this._descriptors;
  }

  getSnapshot() {
    return this._snapshot;
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /**
   * Уведомить подписчиков об изменении дескрипторов фильтров.
   * @param {{ fullDataModelRefresh?: boolean }} [options]
   *        — fullDataModelRefresh: явный режим полного сброса кеша данных (редко нужен снаружи).
   */
  notify(options = {}) {
    const opts =
      typeof options === 'object' && options !== null ? options : {};
    this._listeners.forEach((fn) => {
      try {
        fn(this._descriptors, opts);
      } catch (e) {
        console.error('[DashboardFilterStore] listener', e);
      }
    });
  }
}
