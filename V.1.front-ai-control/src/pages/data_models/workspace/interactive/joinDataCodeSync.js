/**
 * DataCode generation for «Объединение» (JOIN / merge_tables).
 *
 *   global report = left_join(users, orders, "id", "user_id")
 *   users = inner_join(users, extra, [["id", "id"], ["region", "region"]])
 *   global stacked = merge_tables([q1, q2, q3])
 */

import { sanitizeIdentifier } from './schema.js';
import { collectRelationshipTableSources } from './relationshipSources.js';
import { findLinkedTable, normalizeLinkedTables } from './linkedModelDataCodeSync.js';
import { resolveUpstreamDataCodeVariable } from './filterDataCodeSync.js';
import {
  JOIN_FN,
  createDefaultJoinStep,
  isJoinSeparateOutput,
  joinNeedsKeys,
  normalizeJoinSettings,
  resolveJoinOutputVariableName,
} from './joinConfigSchema.js';

export {
  isJoinSeparateOutput,
  resolveJoinOutputVariableName,
  buildDefaultSeparateJoinVariableName,
} from './joinConfigSchema.js';

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

/**
 * Incoming tables for a join widget.
 * A data-model connection with a selected table contributes that table;
 * without a selection, all imported tables of that model are available.
 */
export function collectJoinTableSources(joinWidget, widgetManager) {
  const all = collectRelationshipTableSources(joinWidget, widgetManager);
  if (!joinWidget || !widgetManager) return all;

  const joinId = String(joinWidget.id);
  const incoming = (joinWidget.connections || []).filter(
    (c) => c && String(c.to) === joinId,
  );
  const ordered = [];
  const seen = new Set();

  for (const conn of incoming) {
    const fromId = conn.from;
    if (fromId == null) continue;
    const sourceWidget = widgetManager.getWidget(fromId);
    if (!sourceWidget) continue;

    if (sourceWidget.type === 'data-model') {
      const hint = conn.settings?.selectedTable || conn.settings?.inputVariable;
      const tables = hint
        ? [findLinkedTable(sourceWidget.settings, hint)].filter(Boolean)
        : normalizeLinkedTables(sourceWidget.settings);
      for (const match of tables) {
        const tableVariable = sanitizeIdentifier(match.alias || match.name, '');
        if (!tableVariable || seen.has(`${conn.id}:${tableVariable}`)) continue;
        seen.add(`${conn.id}:${tableVariable}`);
        ordered.push({
          connectionId: conn.id ?? null,
          widgetId: String(fromId),
          widgetName: `${sourceWidget.settings?.name || tableVariable} · ${tableVariable}`,
          tableVariable,
          columns: Array.isArray(match.columns) ? match.columns.filter(Boolean) : [],
          sourceWidget,
        });
      }
      continue;
    }

    const hit = all.find(
      (s) => String(s.widgetId) === String(fromId) && s.connectionId === (conn.id ?? null),
    ) || all.find((s) => String(s.widgetId) === String(fromId));
    if (!hit) {
      const tableVariable = resolveUpstreamDataCodeVariable(
        sourceWidget,
        conn.settings || {},
        { widgetManager, widgetId: joinWidget.id, connections: joinWidget.connections },
      );
      if (!tableVariable) continue;
      ordered.push({
        connectionId: conn.id ?? null,
        widgetId: String(fromId),
        widgetName: sourceWidget.settings?.name || tableVariable,
        tableVariable,
        columns: [],
        sourceWidget,
      });
      continue;
    }
    if (seen.has(`${hit.connectionId}:${hit.tableVariable}`)) continue;
    seen.add(`${hit.connectionId}:${hit.tableVariable}`);
    ordered.push(hit);
  }

  return ordered;
}

export function syncJoinStepsWithSources(settings = {}, sources = []) {
  const normalized = normalizeJoinSettings(settings);
  const rights = (sources || []).slice(1);
  const existing = normalized.joinSteps || [];
  return rights.map((src, index) => {
    const prev = existing.find((step) => step.connectionId && step.connectionId === src.connectionId)
      || existing.find((step) => step.rightTableVariable === src.tableVariable)
      || existing[index];
    return createDefaultJoinStep({
      ...(prev || {}),
      connectionId: src.connectionId ?? null,
      rightTableVariable: src.tableVariable,
    });
  });
}

function validKeys(step) {
  return (step?.keys || []).filter((k) => k?.leftColumn?.trim() && k?.rightColumn?.trim());
}

export function formatJoinOnArgs(keys = []) {
  const pairs = (keys || []).filter((k) => k?.leftColumn?.trim() && k?.rightColumn?.trim());
  if (!pairs.length) return '';
  if (pairs.length === 1) {
    const left = pairs[0].leftColumn.trim();
    const right = pairs[0].rightColumn.trim();
    if (left === right) return `, ${quoteField(left)}`;
    return `, ${quoteField(left)}, ${quoteField(right)}`;
  }
  const lit = pairs
    .map((k) => `[${quoteField(k.leftColumn.trim())}, ${quoteField(k.rightColumn.trim())}]`)
    .join(', ');
  return `, [${lit}]`;
}

export function buildJoinCall(joinType, leftVar, rightVar, step = {}) {
  const type = JOIN_FN[joinType] ? joinType : 'left';
  const fn = JOIN_FN[type];
  if (type === 'cross' || type === 'zip') {
    return `${fn}(${leftVar}, ${rightVar})`;
  }
  if (type === 'asof') {
    const on = step.asofColumn?.trim() || validKeys(step)[0]?.leftColumn?.trim() || '';
    const direction = step.asofDirection || 'backward';
    const by = step.asofBy?.trim();
    const parts = [leftVar, rightVar, on ? quoteField(on) : quoteField('time')];
    if (by) parts.push(`by=${quoteField(by)}`);
    parts.push(`direction=${quoteField(direction)}`);
    return `${fn}(${parts.join(', ')})`;
  }
  return `${fn}(${leftVar}, ${rightVar}${formatJoinOnArgs(step.keys)})`;
}

export function generateJoinDataCode(joinSettings = {}, context = {}) {
  const settings = normalizeJoinSettings(joinSettings);
  const sources = Array.isArray(context.sources) ? context.sources : [];
  const left = sources[0];
  const rights = sources.slice(1);
  const leftVar = sanitizeIdentifier(left?.tableVariable || context.inputVariable || 'data', 'data');
  const outputVar = resolveJoinOutputVariableName(settings, leftVar, context);
  const globalPrefix = settings.exportGlobal && isJoinSeparateOutput(settings) ? 'global ' : '';
  const name = settings.name || 'Объединение';
  const steps = syncJoinStepsWithSources(settings, sources);

  const lines = [
    `# Join: ${name}`,
    `# Left table: ${leftVar}`,
  ];

  if (sources.length < 2) {
    lines.push('# Need at least two incoming tables');
    lines.push(`${globalPrefix}${outputVar} = ${leftVar}`);
    lines.push(`print("${outputVar}: ", table_info(${outputVar}))`);
    return lines.join('\n');
  }

  if (settings.joinMode === 'merge') {
    const vars = sources.map((s) => sanitizeIdentifier(s.tableVariable, 'data'));
    lines.push(`# Mode: merge_tables`);
    lines.push(`${globalPrefix}${outputVar} = merge_tables([${vars.join(', ')}])`);
    lines.push(`print("${outputVar}: ", table_info(${outputVar}))`);
    return lines.join('\n');
  }

  const joinType = settings.joinType || 'left';
  lines.push(`# Type: ${joinType}`);

  let currentVar = leftVar;
  rights.forEach((right, index) => {
    const rightVar = sanitizeIdentifier(right.tableVariable, 'data');
    const step = steps[index] || createDefaultJoinStep({ rightTableVariable: rightVar });
    const prefix = index === 0 ? globalPrefix : '';
    if (joinNeedsKeys(joinType) && !validKeys(step).length) {
      lines.push(`# Missing join keys for ${rightVar}`);
      if (index === 0) {
        lines.push(`${prefix}${outputVar} = ${currentVar}`);
        currentVar = outputVar;
      }
      return;
    }
    const call = buildJoinCall(joinType, currentVar, rightVar, step);
    lines.push(`${prefix}${outputVar} = ${call}`);
    currentVar = outputVar;
  });

  lines.push(`print("${outputVar}: ", table_info(${outputVar}))`);
  return lines.join('\n');
}

const JOIN_BLOCK_RE = /# Join:[^\n]*\r?\n[\s\S]*?print\s*\([^)]*table_info\s*\([\p{L}_][\p{L}\p{N}_]*\)\s*\)/gmu;

export function stripJoinBlocks(code) {
  if (!code?.trim()) return '';
  return String(code)
    .replace(JOIN_BLOCK_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function patchJoinDataCodeInCode(code, joinSettings, context = {}) {
  const generated = generateJoinDataCode(joinSettings, context);
  const leftVar = sanitizeIdentifier(
    context.sources?.[0]?.tableVariable || context.inputVariable || 'data',
    'data',
  );
  const outputVariable = resolveJoinOutputVariableName(joinSettings, leftVar, context);
  const cleaned = stripJoinBlocks(code);
  if (!cleaned) {
    return { code: generated, outputVariable };
  }
  return {
    code: `${cleaned}\n\n${generated}`.trim(),
    outputVariable,
  };
}
