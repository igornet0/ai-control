/**
 * Фон KPI: один цвет, условные правила по значению KPI или по знаку дельты (сравнение периодов).
 */

const OPS = new Set(['lt', 'lte', 'gt', 'gte', 'eq', 'between']);

/**
 * Порог правила: только число в строке → literal; иначе — строка формулы (SUM, арифметика и т.д.).
 * @param {unknown} raw
 * @returns {{ value: number, valueFormula: string }}
 */
export function parseKpiBgRuleThresholdInput(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return { value: 0, valueFormula: '' };
    if (/^-?\d+(?:\.\d+)?(?:e-?\d+)?$/i.test(s)) {
        const n = parseFloat(s);
        return { value: Number.isFinite(n) ? n : 0, valueFormula: '' };
    }
    return { value: 0, valueFormula: s };
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function normalizeHexColor(v, fallback) {
    const s = String(v ?? '').trim();
    if (s.toLowerCase() === 'transparent') return 'transparent';
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
        const r = s[1];
        const g = s[2];
        const b = s[3];
        return `#${r}${r}${g}${g}${b}${b}`;
    }
    return fallback;
}

/**
 * @param {Record<string, unknown>} settings
 */
export function normalizeKpiBackgroundSettings(settings) {
    const s = settings || {};
    const rawMode = String(s.kpiBackgroundMode || 'solid').toLowerCase();
    const mode = rawMode === 'rules' ? 'rules' : rawMode === 'delta' ? 'delta' : 'solid';
    const def = normalizeHexColor(s.kpiBackgroundDefaultColor, 'transparent');
    const deltaNegativeColor = normalizeHexColor(s.kpiBackgroundDeltaNegativeColor, '#c62828');
    const deltaPositiveColor = normalizeHexColor(s.kpiBackgroundDeltaPositiveColor, '#2e7d32');
    const raw = Array.isArray(s.kpiBackgroundRules) ? s.kpiBackgroundRules : [];
    const rules = [];
    for (const r of raw) {
        if (!r || typeof r !== 'object') continue;
        const op = String(r.op || 'gte').toLowerCase();
        if (!OPS.has(op)) continue;
        const color = normalizeHexColor(r.color, '#333333');
        const value = Number(r.value);
        const value2 = Number(r.value2);
        const valueFormula = String(r.valueFormula ?? '').trim();
        const value2Formula = String(r.value2Formula ?? '').trim();
        rules.push({
            op,
            value: Number.isFinite(value) ? value : 0,
            value2: Number.isFinite(value2) ? value2 : 0,
            valueFormula,
            value2Formula,
            color,
        });
        if (rules.length >= 12) break;
    }
    return { mode, defaultColor: def, rules, deltaNegativeColor, deltaPositiveColor };
}

/**
 * @param {{ valueFormula?: string, value?: number }} rule
 * @param {number} idx
 * @param {Array<{ value?: number, value2?: number }>|null|undefined} resolvedList
 */
function pickRuleThresholdV(rule, idx, resolvedList) {
    if (String(rule.valueFormula || '').trim()) {
        const x = resolvedList?.[idx]?.value;
        return Number.isFinite(x) ? x : NaN;
    }
    return Number.isFinite(rule.value) ? rule.value : NaN;
}

/**
 * @param {{ value2Formula?: string, value2?: number }} rule
 * @param {number} idx
 * @param {Array<{ value?: number, value2?: number }>|null|undefined} resolvedList
 */
function pickRuleThresholdV2(rule, idx, resolvedList) {
    if (String(rule.value2Formula || '').trim()) {
        const x = resolvedList?.[idx]?.value2;
        return Number.isFinite(x) ? x : NaN;
    }
    return Number.isFinite(rule.value2) ? rule.value2 : NaN;
}

/**
 * @param {Record<string, unknown>} settings
 * @param {number|null|undefined} primaryNumeric — число KPI (snap.current)
 * @param {Array<{ value?: number, value2?: number }>|null|undefined} resolvedList — вычисленные пороги по формулам (параллельно rules)
 * @param {number|null|undefined} deltaNumeric — абсолютная дельта KPI (current − previous), только для режима «по дельте»
 * @returns {string} CSS color / transparent
 */
export function resolveKpiBackgroundCss(settings, primaryNumeric, resolvedList = null, deltaNumeric = null) {
    const bg = normalizeHexColor(settings?.backgroundColor, 'transparent');
    const { mode, defaultColor, rules, deltaNegativeColor, deltaPositiveColor } =
        normalizeKpiBackgroundSettings(settings);
    if (mode === 'delta') {
        const d = deltaNumeric;
        if (!Number.isFinite(d)) return defaultColor;
        if (d < 0) return deltaNegativeColor;
        if (d > 0) return deltaPositiveColor;
        return defaultColor;
    }
    if (mode !== 'rules' || rules.length === 0) {
        return bg;
    }
    const n = primaryNumeric;
    if (!Number.isFinite(n)) {
        return defaultColor;
    }
    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const v = pickRuleThresholdV(rule, i, resolvedList);
        const v2 = pickRuleThresholdV2(rule, i, resolvedList);
        let ok = false;
        switch (rule.op) {
            case 'lt':
                ok = n < v;
                break;
            case 'lte':
                ok = n <= v;
                break;
            case 'gt':
                ok = n > v;
                break;
            case 'gte':
                ok = n >= v;
                break;
            case 'eq': {
                if (!Number.isFinite(v)) {
                    ok = false;
                    break;
                }
                const scale = Math.max(1, Math.abs(n), Math.abs(v));
                ok = Math.abs(n - v) <= 1e-8 * scale;
                break;
            }
            case 'between': {
                if (!Number.isFinite(v) || !Number.isFinite(v2)) {
                    ok = false;
                    break;
                }
                const lo = Math.min(v, v2);
                const hi = Math.max(v, v2);
                ok = n >= lo && n <= hi;
                break;
            }
            default:
                ok = false;
        }
        if (ok) return rule.color;
    }
    return defaultColor;
}
