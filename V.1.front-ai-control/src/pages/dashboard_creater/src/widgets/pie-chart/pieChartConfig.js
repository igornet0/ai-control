import { defaultTextColor } from '../../theme/themeRuntime.js';
/**
 * Нормализация конфигурации круговой диаграммы (JSON + обратная совместимость).
 */

export const PIE_CHART_DEFAULTS = {
    /** @deprecated use legend.enabled */
    type: 'pie',
    donut: false,
    /** 0..1 от внешнего радиуса */
    innerRadius: 0.58,
    /** Угловой зазор между сегментами (радианы), суммарно распределяется по всем */
    segmentPad: 0.04,
    /** Скругление внешней кромки (условное, в единицах viewBox) */
    segmentCornerRadius: 2,
    gradients: {
        enabled: false,
        type: 'radial', // 'linear' | 'radial'
    },
    labels: {
        showPercent: true,
        showValue: false,
        showName: false,
        /** percent | value | both | none — чем показывать число на сегменте */
        valueDisplay: 'percent',
        /** inside | outside | hidden */
        position: 'inside',
        /** Мин. угол сегмента (градусы), ниже — подпись скрыта (inside/outside) */
        minAngleDeg: 6,
        /** Число знаков после запятой для процентов */
        percentDecimals: 1,
    },
    /** Центр donut: шаблон, агрегация по секторам или отдельный запрос по мере */
    center: {
        enabled: true,
        /** default | hover — при hover показывать сегмент */
        mode: 'default',
        /** Плейсхолдеры: {sum} {avg} {min} {max} {count} {total} {value} {metric} */
        template: '{total}',
        /** segments — из видимых секторов; measure — отдельная SQL-агрегация по мере */
        valueSource: 'segments',
        /** Агрегация по видимым секторам: sum | avg | min | max | count (число категорий) */
        segmentAggregate: 'sum',
        /** При valueSource measure: sum | avg | min | max | count по полю меры (те же фильтры) */
        measureFn: 'sum',
        /** compact | standard | scientific | integer */
        numberFormat: 'compact',
        defaultMetric: 'total',
    },
    colorMode: 'auto', // auto | dark | light | custom — тема автопалитры
    /** Режим окраски из панели: gradient | solid | palette */
    pieColorMode: 'palette',
    pieSolidColor: '#00E0FF',
    /** Палитра при colorMode custom / pieColorMode palette|gradient */
    colors: null,
    legend: {
        enabled: true,
        position: 'right', // right | left | top | bottom
        align: 'start', // start | center | end
        /** column — элементы легенды столбиком; row — в строку с переносом */
        itemFlow: 'column', // column | row
        showColor: true,
        showName: true,
        showValue: false,
        showPercent: true,
        /** percent | value | both | none */
        valueDisplay: 'percent',
        /** Шаблон: {name} {value} {percent} */
        format: null,
        interactive: true,
        multiSelect: true,
        iconShape: 'square', // square | circle
        iconSize: 11,
        itemGap: 6,
        fontSize: null,
        fontWeight: null,
        color: null,
        maxHeight: 200,
        sort: 'value', // value | alpha | none
        /** Склеивать мелкие доли в сектор «Прочее» (порог otherThreshold) */
        groupSmallIntoOther: true,
        otherThreshold: 0.012,
        otherLabel: 'Прочее',
        searchEnabled: true,
    },
};

function deepMerge(base, over) {
    if (!over || typeof over !== 'object') return { ...base };
    const out = { ...base };
    for (const k of Object.keys(over)) {
        const v = over[k];
        if (v != null && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object' && base[k] != null && !Array.isArray(base[k])) {
            out[k] = deepMerge(base[k], v);
        } else if (v !== undefined) {
            out[k] = v;
        }
    }
    return out;
}

export const PIE_VALUE_DISPLAY_MODES = ['percent', 'value', 'both', 'none'];

/**
 * @param {unknown} raw
 * @param {boolean} [showPercent]
 * @param {boolean} [showValue]
 * @returns {'percent'|'value'|'both'|'none'}
 */
export function normalizePieValueDisplay(raw, showPercent, showValue) {
    const s = String(raw || '').toLowerCase();
    if (PIE_VALUE_DISPLAY_MODES.includes(s)) return /** @type {'percent'|'value'|'both'|'none'} */ (s);
    const p = showPercent !== false;
    const v = !!showValue;
    if (p && v) return 'both';
    if (v && !p) return 'value';
    if (!p && !v) return 'none';
    return 'percent';
}

/**
 * @param {'percent'|'value'|'both'|'none'} mode
 */
export function pieValueDisplayFlags(mode) {
    return {
        showPercent: mode === 'percent' || mode === 'both',
        showValue: mode === 'value' || mode === 'both',
    };
}

function applyValueDisplay(target) {
    if (!target || typeof target !== 'object') return;
    const mode = normalizePieValueDisplay(target.valueDisplay, target.showPercent, target.showValue);
    target.valueDisplay = mode;
    const flags = pieValueDisplayFlags(mode);
    target.showPercent = flags.showPercent;
    target.showValue = flags.showValue;
}

function luminance(hex) {
    if (!hex || typeof hex !== 'string') return 0.2;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * @param {Record<string, unknown>} settings - widget.settings
 * @param {Record<string, unknown>} [typography] - styles.typography
 * @param {Record<string, unknown>} [appearance] - styles.appearance
 */
export function normalizePieConfig(settings = {}, typography = {}, appearance = {}) {
    const raw = { ...settings };
    const nested = raw.pie && typeof raw.pie === 'object' ? raw.pie : {};
    let merged = deepMerge(PIE_CHART_DEFAULTS, nested);

    if (raw.donut != null) merged.donut = !!raw.donut;
    if (raw.innerRadius != null) merged.innerRadius = clamp01(Number(raw.innerRadius));
    if (raw.segmentPad != null) merged.segmentPad = Math.max(0, Math.min(0.35, Number(raw.segmentPad)));
    if (raw.segmentCornerRadius != null) merged.segmentCornerRadius = Math.max(0, Number(raw.segmentCornerRadius));
    if (raw.gradients && typeof raw.gradients === 'object') merged.gradients = deepMerge(merged.gradients, raw.gradients);
    if (raw.labels && typeof raw.labels === 'object') merged.labels = deepMerge(merged.labels, raw.labels);
    applyValueDisplay(merged.labels);
    if (raw.center && typeof raw.center === 'object') merged.center = deepMerge(merged.center, raw.center);
    if (merged.center.segmentAggregate && !['sum', 'avg', 'min', 'max', 'count'].includes(merged.center.segmentAggregate)) {
        merged.center.segmentAggregate = 'sum';
    }
    if (merged.center.measureFn && !['sum', 'avg', 'min', 'max', 'count'].includes(merged.center.measureFn)) {
        merged.center.measureFn = 'sum';
    }
    if (merged.center.valueSource && !['segments', 'measure'].includes(merged.center.valueSource)) {
        merged.center.valueSource = 'segments';
    }
    if (merged.center.numberFormat && !['compact', 'standard', 'scientific', 'integer'].includes(merged.center.numberFormat)) {
        merged.center.numberFormat = 'compact';
    }
    if (raw.colorMode) merged.colorMode = raw.colorMode;
    if (raw.pieColorMode != null) {
        const m = String(raw.pieColorMode).toLowerCase();
        merged.pieColorMode = ['gradient', 'solid', 'palette'].includes(m) ? m : 'palette';
    }
    if (raw.pieSolidColor != null) {
        const c = String(raw.pieSolidColor).trim();
        if (/^#[0-9a-fA-F]{3,8}$/.test(c)) merged.pieSolidColor = c;
    }
    if (Array.isArray(raw.colors)) merged.colors = raw.colors;

    // Режим «Градиент» включает объёмную заливку сегментов, если явно не выключили
    if (merged.pieColorMode === 'gradient' && raw.gradients?.enabled == null) {
        merged.gradients = { ...merged.gradients, enabled: true };
    }
    // Режим панели → custom colors (не адаптировать под фон)
    if (['gradient', 'solid', 'palette'].includes(merged.pieColorMode)) {
        if (
            merged.pieColorMode === 'solid' ||
            merged.pieColorMode === 'gradient' ||
            (Array.isArray(merged.colors) && merged.colors.length)
        ) {
            merged.colorMode = 'custom';
        }
    }
    if (raw.legend && typeof raw.legend === 'object') {
        merged.legend = deepMerge(merged.legend, raw.legend);
    }
    applyValueDisplay(merged.legend);
    if (raw.showLegend === false) merged.legend.enabled = false;
    if (raw.showLegend === true && raw.legend == null) merged.legend.enabled = true;

    const textCol = typography.color || defaultTextColor();
    const bgCol = appearance.backgroundColor || '#1a1d24';
    if (merged.colorMode === 'auto') {
        merged._resolvedDark = luminance(textCol) > 0.55 ? false : true;
        merged._bgLum = luminance(bgCol);
    } else if (merged.colorMode === 'dark') {
        merged._resolvedDark = true;
    } else {
        merged._resolvedDark = false;
    }

    return merged;
}

function clamp01(x) {
    if (!Number.isFinite(x)) return PIE_CHART_DEFAULTS.innerRadius;
    return Math.min(0.92, Math.max(0, x));
}

/**
 * Размеры текста pie из панели типографики (с запасным расчётом по геометрии кольца).
 * @param {Record<string, unknown>} [typography]
 * @param {{ outerR?: number, innerR?: number }} [geom]
 */
export function resolvePieTypographySizes(typography = {}, geom = {}) {
    const outerR = Number(geom.outerR) || 100;
    const innerR = Number(geom.innerR) || 58;
    const typoBase = Number(typography.fontSize);
    const hasTypo = Number.isFinite(typoBase) && typoBase > 0;
    const geomLabel = Math.max(9, Math.min(16, (outerR - innerR) * 0.14));

    const labelFs = hasTypo ? Math.max(8, typoBase * 0.82) : geomLabel;
    const labelOutsideFs = labelFs * 0.92;
    const centerFs = hasTypo ? Math.max(10, typoBase * 1.35) : 22;

    return {
        labelFs,
        labelOutsideFs,
        centerFs,
        fontWeight: typography.fontWeight || '600',
        centerFontWeight: typography.fontWeight || '700',
    };
}

/**
 * Экспорт «плоского» JSON для API/сохранения (без служебных полей).
 */
export function pieConfigToJSON(cfg) {
    const { _resolvedDark, _bgLum, ...rest } = cfg;
    void _resolvedDark;
    void _bgLum;
    return rest;
}
