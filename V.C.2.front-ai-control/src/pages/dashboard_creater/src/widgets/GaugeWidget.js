import { WidgetBase } from '../core/WidgetBase.js';
import { hasDataBinding, renderWidgetDataPlaceholder } from '../core/widgetDataBinding.js';
import { createDefaultGaugeSettings, normalizeGaugeSettings } from './gauge/gaugeSettingsSchema.js';
import { computeGaugeState } from './gauge/gaugeCompute.js';
import { buildGaugeMarkup } from './gauge/gaugeRenderSvg.js';
import { formatGaugeDisplayValue } from './gauge/gaugeFormatValue.js';
import { attachGaugeInteraction } from './gauge/gaugeInteraction.js';

/**
 * GaugeWidget — датчик (спидометр); источник: статика / поле+агрегат / формула.
 */
export class GaugeWidget extends WidgetBase {
  /** @type {string} */
  _lastComputeError = '';
  /** @type {(() => void) | null} */
  _gaugeIxTeardown = null;
  /** @type {{ min: number, max: number, target: number|null, targets: Array<{ id: string, label: string, value: number, color: string }> } | null} */
  _gaugeResolvedScale = null;

  constructor(config = {}) {
    super({
      ...config,
      type: 'gauge',
      width: config.width || 220,
      height: config.height || 220,
    });

    this.dataSource = config.dataSource ?? this.dataSource ?? null;
    this.settings = normalizeGaugeSettings(
      { ...createDefaultGaugeSettings(), ...(config.settings || {}) },
      { dataSource: this.dataSource },
    );
  }

  getWidgetColorFormulaMap() {
    const s = this.settings || {};
    const map = {
      titleColor: { hex: s.titleColor, formula: s.titleColorFormula },
      textColor: { hex: s.textColor, formula: s.textColorFormula },
      fillColor: { hex: s.fillColor, formula: s.fillColorFormula },
      gaugeColor: { hex: s.gaugeColor, formula: s.gaugeColorFormula },
      neonColor: { hex: s.neonColor, formula: s.neonColorFormula },
      indicatorColor: { hex: s.indicatorColor, formula: s.indicatorColorFormula },
      gradientColorA: { hex: s.gradientColorA, formula: s.gradientColorAFormula },
      gradientColorB: { hex: s.gradientColorB, formula: s.gradientColorBFormula },
    };
    if (Array.isArray(s.targets)) {
      s.targets.forEach((t, i) => {
        if (!t || typeof t !== 'object') return;
        map[`target_${i}_color`] = { hex: t.color, formula: t.colorFormula };
      });
    }
    return map;
  }

  getColorFormulaFieldValues() {
    const n = Number(this.settings?.value);
    return {
      value: Number.isFinite(n) ? n : null,
    };
  }

  _gaugeSettingsWithResolvedColors() {
    const r = this._resolvedWidgetColors || {};
    const s = { ...this.settings };
    if (r.titleColor) s.titleColor = r.titleColor;
    if (r.textColor) s.textColor = r.textColor;
    if (r.fillColor) s.fillColor = r.fillColor;
    if (r.gaugeColor) s.gaugeColor = r.gaugeColor;
    if (r.neonColor) s.neonColor = r.neonColor;
    if (r.indicatorColor) s.indicatorColor = r.indicatorColor;
    if (r.gradientColorA) s.gradientColorA = r.gradientColorA;
    if (r.gradientColorB) s.gradientColorB = r.gradientColorB;
    if (Array.isArray(s.targets)) {
      s.targets = s.targets.map((t, i) => {
        const c = r[`target_${i}_color`];
        return c ? { ...t, color: c } : t;
      });
    }
    return s;
  }

  render() {
    const content = this.element.querySelector('.widget-content');
    if (!content) return;

    if (typeof this._gaugeIxTeardown === 'function') {
      this._gaugeIxTeardown();
      this._gaugeIxTeardown = null;
    }

    this.settings = normalizeGaugeSettings(this.settings, { dataSource: this.dataSource });

    const typography = this.styles?.typography || {};
    if (!hasDataBinding(this)) {
      content.innerHTML = renderWidgetDataPlaceholder(this, typography);
      return;
    }

    const dataBound = true;
    const paintSettings = this._gaugeSettingsWithResolvedColors();

    const min = Number(this._gaugeResolvedScale?.min ?? paintSettings.min);
    const max = Number(this._gaugeResolvedScale?.max ?? paintSettings.max);
    const src = String(paintSettings.valueSource || '');
    const primaryRaw =
      src === 'static_value' &&
      paintSettings.staticValue != null &&
      paintSettings.staticValue !== ''
        ? paintSettings.staticValue
        : paintSettings.value;
    const numVal =
      primaryRaw != null && primaryRaw !== '' ? Number(primaryRaw) : NaN;
    const v = Number.isFinite(numVal) ? Math.max(min, Math.min(max, numVal)) : min;
    this._numericForInteraction = v;

    const span = max - min || 1;
    const percent = Math.max(0, Math.min(100, ((v - min) / span) * 100));
    const normalized01 = (v - min) / span;

    const displayText = formatGaugeDisplayValue(v, min, max, paintSettings);

    const ixOn = paintSettings.interactionEnabled === true;

    /** @type {Array<{ id: string, label: string, value: number, color: string }>} */
    let resolvedTargets = Array.isArray(this._gaugeResolvedScale?.targets)
      ? this._gaugeResolvedScale.targets
      : [];
    if (!resolvedTargets.length && Array.isArray(paintSettings.targets)) {
      resolvedTargets = paintSettings.targets
        .map((t) => ({
          id: String(t.id || ''),
          label: String(t.label || ''),
          value: Number(t.value),
          color: String(t.color || '#f59e0b'),
        }))
        .filter((t) => Number.isFinite(t.value))
        .sort((a, b) => a.value - b.value);
    } else if (resolvedTargets.length && this._resolvedWidgetColors) {
      resolvedTargets = resolvedTargets.map((t, i) => {
        const c = this._resolvedWidgetColors[`target_${i}_color`];
        return c ? { ...t, color: c } : t;
      });
    }

    const markup = buildGaugeMarkup({
      widgetId: this.id,
      settings: paintSettings,
      typography,
      dataBound,
      unboundHintHtml: '',
      displayText,
      v,
      percent,
      normalized01,
      computeError: this._lastComputeError,
      box: { width: this.width, height: this.height },
      interactionEnabled: ixOn,
      resolvedTargets,
      scaleMin: min,
      scaleMax: max,
    });

    content.innerHTML = markup;

    this._gaugeIxTeardown = attachGaugeInteraction(content, {
      widgetId: this.id,
      enabled: ixOn,
      getNumericValue: () => this._numericForInteraction,
    });
  }

  /**
   * Обновление значения датчика
   * @param {number|string|null} newValue
   */
  updateValue(newValue) {
    this.settings.value = newValue;
    this.update();
  }

  /**
   * Обновление настроек датчика
   * @param {Record<string, unknown>} newSettings
   */
  updateSettings(newSettings) {
    this.settings = normalizeGaugeSettings(
      { ...this.settings, ...newSettings },
      { dataSource: this.dataSource },
    );
    this.update();
  }

  setStyles(styles) {
    super.setStyles(styles);
    if (this.element) {
      this.render();
      this.applyStyles();
    }
  }

  async reloadFromDataModel(engine) {
    this.settings = normalizeGaugeSettings(this.settings, { dataSource: this.dataSource });
    if (!hasDataBinding(this)) {
      this._lastComputeError = '';
      this.update();
      return;
    }
    try {
      const st = await computeGaugeState(engine, this);
      this._gaugeResolvedScale = {
        min: st.min,
        max: st.max,
        target: st.target,
        targets: Array.isArray(st.targets) ? st.targets : [],
      };
      const scaleParts = Object.entries(st.scaleErrors || {})
        .filter(([, msg]) => msg)
        .map(([k, msg]) => `${k}: ${msg}`);
      this._lastComputeError =
        [st.value.error, ...scaleParts].filter(Boolean).join(' | ') || '';
      if (st.value.numeric != null && Number.isFinite(st.value.numeric)) {
        this.settings.value = st.value.numeric;
      } else if (String(this.settings.valueSource || '') !== 'static_value' && st.value.error) {
        this.settings.value = this.settings.min;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.error('GaugeWidget reloadFromDataModel', e);
      this._lastComputeError = String(e?.message || e);
    }
    this.update();
  }

  toJSON() {
    return {
      ...super.toJSON(),
      settings: this.settings,
    };
  }

  fromJSON(json) {
    super.fromJSON(json);
    this.settings = normalizeGaugeSettings(
      { ...createDefaultGaugeSettings(), ...(json.settings || {}) },
      { dataSource: this.dataSource },
    );
    this._lastComputeError = '';
    this.render();
  }

  destroy() {
    if (typeof this._gaugeIxTeardown === 'function') {
      this._gaugeIxTeardown();
      this._gaugeIxTeardown = null;
    }
    super.destroy();
  }
}
