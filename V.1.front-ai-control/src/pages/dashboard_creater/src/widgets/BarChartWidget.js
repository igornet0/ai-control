import { WidgetBase } from '../core/WidgetBase.js';
import { eventBus } from '../core/EventBus.js';
import { getDashboardDataModelClient } from '../../../../services/dashboardDataModel/DashboardDataModelClient.js';
import {
    collectDashboardFilters,
    filtersForModel,
    cycleFilterValueIncludeExcludeState,
    setDashboardFilterIncludeOnlyValue,
    ensureDashboardFilterRowExists,
} from '../../../../services/dashboardFilterUtils.js';
import { hasDataBinding, renderWidgetDataPlaceholder } from '../core/widgetDataBinding.js';
import { resolveKpiDataSourceFromFormula } from '../formula/formulaInference.js';
import { runNamedFormulaBundle } from '../formula/widgetFormulaRuntime.js';
import { normalizeBarFormulaFields } from './common/widgetFormulaSchema.js';
import { resolveChartDimension, resolveChartMeasure, mergeChartMeasureFilters, chartMeasureAggColumn, chartMeasureForMatchesDimension } from './common/chartBindingFormula.js';
import { computeBarCategoryStats, buildBarStatsOverlaySvg } from './bar-chart/barChartStats.js';
import { defaultTextColor, defaultFontFamily } from '../theme/themeRuntime.js';

const DEFAULT_BAR_PALETTE = [
    '#00E0FF',
    '#3D8BFF',
    '#005DFF',
    '#00FFB8',
    '#FF6B6B',
    '#FFD93D',
];

const VIRTUALIZE_MIN_N = 24;

function safeSvgFragmentId(widgetId) {
    return String(widgetId || 'w').replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** Оценка высоты заголовка + нижнего отступа (для вычета из области графика). */
function estimateBarTitleReservePx(settings) {
    if (settings?.showTitle !== true) return 0;
    const fs = parseInt(settings.titleSize, 10);
    const titleFs = Number.isFinite(fs) ? Math.min(48, Math.max(8, fs)) : 14;
    // line-height ~1.2 + margin-bottom у .bar-widget-root .dash-widget-heading (~1rem)
    return Math.ceil(titleFs * 1.25 + 18);
}

/** Горизонтальный/вертикальный padding .dash-widget-shell (0.35rem / 0.5rem). */
const BAR_SHELL_PAD_X_PX = Math.round(0.35 * 16 * 2);
const BAR_SHELL_PAD_Y_PX = Math.round(0.5 * 16 * 2);

function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
}

/** Угол подписи категории (вертикальный столбчатый): только допустимые значения. */
function normalizeBarLabelRotationDeg(v) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return 0;
    return [0, 45, 90, -45].includes(n) ? n : 0;
}

/** Доп. отступ у оси категорий при повороте подписей (вертикальный рост столбцов). */
function verticalCategoryRotExtraPadPx(rotDeg, fontSize) {
    const r = Number(rotDeg);
    if (!r) return 0;
    const rad = (Math.abs(r) * Math.PI) / 180;
    const fs = Math.max(8, Number(fontSize) || 11);
    return Math.round(fs * (1.9 * Math.sin(rad) + 1.2 * Math.cos(rad)) + 14);
}

function escXml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function mergePadding(base, partial) {
    const p = partial && typeof partial === 'object' ? partial : {};
    return {
        top: clamp(Number(p.top ?? base.top), 0, 200),
        right: clamp(Number(p.right ?? base.right), 0, 240),
        bottom: clamp(Number(p.bottom ?? base.bottom), 0, 240),
        left: clamp(Number(p.left ?? base.left), 0, 280),
    };
}

function mergePaddingFromLayout(settings) {
    const lay =
        settings.barLayout && typeof settings.barLayout === 'object' ? settings.barLayout : null;
    if (lay?.padding && typeof lay.padding === 'object') {
        settings.padding = mergePadding(settings.padding, lay.padding);
    }
}

function parsePalette(raw) {
    if (Array.isArray(raw) && raw.length) {
        return raw.map((c) => String(c).trim()).filter(Boolean);
    }
    if (typeof raw === 'string' && raw.trim()) {
        return raw
            .split(/[,;\s]+/)
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => (x.startsWith('#') ? x : `#${x}`));
    }
    return [...DEFAULT_BAR_PALETTE];
}

/** Ось категорий: один общий спектр в userSpace — у каждого столбца свой отрезок градиента. */
function buildBarSpectrumStopTags(paletteArr) {
    const raw =
        Array.isArray(paletteArr) && paletteArr.length >= 2 ? paletteArr : [...DEFAULT_BAR_PALETTE];
    const colors = raw.map((c) => String(c).trim()).filter(Boolean);
    const safe = (colors.length ? colors : [...DEFAULT_BAR_PALETTE]).map((c) =>
        escXml(/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#00E0FF'),
    );
    if (safe.length === 1) {
        return `<stop offset="0%" stop-color="${safe[0]}"/><stop offset="100%" stop-color="${safe[0]}"/>`;
    }
    return safe
        .map((c, i, arr) => {
            const pct = arr.length <= 1 ? 0 : (100 * i) / (arr.length - 1);
            return `<stop offset="${pct}%" stop-color="${c}"/>`;
        })
        .join('');
}

/** @param {number} v @param {'raw'|'int'|'compact'} mode */
function formatBarNumberPlain(v, mode) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    if (mode === 'int') return String(Math.round(n));
    if (mode === 'compact') {
        try {
            return new Intl.NumberFormat('ru-RU', {
                notation: 'compact',
                maximumFractionDigits: 2,
            }).format(n);
        } catch {
            return String(Math.round(n));
        }
    }
    return String(n);
}

function approxTextWidthPx(text, fontSize) {
    let w = 0;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        w += code < 128 ? fontSize * 0.52 : fontSize * 0.92;
    }
    return w;
}

/**
 * Перенос + ellipsis по приблизительной ширине.
 * @returns {string[]}
 */
function wrapLabelToLines(text, maxW, fontSize, maxLines) {
    const s = String(text);
    const maxL = clamp(maxLines, 1, 8);
    if (!maxW || maxW < 6) {
        return [s.length > 12 ? `${s.slice(0, 10)}…` : s];
    }
    const words = s.split(/\s+/).filter(Boolean);
    const chunks = words.length ? words : [s];
    const lines = [];
    let cur = '';
    const push = (ln) => {
        if (!ln) return;
        if (lines.length >= maxL) return;
        lines.push(ln);
    };
    for (const w of chunks) {
        const next = cur ? `${cur} ${w}` : w;
        if (approxTextWidthPx(next, fontSize) <= maxW) {
            cur = next;
        } else {
            if (cur) push(cur);
            cur = w;
            if (lines.length >= maxL - 1) break;
        }
    }
    if (cur && lines.length < maxL) push(cur);
    if (lines.length === 0) lines.push(s.slice(0, 1));

    let last = lines[lines.length - 1];
    while (last.length > 1 && approxTextWidthPx(last, fontSize) > maxW) {
        last = last.slice(0, -1);
    }
    if (approxTextWidthPx(last, fontSize) > maxW) {
        last = '…';
    } else if (chunks.join(' ').length > lines.join(' ').replace(/…/g, '').length + 2) {
        if (!last.endsWith('…')) last = `${last}…`;
    }
    lines[lines.length - 1] = last;
    return lines.slice(0, maxL);
}

function normalizeBarSettings(settings) {
    settings.padding = mergePadding(
        { top: 20, right: 20, bottom: 44, left: 48 },
        settings.padding,
    );
    mergePaddingFromLayout(settings);

    const o = settings.barOrientation;
    settings.barOrientation =
        o === 'top' || o === 'left' || o === 'right' || o === 'bottom' ? o : 'bottom';

    const s = settings.barSort;
    settings.barSort =
        s === 'value_desc' ||
        s === 'value_asc' ||
        s === 'label_asc' ||
        s === 'label_desc' ||
        s === 'none'
            ? s
            : 'none';

    let gapRatio = parseFloat(settings.barGap);
    if (!Number.isFinite(gapRatio)) gapRatio = 0.12;
    settings.barGap = clamp(gapRatio, 0, 0.85);

    let gapPx = parseFloat(settings.barGapPx);
    if (!Number.isFinite(gapPx)) gapPx = 8;
    settings.barGapPx = clamp(gapPx, 0, 48);

    const lp = settings.barLabelPlacement;
    settings.barLabelPlacement =
        lp === 'axis' || lp === 'onBar' || lp === 'both' || lp === 'none' ? lp : 'axis';

    let rot = parseInt(settings.barLabelRotation, 10);
    if (!Number.isFinite(rot) || ![0, 45, 90, -45].includes(rot)) rot = 0;
    settings.barLabelRotation = rot;

    let maxLines = parseInt(settings.barLabelMaxLines, 10);
    if (!Number.isFinite(maxLines)) maxLines = 3;
    settings.barLabelMaxLines = clamp(maxLines, 1, 6);

    const cm = settings.barColorMode;
    settings.barColorMode = cm === 'solid' || cm === 'palette' ? cm : 'gradient';

    if (!settings.barSolidColor || typeof settings.barSolidColor !== 'string') {
        settings.barSolidColor = '#00E0FF';
    }

    settings.barPalette = parsePalette(settings.barPalette);

    const vf = settings.barValueFormat;
    settings.barValueFormat = vf === 'int' || vf === 'compact' || vf === 'number' ? (vf === 'number' ? 'raw' : vf) : 'raw';

    const sc = settings.barScroll;
    settings.barScroll = sc === 'off' || sc === 'on' ? sc : 'auto';

    let mb = parseInt(settings.barMinBandPx, 10);
    if (!Number.isFinite(mb)) mb = 28;
    settings.barMinBandPx = clamp(mb, 12, 120);

    if (typeof settings.showValues !== 'boolean') settings.showValues = true;

    const vp = settings.valuePosition;
    settings.valuePosition =
        vp === 'inside' || vp === 'outside' || vp === 'top' || vp === 'right' ? vp : 'top';

    let br = parseFloat(settings.barBorderRadius);
    if (!Number.isFinite(br)) br = 4;
    settings.barBorderRadius = clamp(br, 0, 24);

    settings.barHoverEffect = settings.barHoverEffect !== false;

    let go = parseFloat(settings.gridOpacity);
    if (!Number.isFinite(go)) go = 0.14;
    settings.gridOpacity = clamp(go, 0, 0.6);

    settings.showValueAxis = settings.showValueAxis !== false;
    settings.showCategoryAxis = settings.showCategoryAxis !== false;

    const bt = settings.barThickness;
    if (bt === 'auto' || bt === undefined || bt === null) {
        settings.barThickness = 'auto';
    } else {
        let t = parseFloat(bt);
        if (!Number.isFinite(t)) settings.barThickness = 'auto';
        else settings.barThickness = clamp(t, 2, 200);
    }

    let minT = parseFloat(settings.barMinThicknessPx);
    if (!Number.isFinite(minT)) minT = 4;
    settings.barMinThicknessPx = clamp(minT, 2, 80);

    let maxT = parseFloat(settings.barMaxThicknessPx);
    if (!Number.isFinite(maxT)) maxT = 200;
    settings.barMaxThicknessPx = clamp(maxT, 8, 400);

    let gg = parseFloat(settings.groupGapPx);
    if (!Number.isFinite(gg)) gg = 0;
    settings.groupGapPx = clamp(gg, 0, 80);

    if (settings.barSelectedIndex != null) {
        const si = parseInt(settings.barSelectedIndex, 10);
        settings.barSelectedIndex = Number.isFinite(si) ? si : null;
    }

    if (typeof settings.showTitle !== 'boolean') settings.showTitle = false;
    if (settings.title == null || String(settings.title).trim() === '') {
        settings.title = 'Столбчатая диаграмма';
    }
    {
        const bts = parseInt(settings.titleSize, 10);
        settings.titleSize = Number.isFinite(bts) ? Math.min(48, Math.max(8, bts)) : 14;
    }

    normalizeBarFormulaFields(settings);

    if (!settings.stats || typeof settings.stats !== 'object') settings.stats = {};
    settings.stats.showAvg = !!settings.stats.showAvg;
    settings.stats.showMedian = !!settings.stats.showMedian;
    settings.stats.showSum = !!settings.stats.showSum;
}

function buildSortedItems(data, xField, yField, sortMode) {
    const items = (data || []).map((row, idx) => {
        const raw = row[xField];
        const label =
            raw !== undefined && raw !== null && String(raw).length ? String(raw) : '—';
        const value = parseFloat(row[yField]);
        const v = Number.isFinite(value) ? value : 0;
        return { label, value: v, idx };
    });

    const cmp = (a, b) => {
        if (sortMode === 'value_desc') {
            if (b.value !== a.value) return b.value - a.value;
            return a.idx - b.idx;
        }
        if (sortMode === 'value_asc') {
            if (a.value !== b.value) return a.value - b.value;
            return a.idx - b.idx;
        }
        if (sortMode === 'label_asc') {
            const c = a.label.localeCompare(b.label, 'ru');
            if (c !== 0) return c;
            return a.idx - b.idx;
        }
        if (sortMode === 'label_desc') {
            const c = b.label.localeCompare(a.label, 'ru');
            if (c !== 0) return c;
            return a.idx - b.idx;
        }
        return a.idx - b.idx;
    };

    if (sortMode !== 'none') items.sort(cmp);
    return items;
}

/**
 * BarChartWidget — столбчатая диаграмма (SVG), читаемые подписи, значения, скролл + виртуализация.
 */
export class BarChartWidget extends WidgetBase {
    constructor(config = {}) {
        super({
            ...config,
            type: 'bar-chart',
            width: config.width || 500,
            height: config.height || 300,
        });

        this.settings = {
            data: config.settings?.data || [],
            xField: config.settings?.xField || 'x',
            yField: config.settings?.yField || 'y',
            showGrid: config.settings?.showGrid !== false,
            barSliceWeight: config.settings?.barSliceWeight || 'auto',
            barOrientation: config.settings?.barOrientation || 'bottom',
            barSort: config.settings?.barSort || 'none',
            barGap: config.settings?.barGap ?? 0.12,
            barGapPx: config.settings?.barGapPx ?? 8,
            padding: config.settings?.padding,
            barLabelPlacement: config.settings?.barLabelPlacement || 'axis',
            barLabelRotation: config.settings?.barLabelRotation ?? 0,
            barLabelMaxLines: config.settings?.barLabelMaxLines ?? 3,
            barColorMode: config.settings?.barColorMode || 'gradient',
            barSolidColor: config.settings?.barSolidColor || '#00E0FF',
            barPalette: config.settings?.barPalette || [...DEFAULT_BAR_PALETTE],
            barValueFormat: config.settings?.barValueFormat || 'raw',
            barScroll: config.settings?.barScroll || 'auto',
            barMinBandPx: config.settings?.barMinBandPx ?? 28,
            showValues: config.settings?.showValues !== false,
            valuePosition: config.settings?.valuePosition || 'top',
            barBorderRadius: config.settings?.barBorderRadius ?? 4,
            barHoverEffect: config.settings?.barHoverEffect !== false,
            gridOpacity: config.settings?.gridOpacity ?? 0.14,
            showValueAxis: config.settings?.showValueAxis !== false,
            showCategoryAxis: config.settings?.showCategoryAxis !== false,
            barThickness: config.settings?.barThickness ?? 'auto',
            barMinThicknessPx: config.settings?.barMinThicknessPx ?? 4,
            barMaxThicknessPx: config.settings?.barMaxThicknessPx ?? 200,
            groupGapPx: config.settings?.groupGapPx ?? 0,
            barSelectedIndex: config.settings?.barSelectedIndex ?? null,
            stats: {
                showAvg: false,
                showMedian: false,
                showSum: false,
                ...(config.settings?.stats && typeof config.settings.stats === 'object'
                    ? config.settings.stats
                    : {}),
            },
            ...config.settings,
        };
        normalizeBarSettings(this.settings);

        /** @type {(() => void) | null} */
        this._barScrollHandler = null;
        /** @type {object | null} */
        this._barRuntime = null;
        /** @type {(() => void) | null} */
        this._barTooltipHide = null;
    }

    getWidgetColorFormulaMap() {
        const s = this.settings || {};
        /** @type {Record<string, { hex?: string, formula?: string }>} */
        const map = {
            titleColor: { hex: s.titleColor, formula: s.titleColorFormula },
            barSolidColor: { hex: s.barSolidColor, formula: s.barSolidColorFormula },
            barThresholdHighColor: {
                hex: s.barThresholdHighColor,
                formula: s.barThresholdHighColorFormula,
            },
            barThresholdLowColor: {
                hex: s.barThresholdLowColor,
                formula: s.barThresholdLowColorFormula,
            },
        };
        const pal = Array.isArray(s.barPalette) ? s.barPalette : [];
        const pfx = Array.isArray(s.barPaletteFormulas) ? s.barPaletteFormulas : [];
        pal.forEach((hex, i) => {
            map[`palette_${i}`] = { hex, formula: pfx[i] || '' };
        });
        return map;
    }

    _resolvedBarPalette() {
        const pal = Array.isArray(this.settings.barPalette) ? this.settings.barPalette : [];
        const r = this._resolvedWidgetColors || {};
        return pal.map((hex, i) => r[`palette_${i}`] || hex);
    }

    _barTeardown(content) {
        const body = content?.querySelector?.('.bar-widget-body');
        if (this._barScrollHandler && body) {
            body.removeEventListener('scroll', this._barScrollHandler);
        }
        if (this._barTooltipHide && body) {
            body.removeEventListener('mouseleave', this._barTooltipHide);
        }
        this._barScrollHandler = null;
        this._barTooltipHide = null;
        this._barRuntime = null;
    }

    render() {
        const content = this.element.querySelector('.widget-content');
        if (!content) return;

        this._barTeardown(content);

        const typography = this.styles?.typography || {};
        const fontFamily = typography.fontFamily || defaultFontFamily();
        const textColor = typography.color || defaultTextColor();

        if (!hasDataBinding(this)) {
            content.innerHTML = renderWidgetDataPlaceholder(this, typography);
            return;
        }

        if (this.settings.bindingError) {
            const safe = escXml(this.settings.bindingError);
            content.innerHTML = `
                <div class="dash-widget-shell dash-widget-shell--centered-msg" style="font-family:'${escXml(fontFamily)}',sans-serif;color:${escXml(textColor)};">
                    <div class="dash-widget-state-message">${safe}</div>
                </div>
            `;
            return;
        }

        const { data, xField, yField, showGrid } = this.settings;

        if (!data || data.length === 0) {
            content.innerHTML = `
                <div class="dash-widget-shell dash-widget-shell--centered-msg" style="font-family:'${escXml(fontFamily)}',sans-serif;color:${escXml(textColor)};">
                    <div class="dash-widget-state-message">Нет строк по текущим фильтрам</div>
                </div>
            `;
            return;
        }

        normalizeBarSettings(this.settings);

        const items = buildSortedItems(data, xField, yField, this.settings.barSort);
        const values = items.map((it) => it.value);
        const sumY = values.reduce((a, b) => a + b, 0);
        if (sumY <= 0) {
            content.innerHTML = `
                <div class="dash-widget-shell dash-widget-shell--centered-msg" style="font-family:'${escXml(fontFamily)}',sans-serif;color:${escXml(textColor)};">
                    <div class="dash-widget-state-message">Данные есть, но высота всех столбцов нулевая. Выберите числовую меру, режим «Сумма» или «Количество» в панели стилей.</div>
                </div>
            `;
            return;
        }

        const hostW = Math.max(
            120,
            (content.clientWidth || this.width || 400) - BAR_SHELL_PAD_X_PX,
        );
        const hostH = Math.max(
            100,
            (content.clientHeight || this.height || 280)
                - BAR_SHELL_PAD_Y_PX
                - estimateBarTitleReservePx(this.settings),
        );

        let pad = mergePadding(
            { top: 20, right: 20, bottom: 44, left: 48 },
            this.settings.padding,
        );
        const orient = this.settings.barOrientation;
        const isVert = orient === 'bottom' || orient === 'top';
        const gapPx = this.settings.barGapPx;
        const gapRatio = this.settings.barGap;
        const minBandPx = this.settings.barMinBandPx;
        const scrollMode = this.settings.barScroll;
        const n = items.length;
        const maxV = Math.max(...values, 1e-9);
        const sid = safeSvgFragmentId(this.id);
        const gradId = `barGradient_${sid}`;
        const glowId = `barGlow_${sid}`;
        const colorMode = this.settings.barColorMode;
        const solid =
            this.resolvedColor('barSolidColor', this.settings.barSolidColor || '#00E0FF') ||
            '#00E0FF';
        const palette = parsePalette(this._resolvedBarPalette());
        const gridOp = this.settings.gridOpacity;
        const strokeGrid = `rgba(0,224,255,${gridOp})`;
        const valueFmt = this.settings.barValueFormat || 'raw';
        const showVal = !!this.settings.showValues;
        const valPos = this.settings.valuePosition || 'top';
        const labelPlacement = this.settings.barLabelPlacement;
        const showAxisCat =
            this.settings.showCategoryAxis !== false &&
            (labelPlacement === 'axis' || labelPlacement === 'both');
        const showOnBarLegacy =
            labelPlacement === 'onBar' || labelPlacement === 'both';
        const showAxisVal = this.settings.showValueAxis !== false;
        const br = this.settings.barBorderRadius;
        const labelFs = typography.fontSize ? Math.max(9, typography.fontSize * 0.82) : 11;
        const valueFs0 = typography.fontSize ? Math.max(10, typography.fontSize * 0.9) : 13;
        const maxLabelLines = this.settings.barLabelMaxLines || 3;
        const labelRot = normalizeBarLabelRotationDeg(this.settings.barLabelRotation);

        if (isVert && showAxisCat && labelRot !== 0) {
            const slack = verticalCategoryRotExtraPadPx(labelRot, labelFs);
            if (orient === 'bottom') {
                pad = { ...pad, bottom: pad.bottom + slack };
            } else if (orient === 'top') {
                pad = { ...pad, top: pad.top + slack };
            }
        }

        let svgW = hostW;
        let svgH = hostH;
        let vbW = hostW;
        let vbH = hostH;
        let scrollClass = '';
        let band = 1;
        let innerW = 1;
        let innerH = 1;
        let useScrollX = false;
        let useScrollY = false;
        let plotLeft = pad.left;
        let plotTop = pad.top;
        let plotBottom = hostH - pad.bottom;
        let plotRight = hostW - pad.right;
        let innerWPlot = 1;
        let innerHPlot = 1;

        if (isVert) {
            const innerW0 = hostW - pad.left - pad.right;
            band = innerW0 / Math.max(1, n);
            useScrollX =
                scrollMode === 'on' || (scrollMode === 'auto' && band < minBandPx);
            innerW = useScrollX ? n * minBandPx : innerW0;
            if (useScrollX) {
                vbW = pad.left + innerW + pad.right;
                vbH = hostH;
                svgW = vbW;
                svgH = hostH;
                scrollClass = ' bar-widget-body--scroll-x';
            } else {
                vbW = hostW;
                vbH = hostH;
            }
            plotLeft = pad.left;
            plotTop = pad.top;
            plotBottom = vbH - pad.bottom;
            plotRight = vbW - pad.right;
            innerHPlot = Math.max(1, plotBottom - plotTop);
            innerWPlot = Math.max(1, plotRight - plotLeft);
        } else {
            const innerH0 = hostH - pad.top - pad.bottom;
            band = innerH0 / Math.max(1, n);
            useScrollY =
                scrollMode === 'on' || (scrollMode === 'auto' && band < minBandPx);
            innerH = useScrollY ? n * minBandPx : innerH0;
            if (useScrollY) {
                vbW = hostW;
                vbH = pad.top + innerH + pad.bottom;
                svgW = hostW;
                svgH = vbH;
                scrollClass = ' bar-widget-body--scroll-y';
            } else {
                vbW = hostW;
                vbH = hostH;
            }
            plotTop = pad.top;
            plotLeft = pad.left;
            plotRight = vbW - pad.right;
            plotBottom = vbH - pad.bottom;
            innerHPlot = Math.max(1, plotBottom - plotTop);
            innerWPlot = Math.max(1, plotRight - plotLeft);
        }

        // Слот на категорию: по фактической «внутренней» ширине/высоте оси категорий,
        // иначе при scroll + n*minBandPx band оставался innerW0/n и ломал позиции/виртуализацию.
        if (isVert) {
            band = innerW / Math.max(1, n);
        } else {
            band = innerH / Math.max(1, n);
        }

        const spectrumStops = buildBarSpectrumStopTags(palette);
        const spectrumAttrs = isVert
            ? `gradientUnits="userSpaceOnUse" x1="${plotLeft}" y1="0" x2="${plotRight}" y2="0"`
            : `gradientUnits="userSpaceOnUse" x1="0" y1="${plotTop}" x2="0" y2="${plotBottom}"`;

        const defs =
            colorMode === 'gradient'
                ? `<linearGradient id="${gradId}" ${spectrumAttrs}>${spectrumStops}</linearGradient>`
                : `<linearGradient id="${gradId}"><stop offset="0%" stop-color="#00E0FF"/></linearGradient>`;

        let gridLines = '';
        if (showGrid) {
            for (let i = 0; i <= 5; i++) {
                if (isVert) {
                    const gy = plotTop + (i / 5) * innerHPlot;
                    gridLines += `<line x1="${plotLeft}" y1="${gy}" x2="${plotLeft + innerWPlot}" y2="${gy}" stroke="${strokeGrid}" stroke-width="1"/>`;
                } else {
                    const gx = plotLeft + (i / 5) * innerWPlot;
                    gridLines += `<line x1="${gx}" y1="${plotTop}" x2="${gx}" y2="${plotTop + innerHPlot}" stroke="${strokeGrid}" stroke-width="1"/>`;
                }
            }
        }

        let axisVal = '';
        if (showAxisVal) {
            const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => maxV * t);
            ticks.forEach((tv, ti) => {
                const lab = formatBarNumberPlain(tv, valueFmt);
                if (isVert) {
                    const gy = plotBottom - (ti / 4) * innerHPlot;
                    axisVal += `<text x="${plotLeft - 6}" y="${gy + 4}" text-anchor="end" font-size="${labelFs * 0.95}" fill="${escXml(textColor)}" opacity="0.85">${escXml(lab)}</text>`;
                } else {
                    const gx = plotLeft + (ti / 4) * innerWPlot;
                    axisVal += `<text x="${gx}" y="${plotBottom + 14}" text-anchor="middle" font-size="${labelFs * 0.95}" fill="${escXml(textColor)}" opacity="0.85">${escXml(lab)}</text>`;
                }
            });
        }

        const par = scrollClass.trim() ? 'none' : 'xMidYMid meet';
        const fitSvg = !useScrollX && !useScrollY;
        const svgSizeAttrs = fitSvg
            ? 'width="100%" height="100%"'
            : `width="${svgW}" height="${svgH}"`;
        const svgFitClass = fitSvg ? ' bar-widget-svg--fit' : '';

        const tsPx = parseInt(this.settings.titleSize, 10);
        const titleColorRaw = String(
            this.resolvedColor('titleColor', this.settings.titleColor) || '',
        ).trim();
        const titleColorOk = /^#[0-9a-fA-F]{6}$/i.test(titleColorRaw);
        const titleStyleParts = [];
        if (this.settings.showTitle && Number.isFinite(tsPx)) {
            titleStyleParts.push(`font-size:${Math.min(48, Math.max(8, tsPx))}px`);
        }
        if (this.settings.showTitle && titleColorOk) {
            titleStyleParts.push(`color:${titleColorRaw}`);
        }
        const titleSizeStyle = titleStyleParts.length
            ? ` style="${titleStyleParts.join(';')}"`
            : '';
        const titleBlock =
            this.settings.showTitle === true
                ? `<div class="dash-widget-heading"${titleSizeStyle}>${escXml(String(this.settings.title ?? ''))}</div>`
                : '';

        content.innerHTML = `
            <div class="dash-widget-shell dash-widget-shell--column chart-widget-root bar-widget-root" style="font-family:'${escXml(fontFamily)}',sans-serif;color:${escXml(textColor)};">
                ${titleBlock}
                <div class="bar-widget-tooltip" aria-hidden="true"></div>
                <div class="dash-widget-chart-body bar-widget-body${scrollClass}">
                    <svg class="bar-widget-svg${svgFitClass}" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="${par}" ${svgSizeAttrs} data-bar-sid="${escXml(sid)}">
                        <defs>
                            ${defs}
                            <filter id="${glowId}">
                                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        ${gridLines}
                        ${axisVal}
                        <g class="bar-layer-bars" data-layer="bars"></g>
                        <g class="bar-layer-stats" data-layer="stats">${buildBarStatsOverlaySvg(
                            computeBarCategoryStats(values),
                            this.settings.stats,
                            {
                                isVert,
                                orient,
                                plotLeft,
                                plotTop,
                                plotRight,
                                plotBottom,
                                innerWPlot,
                                innerHPlot,
                                maxV,
                            },
                            valueFmt,
                            fontFamily,
                            textColor,
                        )}</g>
                        <g class="bar-layer-cat" data-layer="cat"></g>
                        <g class="bar-layer-val" data-layer="val"></g>
                    </svg>
                </div>
            </div>
        `;

        const virtualize =
            (useScrollX || useScrollY) && n >= VIRTUALIZE_MIN_N;

        this._barRuntime = {
            items,
            n,
            isVert,
            orient,
            sid,
            gradId,
            glowId,
            colorMode,
            solid,
            palette,
            valueFmt,
            showVal,
            valPos,
            showAxisCat,
            showOnBarLegacy,
            plotLeft,
            plotTop,
            plotBottom,
            plotRight,
            innerWPlot,
            innerHPlot,
            band,
            innerW,
            innerH,
            maxV,
            gapPx,
            gapRatio,
            br,
            labelFs,
            valueFs0,
            maxLabelLines,
            vbW,
            vbH,
            useScrollX,
            useScrollY,
            virtualize,
            typography,
            textColor,
            fontFamily,
        };

        const body = content.querySelector('.bar-widget-body');
        this._barTooltipHide = () => {
            const tip = content.querySelector('.bar-widget-tooltip');
            if (tip) {
                tip.classList.remove('bar-widget-tooltip--visible');
                tip.textContent = '';
            }
        };
        if (body) body.addEventListener('mouseleave', this._barTooltipHide);

        if (body && (useScrollX || useScrollY) && virtualize) {
            this._barScrollHandler = () => this._barDrawDynamic(content);
            body.addEventListener('scroll', this._barScrollHandler, { passive: true });
        }

        this._barDrawDynamic(content);
    }

    /** @param {number} i0 @param {number} i1 inclusive */
    _visibleRange(body, layout) {
        const { n, band, plotLeft, plotTop, virtualize, useScrollX, useScrollY } = layout;
        if (!virtualize || !body) {
            return { i0: 0, i1: n - 1 };
        }
        if (useScrollX) {
            const sr = body.scrollLeft;
            const er = sr + body.clientWidth;
            const base = plotLeft;
            let i0 = Math.floor((sr - base) / band) - 3;
            let i1 = Math.ceil((er - base) / band) + 3;
            i0 = clamp(i0, 0, n - 1);
            i1 = clamp(i1, 0, n - 1);
            if (i1 < i0) [i0, i1] = [i1, i0];
            return { i0, i1 };
        }
        if (useScrollY) {
            const sr = body.scrollTop;
            const er = sr + body.clientHeight;
            const base = plotTop;
            let i0 = Math.floor((sr - base) / band) - 3;
            let i1 = Math.ceil((er - base) / band) + 3;
            i0 = clamp(i0, 0, n - 1);
            i1 = clamp(i1, 0, n - 1);
            if (i1 < i0) [i0, i1] = [i1, i0];
            return { i0, i1 };
        }
        return { i0: 0, i1: n - 1 };
    }

    _barDrawDynamic(content) {
        const rt = this._barRuntime;
        if (!rt || !content) return;

        const svg = content.querySelector('.bar-widget-svg');
        const body = content.querySelector('.bar-widget-body');
        const gBars = svg?.querySelector('[data-layer="bars"]');
        const gCat = svg?.querySelector('[data-layer="cat"]');
        const gVal = svg?.querySelector('[data-layer="val"]');
        if (!gBars || !gCat || !gVal) return;

        const {
            items,
            n,
            isVert,
            orient,
            gradId,
            glowId,
            colorMode,
            solid,
            palette,
            valueFmt,
            showVal,
            valPos,
            showAxisCat,
            showOnBarLegacy,
            plotLeft,
            plotTop,
            plotBottom,
            plotRight,
            innerWPlot,
            innerHPlot,
            band,
            maxV,
            gapPx,
            gapRatio,
            br,
            labelFs,
            valueFs0,
            maxLabelLines,
            vbW,
            vbH,
            useScrollX,
            useScrollY,
            virtualize,
            textColor,
            fontFamily,
        } = rt;

        const labelRot = normalizeBarLabelRotationDeg(this.settings.barLabelRotation);

        const { i0, i1 } = this._visibleRange(body, rt);

        let barsHtml = '';
        let catHtml = '';
        let valHtml = '';

        const slot = band;
        const innerSlot = Math.max(2, slot - gapPx);
        let barW = innerSlot * (1 - gapRatio);
        if (this.settings.barThickness === 'auto') {
            barW = clamp(
                barW,
                this.settings.barMinThicknessPx,
                this.settings.barMaxThicknessPx,
            );
        } else {
            barW = clamp(
                Number(this.settings.barThickness),
                this.settings.barMinThicknessPx,
                this.settings.barMaxThicknessPx,
            );
        }
        const offset = (slot - barW) / 2;

        const selIdx = this.settings.barSelectedIndex;

        for (let i = i0; i <= i1; i++) {
            const it = items[i];
            const v = it.value;
            const frac = v / maxV;
            const valStrPlain = formatBarNumberPlain(v, valueFmt);
            const valStr = escXml(valStrPlain);
            const title = escXml(`${it.label}: ${valStrPlain}`);

            let fillAttr = `url(#${gradId})`;
            if (colorMode === 'solid') fillAttr = escXml(solid);
            else if (colorMode === 'palette') fillAttr = escXml(palette[i % palette.length] || solid);

            const thrN = this.settings._resolvedBarThreshold;
            if (thrN != null && Number.isFinite(Number(thrN))) {
                const hi = String(
                    this.resolvedColor(
                        'barThresholdHighColor',
                        this.settings.barThresholdHighColor || '#34d399',
                    ) || '#34d399',
                ).trim();
                const lo = String(
                    this.resolvedColor(
                        'barThresholdLowColor',
                        this.settings.barThresholdLowColor || '#f87171',
                    ) || '#f87171',
                ).trim();
                const hiSafe = /^#[0-9a-fA-F]{3,8}$/.test(hi) ? hi : '#34d399';
                const loSafe = /^#[0-9a-fA-F]{3,8}$/.test(lo) ? lo : '#f87171';
                fillAttr = escXml(v >= Number(thrN) ? hiSafe : loSafe);
            }

            const isSel = selIdx === i;
            const stroke = isSel ? " stroke='#ffffff' stroke-width='2'" : '';

            if (isVert) {
                const barH = frac * innerHPlot;
                const x = plotLeft + i * slot + offset;
                let y;
                let h;
                if (orient === 'bottom') {
                    h = barH;
                    y = plotBottom - barH;
                } else {
                    h = barH;
                    y = plotTop;
                }
                const rx = Math.min(br, barW / 2, h / 2);
                barsHtml += `<g class="bar-hit" data-bar-idx="${i}" data-fill="${fillAttr}" data-base-opacity="0.92">
                    <title>${title}</title>
                    <rect class="bar-rect" x="${x}" y="${y}" width="${barW}" height="${h}" rx="${rx}" ry="${rx}" fill="${fillAttr}" filter="url(#${glowId})" opacity="0.92"${stroke}/>
                </g>`;

                if (showAxisCat) {
                    const cx = x + barW / 2;
                    const baseY =
                        orient === 'bottom'
                            ? plotBottom + labelFs * 0.85
                            : plotTop + labelFs * 0.85;
                    if (labelRot !== 0) {
                        const raw = String(it.label).replace(/\s+/g, ' ').trim() || '—';
                        const maxCh = Math.max(
                            4,
                            Math.floor((barW + labelFs * 2.5) / (labelFs * 0.36)),
                        );
                        const line =
                            raw.length > maxCh ? `${raw.slice(0, Math.max(1, maxCh - 1))}…` : raw;
                        const textEl = `<text pointer-events="none" x="${cx}" y="${baseY}" text-anchor="middle" font-size="${labelFs}" fill="${escXml(textColor)}" font-family="${escXml(fontFamily)}, sans-serif">${escXml(line)}</text>`;
                        catHtml += `<g transform="rotate(${labelRot}, ${cx}, ${baseY})">${textEl}</g>`;
                    } else {
                        const maxW = Math.max(12, barW - 2);
                        const lines = wrapLabelToLines(it.label, maxW, labelFs, maxLabelLines);
                        const tspans = lines
                            .map((ln, li) => {
                                const dy = li === 0 ? 0 : labelFs * 1.18;
                                return `<tspan x="${cx}" dy="${li === 0 ? 0 : dy}">${escXml(ln)}</tspan>`;
                            })
                            .join('');
                        catHtml += `<text pointer-events="none" x="${cx}" y="${baseY}" text-anchor="middle" font-size="${labelFs}" fill="${escXml(textColor)}" font-family="${escXml(fontFamily)}, sans-serif">${tspans}</text>`;
                    }
                }

                if (showVal) {
                    let fs = valueFs0;
                    let tw = approxTextWidthPx(valStrPlain, fs);
                    while (fs > 7 && tw > barW - 2 && valPos !== 'right') {
                        fs -= 0.75;
                        tw = approxTextWidthPx(valStrPlain, fs);
                    }
                    let pos = valPos;
                    const insideOk = h > fs + 6 && barW > tw + 4;
                    if (pos === 'inside' && !insideOk) pos = 'outside';

                    let tx;
                    let ty;
                    let anchor = 'middle';
                    if (pos === 'inside') {
                        tx = x + barW / 2;
                        ty = y + h / 2 + fs * 0.35;
                    } else if (pos === 'right') {
                        tx = x + barW + 6;
                        ty = y + h / 2 + fs * 0.35;
                        anchor = 'start';
                    } else if (pos === 'outside') {
                        tx = x + barW / 2;
                        ty = orient === 'bottom' ? y - 6 : y + h + fs + 4;
                    } else {
                        tx = x + barW / 2;
                        ty = orient === 'bottom' ? y - 6 : y + h + fs + 4;
                    }
                    const fill =
                        pos === 'inside' ? '#EEF1F6' : escXml(textColor);
                    valHtml += `<text pointer-events="none" x="${tx}" y="${ty}" text-anchor="${anchor}" font-size="${fs}" fill="${fill}" font-weight="600" font-family="${escXml(fontFamily)}, sans-serif">${valStr}</text>`;
                } else if (showOnBarLegacy && h > 14) {
                    valHtml += `<text pointer-events="none" x="${x + barW / 2}" y="${orient === 'bottom' ? y - 5 : y + h + 12}" text-anchor="middle" font-size="${valueFs0}" fill="${escXml(textColor)}" font-weight="600" font-family="${escXml(fontFamily)}, sans-serif">${valStr}</text>`;
                }
            } else {
                const barLen = frac * innerWPlot;
                const y = plotTop + i * slot + offset;
                const h = barW;
                const valueAxisX0 = orient === 'left' ? plotLeft : plotRight;
                let x;
                let w;
                if (orient === 'left') {
                    w = barLen;
                    x = valueAxisX0;
                } else {
                    w = barLen;
                    x = valueAxisX0 - barLen;
                }
                const rx = Math.min(br, w / 2, h / 2);
                barsHtml += `<g class="bar-hit" data-bar-idx="${i}" data-fill="${fillAttr}" data-base-opacity="0.92">
                    <title>${title}</title>
                    <rect class="bar-rect" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="${fillAttr}" filter="url(#${glowId})" opacity="0.92"${stroke}/>
                </g>`;

                if (showAxisCat) {
                    const maxW =
                        orient === 'left'
                            ? Math.max(16, plotLeft - 8)
                            : Math.max(16, vbW - plotRight - 8);
                    const lines = wrapLabelToLines(it.label, maxW, labelFs, maxLabelLines);
                    const cx = orient === 'left' ? plotLeft - 6 : plotRight + 6;
                    const cy = y + h / 2;
                    const anchor = orient === 'left' ? 'end' : 'start';
                    const tspans = lines
                        .map((ln, li) => {
                            const dy = li === 0 ? 0 : labelFs * 1.12;
                            return `<tspan x="${cx}" dy="${li === 0 ? 0 : dy}">${escXml(ln)}</tspan>`;
                        })
                        .join('');
                    catHtml += `<text pointer-events="none" x="${cx}" y="${cy + labelFs * 0.35}" text-anchor="${anchor}" font-size="${labelFs}" fill="${escXml(textColor)}" font-family="${escXml(fontFamily)}, sans-serif">${tspans}</text>`;
                }

                if (showVal) {
                    let fs = valueFs0;
                    let tx = orient === 'left' ? x + w + 6 : x - 6;
                    let ty = y + h / 2 + fs * 0.35;
                    let anchor = orient === 'left' ? 'start' : 'end';
                    let tw = approxTextWidthPx(valStrPlain, fs);
                    while (fs > 7 && tw > innerWPlot - w - 10) {
                        fs -= 0.75;
                        tw = approxTextWidthPx(valStrPlain, fs);
                    }
                    const fill = escXml(textColor);
                    valHtml += `<text pointer-events="none" x="${tx}" y="${ty}" text-anchor="${anchor}" font-size="${fs}" fill="${fill}" font-weight="600" font-family="${escXml(fontFamily)}, sans-serif">${valStr}</text>`;
                } else if (showOnBarLegacy && w > 18) {
                    valHtml += `<text pointer-events="none" x="${orient === 'left' ? x + w + 6 : x - 6}" y="${y + h / 2 + 4}" text-anchor="${orient === 'left' ? 'start' : 'end'}" font-size="${valueFs0}" fill="${escXml(textColor)}" font-weight="600" font-family="${escXml(fontFamily)}, sans-serif">${valStr}</text>`;
                }
            }
        }

        gBars.innerHTML = barsHtml;
        gCat.innerHTML = catHtml;
        gVal.innerHTML = valHtml;

        this._barWireInteractions(content);
    }

    _barWireInteractions(content) {
        const tip = content.querySelector('.bar-widget-tooltip');
        const svg = content.querySelector('.bar-widget-svg');
        if (!svg) return;

        const hideTip = this._barTooltipHide || (() => {});

        svg.querySelectorAll('.bar-hit').forEach((g) => {
            const rect = g.querySelector('.bar-rect');
            if (!rect) return;

            g.addEventListener('mouseenter', (ev) => {
                const idx = parseInt(g.getAttribute('data-bar-idx'), 10);
                const it = this._barRuntime?.items?.[idx];
                if (tip && it) {
                    tip.textContent = `${it.label}: ${formatBarNumberPlain(it.value, this.settings.barValueFormat)}`;
                    tip.classList.add('bar-widget-tooltip--visible');
                    tip.style.left = `${ev.clientX + 12}px`;
                    tip.style.top = `${ev.clientY + 12}px`;
                }
                if (!this.settings.barHoverEffect) return;
                const f = g.getAttribute('data-fill');
                if (f && !f.startsWith('url(')) {
                    rect.setAttribute('fill', f);
                    rect.setAttribute('opacity', '1');
                } else {
                    rect.setAttribute('opacity', '1');
                }
            });
            g.addEventListener('mousemove', (ev) => {
                if (!tip || !tip.classList.contains('bar-widget-tooltip--visible')) return;
                tip.style.left = `${ev.clientX + 12}px`;
                tip.style.top = `${ev.clientY + 12}px`;
            });
            g.addEventListener('mouseleave', () => {
                rect.setAttribute('opacity', g.getAttribute('data-base-opacity') || '0.92');
                hideTip();
            });

            g.addEventListener('click', (ev) => {
                const idx = parseInt(g.getAttribute('data-bar-idx'), 10);
                if (Number.isNaN(idx)) return;
                const engine = typeof window !== 'undefined' ? window.engine : null;
                const dim = this.settings.bindingDimension;
                const it = this._barRuntime?.items?.[idx];

                if (ev.shiftKey) {
                    if (engine && dim?.field && it) {
                        const ensured = ensureDashboardFilterRowExists(engine, dim);
                        if (ensured.ok) {
                            cycleFilterValueIncludeExcludeState(engine, ensured.row, it.label);
                            eventBus.emit('dashboard:filters-changed', { source: 'bar-chart' });
                        }
                    }
                    return;
                }

                if (engine && dim?.field && it) {
                    const ensured = ensureDashboardFilterRowExists(engine, dim);
                    if (ensured.ok) {
                        const r = setDashboardFilterIncludeOnlyValue(engine, dim, it.label, {
                            toggle: true,
                        });
                        if (r.ok) {
                            this.settings.barSelectedIndex = null;
                            eventBus.emit('dashboard:filters-changed', { source: 'bar-chart' });
                            return;
                        }
                    }
                }

                this.settings.barSelectedIndex =
                    this.settings.barSelectedIndex === idx ? null : idx;
                this._barDrawDynamic(content);
                eventBus.emit('widget:styles-changed', { widget: this });
            });
        });
    }

    async reloadFromDataModel(engine) {
        const dimRaw = this.settings.bindingDimension;
        const measRaw = this.settings.bindingMeasure;
        const dim = resolveChartDimension(dimRaw);
        const meas = resolveChartMeasure(measRaw, {
            weightMode: this.settings.barSliceWeight,
        });
        if (!engine || !dim || !meas) {
            this.update();
            return;
        }
        if (!dim.sqlOk || !meas.sqlOk) {
            this.settings.bindingError = dim.error || meas.error || 'Ошибка формулы привязки';
            this.settings.data = [];
            this.update();
            return;
        }
        const forMatch = chartMeasureForMatchesDimension(meas, dim);
        if (!forMatch.ok) {
            this.settings.bindingError = forMatch.error;
            this.settings.data = [];
            this.update();
            return;
        }
        if (String(dim.modelId) !== String(meas.modelId)) {
            console.warn('BarChart: измерение и мера должны быть из одной модели данных');
            this.settings.bindingError = 'Измерение и мера должны быть из одной модели данных';
            this.update();
            return;
        }
        try {
            delete this.settings.bindingError;
            const filters = mergeChartMeasureFilters(
                filtersForModel(collectDashboardFilters(engine), dim.modelId),
                meas,
            );
            const aggFn = String(meas.aggFn || 'sum').toLowerCase();
            const parseVal = typeof meas.parse === 'function' ? meas.parse : (raw) => {
                const n = parseFloat(raw);
                return Number.isFinite(n) ? n : 0;
            };
            const client = getDashboardDataModelClient(engine);
            const { rows } = await client.fetchAggregate({
                modelId: dim.modelId,
                base_table: dim.table,
                group_by: [dim.field],
                aggregations: [{ fn: aggFn, column: chartMeasureAggColumn(dim, meas), as: 'value' }],
                filters,
                limit: 500,
            });
            this.settings.xField = dim.field;
            this.settings.yField = 'value';
            this.settings.data = (rows || []).map((r) => ({
                [dim.field]: r[dim.field],
                value: parseVal(r.value),
            }));

            delete this.settings._resolvedBarThreshold;
            const thrF = String(this.settings.barThresholdFormula || '').trim();
            if (thrF && engine) {
                try {
                    const resolved = await resolveKpiDataSourceFromFormula(
                        engine,
                        { modelId: dim.modelId, table: dim.table },
                        thrF,
                    );
                    const mid = resolved?.modelId ?? dim.modelId;
                    const tbl = resolved?.table ?? dim.table;
                    if (mid != null && tbl) {
                        const b = await runNamedFormulaBundle(engine, mid, tbl, { bar_thr: thrF }, null);
                        const n = b.byId.bar_thr?.numeric;
                        this.settings._resolvedBarThreshold =
                            n != null && Number.isFinite(n) ? n : null;
                    }
                } catch (e2) {
                    console.warn('BarChartWidget threshold formula', e2);
                    this.settings._resolvedBarThreshold = null;
                }
            }

            this.dataSource = {
                type: 'data-model',
                modelId: dim.modelId,
                table: dim.table,
                field: dim.field,
                fieldType: dim.type,
            };
            this.update();
        } catch (e) {
            if (e?.name === 'AbortError') return;
            console.error('BarChartWidget reloadFromDataModel', e);
            const msg = e?.response?.data?.detail || e?.message || 'Ошибка загрузки данных';
            this.settings.bindingError =
                typeof msg === 'string' ? msg : JSON.stringify(msg);
            this.settings.data = [];
            this.update();
        }
    }

    toJSON() {
        const settings = { ...this.settings };
        delete settings.bindingError;
        delete settings._resolvedBarThreshold;
        return {
            ...super.toJSON(),
            settings,
        };
    }

    fromJSON(json) {
        super.fromJSON(json);
        if (json.settings) {
            this.settings = { ...this.settings, ...json.settings };
        }
        delete this.settings.bindingError;
        if (this.settings.barSliceWeight !== 'sum' && this.settings.barSliceWeight !== 'count') {
            this.settings.barSliceWeight = 'auto';
        }
        normalizeBarSettings(this.settings);
        this.render();
    }
}
