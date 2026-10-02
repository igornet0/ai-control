import { WidgetBase } from '../core/WidgetBase.js';
import { getDashboardDataModelClient } from '../../../../services/dashboardDataModel/DashboardDataModelClient.js';
import { collectDashboardFilters, filtersForModel } from '../../../../services/dashboardFilterUtils.js';
import { getDashboardQueryBumpGeneration } from '../../../../services/dashboardQueryBump.js';
import { hasDataBinding, renderWidgetDataPlaceholder } from '../core/widgetDataBinding.js';
import {
    chooseTrend,
    formatDelta,
    formatKpiValue,
    formatPercentChange,
    isFiniteNumber,
} from './kpi/kpiFormat.js';
import { buildSimpleFormula } from './kpi/kpiBuildFormula.js';
import {
    alignInclusiveRangeMs,
    computePreviousKpiWindowMs,
    formatAlignedRangeForSql,
    inclusiveRangeToLocalMs,
    normalizeKpiPeriodShift,
    resolveEffectiveGranularity,
} from './kpi/kpiGranularity.js';
import { resolveKpiWindowsForWidget } from './kpi/kpiDataRange.js';
import { normalizeKpiBackgroundSettings, resolveKpiBackgroundCss } from './kpi/kpiBackgroundStyle.js';
import { resolveKpiDataSourceFromFormula } from '../formula/formulaInference.js';
import { runNamedFormulaBundle } from '../formula/widgetFormulaRuntime.js';
import { resolveColorSettingSync } from './common/resolveColorSetting.js';

function escHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** @param {unknown} raw */
function coerceKpiTypeFontSize(raw) {
    if (raw == null || raw === '') return null;
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/px$/i, '').trim());
    return Number.isFinite(n) && n > 0 ? n : null;
}

/** @returns {Record<string, unknown>} */
function createDefaultKpiSettings() {
    return {
        title: 'KPI',
        value: '',
        unit: '',
        trend: null,
        trendValue: null,
        backgroundColor: 'transparent',
        titleColor: '#B0B3B8',
        valueColor: '#00E0FF',
        kpiMode: 'simple',
        valueField: '',
        aggregation: 'sum',
        valueFormula: '',
        dateField: '',
        customRange: { start: '', end: '' },
        deltaMode: 'previous_period',
        deltaType: 'both',
        deltaDisplay: 'below',
        deltaEnabled: true,
        deltaColor: '',
        deltaColorFormula: '',
        deltaCustomRange: { start: '', end: '' },
        granularity: 'auto',
        periodShift: 0,
        kpiBucketMode: 'last_completed',
        periodMode: 'auto',
        format: 'number',
        currency: 'USD',
        decimals: 2,
        numberCompact: true,
        countMode: 'rows',
        target: null,
        kpiBackgroundMode: 'solid',
        kpiBackgroundRules: [],
        kpiBackgroundDefaultColor: 'transparent',
        kpiBackgroundDeltaNegativeColor: '#c62828',
        kpiBackgroundDeltaPositiveColor: '#2e7d32',
        showTitle: true,
        titleSize: null,
    };
}

/**
 * @param {Record<string, unknown>} raw
 * @param {{ dataSource?: { field?: string } | null }} [ctx]
 */
export function migrateKpiWidgetSettings(raw, ctx = {}) {
    const out = { ...raw };
    const hasFormula = String(out.valueFormula || '').trim().length > 0;

    if (out.kpiMode !== 'simple' && out.kpiMode !== 'formula') {
        out.kpiMode = hasFormula ? 'formula' : 'simple';
    }

    if (!out.deltaMode) {
        const cm = String(out.comparisonMode || 'previous');
        if (cm === 'yoy') out.deltaMode = 'previous_year';
        else out.deltaMode = 'previous_period';
    }

    if (!out.deltaType) {
        const sd = out.showDelta !== false;
        const sp = out.showPercent !== false;
        if (sd && sp) out.deltaType = 'both';
        else if (sp) out.deltaType = 'percent';
        else out.deltaType = 'absolute';
    }

    const legacyShowDelta = out.showDelta;
    const dd = String(out.deltaDisplay || 'below').toLowerCase();
    if (out.deltaEnabled === undefined) {
        out.deltaEnabled = !(legacyShowDelta === false || dd === 'hidden');
    } else {
        out.deltaEnabled = out.deltaEnabled !== false;
    }
    out.deltaDisplay = dd === 'inline' ? 'inline' : 'below';

    const dcf = String(out.deltaColorFormula ?? '').trim();
    out.deltaColorFormula = dcf;
    const dc = String(out.deltaColor || '').trim();
    out.deltaColor = /^#[0-9a-fA-F]{6}$/i.test(dc) ? dc : '';

    if (!out.deltaCustomRange || typeof out.deltaCustomRange !== 'object') {
        out.deltaCustomRange = { start: '', end: '' };
    } else {
        out.deltaCustomRange = {
            start: String(out.deltaCustomRange.start ?? ''),
            end: String(out.deltaCustomRange.end ?? ''),
        };
    }

    if (!out.customRange || typeof out.customRange !== 'object') {
        out.customRange = { start: '', end: '' };
    }

    if (out.kpiMode === 'simple' && !String(out.valueField || '').trim() && ctx.dataSource?.field) {
        out.valueField = String(ctx.dataSource.field);
    }

    if (!out.aggregation) out.aggregation = 'sum';
    const countMode = String(out.countMode || '').toLowerCase();
    if (countMode === 'distinct') out.countMode = 'distinct';
    else if (countMode === 'non_null') out.countMode = 'non_null';
    else out.countMode = 'rows';

    const gran = String(out.granularity || 'auto').toLowerCase();
    if (!['auto', 'minute', 'hour', 'day', 'week', 'month'].includes(gran)) out.granularity = 'auto';
    else out.granularity = gran;

    out.periodShift = normalizeKpiPeriodShift(out.periodShift);

    const pm = String(out.periodMode || 'auto').toLowerCase();
    out.periodMode = pm === 'fallback' ? 'fallback' : 'auto';

    const bucketMode = String(out.kpiBucketMode || '').toLowerCase();
    out.kpiBucketMode = bucketMode === 'last_inclusive' ? 'last_inclusive' : 'last_completed';

    delete out.period;
    delete out.comparisonMode;
    delete out.showDelta;
    delete out.showPercent;

    const kbm = String(out.kpiBackgroundMode || '').toLowerCase();
    out.kpiBackgroundMode = kbm === 'rules' ? 'rules' : kbm === 'delta' ? 'delta' : 'solid';
    if (!Array.isArray(out.kpiBackgroundRules)) out.kpiBackgroundRules = [];
    if (out.kpiBackgroundDefaultColor == null || String(out.kpiBackgroundDefaultColor).trim() === '') {
        out.kpiBackgroundDefaultColor = 'transparent';
    }
    if (out.kpiBackgroundDeltaNegativeColor == null || String(out.kpiBackgroundDeltaNegativeColor).trim() === '') {
        out.kpiBackgroundDeltaNegativeColor = '#c62828';
    }
    if (out.kpiBackgroundDeltaPositiveColor == null || String(out.kpiBackgroundDeltaPositiveColor).trim() === '') {
        out.kpiBackgroundDeltaPositiveColor = '#2e7d32';
    }

    if (out.showTitle === undefined) out.showTitle = true;
    else out.showTitle = out.showTitle !== false;
    if (out.titleSize != null && out.titleSize !== '') {
        const n = parseInt(out.titleSize, 10);
        out.titleSize = Number.isFinite(n) ? Math.min(48, Math.max(8, n)) : null;
    } else {
        out.titleSize = null;
    }

    const fmt = String(out.format || 'number').toLowerCase();
    out.format = ['number', 'percent', 'currency'].includes(fmt) ? fmt : 'number';
    const dec = Number(out.decimals);
    out.decimals = Number.isFinite(dec) ? Math.min(8, Math.max(0, Math.round(dec))) : 2;
    out.numberCompact = out.numberCompact !== false;

    return out;
}

/**
 * KpiWidget — KPI: простой режим (поле + агрегат) или формула; период из фильтров дашборда, запасного диапазона или авто по последним данным (periodMode).
 */
export class KpiWidget extends WidgetBase {
    constructor(config = {}) {
        super({
            ...config,
            type: 'kpi',
            width: config.width || 250,
            height: config.height || 150,
        });

        const merged = { ...createDefaultKpiSettings(), ...(config.settings || {}) };
        this.settings = migrateKpiWidgetSettings(merged, { dataSource: config.dataSource || null });

        /** Счётчик применений панели — ломает устаревший hit по _kpiCacheKey при смене шага времени и др. */
        /** @type {number} */
        this._kpiApplyGeneration = 0;
        /** @type {string|null} */
        this._kpiCacheKey = null;
        /** @type {object|null} */
        this._kpiSnapshot = null;
        /** @type {boolean} */
        this._kpiFormulaMode = false;
        /** @type {number} */
        this._kpiReloadSeq = 0;
        /** @type {Array<{ value: number, value2: number }>|null} */
        this._kpiBgThresholdResolved = null;
    }

    /** @param {object} snap */
    _kpiDeltaHtml(snap) {
        const deltaType = String(this.settings.deltaType || 'both');
        const noComparison =
            snap.previous === null &&
            snap.delta === null &&
            (snap.percent === null || snap.percent === undefined) &&
            !snap.error;

        if (noComparison) {
            return '—';
        }

        if (!isFiniteNumber(snap.previous)) {
            return '—';
        }

        const parts = [];
        if (deltaType === 'absolute' || deltaType === 'both') {
            if (isFiniteNumber(snap.delta)) {
                parts.push(
                    formatDelta(snap.delta, {
                        decimals: this.settings.format === 'currency' ? this.settings.decimals : 0,
                        compact: this.settings.numberCompact,
                    }),
                );
            } else {
                parts.push('—');
            }
        }
        if (deltaType === 'percent' || deltaType === 'both') {
            parts.push(`(${formatPercentChange(snap.percent, { decimals: 1 })})`);
        }
        return parts.join(' ');
    }

    getWidgetColorFormulaMap() {
        const s = this.settings || {};
        return {
            titleColor: { hex: s.titleColor, formula: s.titleColorFormula },
            backgroundColor: { hex: s.backgroundColor, formula: s.backgroundColorFormula },
            kpiBackgroundDefaultColor: {
                hex: s.kpiBackgroundDefaultColor,
                formula: s.kpiBackgroundDefaultColorFormula,
            },
            kpiBackgroundDeltaNegativeColor: {
                hex: s.kpiBackgroundDeltaNegativeColor,
                formula: s.kpiBackgroundDeltaNegativeColorFormula,
            },
            kpiBackgroundDeltaPositiveColor: {
                hex: s.kpiBackgroundDeltaPositiveColor,
                formula: s.kpiBackgroundDeltaPositiveColorFormula,
            },
            deltaColor: { hex: s.deltaColor, formula: s.deltaColorFormula },
        };
    }

    getColorFormulaFieldValues() {
        const snap = this._kpiSnapshot;
        return {
            delta: isFiniteNumber(snap?.delta) ? snap.delta : null,
            percent: isFiniteNumber(snap?.percent) ? snap.percent : null,
            current: isFiniteNumber(snap?.current) ? snap.current : null,
            previous: isFiniteNumber(snap?.previous) ? snap.previous : null,
            value: isFiniteNumber(snap?.current) ? snap.current : null,
            trend: snap?.trend || 'neutral',
        };
    }

    _kpiSettingsWithResolvedColors() {
        const r = this._resolvedWidgetColors || {};
        return {
            ...this.settings,
            titleColor: r.titleColor || this.settings.titleColor,
            backgroundColor: r.backgroundColor || this.settings.backgroundColor,
            kpiBackgroundDefaultColor:
                r.kpiBackgroundDefaultColor || this.settings.kpiBackgroundDefaultColor,
            kpiBackgroundDeltaNegativeColor:
                r.kpiBackgroundDeltaNegativeColor || this.settings.kpiBackgroundDeltaNegativeColor,
            kpiBackgroundDeltaPositiveColor:
                r.kpiBackgroundDeltaPositiveColor || this.settings.kpiBackgroundDeltaPositiveColor,
            deltaColor: r.deltaColor || this.settings.deltaColor,
        };
    }

    /**
     * Цвет текста дельты: формула → фиксированный → авто по тренду (null).
     * @param {object} snap
     * @returns {string|null} hex или null (CSS-классы тренда)
     */
    _resolveKpiDeltaTextColor(snap) {
        const formula = String(this.settings.deltaColorFormula || '').trim();
        const solid = String(this.settings.deltaColor || '').trim();
        if (!formula && !/^#[0-9a-fA-F]{6}$/i.test(solid)) return null;
        if (formula) {
            const asyncHex = this._resolvedWidgetColors?.deltaColor;
            if (/^#[0-9a-fA-F]{6}$/i.test(String(asyncHex || ''))) return asyncHex;
            const hex = resolveColorSettingSync({
                hex: solid,
                formula,
                value: isFiniteNumber(snap?.current) ? snap.current : null,
                fieldValues: this.getColorFormulaFieldValues(),
                engine: typeof window !== 'undefined' ? window.engine : null,
            });
            if (hex) return hex;
        }
        if (/^#[0-9a-fA-F]{6}$/i.test(solid)) return solid;
        return null;
    }

    /**
     * @param {object} snap
     * @param {{ fontFamily?: string, trendFontSize?: number, deltaFontSize?: number }} opts
     * @returns {string}
     */
    _kpiDeltaBlockMarkup(snap, opts = {}) {
        if (this.settings.deltaEnabled === false) return '';
        const deltaDisplay = String(this.settings.deltaDisplay || 'below').toLowerCase();
        if (deltaDisplay === 'hidden') return '';

        const fontFamily = opts.fontFamily || 'Inter';
        const trendFontSize = opts.trendFontSize ?? 16;
        const deltaFontSize = opts.deltaFontSize ?? 14;
        const inline = deltaDisplay === 'inline';

        const noComparison =
            snap.previous === null &&
            snap.delta === null &&
            (snap.percent === null || snap.percent === undefined) &&
            !snap.error;
        const tr = noComparison || !isFiniteNumber(snap.previous) ? 'neutral' : snap.trend || 'neutral';
        const trendIcon = tr === 'up' ? '↑' : tr === 'down' ? '↓' : '';
        const customColor = this._resolveKpiDeltaTextColor(snap);
        const autoTrendMod =
            tr === 'up' ? 'kpi-widget-delta--up' : tr === 'down' ? 'kpi-widget-delta--down' : 'kpi-widget-delta--neutral';
        const trendClass = customColor
            ? 'kpi-widget-trend'
            : `kpi-widget-trend kpi-widget-trend--${tr === 'up' ? 'up' : tr === 'down' ? 'down' : 'neutral'}`;

        const deltaNums = escHtml(this._kpiDeltaHtml(snap));
        const colorStyle = customColor ? `color:${escHtml(customColor)};` : '';
        const deltaInner =
            trendIcon !== ''
                ? `<span class="kpi-widget-delta__nums">${deltaNums}</span>
                   <span class="${trendClass}" style="font-size: ${trendFontSize}px;font-family:'${fontFamily}',sans-serif;">${trendIcon}</span>`
                : `<span class="kpi-widget-delta__nums">${deltaNums}</span>`;

        const layoutClass = [
            'kpi-widget-delta',
            inline ? 'kpi-widget-delta--inline' : '',
            customColor ? '' : autoTrendMod,
        ]
            .filter(Boolean)
            .join(' ');
        return `<div class="${layoutClass}" style="font-size: ${deltaFontSize}px;font-family:'${fontFamily}',sans-serif;${colorStyle}">${deltaInner}</div>`;
    }

    /**
     * Число KPI для выбора фона по порогам (формула или простое значение из settings.value).
     * @param {object|null} snap
     * @param {boolean} formulaMode
     */
    _kpiValueNumberForBackground(snap, formulaMode) {
        if (formulaMode && snap && isFiniteNumber(snap.current)) return snap.current;
        const raw = this.settings.value;
        if (raw == null || raw === '' || raw === '—') return NaN;
        const cleaned = String(raw).replace(/\s/g, '').replace(/,/g, '.');
        const n = parseFloat(cleaned);
        return Number.isFinite(n) ? n : NaN;
    }

    _kpiFormatOpts() {
        return {
            format: this.settings.format,
            currency: this.settings.currency,
            decimals: this.settings.decimals,
            compact: this.settings.numberCompact,
            formula:
                this.settings.kpiMode === 'formula'
                    ? String(this.settings.valueFormula || '').trim()
                    : buildSimpleFormula(
                          this.settings.aggregation,
                          String(this.settings.valueField || ''),
                          { countMode: this.settings.countMode || 'rows' },
                      ).trim(),
        };
    }

    /**
     * Если snapshot ещё нет (до reload), форматируем сырое число из settings.value.
     * Уже отформатированную строку оставляем как есть.
     * @param {unknown} value
     */
    _kpiFallbackDisplayValue(value) {
        if (value == null || value === '') return '';
        if (typeof value === 'number' && Number.isFinite(value)) {
            return formatKpiValue(value, this._kpiFormatOpts());
        }
        const s = String(value).trim();
        if (/^-?\d+(\.\d+)?$/.test(s)) {
            return formatKpiValue(Number(s), this._kpiFormatOpts());
        }
        return s;
    }

    /** @param {Record<string, unknown>} typography */
    _kpiHeadingMarkup(typography) {
        if (this.settings.showTitle === false) return '';
        const resolvedTitle = this.resolvedColor('titleColor', this.settings.titleColor);
        const rawTitleColor = String(resolvedTitle || '').trim();
        const finalTitleColor = /^#[0-9a-fA-F]{6}$/i.test(rawTitleColor)
            ? rawTitleColor
            : typography.color || '#B0B3B8';
        const { title } = this.settings;
        let fs = '';
        const ts = this.settings.titleSize;
        if (ts != null && Number.isFinite(Number(ts))) {
            const n = Math.min(48, Math.max(8, parseInt(ts, 10)));
            fs = ` font-size: ${n}px`;
        }
        return `<div class="dash-widget-heading" style="color: ${finalTitleColor};${fs}">${escHtml(title)}</div>`;
    }

    render() {
        const content = this.element.querySelector('.widget-content');
        if (!content) return;

        const typography = this.styles?.typography || {};
        if (!hasDataBinding(this)) {
            content.innerHTML = renderWidgetDataPlaceholder(this, typography);
            return;
        }

        const {
            value,
            unit,
            trend,
            trendValue,
            valueColor,
        } = this.settings;

        const typeFontSize = coerceKpiTypeFontSize(typography.fontSize);
        const baseFontSize = typeFontSize || Math.max(12, Math.min(this.width, this.height) / 8);
        const fontFamily = typography.fontFamily || 'Inter';
        const textColor = typography.color || '#E4E6EB';
        const lineHeight = typography.lineHeight || 1.2;
        const textShadow = typography.textShadow || '';

        const valueFontSize = typeFontSize ? Math.max(32, typeFontSize * 2.2) : Math.max(32, baseFontSize * 2.2);
        const unitFontSize = typeFontSize ? Math.max(18, typeFontSize * 0.9) : Math.max(18, baseFontSize * 0.9);
        const trendFontSize = typeFontSize ? Math.max(16, typeFontSize * 0.8) : Math.max(16, baseFontSize * 0.8);
        const deltaFontSize = typeFontSize ? Math.max(14, typeFontSize * 0.75) : Math.max(14, baseFontSize * 0.75);

        const finalValueColor = typography.color || valueColor;

        const snap = this._kpiSnapshot;
        const formulaMode = this._kpiFormulaMode && snap;
        const primaryNum = this._kpiValueNumberForBackground(snap, !!formulaMode);
        const deltaForBg =
            formulaMode && snap && isFiniteNumber(snap.delta) ? snap.delta : null;
        const settingsForBg = this._kpiSettingsWithResolvedColors();
        const resolvedBg = resolveKpiBackgroundCss(
            settingsForBg,
            primaryNum,
            this._kpiBgThresholdResolved,
            deltaForBg,
        );

        if (formulaMode) {
            if (snap.error && !isFiniteNumber(snap.current)) {
                content.innerHTML = `
                <div class="dash-widget-shell dash-widget-shell--column kpi-widget-root" style="font-family:'${fontFamily}', -apple-system, sans-serif;color:${textColor};background:${resolvedBg}">
                ${this._kpiHeadingMarkup(typography)}
                <div class="kpi-widget-error" style="font-size: ${deltaFontSize}px;">${escHtml(snap.error)}</div>
            </div>`;
                return;
            }

            if (snap.noData && !isFiniteNumber(snap.current)) {
                content.innerHTML = `
                <div class="dash-widget-shell dash-widget-shell--column kpi-widget-root" style="font-family:'${fontFamily}', -apple-system, sans-serif;color:${textColor};background:${resolvedBg}">
                ${this._kpiHeadingMarkup(typography)}
                <div class="kpi-widget-no-data" style="font-size: ${valueFontSize * 0.45}px;">No data</div>
            </div>`;
                return;
            }

            const primary = formatKpiValue(snap.current, this._kpiFormatOpts());
            const valueShadow = textShadow || `0 0 16px ${finalValueColor}40`;

            const deltaDisplay = String(this.settings.deltaDisplay || 'below').toLowerCase();
            const deltaBlock = this._kpiDeltaBlockMarkup(snap, { fontFamily, trendFontSize, deltaFontSize });
            const deltaInline = deltaDisplay === 'inline' ? deltaBlock : '';
            const deltaBelow = deltaDisplay === 'below' ? deltaBlock : '';

            content.innerHTML = `
            <div class="dash-widget-shell dash-widget-shell--column kpi-widget-root" style="font-family:'${fontFamily}', -apple-system, sans-serif;color:${textColor};background:${resolvedBg}">
                ${this._kpiHeadingMarkup(typography)}
                <div class="kpi-widget-value-row">
                    <div class="kpi-widget-value" style="
                        font-size: ${valueFontSize}px;
                        color: ${finalValueColor};
                        line-height: ${lineHeight};
                        text-shadow: ${valueShadow};
                    ">${escHtml(primary)}</div>
                    ${deltaInline}
                </div>
                ${deltaBelow}
            </div>`;
            return;
        }

        const deltaDisplay = String(this.settings.deltaDisplay || 'below').toLowerCase();
        let trendHtml = '';
        if (this.settings.deltaEnabled !== false && deltaDisplay !== 'hidden' && trend && trendValue !== null) {
            const trendIcon = trend === 'up' ? '↑' : '↓';
            const dir = trend === 'up' ? 'up' : 'down';
            const inlineClass = deltaDisplay === 'inline' ? ' kpi-widget-delta--inline' : '';
            const customColor = this._resolveKpiDeltaTextColor({
                trend,
                delta: null,
                percent: null,
                current: null,
                previous: null,
            });
            const colorStyle = customColor ? `color:${escHtml(customColor)};` : '';
            const autoMod = customColor ? '' : ` kpi-widget-delta--${dir}`;
            trendHtml = `
                <div class="kpi-widget-delta${inlineClass}${autoMod}" style="font-size: ${trendFontSize}px; font-family: '${fontFamily}', -apple-system, sans-serif;${colorStyle}">
                    <span class="kpi-widget-trend">${trendIcon}</span>
                    <span class="kpi-widget-delta__nums">${escHtml(String(trendValue))}</span>
                </div>
            `;
        }

        const valStr = this._kpiFallbackDisplayValue(value);
        const valueShadow = textShadow || `0 0 16px ${finalValueColor}40`;
        const unitPart = unit
            ? ` <span style="font-size: ${unitFontSize}px; font-weight: 500;">${escHtml(String(unit))}</span>`
            : '';

        const trendInline = deltaDisplay === 'inline' ? trendHtml : '';
        const trendBelow = deltaDisplay === 'below' ? trendHtml : '';

        content.innerHTML = `
            <div class="dash-widget-shell dash-widget-shell--column kpi-widget-root" style="font-family:'${fontFamily}', -apple-system, sans-serif;color:${textColor};background:${resolvedBg}">
                ${this._kpiHeadingMarkup(typography)}
                <div class="kpi-widget-value-row">
                    <div class="kpi-widget-value" style="
                        font-size: ${valueFontSize}px;
                        color: ${finalValueColor};
                        line-height: ${lineHeight};
                        text-shadow: ${valueShadow};
                    ">${escHtml(valStr)}${unitPart}</div>
                    ${trendInline}
                </div>
                ${trendBelow}
            </div>
        `;
    }

    /**
     * Окно дат для формул порога фона — то же, что для `snap.current` (см. computeKpiSnapshot).
     * @param {string} dateField
     * @param {{ start?: string, end?: string }|null} rangeForSqlCur
     * @returns {{ dateField: string, range: { start: string, end: string } }|null}
     */
    _buildKpiWindowForBgFormulas(dateField, rangeForSqlCur) {
        const df = String(dateField || '').trim();
        const r = rangeForSqlCur;
        if (!df || !r || !String(r.start || '').trim() || !String(r.end || '').trim()) return null;
        return { dateField: df, range: { start: String(r.start), end: String(r.end) } };
    }

    /**
     * Вычисляет пороги правил фона по формулам (те же фильтры дашборда, что и у KPI).
     * @param {object|null} engine
     * @param {number|null} reloadSeq — если задан и увеличился счётчик перезагрузки, прервать.
     * @param {{ dateField: string, range: { start: string, end: string } }|null} [kpiWindow] — период как у основного KPI (иначе SUM в пороге считался по всем строкам).
     */
    async _evaluateKpiBackgroundRules(engine, reloadSeq = null, kpiWindow = null) {
        this._kpiBgThresholdResolved = null;
        if (!engine) return;
        const ds = this.dataSource;
        if (String(this.settings.kpiBackgroundMode || '').toLowerCase() !== 'rules') return;
        const { rules } = normalizeKpiBackgroundSettings(this.settings);
        if (!rules.length) return;

        let probe = String(this.settings.valueFormula || '').trim();
        if (!probe) {
            for (const rule of rules) {
                probe =
                    String(rule.valueFormula || '').trim() ||
                    String(rule.value2Formula || '').trim();
                if (probe) break;
            }
        }
        const resolved = await resolveKpiDataSourceFromFormula(engine, ds, probe);
        const modelId = resolved?.modelId ?? ds?.modelId;
        const table = resolved?.table ?? ds?.table;
        if (modelId == null || !table) return;

        /** @type {Record<string, string>} */
        const named = {};
        const meta = [];
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            const f1 = String(rule.valueFormula || '').trim();
            const f2 = String(rule.value2Formula || '').trim();
            let k1 = null;
            let k2 = null;
            if (f1) {
                k1 = `r${i}_v`;
                named[k1] = f1;
            }
            if (rule.op === 'between' && f2) {
                k2 = `r${i}_v2`;
                named[k2] = f2;
            }
            meta.push({ rule, k1, k2 });
        }

        if (!Object.keys(named).length) {
            const out = rules.map((rule) => {
                const value = Number.isFinite(rule.value) ? rule.value : NaN;
                let value2 = NaN;
                if (rule.op === 'between') {
                    value2 = Number.isFinite(rule.value2) ? rule.value2 : NaN;
                } else {
                    value2 = Number.isFinite(rule.value2) ? rule.value2 : 0;
                }
                return { value, value2 };
            });
            if (reloadSeq != null && reloadSeq !== this._kpiReloadSeq) return;
            this._kpiBgThresholdResolved = out;
            return;
        }

        const bundle = await runNamedFormulaBundle(engine, modelId, table, named, kpiWindow || null);
        if (reloadSeq != null && reloadSeq !== this._kpiReloadSeq) return;

        /** @type {Array<{ value: number, value2: number }>} */
        const out = [];
        for (const m of meta) {
            const { rule, k1, k2 } = m;
            let value = NaN;
            if (k1) {
                const r = bundle.byId[k1];
                value = r?.numeric != null && Number.isFinite(r.numeric) ? r.numeric : NaN;
            } else {
                value = Number.isFinite(rule.value) ? rule.value : NaN;
            }
            let value2 = NaN;
            if (rule.op === 'between' && k2) {
                const r2 = bundle.byId[k2];
                value2 = r2?.numeric != null && Number.isFinite(r2.numeric) ? r2.numeric : NaN;
            } else if (rule.op === 'between') {
                value2 = Number.isFinite(rule.value2) ? rule.value2 : NaN;
            } else {
                value2 = Number.isFinite(rule.value2) ? rule.value2 : 0;
            }
            out.push({ value, value2 });
        }
        this._kpiBgThresholdResolved = out;
    }

    async reloadFromDataModel(engine) {
        const ds = this.dataSource;
        if (!engine) return;
        // Drop local KPI hit so filter clear cannot reuse previous snapshot.
        this._kpiCacheKey = null;
        const client = getDashboardDataModelClient(engine);

        const mode = this.settings.kpiMode === 'formula' ? 'formula' : 'simple';
        let formula = '';
        if (mode === 'formula') {
            formula = String(this.settings.valueFormula || '').trim();
        } else {
            formula = buildSimpleFormula(this.settings.aggregation, String(this.settings.valueField || ''), {
                countMode: this.settings.countMode || 'rows',
            }).trim();
        }

        const resolvedBase = await resolveKpiDataSourceFromFormula(engine, ds, formula);
        const modelId = resolvedBase?.modelId ?? ds?.modelId;
        const table = resolvedBase?.table ?? ds?.table;
        if (modelId != null && modelId !== '') {
            this._resolvedFormulaModelId = modelId;
        }

        if (!formula) {
            if (!ds.field) return;
            if (modelId == null || !table) return;
            this._kpiFormulaMode = false;
            this._kpiSnapshot = null;
            this._kpiCacheKey = null;
            try {
                const filters = filtersForModel(collectDashboardFilters(engine), modelId);
                const { rows } = await client.fetchAggregate({
                    modelId,
                    base_table: table,
                    group_by: [],
                    aggregations: [{ fn: 'sum', column: ds.field, as: 'v' }],
                    filters,
                    limit: 1,
                });
                const v = rows?.[0]?.v;
                this.settings.value = v != null && v !== '' ? String(v) : '—';
                await this._evaluateKpiBackgroundRules(engine, null);
                this.update();
            } catch (e) {
                if (e?.name === 'AbortError') return;
                console.error('KpiWidget reloadFromDataModel', e);
            }
            return;
        }

        if (modelId == null || !table) {
            const reloadSeqErr = ++this._kpiReloadSeq;
            this._kpiFormulaMode = true;
            this._kpiSnapshot = {
                error:
                    'Укажите таблицу (перетаскивание с «Данные») или квалифицированные поля в формуле, например SUM([orders.amount]). Для COUNT(*) выберите таблицу в данных виджета.',
                noData: false,
            };
            this._kpiCacheKey = null;
            await this._evaluateKpiBackgroundRules(engine, reloadSeqErr, null);
            if (reloadSeqErr === this._kpiReloadSeq) this.update();
            return;
        }

        if (mode === 'simple' && !String(this.settings.valueField || '').trim()) {
            const reloadSeqErr = ++this._kpiReloadSeq;
            this._kpiFormulaMode = true;
            this._kpiSnapshot = { error: 'Выберите поле значения', noData: false };
            this._kpiCacheKey = null;
            await this._evaluateKpiBackgroundRules(engine, reloadSeqErr);
            if (reloadSeqErr === this._kpiReloadSeq) this.update();
            return;
        }

        const dateField = String(this.settings.dateField || '').trim();
        const globalFilters = filtersForModel(collectDashboardFilters(engine), modelId);
        let currentRange = null;
        let previousRange = null;
        /** @type {string} */
        let rangeSource = 'none';
        if (dateField) {
            const rw = await resolveKpiWindowsForWidget({
                engine,
                modelId,
                table,
                dateField,
                globalFilters,
                customRange: this.settings.customRange || {},
                periodMode: this.settings.periodMode === 'fallback' ? 'fallback' : 'auto',
                deltaMode: this.settings.deltaMode || 'previous_period',
                deltaCustomRange: this.settings.deltaCustomRange || {},
                granularitySetting: this.settings.granularity || 'auto',
                kpiBucketMode: this.settings.kpiBucketMode || 'last_completed',
                periodShift: normalizeKpiPeriodShift(this.settings.periodShift),
            });
            currentRange = rw.currentRange;
            previousRange = rw.previousRange;
            rangeSource = rw.rangeSource;
        }

        let alignedCurrentRange = currentRange;
        let alignedPreviousRange = previousRange;
        /** @type {string} */
        let granularityEffective = '';
        if (
            dateField &&
            currentRange &&
            String(currentRange.start || '').trim() &&
            String(currentRange.end || '').trim()
        ) {
            const ms = inclusiveRangeToLocalMs(String(currentRange.start), String(currentRange.end));
            if (ms && Number.isFinite(ms.loMs) && Number.isFinite(ms.hiMs)) {
                granularityEffective = resolveEffectiveGranularity(
                    this.settings.granularity,
                    ms.loMs,
                    ms.hiMs,
                );

                let ac = alignInclusiveRangeMs(ms.loMs, ms.hiMs, granularityEffective);
                // resolveKpiWindowsForWidget уже сдвигает; повторный сдвиг не нужен
                alignedCurrentRange = formatAlignedRangeForSql(ac.loMs, ac.hiMs);
                const prevWin = computePreviousKpiWindowMs(
                    ac.loMs,
                    ac.hiMs,
                    granularityEffective,
                    this.settings.deltaMode || 'previous_period',
                    this.settings.deltaCustomRange || {},
                    { mode: 'calendar' },
                );
                if (prevWin && Number.isFinite(prevWin.loMs) && Number.isFinite(prevWin.hiMs)) {
                    alignedPreviousRange = formatAlignedRangeForSql(prevWin.loMs, prevWin.hiMs);
                } else {
                    alignedPreviousRange = null;
                }
            }
        }

        const rangeForSqlCur =
            alignedCurrentRange &&
            String(alignedCurrentRange.start || '').trim() &&
            String(alignedCurrentRange.end || '').trim()
                ? alignedCurrentRange
                : currentRange;
        const rangeForSqlPrev =
            alignedPreviousRange &&
            String(alignedPreviousRange.start || '').trim() &&
            String(alignedPreviousRange.end || '').trim()
                ? alignedPreviousRange
                : previousRange;

        const kpiWindowForBg = this._buildKpiWindowForBgFormulas(dateField, rangeForSqlCur);

        const cacheKey = JSON.stringify({
            queryBumpGen: getDashboardQueryBumpGeneration(),
            kpiApplyGen: this._kpiApplyGeneration || 0,
            modelId,
            table,
            formula,
            dateField,
            granularity: this.settings.granularity,
            periodShift: normalizeKpiPeriodShift(this.settings.periodShift),
            granularityEffective: granularityEffective || null,
            periodMode: this.settings.periodMode,
            rangeSource,
            currentRange: alignedCurrentRange,
            previousRange: alignedPreviousRange,
            deltaMode: this.settings.deltaMode,
            deltaType: this.settings.deltaType,
            deltaCustomRange: this.settings.deltaCustomRange,
            kpiMode: mode,
            valueField: this.settings.valueField,
            aggregation: this.settings.aggregation,
            customRange: this.settings.customRange,
            filters: globalFilters,
            kpiBgRules: this.settings.kpiBackgroundMode === 'rules' ? this.settings.kpiBackgroundRules : null,
            kpiBgDelta:
                this.settings.kpiBackgroundMode === 'delta'
                    ? {
                          neg: this.settings.kpiBackgroundDeltaNegativeColor,
                          pos: this.settings.kpiBackgroundDeltaPositiveColor,
                          def: this.settings.kpiBackgroundDefaultColor,
                      }
                    : null,
        });

        if (this._kpiCacheKey === cacheKey && this._kpiSnapshot) {
            this._kpiFormulaMode = true;
            await this._evaluateKpiBackgroundRules(engine, null, kpiWindowForBg);
            this.update();
            return;
        }

        const reloadSeq = ++this._kpiReloadSeq;
        let kpiWindowForBgEval = this._buildKpiWindowForBgFormulas(dateField, rangeForSqlCur);
        try {
            const { snapshot: snap, windows } = await client.fetchKpiBucketSnapshot({
                engine,
                modelId,
                table,
                formula,
                dateField,
                globalFilters,
                customRange: this.settings.customRange || {},
                periodMode: this.settings.periodMode === 'fallback' ? 'fallback' : 'auto',
                deltaMode: this.settings.deltaMode || 'previous_period',
                deltaCustomRange: this.settings.deltaCustomRange || {},
                granularitySetting: this.settings.granularity || 'auto',
                kpiBucketMode: this.settings.kpiBucketMode || 'last_completed',
                periodShift: normalizeKpiPeriodShift(this.settings.periodShift),
            });
            if (reloadSeq !== this._kpiReloadSeq) {
                return;
            }
            kpiWindowForBgEval = this._buildKpiWindowForBgFormulas(
                dateField,
                windows?.currentRange || rangeForSqlCur,
            );
            this._kpiSnapshot = snap;
            this._kpiCacheKey = cacheKey;
            this._kpiFormulaMode = true;

            if (!snap.error && isFiniteNumber(snap.current)) {
                this.settings.value = formatKpiValue(snap.current, this._kpiFormatOpts());
                const noComp =
                    snap.previous === null &&
                    snap.delta === null &&
                    (snap.percent === null || snap.percent === undefined);
                this.settings.trend = noComp ? null : snap.trend;
                const dt = String(this.settings.deltaType || 'both');
                const parts = [];
                if (!noComp && isFiniteNumber(snap.previous)) {
                    if (dt === 'absolute' || dt === 'both') {
                        if (isFiniteNumber(snap.delta)) {
                            parts.push(
                                formatDelta(snap.delta, {
                                    decimals: 0,
                                    compact: this.settings.numberCompact,
                                }),
                            );
                        }
                    }
                    if (dt === 'percent' || dt === 'both') {
                        parts.push(`(${formatPercentChange(snap.percent, { decimals: 1 })})`);
                    }
                    const icon =
                        snap.trend === 'up' ? '↑' : snap.trend === 'down' ? '↓' : '';
                    if (icon) parts.push(icon);
                }
                this.settings.trendValue = parts.length ? parts.join(' ') : null;
            } else if (snap.error) {
                this.settings.trend = null;
                this.settings.trendValue = null;
            } else {
                this.settings.value = '—';
                this.settings.trend = snap.trend || chooseTrend(snap.delta);
                this.settings.trendValue = null;
            }
        } catch (e) {
            if (reloadSeq !== this._kpiReloadSeq) {
                return;
            }
            if (e?.name === 'AbortError') return;
            console.error('KpiWidget reloadFromDataModel', e);
            this._kpiSnapshot = { error: String(e?.message || e), noData: true };
            this._kpiFormulaMode = true;
        }
        if (reloadSeq === this._kpiReloadSeq) {
            await this._evaluateKpiBackgroundRules(engine, reloadSeq, kpiWindowForBgEval);
            if (reloadSeq === this._kpiReloadSeq) this.update();
        }
    }

    toJSON() {
        return {
            ...super.toJSON(),
            settings: this.settings,
        };
    }

    fromJSON(json) {
        super.fromJSON(json);
        const defaults = createDefaultKpiSettings();
        this.settings = migrateKpiWidgetSettings({ ...defaults, ...(json.settings || {}) }, {
            dataSource: this.dataSource,
        });
        this._kpiCacheKey = null;
        this._kpiSnapshot = null;
        this._kpiFormulaMode = false;
        this._kpiBgThresholdResolved = null;
        this.render();
    }
}
