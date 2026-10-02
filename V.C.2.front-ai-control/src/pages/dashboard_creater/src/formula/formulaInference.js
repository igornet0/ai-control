import { getDashboardSchema } from '../../../../services/dashboardSqliteSchemaService.js';
import { compileFormula, formulaGroupBy } from './compile.js';
import { parseTemplate, uniquePlaceholderFormulas } from './template.js';

/**
 * Таблица из квалифицированной колонки агрегата (`sales.amount` → `sales`). Для `*` и неквалифицированных — null.
 * @param {string|null|undefined} column
 * @returns {string|null}
 */
export function tableNameFromAggColumn(column) {
  if (column == null || column === '*' || String(column).trim() === '') return null;
  const c = String(column).trim();
  const dot = c.indexOf('.');
  if (dot <= 0) return null;
  const tbl = c.slice(0, dot).trim();
  return tbl || null;
}

/**
 * Уникальные имена таблиц из формулы (порядок — как в агрегатах).
 * @param {string} formula
 * @returns {string[]}
 */
export function collectReferencedTableNames(formula) {
  const { ast, aggs } = compileFormula(String(formula ?? '').trim());
  const out = [];
  const seen = new Set();
  const push = (tn) => {
    const name = String(tn || '').trim();
    if (!name) return;
    const k = name.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(name);
  };
  for (const a of aggs) {
    push(tableNameFromAggColumn(a.column));
  }
  const gb = formulaGroupBy(ast);
  if (gb) {
    for (const f of gb) push(f.table);
  }
  return out;
}

/**
 * @param {string} formula
 * @returns {boolean}
 */
export function formulaHasQualifiedTableRefs(formula) {
  try {
    return collectReferencedTableNames(String(formula ?? '').trim()).length > 0;
  } catch {
    return false;
  }
}

/**
 * Подбор modelId и основной таблицы для запроса по ссылкам в формуле и схеме дашборда.
 * Если одно имя таблицы есть в нескольких моделях — без preferredModelId не угадываем первую.
 * @param {string} formula
 * @param {Array<{ modelId: number|string, tableName: string, label?: string }>} schemaTables
 * @param {number|string|null} [preferredModelId]
 * @returns {{ modelId: number|string, table: string } | null}
 */
export function resolveModelTableFromFormula(formula, schemaTables, preferredModelId = null) {
  const names = collectReferencedTableNames(formula);
  if (!names.length || !Array.isArray(schemaTables) || !schemaTables.length) return null;
  const rows = [];
  for (const name of names) {
    const matches = schemaTables.filter(
      (t) => String(t.tableName).toLowerCase() === name.toLowerCase(),
    );
    if (!matches.length) return null;
    let row = matches[0];
    if (matches.length > 1) {
      if (preferredModelId != null && preferredModelId !== '') {
        const pref = matches.find((t) => String(t.modelId) === String(preferredModelId));
        if (!pref) return null;
        row = pref;
      } else {
        const uniqueModels = new Set(matches.map((t) => String(t.modelId)));
        if (uniqueModels.size > 1) return null;
      }
    }
    rows.push({ modelId: row.modelId, table: row.tableName });
  }
  const modelId = rows[0].modelId;
  for (const r of rows) {
    if (String(r.modelId) !== String(modelId)) return null;
  }
  return { modelId, table: rows[0].table };
}

/**
 * Явная привязка виджета к модели/таблице.
 * @param {{ modelId?: number|string|null, table?: string|null }} dataSource
 * @returns {{ modelId: number|string, table: string } | null}
 */
export function resolveExplicitDataSource(dataSource) {
  const ds = dataSource || {};
  if (ds.modelId != null && ds.table) {
    return { modelId: ds.modelId, table: ds.table };
  }
  return null;
}

/**
 * Контекст для предпросмотра формулы: привязка виджета → квалифицированные ссылки → выбранная таблица в модалке.
 * @param {{ modelId?: number|string|null, table?: string|null }} dataSource
 * @param {string} formula
 * @param {Array<{ modelId: number|string, tableName: string }>} schemaTables — `state.tables` после loadSchema
 * @param {string} [selectedTableName] — значение `#fe-table-select`
 */
export function resolvePreviewExecutionContext(dataSource, formula, schemaTables, selectedTableName) {
  const explicit = resolveExplicitDataSource(dataSource);
  if (explicit) return explicit;
  const fromFormula = resolveModelTableFromFormula(
    String(formula ?? '').trim(),
    schemaTables || [],
    dataSource?.modelId,
  );
  if (fromFormula) return fromFormula;
  const sel = String(selectedTableName || '').trim();
  if (sel && Array.isArray(schemaTables)) {
    const preferred = dataSource?.modelId;
    const row = schemaTables.find((t) => {
      if (String(t.tableName) !== sel) return false;
      if (preferred == null || preferred === '') return true;
      return String(t.modelId) === String(preferred);
    }) || schemaTables.find((t) => String(t.tableName) === sel);
    if (row) return { modelId: row.modelId, table: row.tableName };
  }
  return null;
}

/**
 * Загрузка схемы дашборда и разрешение контекста для KPI / предпросмотра формулы.
 * Квалифицированные поля в формуле (COUNT([employees.id])) важнее table из dataSource —
 * иначе COUNT сотрудников якорится на documents и после фильтра считает документы.
 * @param {object|null} engine
 * @param {{ modelId?: number|string|null, table?: string|null }} dataSource
 * @param {string} formula
 * @returns {Promise<{ modelId: number|string, table: string } | null>}
 */
export async function resolveKpiDataSourceFromFormula(engine, dataSource, formula) {
  const dashId = engine?.dashboardId;
  const formulaText = String(formula ?? '').trim();
  if (dashId && formulaHasQualifiedTableRefs(formulaText)) {
    const { tables } = await getDashboardSchema(dashId);
    const fromFormula = resolveModelTableFromFormula(
      formulaText,
      tables || [],
      dataSource?.modelId,
    );
    if (fromFormula) return fromFormula;
  }
  const explicit = resolveExplicitDataSource(dataSource || {});
  if (explicit) return explicit;
  if (!dashId) return null;
  const { tables } = await getDashboardSchema(dashId);
  return resolveModelTableFromFormula(
    formulaText,
    tables || [],
    dataSource?.modelId,
  );
}

/**
 * Все плейсхолдеры `{формула}` должны ссылаться на таблицы одной модели.
 * @param {string[]} formulas
 * @param {Array<{ modelId: number|string, tableName: string }>} schemaTables
 * @returns {{ modelId: number|string, table: string } | null}
 */
export function resolveModelTableFromFormulasBundle(formulas, schemaTables, preferredModelId = null) {
  if (!formulas.length || !Array.isArray(schemaTables) || !schemaTables.length) return null;
  /** @type {{ modelId: number|string, table: string } | null} */
  let first = null;
  for (const f of formulas) {
    const ctx = resolveModelTableFromFormula(f, schemaTables, preferredModelId);
    if (!ctx) return null;
    if (!first) first = ctx;
    else if (String(first.modelId) !== String(ctx.modelId)) return null;
  }
  return first;
}

/**
 * Контекст SQLite для текстового виджета: явная привязка или вывод из всех формул в `{…}` шаблона.
 * @param {object|null} engine
 * @param {{ modelId?: number|string|null, table?: string|null }} dataSource
 * @param {string} template
 * @returns {Promise<{ modelId: number|string, table: string } | null>}
 */
export async function resolveTextTemplateDataSource(engine, dataSource, template) {
  const explicit = resolveExplicitDataSource(dataSource || {});
  if (explicit) return explicit;
  let parts;
  try {
    parts = parseTemplate(String(template ?? ''));
  } catch {
    return null;
  }
  const fms = uniquePlaceholderFormulas(parts);
  if (!fms.length) return null;
  const dashId = engine?.dashboardId;
  if (!dashId) return null;
  const { tables } = await getDashboardSchema(dashId);
  return resolveModelTableFromFormulasBundle(fms, tables || [], dataSource?.modelId);
}
