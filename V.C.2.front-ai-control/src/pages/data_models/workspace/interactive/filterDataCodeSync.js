/**
 * DataCode generation for filter processing-block widgets.
 *
 * Example:
 *   data = data[("Age" > 25 or "City" == "Houston")]
 *   data = data["City" in ["Houston", "Chicago"]]
 *   data = data["City" not in ["Houston", "Chicago"]]
 *   data = data["City" & contains("Hou")]
 */

import { sanitizeIdentifier } from './schema.js';
import { resolveDataCodeVariableName } from './fileSourceDataCodeSync.js';
import {
  isTransformSeparateOutput,
  resolveTransformOutputVariableName,
} from './transformDataCodeSync.js';
import {
  isAggregateSeparateOutput,
  resolveAggregateOutputVariableName,
} from './aggregateDataCodeSync.js';
import { parseDbWidgetId } from '../widgetDbSync.js';
import { findLinkedTable } from './linkedModelDataCodeSync.js';
import {
  isJoinSeparateOutput,
  resolveJoinOutputVariableName,
} from './joinConfigSchema.js';

function contextForProcessingWidget(widget, options = {}) {
  const ownId = parseDbWidgetId(widget);
  return {
    ...options,
    widgetId: ownId ?? options.widgetId,
  };
}

function escapeString(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function quoteField(name) {
  return `"${escapeString(name)}"`;
}

function formatFilterValue(raw) {
  if (raw === '' || raw == null) return '""';
  const trimmed = String(raw).trim();
  if (trimmed === 'true' || trimmed === 'false') return trimmed;
  const num = Number(trimmed);
  if (!Number.isNaN(num) && String(num) === trimmed) {
    return String(num);
  }
  return `"${escapeString(trimmed)}"`;
}

const OPERATOR_TOKENS = {
  eq: '==',
  ne: '!=',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
};

export function buildSingleFilterCondition(cond) {
  if (!cond?.field?.trim()) return null;
  const field = cond.field.trim();
  const op = cond.operator || 'eq';

  if (op === 'between') {
    if (cond.value == null && cond.value2 == null) return null;
    const min = formatFilterValue(cond.value ?? '');
    const max = formatFilterValue(cond.value2 ?? '');
    return `(${quoteField(field)} > ${min} and ${quoteField(field)} < ${max})`;
  }

  if (op === 'in' || op === 'notIn') {
    const parts = String(cond.value || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return null;
    const list = `[${parts.map((p) => formatFilterValue(p)).join(', ')}]`;
    const keyword = op === 'notIn' ? 'not in' : 'in';
    return `${quoteField(field)} ${keyword} ${list}`;
  }

  if (op === 'contains') {
    if (cond.value == null || cond.value === '') return null;
    return `${quoteField(field)} & contains(${formatFilterValue(cond.value)})`;
  }

  if (op === 'startsWith') {
    if (cond.value == null || cond.value === '') return null;
    return `${quoteField(field)} & starts_with(${formatFilterValue(cond.value)})`;
  }

  if (op === 'endsWith') {
    if (cond.value == null || cond.value === '') return null;
    return `${quoteField(field)} & ends_with(${formatFilterValue(cond.value)})`;
  }

  const token = OPERATOR_TOKENS[op] || '==';
  if (cond.value == null || cond.value === '') return null;
  return `${quoteField(field)} ${token} ${formatFilterValue(cond.value)}`;
}

export function joinFilterExpressions(exprs, logic = 'and') {
  const valid = exprs.filter(Boolean);
  if (!valid.length) return null;
  if (valid.length === 1) return valid[0];
  const joiner = logic === 'or' ? ' or ' : ' and ';
  return `(${valid.join(joiner)})`;
}

export function buildFilterBracketExpression(settings = {}) {
  const parts = [];

  const flatConditions = settings.filterConditions || [];
  if (flatConditions.length) {
    const exprs = flatConditions.map(buildSingleFilterCondition).filter(Boolean);
    const part = joinFilterExpressions(exprs, settings.filterLogic || 'and');
    if (part) parts.push(part);
  }

  for (const grp of settings.filterGroups || []) {
    const exprs = (grp.conditions || []).map(buildSingleFilterCondition).filter(Boolean);
    const part = joinFilterExpressions(exprs, grp.logic || 'and');
    if (part) parts.push(part);
  }

  return joinFilterExpressions(parts, 'and');
}

export function buildDefaultSeparateFilterVariableName(inputVariable = 'data', widgetId = null) {
  const base = sanitizeIdentifier(inputVariable, 'data');
  if (widgetId == null || widgetId === '') {
    return sanitizeIdentifier(`${base}_filtered`, 'filtered_data');
  }
  return sanitizeIdentifier(`${base}_filter_${widgetId}`, `${base}_filtered`);
}

export function isFilterSeparateOutput(settings = {}) {
  if (settings.filterSeparateOutput === true) return true;
  if (settings.filterSeparateOutput === false) return false;
  return !!settings.dataCodeVariableName?.trim();
}

export function resolveFilterOutputVariableName(settings = {}, inputVariable = 'data', context = {}) {
  const inputVar = sanitizeIdentifier(inputVariable, 'data');
  if (!isFilterSeparateOutput(settings)) {
    return inputVar;
  }
  const custom = settings.dataCodeVariableName?.trim();
  if (custom) {
    return sanitizeIdentifier(
      custom,
      buildDefaultSeparateFilterVariableName(inputVar, context.widgetId),
    );
  }
  return buildDefaultSeparateFilterVariableName(inputVar, context.widgetId);
}

function resolveProcessingChainInput(sourceWidget, connectionSettings = {}, options = {}) {
  const { widgetManager } = options;
  if (widgetManager && sourceWidget?.id != null) {
    const widget = widgetManager.getWidget(sourceWidget.id) || sourceWidget;
    const incoming = (widget.connections || []).filter((c) => String(c.to) === String(widget.id));
    const first = incoming[0];
    if (first?.from) {
      const upstream = widgetManager.getWidget(first.from);
      return resolveUpstreamDataCodeVariable(upstream, first.settings || {}, options);
    }
  }
  if (connectionSettings?.inputVariable?.trim()) {
    return sanitizeIdentifier(connectionSettings.inputVariable, 'data');
  }
  return 'data';
}

export function resolveUpstreamDataCodeVariable(sourceWidget, connectionSettings = {}, options = {}) {
  if (connectionSettings?.dataCodeVariableName?.trim()) {
    return sanitizeIdentifier(connectionSettings.dataCodeVariableName, 'data');
  }

  const s = sourceWidget?.settings;
  if (sourceWidget?.type === 'data-model' || Array.isArray(s?.selectedTables)) {
    const match = findLinkedTable(
      s,
      connectionSettings.selectedTable || connectionSettings.inputVariable,
    );
    if (match?.alias) {
      return sanitizeIdentifier(match.alias, 'data');
    }
  }

  if (connectionSettings?.inputVariable?.trim()) {
    return sanitizeIdentifier(connectionSettings.inputVariable, 'data');
  }
  if (connectionSettings?.selectedTable?.trim()) {
    return sanitizeIdentifier(connectionSettings.selectedTable, 'data');
  }

  if (!s) return 'data';

  if (s.blockType === 'filter') {
    const chainInput = resolveProcessingChainInput(sourceWidget, connectionSettings, options);
    if (isFilterSeparateOutput(s)) {
      return resolveFilterOutputVariableName(
        s,
        chainInput,
        contextForProcessingWidget(sourceWidget, options),
      );
    }
    return chainInput;
  }

  if (s.blockType === 'transform') {
    const chainInput = resolveProcessingChainInput(sourceWidget, connectionSettings, options);
    if (isTransformSeparateOutput(s)) {
      return resolveTransformOutputVariableName(
        s,
        chainInput,
        contextForProcessingWidget(sourceWidget, options),
      );
    }
    return chainInput;
  }

  if (s.blockType === 'aggregate') {
    const chainInput = resolveProcessingChainInput(sourceWidget, connectionSettings, options);
    if (isAggregateSeparateOutput(s)) {
      return resolveAggregateOutputVariableName(
        s,
        chainInput,
        contextForProcessingWidget(sourceWidget, options),
      );
    }
    return chainInput;
  }

  if (s.blockType === 'join') {
    const chainInput = resolveProcessingChainInput(sourceWidget, connectionSettings, options);
    if (isJoinSeparateOutput(s)) {
      return resolveJoinOutputVariableName(
        s,
        chainInput,
        contextForProcessingWidget(sourceWidget, options),
      );
    }
    return chainInput;
  }

  if (s.sourceType === 'file' || s.selectedFile) {
    return resolveDataCodeVariableName(s);
  }

  if (s.sourceType === 'folder') {
    const groupName = s.folderConfig?.groups?.[0]?.tableName;
    if (groupName) return sanitizeIdentifier(groupName, 'data');
  }

  if (s.sourceType === 'interactive') {
    const tableName = s.interactiveConfig?.table?.name;
    if (tableName) return sanitizeIdentifier(tableName, 'data');
    const varName = s.interactiveConfig?.variable?.name;
    if (varName) return sanitizeIdentifier(varName, 'data');
  }

  return sanitizeIdentifier(s.name, 'data');
}

export function generateFilterDataCode(filterSettings = {}, context = {}) {
  const inputVar = sanitizeIdentifier(context.inputVariable || 'data', 'data');
  const outputVar = resolveFilterOutputVariableName(filterSettings, inputVar, context);
  const globalPrefix = filterSettings.exportGlobal && isFilterSeparateOutput(filterSettings)
    ? 'global '
    : '';
  const expr = buildFilterBracketExpression(filterSettings);
  const filterName = filterSettings.name || 'Фильтр';

  const lines = [
    `# Filter: ${filterName}`,
    `# Input table: ${inputVar}`,
  ];

  if (!expr) {
    lines.push(`# No filter conditions — pass-through`);
    lines.push(`${globalPrefix}${outputVar} = ${inputVar}`);
  } else {
    lines.push(`${globalPrefix}${outputVar} = ${inputVar}[${expr}]`);
  }

  lines.push(`print("${outputVar}: ", table_info(${outputVar}))`);
  return lines.join('\n');
}

const FILTER_BLOCK_RE = /# Filter:[^\n]*\r?\n[\s\S]*?print\s*\([^)]*table_info\s*\([\p{L}_][\p{L}\p{N}_]*\)\s*\)/gmu;

/** Удаляет все автогенерированные блоки фильтра из кода. */
export function stripFilterBlocks(code) {
  if (!code?.trim()) return '';
  return String(code)
    .replace(FILTER_BLOCK_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const FILTER_ASSIGNMENT_RE = /(?:(global)\s+)?([\p{L}_][\p{L}\p{N}_]*)\s*=\s*([\p{L}_][\p{L}\p{N}_]*)(?:\s*\[|\s*$)/gmu;

export function findFilterAssignment(code, outputVariableHint = null) {
  if (!code?.trim()) return null;
  const matches = [];
  let m;
  const text = String(code);
  FILTER_ASSIGNMENT_RE.lastIndex = 0;
  while ((m = FILTER_ASSIGNMENT_RE.exec(text)) !== null) {
    matches.push({
      outputVariable: m[2],
      inputVariable: m[3],
      exportGlobal: m[1] === 'global',
      start: m.index,
    });
  }
  if (!matches.length) return null;
  if (outputVariableHint) {
    return matches.find((item) => item.outputVariable === outputVariableHint) || matches[0];
  }
  return matches[0];
}

export function patchFilterDataCodeInCode(code, filterSettings, context = {}, options = {}) {
  const generated = generateFilterDataCode(filterSettings, context);
  const outputVariable = resolveFilterOutputVariableName(
    filterSettings,
    context.inputVariable,
    context,
  );

  const cleaned = stripFilterBlocks(code);
  if (!cleaned) {
    return { code: generated, outputVariable };
  }

  return {
    code: `${cleaned}\n\n${generated}`.trim(),
    outputVariable,
  };
}
