/**
 * Resolve connected tables + columns for relationship widgets.
 * Columns reflect upstream transform renames (post-rename names).
 */

import {
  resolveFieldsFromWidgetChain,
  resolveEffectiveColumnName,
} from './incomingFieldsUtils.js';
import { resolveUpstreamDataCodeVariable } from './filterDataCodeSync.js';
import { findLinkedTable, normalizeLinkedTables } from './linkedModelDataCodeSync.js';
import { sanitizeIdentifier } from './schema.js';

function sanitizeLinkedAlias(table) {
  return sanitizeIdentifier(table?.alias || table?.name, '');
}

function linkedTablesForConnection(sourceWidget, connSettings = {}) {
  const tables = normalizeLinkedTables(sourceWidget?.settings);
  const hint = connSettings.selectedTable || connSettings.inputVariable;
  if (!hint) return tables;
  const match = findLinkedTable(sourceWidget?.settings, hint);
  return match ? [match] : [];
}

/**
 * @typedef {{
 *   connectionId: string|null,
 *   widgetId: string,
 *   widgetName: string,
 *   tableVariable: string,
 *   columns: string[],
 *   sourceWidget: object|null,
 * }} RelationshipTableSource
 */

/**
 * Collect unique table sources connected into a relationship widget.
 * @returns {RelationshipTableSource[]}
 */
export function collectRelationshipTableSources(relationshipWidget, widgetManager) {
  if (!relationshipWidget || !widgetManager) return [];

  const relId = String(relationshipWidget.id);
  const incoming = (relationshipWidget.connections || []).filter(
    (c) => c && String(c.to) === relId,
  );

  const seenVars = new Set();
  const sources = [];

  for (const conn of incoming) {
    const fromId = conn.from;
    if (fromId == null) continue;
    const sourceWidget = widgetManager.getWidget(fromId);
    if (!sourceWidget) continue;

    if (sourceWidget.type === 'data-model') {
      for (const table of linkedTablesForConnection(sourceWidget, conn.settings || {})) {
        const tableVariable = sanitizeLinkedAlias(table);
        if (!tableVariable || seenVars.has(tableVariable)) continue;
        seenVars.add(tableVariable);
        sources.push({
          connectionId: conn.id ?? null,
          widgetId: String(fromId),
          widgetName: `${sourceWidget.settings?.name || tableVariable} · ${tableVariable}`,
          tableVariable,
          columns: Array.isArray(table.columns) ? table.columns.filter(Boolean) : [],
          sourceWidget,
        });
      }
      continue;
    }

    const tableVariable = resolveUpstreamDataCodeVariable(
      sourceWidget,
      conn.settings || {},
      { widgetManager, widgetId: relationshipWidget.id, connections: relationshipWidget.connections },
    );
    if (!tableVariable || seenVars.has(tableVariable)) continue;
    seenVars.add(tableVariable);

    let columns = resolveFieldsFromWidgetChain(widgetManager, fromId);
    // Walk transform chain and apply effective names for any stored originals.
    columns = columns.map((col) => {
      let w = sourceWidget;
      let name = col;
      let guard = 0;
      while (w && guard < 12) {
        if (w.settings?.blockType === 'transform') {
          name = resolveEffectiveColumnName(name, w.settings);
        }
        const up = (w.connections || []).find((c) => String(c.to) === String(w.id));
        if (!up?.from) break;
        w = widgetManager.getWidget(up.from);
        guard += 1;
      }
      return name;
    });
    // Dedupe after rename
    columns = [...new Set(columns.filter(Boolean))];

    sources.push({
      connectionId: conn.id ?? null,
      widgetId: String(fromId),
      widgetName: sourceWidget.settings?.name || tableVariable,
      tableVariable,
      columns,
      sourceWidget,
    });
  }

  return sources;
}

/**
 * Resolve column for codegen: apply renames along the source widget chain.
 */
export function resolveRelateColumnName(column, sourceWidget, widgetManager) {
  if (!column) return column;
  let name = String(column);
  let w = sourceWidget;
  let guard = 0;
  while (w && guard < 12) {
    if (w.settings?.blockType === 'transform') {
      name = resolveEffectiveColumnName(name, w.settings);
    }
    if (w.type === 'formula') {
      // formula adds columns; no rename of existing
    }
    const up = (w.connections || []).find((c) => String(c.to) === String(w.id));
    if (!up?.from || !widgetManager) break;
    w = widgetManager.getWidget(up.from);
    guard += 1;
  }
  return name;
}
