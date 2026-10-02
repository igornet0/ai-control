/**
 * Reference lines: number | formula (scalar via existing Formula API).
 * Formula = вычисление; Chart = отрисовка resolved числа.
 *
 * Scope:
 * - Formula references → global (model + dashboard filters), как threshold / KPI.
 * - type average|median → viewport stats на стороне Chart (не Formula).
 *
 * Future (не в этом модуле): series-valued Window Formula
 * (MOVING_AVG / LAG / CUMSUM) → Derived Series → Line Chart series binding.
 */

import { compileFormula } from '../../formula/compile.js';
import { formulaHasQualifiedTableRefs } from '../../formula/formulaInference.js';

/**
 * Чистая числовая строка (в т.ч. с пробелами / запятой как десятичный разделитель).
 * @param {unknown} raw
 * @returns {number|null}
 */
export function parsePlainNumberInput(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).trim().replace(/\s+/g, '').replace(',', '.');
  if (!s) return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Скалярная формула (агрегаты + арифметика), пригодная для Reference / KPI / Gauge.
 * Не то же самое, что формула меры линии (колонка SELECT).
 * @param {string} formula
 * @returns {{ ok: boolean, error?: string, aggs?: number }}
 */
export function validateScalarAggregateFormula(formula) {
  const src = String(formula ?? '').trim();
  if (!src) return { ok: false, error: 'Пустая формула' };
  const asNum = parsePlainNumberInput(src);
  if (asNum != null) return { ok: true, aggs: 0 };
  try {
    const { aggs, ast } = compileFormula(src);
    if (!ast) return { ok: false, error: 'Не удалось разобрать формулу' };
    if (!aggs?.length && !formulaHasQualifiedTableRefs(src)) {
      // Константное выражение без полей — compile обычно даёт num
      if (ast.t === 'num') return { ok: true, aggs: 0 };
    }
    if (!aggs?.length) {
      return { ok: false, error: 'Формула должна содержать агрегат или поле, например SUM([t.x])' };
    }
    return { ok: true, aggs: aggs.length };
  } catch (e) {
    return { ok: false, error: e?.message ? String(e.message) : 'Ошибка формулы' };
  }
}

/**
 * Нормализация одного reference из settings (обратная совместимость).
 * @param {Record<string, unknown>} r
 * @param {number} i
 */
export function normalizeLineReference(r, i = 0) {
  if (!r || typeof r !== 'object') return null;
  const type = ['constant', 'average', 'median', 'target', 'band'].includes(String(r.type))
    ? String(r.type)
    : 'constant';

  let value = r.value != null && Number.isFinite(Number(r.value)) ? Number(r.value) : null;
  let yMin = r.yMin != null && Number.isFinite(Number(r.yMin)) ? Number(r.yMin) : null;
  let yMax = r.yMax != null && Number.isFinite(Number(r.yMax)) ? Number(r.yMax) : null;

  let valueFormula = typeof r.valueFormula === 'string' ? r.valueFormula.trim() : '';
  let yMinFormula = typeof r.yMinFormula === 'string' ? r.yMinFormula.trim() : '';
  let yMaxFormula = typeof r.yMaxFormula === 'string' ? r.yMaxFormula.trim() : '';

  // Legacy: value как строка-формула
  if (!valueFormula && typeof r.value === 'string' && String(r.value).trim()) {
    const asNum = parsePlainNumberInput(r.value);
    if (asNum != null) value = asNum;
    else valueFormula = String(r.value).trim();
  }
  if (!yMinFormula && typeof r.yMin === 'string' && String(r.yMin).trim()) {
    const asNum = parsePlainNumberInput(r.yMin);
    if (asNum != null) yMin = asNum;
    else yMinFormula = String(r.yMin).trim();
  }
  if (!yMaxFormula && typeof r.yMax === 'string' && String(r.yMax).trim()) {
    const asNum = parsePlainNumberInput(r.yMax);
    if (asNum != null) yMax = asNum;
    else yMaxFormula = String(r.yMax).trim();
  }

  // Band с одним bound без формул → constant (как раньше)
  if (
    type === 'band' &&
    !yMinFormula &&
    !yMaxFormula &&
    (yMin == null || yMax == null)
  ) {
    const single = yMin ?? yMax ?? value;
    if (single != null && !valueFormula) {
      return {
        id: String(r.id || `ref_${i}`),
        type: 'constant',
        value: single,
        valueFormula: '',
        yMin: null,
        yMax: null,
        yMinFormula: '',
        yMaxFormula: '',
        label: r.label != null ? String(r.label) : String(single),
        color: r.color != null ? String(r.color) : '#f59e0b',
        style: ['solid', 'dashed', 'dotted'].includes(String(r.style)) ? String(r.style) : 'dashed',
      };
    }
  }

  return {
    id: String(r.id || `ref_${i}`),
    type,
    value,
    valueFormula,
    yMin,
    yMax,
    yMinFormula,
    yMaxFormula,
    label: r.label != null ? String(r.label) : '',
    color: r.color != null ? String(r.color) : '#f59e0b',
    style: ['solid', 'dashed', 'dotted'].includes(String(r.style)) ? String(r.style) : 'dashed',
  };
}

/**
 * @param {unknown[]} refs
 */
export function normalizeLineReferences(refs) {
  if (!Array.isArray(refs)) return [];
  return refs
    .map((r, i) => normalizeLineReference(r, i))
    .filter(Boolean)
    .slice(0, 20);
}

/**
 * Собрать named formulas для runNamedFormulaBundle.
 * @param {object[]} refs — нормализованные
 * @returns {Record<string, string>}
 */
export function collectReferenceNamedFormulas(refs) {
  /** @type {Record<string, string>} */
  const named = {};
  for (const r of refs || []) {
    if (!r?.id) continue;
    const id = String(r.id);
    if (r.valueFormula) named[`ref_${id}_value`] = r.valueFormula;
    if (r.yMinFormula) named[`ref_${id}_yMin`] = r.yMinFormula;
    if (r.yMaxFormula) named[`ref_${id}_yMax`] = r.yMaxFormula;
  }
  return named;
}

/**
 * Применить результат bundle к references (без мутации формул).
 * @param {object[]} refs
 * @param {Record<string, { numeric?: number|null, error?: string }>} byId
 * @returns {object[]}
 */
export function applyResolvedReferenceFormulas(refs, byId = {}) {
  return (refs || []).map((r) => {
    const id = String(r.id);
    const next = { ...r };
    if (r.valueFormula) {
      const hit = byId[`ref_${id}_value`];
      if (hit?.numeric != null && Number.isFinite(hit.numeric)) next.value = hit.numeric;
      if (hit?.error) next._valueError = hit.error;
    }
    if (r.yMinFormula) {
      const hit = byId[`ref_${id}_yMin`];
      if (hit?.numeric != null && Number.isFinite(hit.numeric)) next.yMin = hit.numeric;
      if (hit?.error) next._yMinError = hit.error;
    }
    if (r.yMaxFormula) {
      const hit = byId[`ref_${id}_yMax`];
      if (hit?.numeric != null && Number.isFinite(hit.numeric)) next.yMax = hit.numeric;
      if (hit?.error) next._yMaxError = hit.error;
    }
    return next;
  });
}

/**
 * Построить reference из UI (число или формула в одном поле).
 * @param {{ type: string, valueRaw: string, yMaxRaw: string, label: string, color: string }} input
 */
export function buildReferenceFromUiInput(input) {
  const type = String(input.type || 'constant');
  const label = String(input.label || '').trim();
  const color = input.color || '#f59e0b';
  const valueRaw = String(input.valueRaw ?? '').trim();
  const yMaxRaw = String(input.yMaxRaw ?? '').trim();
  const id = `ref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const asValueNum = parsePlainNumberInput(valueRaw);
  const asYMaxNum = parsePlainNumberInput(yMaxRaw);

  if (type === 'average' || type === 'median') {
    return {
      ok: true,
      row: {
        id,
        type,
        label: label || (type === 'average' ? 'Average' : 'Median'),
        color,
        style: 'dashed',
        value: null,
        valueFormula: '',
        yMin: null,
        yMax: null,
        yMinFormula: '',
        yMaxFormula: '',
      },
    };
  }

  if (type === 'band') {
    if (!valueRaw && !yMaxRaw) {
      return { ok: false, error: 'Укажите yMin и/или yMax (число или формула)' };
    }
    let yMin = asValueNum;
    let yMax = asYMaxNum;
    let yMinFormula = asValueNum == null && valueRaw ? valueRaw : '';
    let yMaxFormula = asYMaxNum == null && yMaxRaw ? yMaxRaw : '';

    if (yMinFormula) {
      const v = validateScalarAggregateFormula(yMinFormula);
      if (!v.ok) return { ok: false, error: v.error };
    }
    if (yMaxFormula) {
      const v = validateScalarAggregateFormula(yMaxFormula);
      if (!v.ok) return { ok: false, error: v.error };
    }

    // Один bound без второй стороны → constant
    const onlyMin = (yMin != null || yMinFormula) && yMax == null && !yMaxFormula;
    const onlyMax = (yMax != null || yMaxFormula) && yMin == null && !yMinFormula;
    if (onlyMin || onlyMax) {
      const num = onlyMin ? yMin : yMax;
      const formula = onlyMin ? yMinFormula : yMaxFormula;
      return {
        ok: true,
        row: {
          id,
          type: 'constant',
          label: label || formula || String(num),
          color,
          style: 'dashed',
          value: formula ? null : num,
          valueFormula: formula || '',
          yMin: null,
          yMax: null,
          yMinFormula: '',
          yMaxFormula: '',
        },
      };
    }

    return {
      ok: true,
      row: {
        id,
        type: 'band',
        label: label || 'Band',
        color,
        style: 'dashed',
        value: null,
        valueFormula: '',
        yMin: yMinFormula ? null : yMin,
        yMax: yMaxFormula ? null : yMax,
        yMinFormula,
        yMaxFormula,
      },
    };
  }

  // constant | target
  if (!valueRaw) return { ok: false, error: 'Укажите значение (число или формулу)' };
  if (asValueNum != null) {
    return {
      ok: true,
      row: {
        id,
        type,
        label: label || (type === 'target' ? `Target ${asValueNum}` : String(asValueNum)),
        color,
        style: 'dashed',
        value: asValueNum,
        valueFormula: '',
        yMin: null,
        yMax: null,
        yMinFormula: '',
        yMaxFormula: '',
      },
    };
  }
  const v = validateScalarAggregateFormula(valueRaw);
  if (!v.ok) return { ok: false, error: v.error };
  return {
    ok: true,
    row: {
      id,
      type,
      label: label || (type === 'target' ? 'Target' : valueRaw),
      color,
      style: 'dashed',
      value: null,
      valueFormula: valueRaw,
      yMin: null,
      yMax: null,
      yMinFormula: '',
      yMaxFormula: '',
    },
  };
}
