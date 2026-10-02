import { eventBus } from '../core/EventBus.js';

/**
 * @typedef {object} SettingsPanelApi
 * @property {import('../core/WidgetBase.js').WidgetBase} widget
 * @property {object|null} engine
 * @property {() => object} getSettings
 * @property {(settings: object) => void} setSettings
 * @property {(partial: object) => void} patchSettings
 * @property {() => object} getStyles
 * @property {(styles: object) => void} setStyles
 * @property {(opts?: object) => void} openFormulaEditor
 * @property {() => Promise<void>} requestReload
 * @property {(cb: () => void) => () => void} onChange
 * @property {() => void} destroy
 */

/**
 * Create the settings-panel contribution API for a selected widget.
 *
 * @param {object} opts
 * @param {import('../core/WidgetBase.js').WidgetBase} opts.widget
 * @param {object|null} opts.engine
 * @param {(opts: object) => void} [opts.openFormulaEditor]
 * @returns {SettingsPanelApi}
 */
export function createSettingsPanelApi({ widget, engine, openFormulaEditor }) {
  /** @type {Set<() => void>} */
  const listeners = new Set();
  let destroyed = false;

  const emitLocal = () => {
    listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('settingsPanel onChange error', err);
      }
    });
  };

  const api = {
    widget,
    engine: engine || null,

    getSettings() {
      return widget.settings && typeof widget.settings === 'object' ? widget.settings : {};
    },

    setSettings(settings) {
      widget.settings = settings && typeof settings === 'object' ? settings : {};
      eventBus.emit('widget:settings-changed', { widget });
      emitLocal();
    },

    patchSettings(partial) {
      const next = {
        ...(widget.settings && typeof widget.settings === 'object' ? widget.settings : {}),
        ...(partial && typeof partial === 'object' ? partial : {}),
      };
      widget.settings = next;
      eventBus.emit('widget:settings-changed', { widget });
      emitLocal();
    },

    getStyles() {
      return typeof widget.getStyles === 'function' ? widget.getStyles() : widget.styles || {};
    },

    setStyles(styles) {
      if (typeof widget.setStyles === 'function') {
        widget.setStyles(styles || {});
      } else {
        widget.styles = { ...(widget.styles || {}), ...(styles || {}) };
      }
      emitLocal();
    },

    openFormulaEditor(opts = {}) {
      if (typeof openFormulaEditor === 'function') {
        openFormulaEditor(opts);
        return;
      }
      if (engine && typeof engine.openFormulaEditor === 'function') {
        engine.openFormulaEditor(opts);
      }
    },

    async requestReload() {
      const eng = engine;
      if (eng && typeof widget.reloadFromDataModel === 'function') {
        await widget.reloadFromDataModel(eng);
      } else if (typeof widget.update === 'function') {
        widget.update();
      } else if (typeof widget.render === 'function') {
        widget.render();
      }
      eventBus.emit('widget:settings-changed', { widget });
      emitLocal();
    },

    onChange(cb) {
      if (typeof cb !== 'function' || destroyed) return () => {};
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    destroy() {
      destroyed = true;
      listeners.clear();
    },
  };

  return api;
}
