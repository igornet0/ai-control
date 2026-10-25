import { WidgetBase } from '../core/WidgetBase.js';
import { renderWidgetEmptyInnerHtml } from '../core/widgetDataBinding.js';
import { collectDashboardFilters, filtersForModel } from '../../../../services/dashboardFilterUtils.js';
import { getDashboardQueryBumpGeneration } from '../../../../services/dashboardQueryBump.js';
import { materializeTextTemplate } from '../formula/runDashboard.js';
import { parseTemplate, uniquePlaceholderFormulas } from '../formula/template.js';
import { formatFormulaError } from '../formula/errors.js';
import { resolveTextTemplateDataSource, resolveKpiDataSourceFromFormula } from '../formula/formulaInference.js';
import { runNamedFormulaBundle } from '../formula/widgetFormulaRuntime.js';
import { normalizeTextStyleFormulas } from './common/widgetFormulaSchema.js';
import { resolveColorSetting } from './common/resolveColorSetting.js';
import { snapshotEngineModelVariables } from '../formula/formulaVarContext.js';
import { defaultTextColor, defaultFontFamily, adaptTextColor } from '../theme/themeRuntime.js';

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stableStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

/**
 * TextWidget — статический или динамический текст (формулы + шаблон).
 */
export class TextWidget extends WidgetBase {
  constructor(config = {}) {
    super({
      ...config,
      type: 'text',
      width: config.width || 300,
      height: config.height || 100,
    });

    const s = config.settings || {};
    this.settings = {
      text: s.text ?? '',
      fontSize: s.fontSize || 16,
      fontFamily: s.fontFamily || defaultFontFamily(),
      color: s.color || '#FFFFFF',
      align: s.align || 'left',
      mode: s.mode === 'dynamic' ? 'dynamic' : 'static',
      template: s.template != null ? String(s.template) : '',
      formulas: Array.isArray(s.formulas) ? [...s.formulas] : [],
      blockBackgroundFormula:
        s.blockBackgroundFormula != null ? String(s.blockBackgroundFormula) : '',
      textColorFormula: s.textColorFormula != null ? String(s.textColorFormula) : '',
      visibilityFormula: s.visibilityFormula != null ? String(s.visibilityFormula) : '',
      ...s,
      timestampDisplay: s.timestampDisplay === 'utc' ? 'utc' : 'local',
    };
    if (this.settings.mode !== 'dynamic') {
      this.settings.mode = 'static';
    }

    normalizeTextStyleFormulas(this.settings);

    /** @type {{ text: string, error: string }|null} */
    this._dynamicRender = null;
    /** @type {string|null} */
    this._dynamicCacheKey = null;
    /** @type {{ backgroundColor?: string, color?: string, visible?: boolean, error?: string }|null} */
    this._textStyleResolved = null;
  }

  _isDynamic() {
    return this.settings.mode === 'dynamic';
  }

  async _evalTextStyleFormulas(engine) {
    this._textStyleResolved = null;
    if (!engine) return;
    normalizeTextStyleFormulas(this.settings);
    const bgF = String(this.settings.blockBackgroundFormula || '').trim();
    const colF = String(this.settings.textColorFormula || '').trim();
    const visF = String(this.settings.visibilityFormula || '').trim();
    if (!bgF && !colF && !visF) return;

    const ds = this.dataSource;
    const appearanceHex = this.styles?.appearance?.backgroundColor || '';
    const typoHex = this.styles?.typography?.color || this.settings.color || '';
    try {
      /** @type {{ backgroundColor?: string, color?: string, visible: boolean, error?: string }} */
      const out = { visible: true };

      if (bgF) {
        const bgC = await resolveColorSetting({
          hex: appearanceHex,
          formula: bgF,
          engine,
          dataSource: ds,
        });
        if (bgC) out.backgroundColor = bgC;
      }
      if (colF) {
        const fgC = await resolveColorSetting({
          hex: typoHex,
          formula: colF,
          engine,
          dataSource: ds,
        });
        if (fgC) out.color = fgC;
      }

      if (visF) {
        const resolved = await resolveKpiDataSourceFromFormula(engine, ds || {}, visF);
        const modelId = resolved?.modelId ?? ds?.modelId;
        const table = resolved?.table ?? ds?.table;
        if (modelId == null || !table) {
          this._textStyleResolved = {
            error:
              'Укажите данные (перетащите поле) или квалифицируйте таблицу в формуле стиля.',
            visible: true,
            backgroundColor: out.backgroundColor,
            color: out.color,
          };
          return;
        }
        const b = await runNamedFormulaBundle(engine, modelId, table, { vis: visF }, null);
        const vn = b.byId.vis?.numeric;
        if (vn == null || !Number.isFinite(vn)) out.visible = false;
        else out.visible = vn !== 0;
        if (b.errors?.vis) out.error = b.errors.vis;
      }

      this._textStyleResolved = out;
    } catch (e) {
      this._textStyleResolved = {
        error: formatFormulaError(e),
        visible: true,
      };
    }
  }

  /** Литеральный fallback только если в шаблоне нет `{формула}` — иначе ждём materializeTextTemplate. */
  _staticFallbackBody() {
    const a = String(this.settings.text ?? '').trim();
    if (a) return a;
    const tpl = String(this.settings.template ?? '');
    try {
      if (uniquePlaceholderFormulas(parseTemplate(tpl)).length > 0) return '';
    } catch {
      return '';
    }
    return tpl.trim();
  }

  _filtersCacheKey(engine, modelId) {
    const f = filtersForModel(collectDashboardFilters(engine), modelId);
    return stableStringify(f);
  }

  render() {
    const content = this.element.querySelector('.widget-content');
    if (!content) return;

    const typography = this.styles?.typography || {};

    if (this._isDynamic()) {
      const tpl = this.settings.template != null ? String(this.settings.template) : '';
      if (!tpl.trim()) {
        const onlyStatic = String(this.settings.text ?? '').trim();
        if (onlyStatic) {
          this._renderTextInner(content, typography, escHtml(onlyStatic));
        } else {
          content.innerHTML = renderWidgetEmptyInnerHtml(typography, 'text');
        }
        return;
      }

      let placeholderCount = 0;
      try {
        placeholderCount = uniquePlaceholderFormulas(parseTemplate(tpl)).length;
      } catch {
        content.innerHTML = renderWidgetEmptyInnerHtml(typography, 'text');
        return;
      }

      if (this._dynamicRender != null) {
        const err0 = this._dynamicRender.error;
        const err =
          (this._textStyleResolved?.error ? `${this._textStyleResolved.error}\n` : '') +
          (err0 ? err0 : '');
        const body = err
          ? `<div class="text-widget-dynamic-error" style="font-size:0.75rem;color:#ff8a8a;margin-bottom:0.35rem;">${escHtml(err)}</div>`
          : '';
        const display = this._dynamicRender.text != null ? this._dynamicRender.text : '…';
        this._renderTextInner(content, typography, body + escHtml(display));
        return;
      }

      if (placeholderCount > 0) {
        this._renderTextInner(content, typography, escHtml('…'));
        return;
      }

      const fallback = this._staticFallbackBody();
      if (fallback) {
        this._renderTextInner(content, typography, escHtml(fallback));
        return;
      }
      content.innerHTML = renderWidgetEmptyInnerHtml(typography, 'text');
      return;
    }

    const textRaw = this.settings.text != null ? String(this.settings.text) : '';
    if (!textRaw.trim()) {
      content.innerHTML = renderWidgetEmptyInnerHtml(typography, 'text');
      return;
    }
    const stErr = this._textStyleResolved?.error
      ? `<div class="text-widget-dynamic-error" style="font-size:0.75rem;color:#ff8a8a;margin-bottom:0.35rem;">${escHtml(this._textStyleResolved.error)}</div>`
      : '';
    this._renderTextInner(content, typography, stErr + escHtml(textRaw));
  }

  _renderTextInner(content, typography, escapedInnerHtml) {
    const adaptiveFontSize = Math.max(10, Math.min(this.width, this.height) / 15);
    const fontSize = typography.fontSize || this.settings.fontSize || adaptiveFontSize;
    const fontFamily = typography.fontFamily || this.settings.fontFamily || defaultFontFamily();
    const color = adaptTextColor(typography.color || this.settings.color) || defaultTextColor();
    const fontWeight = typography.fontWeight || '400';
    const letterSpacing =
      typography.letterSpacing !== undefined ? `${typography.letterSpacing}px` : 'normal';
    const lineHeight = typography.lineHeight || 1.6;
    const textShadow = typography.textShadow || '';
    const padding = Math.max(2, Math.min(this.width, this.height) / 40);

    const st = this._textStyleResolved;
    const vis = st?.visible !== false;
    let blockBg = '';
    let fg = color;
    if (st?.backgroundColor) blockBg = `background-color:${escHtml(st.backgroundColor)};`;
    if (st?.color) fg = st.color;
    const visCss = vis ? '' : 'display:none;';

    content.innerHTML = `
            <div class="dash-widget-shell dash-widget-shell--column" style="font-family:'${escHtml(fontFamily)}', -apple-system, sans-serif;${visCss}">
            <div class="dash-widget-text-inner" style="
                padding: ${padding}px;
                font-size: ${fontSize}px;
                font-weight: ${fontWeight};
                color: ${escHtml(String(fg))};
                text-align: ${escHtml(this.settings.align)};
                letter-spacing: ${letterSpacing};
                line-height: ${lineHeight};
                text-shadow: ${textShadow};
                word-wrap: break-word;
                box-sizing: border-box;
                ${blockBg}
            ">${escapedInnerHtml}</div>
            </div>
        `;
  }

  async reloadFromDataModel(engine) {
    await this._evalTextStyleFormulas(engine || null);

    if (!this._isDynamic()) {
      this._dynamicRender = null;
      this._dynamicCacheKey = null;
      this.update();
      return;
    }
    if (!engine) {
      this._dynamicRender = null;
      this._dynamicCacheKey = null;
      this.update();
      return;
    }

    const tpl = this.settings.template != null ? String(this.settings.template) : '';
    const td = this.settings.timestampDisplay === 'utc' ? 'utc' : 'local';
    const ds = this.dataSource;

    let formulas = [];
    try {
      formulas = uniquePlaceholderFormulas(parseTemplate(tpl));
    } catch (e) {
      this._dynamicRender = { text: '', error: formatFormulaError(e) };
      this._dynamicCacheKey = null;
      this.update();
      return;
    }

    if (!tpl.trim()) {
      this._dynamicRender = null;
      this._dynamicCacheKey = null;
      this.update();
      return;
    }

    if (formulas.length === 0) {
      const { text, error } = await materializeTextTemplate(engine, ds?.modelId ?? 0, ds?.table ?? '', tpl, {
        timestampDisplay: td,
      });
      this._dynamicRender = { text, error };
      this._dynamicCacheKey = `lit\0${tpl}\0${td}`;
      this.update();
      return;
    }

    const resolved = await resolveTextTemplateDataSource(engine, ds, tpl);
    const modelId = resolved?.modelId;
    const table = resolved?.table;

    if (modelId == null || !table) {
      this._dynamicRender = {
        text: '',
        error:
          'Не удалось определить модель по формулам в шаблоне. Перетащите поле с вкладки «Данные» на виджет или укажите таблицу в формулах: SUM([имя_таблицы.колонка]).',
      };
      this._dynamicCacheKey = null;
      this.update();
      return;
    }

    const fk = this._filtersCacheKey(engine, modelId);
    const bump = getDashboardQueryBumpGeneration();
    const varsKey = stableStringify(snapshotEngineModelVariables(engine));
    const cacheKey = `${bump}\0${modelId}\0${table}\0${fk}\0${tpl}\0${td}\0${varsKey}`;
    if (this._dynamicCacheKey === cacheKey && this._dynamicRender) {
      this.update();
      return;
    }

    const { text, error } = await materializeTextTemplate(engine, modelId, table, tpl, {
      timestampDisplay: td,
    });
    this._dynamicRender = { text, error };
    this._dynamicCacheKey = cacheKey;
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
    if (json.settings) {
      this.settings = { ...this.settings, ...json.settings };
    }
    if (this.settings.mode !== 'dynamic') {
      this.settings.mode = 'static';
    }
    if (!Array.isArray(this.settings.formulas)) {
      this.settings.formulas = [];
    }
    normalizeTextStyleFormulas(this.settings);
    this._dynamicRender = null;
    this._dynamicCacheKey = null;
    this._textStyleResolved = null;
    this.render();
  }
}
