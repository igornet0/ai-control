/**
 * DataCode generation for transform processing-block widgets.
 *
 * Aligns with DataCode docs (tables.md / examples/.../01-transformation):
 *   .map("Col", trim|upper|lower|capitalize|fn)
 *   .rename / .select / .drop_column / .add_column
 *   .split_column / .join_columns / .distinct / .row_number
 *   .drop_nulls / .replace_nulls / .value_map
 */

import { sanitizeIdentifier } from './schema.js';

function escapeString(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function quoteString(value) {
  return `"${escapeString(value)}"`;
}

function quoteField(name) {
  return quoteString(name);
}

function formatLiteral(raw) {
  if (raw === '' || raw == null) return '""';
  if (typeof raw === 'string' && raw.length > 0 && raw.trim() === '') {
    return quoteString(raw);
  }
  const trimmed = String(raw).trim();
  if (trimmed === 'true' || trimmed === 'false') return trimmed;
  const num = Number(trimmed);
  if (!Number.isNaN(num) && String(num) === trimmed) return String(num);
  return quoteString(trimmed);
}

function formatColumnList(columns = []) {
  const cols = (columns || []).filter(Boolean);
  if (!cols.length) return '[]';
  return `[${cols.map((c) => quoteField(c)).join(', ')}]`;
}

function formatTypeMapFn(targetType) {
  const map = {
    string: 'string',
    int: 'int',
    float: 'float',
    bool: 'bool',
  };
  return map[targetType] || null;
}

function formatMappings(mappings = []) {
  const pairs = (mappings || []).filter((m) => m?.from != null && m.from !== '');
  if (!pairs.length) return '{}';
  const parts = pairs.map((m) => `${quoteField(m.from)}: ${formatLiteral(m.to)}`);
  return `{${parts.join(', ')}}`;
}

/**
 * Expand one UI operation into one or more method suffixes (e.g. `.map("Name", trim)`).
 * @returns {string[]}
 */
export function buildTransformMethodLines(operation = {}) {
  if (!operation.enabled) return [];
  const p = operation.params || {};

  switch (operation.type) {
    case 'renameColumn':
      if (!p.column || !p.newName) return [];
      return [`.rename(${quoteField(p.column)}, ${quoteField(p.newName)})`];
    case 'selectColumns':
      if (!p.columns?.length) return [];
      return [`.select(${formatColumnList(p.columns)})`];
    case 'dropColumn':
      if (!p.column) return [];
      return [`.drop_column(${quoteField(p.column)})`];
    case 'reorderColumns':
      // No dedicated reorder in DataCode tables.md — approximate via select.
      if (!p.columns?.length) return [];
      return [`.select(${formatColumnList(p.columns)})`];
    case 'addColumn':
      if (!p.name) return [];
      return [`.add_column(${quoteField(p.name)}, ${formatLiteral(p.value)})`];
    case 'changeType': {
      if (!p.column || !p.targetType) return [];
      const castFn = formatTypeMapFn(p.targetType);
      if (!castFn) return [];
      return [`.map(${quoteField(p.column)}, ${castFn})`];
    }
    case 'trim':
    case 'upper':
    case 'lower':
    case 'capitalize': {
      const cols = (p.columns || []).filter(Boolean);
      if (!cols.length) return [];
      return cols.map((col) => `.map(${quoteField(col)}, ${operation.type})`);
    }
    case 'replace': {
      if (!p.column) return [];
      const find = formatLiteral(p.find);
      const repl = formatLiteral(p.replaceWith);
      return [
        `.map(${quoteField(p.column)}, fn(s) => replace(s, ${find}, ${repl}))`,
      ];
    }
    case 'splitColumn':
      if (!p.column || !p.targetColumns?.length) return [];
      return [
        `.split_column(${quoteField(p.column)}, ${formatLiteral(p.delimiter || ' ')}, ${formatColumnList(p.targetColumns)})`,
      ];
    case 'joinColumns':
      if (!p.columns?.length || !p.targetColumn) return [];
      return [
        `.join_columns(${formatColumnList(p.columns)}, ${quoteField(p.targetColumn)}, ${formatLiteral(p.separator ?? ' ')})`,
      ];
    case 'round':
    case 'ceil':
    case 'floor':
    case 'abs': {
      // Not in tables.md as table methods — apply via map with native scalar fn.
      if (!p.column) return [];
      if (operation.type === 'round') {
        const decimals = Number(p.decimals ?? 0);
        return [`.map(${quoteField(p.column)}, fn(v) => round(v, ${Number.isFinite(decimals) ? decimals : 0}))`];
      }
      return [`.map(${quoteField(p.column)}, ${operation.type})`];
    }
    case 'extractDatePart':
      if (!p.column || !p.part) return [];
      // Best-effort: keep as map helper if engine exposes date_part scalar.
      return [
        `.map(${quoteField(p.column)}, fn(v) => date_part(v, ${quoteString(p.part)}))`,
      ];
    case 'fillEmpty':
      if (!p.column) return [];
      return [`.replace_nulls(${quoteField(p.column)}, ${formatLiteral(p.value)})`];
    case 'dropEmptyRows':
      if (!p.column) return [];
      return [`.drop_nulls(${quoteField(p.column)})`];
    case 'distinct':
      return [`.distinct(${formatColumnList(p.columns || [])})`];
    case 'sort': {
      // Docs: table_sort(table, column, ascending) — method form not documented;
      // emit sequential single-column sorts when possible via chain break is hard,
      // so use first sort key only as `.` is not available — keep as comment skip.
      const sorts = (p.sorts || []).filter((s) => s?.column);
      if (!sorts.length) return [];
      // Prefer documented global call is not chainable; approximate unsupported.
      // Use first key only with a method-shaped helper if present in runtime.
      const s0 = sorts[0];
      const asc = s0.ascending !== false;
      return [`  /* sort: use table_sort(table, ${quoteField(s0.column)}, ${asc}) */`];
    }
    case 'rowNumber':
      return [`.row_number(${quoteField(p.targetColumn || 'RowNumber')}, ${formatLiteral(p.startFrom ?? 1)})`];
    case 'valueMap':
      if (!p.column || !p.mappings?.length) return [];
      return [`.value_map(${quoteField(p.column)}, ${formatMappings(p.mappings)})`];
    default:
      return [];
  }
}

/** @deprecated use buildTransformMethodLines — kept for single-line callers/tests */
export function buildTransformMethodLine(operation = {}) {
  const lines = buildTransformMethodLines(operation).filter((l) => !l.trim().startsWith('/*'));
  return lines[0] || null;
}

export function buildTransformChainExpression(settings = {}) {
  return (settings.transformOperations || [])
    .flatMap(buildTransformMethodLines)
    .filter((line) => line && !String(line).trim().startsWith('/*'));
}

export function buildDefaultSeparateTransformVariableName(inputVariable = 'data', widgetId = null) {
  const base = sanitizeIdentifier(inputVariable, 'data');
  if (widgetId == null || widgetId === '') {
    return sanitizeIdentifier(`${base}_transformed`, 'transformed_data');
  }
  return sanitizeIdentifier(`${base}_transform_${widgetId}`, `${base}_transformed`);
}

export function isTransformSeparateOutput(settings = {}) {
  if (settings.transformSeparateOutput === true) return true;
  if (settings.transformSeparateOutput === false) return false;
  return !!settings.dataCodeVariableName?.trim();
}

export function resolveTransformOutputVariableName(settings = {}, inputVariable = 'data', context = {}) {
  const inputVar = sanitizeIdentifier(inputVariable, 'data');
  if (!isTransformSeparateOutput(settings)) {
    return inputVar;
  }
  const custom = settings.dataCodeVariableName?.trim();
  if (custom) {
    return sanitizeIdentifier(
      custom,
      buildDefaultSeparateTransformVariableName(inputVar, context.widgetId),
    );
  }
  return buildDefaultSeparateTransformVariableName(inputVar, context.widgetId);
}

export function generateTransformDataCode(transformSettings = {}, context = {}) {
  const inputVar = sanitizeIdentifier(context.inputVariable || 'data', 'data');
  const outputVar = resolveTransformOutputVariableName(transformSettings, inputVar, context);
  const globalPrefix = transformSettings.exportGlobal && isTransformSeparateOutput(transformSettings)
    ? 'global '
    : '';
  const chain = buildTransformChainExpression(transformSettings);
  const transformName = transformSettings.name || 'Трансформация';

  const lines = [
    `# Transform: ${transformName}`,
    `# Input table: ${inputVar}`,
  ];

  if (!chain.length) {
    lines.push('# No transform operations — pass-through');
    lines.push(`${globalPrefix}${outputVar} = ${inputVar}`);
  } else if (chain.length === 1) {
    lines.push(`${globalPrefix}${outputVar} = ${inputVar}${chain[0]}`);
  } else {
    lines.push(`${globalPrefix}${outputVar} = ${inputVar}${chain[0]}`);
    for (let i = 1; i < chain.length; i += 1) {
      lines.push(`${globalPrefix}${outputVar} = ${outputVar}${chain[i]}`);
    }
  }

  lines.push(`print("${outputVar}: ", table_info(${outputVar}))`);
  return lines.join('\n');
}

const TRANSFORM_BLOCK_RE = /# Transform:[^\n]*\r?\n[\s\S]*?print\s*\([^)]*table_info\s*\([\p{L}_][\p{L}\p{N}_]*\)\s*\)/gmu;

export function stripTransformBlocks(code) {
  if (!code?.trim()) return '';
  return String(code)
    .replace(TRANSFORM_BLOCK_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function patchTransformDataCodeInCode(code, transformSettings, context = {}) {
  const generated = generateTransformDataCode(transformSettings, context);
  const outputVariable = resolveTransformOutputVariableName(
    transformSettings,
    context.inputVariable,
    context,
  );
  const cleaned = stripTransformBlocks(code);
  if (!cleaned) {
    return { code: generated, outputVariable };
  }
  return {
    code: `${cleaned}\n\n${generated}`.trim(),
    outputVariable,
  };
}
