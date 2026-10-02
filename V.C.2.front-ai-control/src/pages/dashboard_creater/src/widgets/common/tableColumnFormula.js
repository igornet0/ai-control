import { resolveKpiDataSourceFromFormula } from '../../formula/formulaInference.js';
import { runSingleFormulaOnDashboard } from '../../formula/runDashboard.js';
import {
  compileFormula,
  formulaGroupBy,
  groupBySignature,
  unwrapGroupedAst,
} from '../../formula/compile.js';
import { compileFormulaBundle } from '../../formula/cache.js';
import { fetchMergedAggregateRows } from '../../formula/formulaAggregateFetch.js';
import { evaluateAst } from '../../formula/evaluate.js';
import { formatFormulaError } from '../../formula/errors.js';
import { makeFormulaVarContext } from '../../formula/formulaVarContext.js';

const SIMPLE_FIELD_REF_RE = /^\s*\[([^\].]+)\.([^\].]+)\]\s*$/;
const UNFILTERED_FIELD_REF_RE = /^\s*\$\[([^\].]+)\.([^\].]+)\]\s*$/;

/**
 * @param {{ table?: string, field?: string }} binding
 */
export function defaultTableColumnFormula(binding) {
  const table = String(binding?.table ?? '').trim();
  const field = String(binding?.field ?? '').trim();
  if (!table || !field) return '';
  return `[${table}.${field}]`;
}

/**
 * @param {string} formula
 * @returns {{ table: string, field: string, ignoreFilters?: boolean } | null}
 */
export function parseSimpleTableFieldRef(formula) {
  const s = String(formula ?? '').trim();
  let m = s.match(UNFILTERED_FIELD_REF_RE);
  if (m) {
    return { table: m[1].trim(), field: m[2].trim(), ignoreFilters: true };
  }
  m = s.match(SIMPLE_FIELD_REF_RE);
  if (!m) return null;
  return { table: m[1].trim(), field: m[2].trim() };
}

/**
 * @param {Array<{ formula?: string }>} bindingFields
 */
export function collectUnfilteredTableColumnRefs(bindingFields) {
  /** @type {{ table: string, column: string }[]} */
  const refs = [];
  const seen = new Set();
  if (!Array.isArray(bindingFields)) return refs;
  for (const b of bindingFields) {
    const simpleRef = parseSimpleTableFieldRef(String(b?.formula ?? '').trim());
    if (!simpleRef?.ignoreFilters) continue;
    const key = `${simpleRef.table}.${simpleRef.field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ table: simpleRef.table, column: simpleRef.field });
  }
  return refs;
}

/**
 * @param {string} formula
 * @param {{ table?: string, field?: string }} binding
 */
export function isDefaultTableColumnFormula(formula, binding) {
  const f = String(formula ?? '').trim();
  if (!f) return true;
  const def = defaultTableColumnFormula(binding);
  if (f === def) return true;
  const fieldOnly = `[${String(binding?.field ?? '').trim()}]`;
  return f === fieldOnly;
}

/**
 * @param {Array<{ table?: string, field?: string, formula?: string }>} bindingFields
 */
export function normalizeTableBindingFieldFormulas(bindingFields) {
  if (!Array.isArray(bindingFields)) return [];
  return bindingFields.map((b) => {
    if (!b || typeof b !== 'object') return b;
    const formulaRaw = typeof b.formula === 'string' ? b.formula.trim() : '';
    const formula = formulaRaw || defaultTableColumnFormula(b);
    return { ...b, formula };
  });
}

/**
 * План запроса таблицы: SELECT строк или AGGREGATE + GROUP BY из FOR.
 * @param {Array<{ table?: string, field?: string, formula?: string }>} bindingFields
 * @param {{ table?: string }|null|undefined} ds
 * @returns {{
 *   mode: 'select'|'aggregate',
 *   error?: string,
 *   groupBy?: { table: string, column: string }[],
 *   extraDims?: { table: string, column: string, key: string }[],
 *   kinds?: object[],
 * }}
 */
export function resolveTableQueryPlan(bindingFields, ds) {
  const bf = Array.isArray(bindingFields) ? bindingFields : [];
  const baseTable = String(ds?.table || '').trim();
  /** @type {{ table: string, column: string }[]|null} */
  let groupBy = null;
  let hasFor = false;
  const kinds = [];

  for (const b of bf) {
    const formula = String(b?.formula ?? '').trim() || defaultTableColumnFormula(b);
    const simple = parseSimpleTableFieldRef(formula);
    if (simple) {
      kinds.push({ kind: 'field', simple, formula, binding: b });
      continue;
    }
    try {
      const compiled = compileFormula(formula);
      const gb = formulaGroupBy(compiled.ast);
      if (gb?.length) {
        hasFor = true;
        if (!groupBy) groupBy = gb;
        else if (groupBySignature(groupBy) !== groupBySignature(gb)) {
          return {
            mode: 'aggregate',
            error: 'В колонках разные поля FOR — группировка должна совпадать во всех мерах',
          };
        }
        kinds.push({ kind: 'measure', formula, binding: b });
      } else {
        kinds.push({ kind: 'scalar', formula, binding: b });
      }
    } catch (e) {
      kinds.push({ kind: 'error', error: formatFormulaError(e), formula, binding: b });
    }
  }

  if (!hasFor) {
    const firstErr = kinds.find((k) => k.kind === 'error');
    if (firstErr) return { mode: 'select', error: firstErr.error };
    return { mode: 'select' };
  }

  if (kinds.some((k) => k.kind === 'scalar')) {
    return {
      mode: 'aggregate',
      error:
        'Смешаны формулы с FOR и агрегаты без группировки. У всех мер должен быть один и тот же FOR.',
    };
  }
  const errCol = kinds.find((k) => k.kind === 'error');
  if (errCol) return { mode: 'aggregate', error: errCol.error };

  const gbSet = new Set((groupBy || []).map((g) => `${g.table}.${g.column}`.toLowerCase()));
  const gbFieldSet = new Set((groupBy || []).map((g) => g.column.toLowerCase()));

  for (const k of kinds) {
    if (k.kind !== 'field') continue;
    const t = String(k.simple.table || '').trim();
    const f = String(k.simple.field || '').trim();
    const q = `${t}.${f}`.toLowerCase();
    const onBase = !t || !baseTable || t.toLowerCase() === baseTable.toLowerCase();
    if (gbSet.has(q) || (onBase && gbFieldSet.has(f.toLowerCase()))) continue;
    return {
      mode: 'aggregate',
      error: `Поле [${t}.${f}] не входит в группировку FOR. Добавьте его в FOR или уберите колонку.`,
    };
  }

  for (const g of groupBy || []) {
    if (g.table && baseTable && g.table.toLowerCase() !== baseTable.toLowerCase()) {
      return {
        mode: 'aggregate',
        error: `FOR группирует по [${g.table}.${g.column}], а таблица виджета — «${baseTable}». Поле группировки должно быть на базовой таблице.`,
      };
    }
  }

  const present = new Set();
  for (const k of kinds) {
    if (k.kind !== 'field') continue;
    present.add(`${k.simple.table}.${k.simple.field}`.toLowerCase());
    present.add(String(k.simple.field || '').toLowerCase());
  }
  /** @type {{ table: string, column: string, key: string }[]} */
  const extraDims = [];
  const usedKeys = new Set(bf.map((_, i) => String(bf[i]?.field || `c${i}`).toLowerCase()));
  for (const g of groupBy || []) {
    const q = `${g.table}.${g.column}`.toLowerCase();
    if (present.has(q) || present.has(g.column.toLowerCase())) continue;
    let key = g.column;
    if (usedKeys.has(key.toLowerCase())) key = `${g.table}.${g.column}`;
    usedKeys.add(key.toLowerCase());
    extraDims.push({ table: g.table, column: g.column, key });
  }

  return { mode: 'aggregate', groupBy, extraDims, kinds };
}

/**
 * Строки таблицы из aggregate + GROUP BY (формулы с FOR).
 * @param {object} client
 * @param {{ modelId: number|string, table: string }} ds
 * @param {ReturnType<typeof resolveTableQueryPlan>} plan
 * @param {Array<Record<string, unknown>>} bindingFields
 * @param {string[]} columnKeys
 * @param {object[]} filters
 * @param {number} limit
 */
export async function fetchTableGroupedRows(
  client,
  ds,
  plan,
  bindingFields,
  columnKeys,
  filters,
  limit,
) {
  const measureFormulas = (plan.kinds || [])
    .filter((k) => k.kind === 'measure')
    .map((k) => k.formula);
  const unique = [];
  const seen = new Set();
  for (const f of measureFormulas) {
    if (seen.has(f)) continue;
    seen.add(f);
    unique.push(f);
  }
  const bundle = compileFormulaBundle(unique);
  const { rows } = await fetchMergedAggregateRows(client, {
    modelId: ds.modelId,
    base_table: ds.table,
    mergedAggs: bundle.mergedAggs,
    keyToAlias: bundle.keyToAlias,
    filters,
    groupBy: plan.groupBy,
    limit,
  });
  const formulaToAst = new Map();
  unique.forEach((f, i) => formulaToAst.set(f, unwrapGroupedAst(bundle.asts[i])));

  /** @type {Record<string, unknown>[]} */
  const outRows = [];
  for (const sqlRow of rows || []) {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const d of plan.extraDims || []) {
      out[d.key] = sqlRow[d.column] ?? '';
    }
    for (let i = 0; i < bindingFields.length; i += 1) {
      const colKey = columnKeys[i];
      const k = plan.kinds?.[i];
      if (!colKey || !k) continue;
      if (k.kind === 'field') {
        const short = k.simple.field;
        if (Object.prototype.hasOwnProperty.call(sqlRow, short)) {
          out[colKey] = sqlRow[short] ?? '';
        } else {
          out[colKey] = sqlRow[`${k.simple.table}.${k.simple.field}`] ?? '';
        }
      } else if (k.kind === 'measure') {
        const ast = formulaToAst.get(k.formula);
        try {
          const n = evaluateAst(
            ast,
            sqlRow,
            undefined,
            makeFormulaVarContext(client?.engine || (typeof window !== 'undefined' ? window.engine : null)),
          );
          out[colKey] = Number.isFinite(n) ? n : '—';
        } catch {
          out[colKey] = '—';
        }
      }
    }
    outRows.push(out);
  }
  return outRows;
}

/**
 * Колонки-ссылки на поля берутся из SQL SELECT; агрегатные формулы — один запрос на колонку с учётом фильтров.
 * @param {object|null} engine
 * @param {{ modelId?: number|string, table?: string }} ds
 * @param {Array<Record<string, unknown>>} rows
 * @param {Array<{ modelId?: number|string, table?: string, field?: string, formula?: string }>} bindingFields
 * @param {string[]} columnKeys
 * @param {Array<Record<string, unknown>>|null} [unfilteredRows]
 */
export async function applyTableColumnFormulas(engine, ds, rows, bindingFields, columnKeys, unfilteredRows = null) {
  if (!engine || !Array.isArray(rows) || !rows.length || !bindingFields?.length) return;

  for (let i = 0; i < bindingFields.length; i += 1) {
    const b = bindingFields[i];
    const colKey = columnKeys[i];
    if (!b || !colKey) continue;

    const formula = String(b.formula ?? '').trim() || defaultTableColumnFormula(b);
    if (isDefaultTableColumnFormula(formula, b)) continue;

    try {
      if (formulaGroupBy(compileFormula(formula).ast)?.length) continue;
    } catch {
      /* parse below / skip */
    }

    const simpleRef = parseSimpleTableFieldRef(formula);
    if (simpleRef) {
      const refKey =
        simpleRef.table === String(b.table ?? '') && simpleRef.field === String(b.field ?? '')
          ? colKey
          : `${simpleRef.table}.${simpleRef.field}`;
      const sourceRows = simpleRef.ignoreFilters && Array.isArray(unfilteredRows) ? unfilteredRows : rows;
      for (let ri = 0; ri < rows.length; ri += 1) {
        const srcRow = sourceRows[ri] || {};
        if (Object.prototype.hasOwnProperty.call(srcRow, refKey)) {
          rows[ri][colKey] = srcRow[refKey] ?? '';
        } else if (Object.prototype.hasOwnProperty.call(srcRow, simpleRef.field)) {
          rows[ri][colKey] = srcRow[simpleRef.field] ?? '';
        }
      }
      continue;
    }

    try {
      const resolved = await resolveKpiDataSourceFromFormula(engine, ds, formula);
      const mid = resolved?.modelId ?? ds?.modelId ?? b.modelId;
      const tbl = resolved?.table ?? ds?.table ?? b.table;
      if (mid == null || !tbl) continue;

      const result = await runSingleFormulaOnDashboard(engine, mid, tbl, formula, null);
      const display = result.error ? '—' : result.value != null && result.value !== '' ? result.value : '—';
      for (const row of rows) {
        row[colKey] = display;
      }
    } catch {
      for (const row of rows) {
        row[colKey] = '—';
      }
    }
  }
}
