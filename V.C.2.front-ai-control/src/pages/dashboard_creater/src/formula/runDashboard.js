import { getDashboardDataModelClient } from '../../../../services/dashboardDataModel/DashboardDataModelClient.js';
import {
  collectDashboardFilters,
  filtersForModel,
} from '../../../../services/dashboardFilterUtils.js';
import { appendDateRangeFilters, stripDateFieldRangeFilters } from '../widgets/kpi/kpiCompute.js';
import { parseTemplate, uniquePlaceholderFormulas } from './template.js';
import { fetchMergedAggregateRow, fetchMergedAggregateRows } from './formulaAggregateFetch.js';
import { compileFormulaBundle, getCompiledFormula } from './cache.js';
import { evaluateAst, formatEvalResultForDisplay } from './evaluate.js';
import { formatFormulaError } from './errors.js';
import { formulaGroupBy, unwrapGroupedAst } from './compile.js';
import { makeFormulaVarContext } from './formulaVarContext.js';

/**
 * Выполняет одну формулу (агрегаты + арифметика) на текущих фильтрах дашборда.
 * @param {object} engine
 * @param {number|string} modelId
 * @param {string} base_table
 * @param {string} formula
 * @param {{ dateField: string, range: { start: string, end: string } } | null | undefined} [kpiWindow] — как у KPI: глобальные фильтры + окно по колонке даты (текущий период)
 * @returns {Promise<{
 *   value: string,
 *   numeric: number|null,
 *   error: string,
 *   grouped?: { keys: Record<string, unknown>, numeric: number|null, value: string }[],
 *   groupBy?: { table: string, column: string }[],
 * }>}
 */
export async function runSingleFormulaOnDashboard(engine, modelId, base_table, formula, kpiWindow) {
  try {
    const src = String(formula ?? '').trim();
    const bundle = compileFormulaBundle([src]);
    const client = getDashboardDataModelClient(engine);
    let filters = filtersForModel(collectDashboardFilters(engine), modelId);
    const df = String(kpiWindow?.dateField || '').trim();
    const wr = kpiWindow?.range;
    if (df && wr && String(wr.start || '').trim() && String(wr.end || '').trim()) {
      filters = appendDateRangeFilters(
        stripDateFieldRangeFilters(filters, base_table, df),
        base_table,
        df,
        wr.start,
        wr.end,
      );
    }
    const groupBy = formulaGroupBy(bundle.asts[0]);
    if (groupBy?.length) {
      const { rows, groupByColumns } = await fetchMergedAggregateRows(client, {
        modelId,
        base_table,
        mergedAggs: bundle.mergedAggs,
        keyToAlias: bundle.keyToAlias,
        filters,
        groupBy,
        limit: 500,
      });
      const inner = unwrapGroupedAst(bundle.asts[0]);
      const grouped = (rows || []).map((row) => {
        let n = NaN;
        try {
          n = evaluateAst(inner, row, undefined, makeFormulaVarContext(engine));
        } catch {
          n = NaN;
        }
        /** @type {Record<string, unknown>} */
        const keys = {};
        for (const c of groupByColumns) keys[c] = row[c];
        const numeric = Number.isFinite(n) ? n : null;
        return {
          keys,
          numeric,
          value: numeric != null ? formatEvalResultForDisplay(n, src) : '—',
        };
      });
      return {
        value: formatGroupedPreview(grouped, groupByColumns),
        numeric: null,
        grouped,
        groupBy,
        error: '',
      };
    }
    const row = await fetchMergedAggregateRow(client, {
      modelId,
      base_table,
      mergedAggs: bundle.mergedAggs,
      keyToAlias: bundle.keyToAlias,
      filters,
    });
    const n = evaluateAst(bundle.asts[0], row, undefined, makeFormulaVarContext(engine));
    if (!Number.isFinite(n)) {
      return { value: '—', numeric: null, error: '' };
    }
    return { value: formatEvalResultForDisplay(n, src), numeric: n, error: '' };
  } catch (e) {
    return { value: '', numeric: null, error: formatFormulaError(e) };
  }
}

/**
 * @param {{ keys: Record<string, unknown>, value: string }[]} grouped
 * @param {string[]} groupByColumns
 */
export function formatGroupedPreview(grouped, groupByColumns) {
  const cols = Array.isArray(groupByColumns) ? groupByColumns : [];
  const rows = Array.isArray(grouped) ? grouped : [];
  if (!rows.length) return 'Нет групп';
  const header = [...cols, 'value'].join(' | ');
  const body = rows
    .slice(0, 50)
    .map((r) => {
      const cells = cols.map((c) => String(r.keys?.[c] ?? ''));
      cells.push(String(r.value ?? '—'));
      return cells.join(' | ');
    })
    .join('\n');
  const more = rows.length > 50 ? `\n… ещё ${rows.length - 50}` : '';
  return `${header}\n${body}${more}`;
}

/**
 * Подставляет плейсхолдеры `{формула}` в шаблоне по текущим фильтрам.
 * @param {object} engine
 * @param {number|string} modelId
 * @param {string} base_table
 * @param {string} template
 * @param {{ timestampDisplay?: 'local' | 'utc' }} [options]
 * @returns {Promise<{ text: string, error: string }>}
 */
export async function materializeTextTemplate(engine, modelId, base_table, template, options = {}) {
  try {
    const parts = parseTemplate(String(template ?? ''));
    const formulas = uniquePlaceholderFormulas(parts);
    if (formulas.length === 0) {
      const textOnly = parts
        .filter((p) => p.type === 'lit')
        .map((p) => p.text)
        .join('');
      return { text: textOnly, error: '' };
    }

    const scalarFormulas = formulas.filter((f) => {
      try {
        return !formulaGroupBy(getCompiledFormula(f).ast)?.length;
      } catch {
        return true;
      }
    });
    const bundle = scalarFormulas.length ? compileFormulaBundle(scalarFormulas) : null;
    const client = getDashboardDataModelClient(engine);
    const filters = filtersForModel(collectDashboardFilters(engine), modelId);
    const row =
      bundle && bundle.mergedAggs.length
        ? await fetchMergedAggregateRow(client, {
            modelId,
            base_table,
            mergedAggs: bundle.mergedAggs,
            keyToAlias: bundle.keyToAlias,
            filters,
          })
        : {};
    const map = new Map();
    if (bundle) {
      scalarFormulas.forEach((f, i) => {
        map.set(f, bundle.asts[i]);
      });
    }

    const formatOpts = {
      timestampDisplay: options.timestampDisplay === 'utc' ? 'utc' : 'local',
    };

    let out = '';
    for (const p of parts) {
      if (p.type === 'lit') {
        out += p.text;
        continue;
      }
      const ast = map.get(p.formula);
      if (!ast) {
        out += '⟪FOR: группы, не число⟫';
        continue;
      }
      try {
        const n = evaluateAst(ast, row, undefined, makeFormulaVarContext(engine));
        out += Number.isFinite(n) ? formatEvalResultForDisplay(n, p.formula, formatOpts) : '—';
      } catch (err) {
        out += '⟪ошибка⟫';
        void err;
      }
    }
    return { text: out, error: '' };
  } catch (e) {
    return { text: '', error: formatFormulaError(e) };
  }
}
