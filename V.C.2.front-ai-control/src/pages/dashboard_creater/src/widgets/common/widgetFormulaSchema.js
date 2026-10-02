/**
 * Унификация опциональных формульных полей виджетов (обратно совместимо со старым JSON).
 */

import { normalizeTableConditionalRules } from './tableConditionalStyle.js';
import { normalizeTableBindingFieldFormulas } from './tableColumnFormula.js';
import { normalizeChartBindingFormulas } from './chartBindingFormula.js';

/** Цвет фона ячеек заголовка таблицы по умолчанию (серый) */
export const DEFAULT_TABLE_COLUMN_HEADER_BG = '#cfd5e3';

/**
 * @param {Record<string, unknown>} settings
 */
export function normalizeBarFormulaFields(settings) {
    const s = settings;
    normalizeChartBindingFormulas(s);
    if (typeof s.barThresholdFormula !== 'string') s.barThresholdFormula = '';
    else s.barThresholdFormula = s.barThresholdFormula.trim();
    if (!s.barThresholdHighColor || typeof s.barThresholdHighColor !== 'string') {
        s.barThresholdHighColor = '#34d399';
    }
    if (!s.barThresholdLowColor || typeof s.barThresholdLowColor !== 'string') {
        s.barThresholdLowColor = '#f87171';
    }
}

/**
 * @param {Record<string, unknown>} settings
 */
export function normalizePieFormulaFields(settings) {
    const s = settings;
    normalizeChartBindingFormulas(s);
    if (typeof s.pieSliceThresholdFormula !== 'string') s.pieSliceThresholdFormula = '';
    else s.pieSliceThresholdFormula = s.pieSliceThresholdFormula.trim();
    if (!s.pieSliceAboveColor || typeof s.pieSliceAboveColor !== 'string') {
        s.pieSliceAboveColor = '#34d399';
    }
    if (!s.pieSliceBelowColor || typeof s.pieSliceBelowColor !== 'string') {
        s.pieSliceBelowColor = '#f87171';
    }
}

/**
 * @param {Record<string, unknown>} settings
 */
export function normalizeLineFormulaFields(settings) {
    const s = settings;
    normalizeChartBindingFormulas(s);
    if (typeof s.lineThresholdFormula !== 'string') s.lineThresholdFormula = '';
    else s.lineThresholdFormula = s.lineThresholdFormula.trim();
    if (!s.lineThresholdHighColor || typeof s.lineThresholdHighColor !== 'string') {
        s.lineThresholdHighColor = '#34d399';
    }
    if (!s.lineThresholdLowColor || typeof s.lineThresholdLowColor !== 'string') {
        s.lineThresholdLowColor = '#f87171';
    }
}

/**
 * @param {Record<string, unknown>} settings
 */
export function normalizeTextStyleFormulas(settings) {
    const s = settings;
    for (const k of ['blockBackgroundFormula', 'textColorFormula', 'visibilityFormula']) {
        if (typeof s[k] !== 'string') s[k] = '';
        else s[k] = s[k].trim();
    }
}

/**
 * @param {Record<string, unknown>} settings
 * @returns {Record<string, unknown>}
 */
export function normalizeTableExtendedSettings(settings) {
    const s = settings;
    s.bindingFields = normalizeTableBindingFieldFormulas(s.bindingFields);
    if (!Array.isArray(s.computedColumns)) s.computedColumns = [];
    s.computedColumns = s.computedColumns
        .map((c, i) => {
            if (!c || typeof c !== 'object') return null;
            const rawId = String(c.id || '').trim();
            const id =
                rawId.replace(/[^\w]/g, '_').replace(/^_+/, '').slice(0, 48) ||
                `col_${i}`;
            const header = String(c.header != null && String(c.header).trim() ? c.header : id);
            const formula = String(c.formula || '').trim();
            if (!formula) return null;
            return { id, header, formula };
        })
        .filter(Boolean);
    s.tableConditionalRules = normalizeTableConditionalRules(s.tableConditionalRules);
    delete s.columnHeaderColor;
    if (typeof s.columnHeaderBackgroundColor === 'string') {
        const c = s.columnHeaderBackgroundColor.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(c)) s.columnHeaderBackgroundColor = c;
        else s.columnHeaderBackgroundColor = DEFAULT_TABLE_COLUMN_HEADER_BG;
    } else {
        s.columnHeaderBackgroundColor = DEFAULT_TABLE_COLUMN_HEADER_BG;
    }
    if (!s.columnWidths || typeof s.columnWidths !== 'object' || Array.isArray(s.columnWidths)) {
        s.columnWidths = {};
    } else {
        const cleaned = {};
        for (const [key, value] of Object.entries(s.columnWidths)) {
            const colKey = String(key || '').trim();
            const n = Number(value);
            if (!colKey || !Number.isFinite(n)) continue;
            cleaned[colKey] = Math.min(800, Math.max(48, Math.round(n)));
        }
        s.columnWidths = cleaned;
    }
    return s;
}
