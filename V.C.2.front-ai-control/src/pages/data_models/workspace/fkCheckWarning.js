/**
 * Parse DataCode fk_check=warn messages and map them onto canvas widgets.
 *
 * Example engine warning:
 *   fk_check=warn: skipped order_items.order_id -> orders(id) (67 orphans)
 *
 * That means the child table still has FK values whose parent PK rows were
 * dropped (typically an in-place filter/transform on the parent).
 */

const SKIPPED_FK_RE =
  /skipped\s+([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)\s*->\s*([A-Za-z_][\w]*)\(([A-Za-z_][\w]*)\)\s*\((\d+)\s*orphans?\)/gi;

export function normalizeWarningText(raw) {
  if (raw == null) return '';
  if (Array.isArray(raw)) return raw.map((item) => String(item || '')).filter(Boolean).join('\n');
  if (typeof raw === 'object') {
    return [raw.warning, raw.message, raw.detail].filter(Boolean).map(String).join('\n');
  }
  return String(raw);
}

export function parseFkCheckWarnings(raw) {
  const text = normalizeWarningText(raw);
  if (!text.trim()) return [];
  const issues = [];
  const seen = new Set();
  SKIPPED_FK_RE.lastIndex = 0;
  let match;
  while ((match = SKIPPED_FK_RE.exec(text)) !== null) {
    const issue = {
      childTable: match[1],
      childColumn: match[2],
      parentTable: match[3],
      parentColumn: match[4],
      orphans: Number(match[5]) || 0,
    };
    const key = `${issue.childTable}.${issue.childColumn}->${issue.parentTable}.${issue.parentColumn}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push(issue);
  }
  return issues;
}

function addAlias(set, value) {
  const name = String(value || '').trim();
  if (name) set.add(name);
}

export function collectWidgetTableAliases(widget) {
  const names = new Set();
  const settings = widget?.settings || {};
  addAlias(names, settings.tableName);
  addAlias(names, settings.dataCodeVariableName);
  if (Array.isArray(settings.selectedTables)) {
    settings.selectedTables.forEach((table) => {
      addAlias(names, table?.name);
      addAlias(names, table?.alias);
    });
  }
  addAlias(names, settings.interactiveConfig?.table?.name);
  addAlias(names, settings.interactiveConfig?.variable?.name);
  if (Array.isArray(settings.folderConfig?.groups)) {
    settings.folderConfig.groups.forEach((group) => addAlias(names, group?.tableName));
  }
  addAlias(names, settings.pk?.tableVariable);
  (settings.foreignKeys || []).forEach((fk) => addAlias(names, fk?.tableVariable));
  addAlias(names, settings.left?.tableVariable);
  addAlias(names, settings.right?.tableVariable);
  addAlias(names, settings.junction?.tableVariable);
  (widget?.connections || []).forEach((conn) => {
    addAlias(names, conn?.settings?.inputVariable);
    addAlias(names, conn?.settings?.dataCodeVariableName);
    addAlias(names, conn?.settings?.selectedTable);
  });
  return names;
}

export function widgetTouchesTable(widget, tableName) {
  if (!tableName) return false;
  return collectWidgetTableAliases(widget).has(tableName);
}

function isInPlaceMutation(widget) {
  const type = widget?.type;
  const settings = widget?.settings || {};
  if (type === 'formula') return true;
  if (type !== 'processing-block') return false;
  const block = settings.blockType;
  if (block === 'filter') return !settings.filterSeparateOutput;
  if (block === 'transform') return !settings.transformSeparateOutput;
  if (block === 'aggregate') return !settings.aggregateSeparateOutput;
  if (block === 'join') return settings.joinSeparateOutput === false;
  return true;
}

export function describeFkIssue(issue) {
  const n = issue.orphans;
  const orphanLabel = n === 1 ? '1 строка-сирота' : `${n} строк-сирот`;
  return (
    `Связь ${issue.childTable}.${issue.childColumn} → ${issue.parentTable}.${issue.parentColumn} `
    + `неполная (${orphanLabel}). После фильтрации или обработки родитель или потомок `
    + `не содержат полный набор ключей. Отфильтруйте дочернюю таблицу так же, `
    + `как родителя, или исправьте обработку.`
  );
}

export function describeFkIssueForRole(issue, role) {
  const shared = describeFkIssue(issue);
  if (role === 'parent') {
    return (
      `Родительская таблица «${issue.parentTable}» после обработки содержит не все ключи `
      + `для связи с «${issue.childTable}». ${shared}`
    );
  }
  if (role === 'child') {
    return (
      `Дочерняя таблица «${issue.childTable}» содержит ключи без родителя в «${issue.parentTable}». ${shared}`
    );
  }
  if (role === 'processing') {
    return (
      `Эта обработка сужает набор «${issue.parentTable}» или «${issue.childTable}», `
      + `поэтому связь ломается. ${shared}`
    );
  }
  if (role === 'relationship') {
    return `Пропущена FK в DDL. ${shared}`;
  }
  return shared;
}

function widgetRolesForIssue(widget, issue) {
  const type = widget?.type;
  const touchesParent = widgetTouchesTable(widget, issue.parentTable);
  const touchesChild = widgetTouchesTable(widget, issue.childTable);
  if (!touchesParent && !touchesChild) return [];

  const roles = [];
  if (type === 'relationship' && (touchesParent || touchesChild)) {
    roles.push('relationship');
  }
  if (type === 'data-source' && touchesParent) roles.push('parent');
  if (type === 'data-source' && touchesChild) roles.push('child');
  if ((type === 'processing-block' || type === 'formula') && isInPlaceMutation(widget)) {
    roles.push('processing');
  }
  return roles;
}

export function matchWidgetsToFkIssues(widgets = [], issues = []) {
  const byWidget = new Map();
  for (const widget of widgets || []) {
    if (!widget) continue;
    const messages = [];
    const roles = new Set();
    for (const issue of issues) {
      const widgetRoles = widgetRolesForIssue(widget, issue);
      if (!widgetRoles.length) continue;
      widgetRoles.forEach((role) => roles.add(role));
      messages.push(describeFkIssueForRole(issue, widgetRoles[0]));
    }
    if (messages.length) {
      byWidget.set(String(widget.id), {
        widget,
        roles: [...roles],
        message: [...new Set(messages)].join('\n'),
        issues,
      });
    }
  }
  return byWidget;
}

export function applyFkCheckWarningsToWidgets(widgets = [], rawWarning) {
  const issues = parseFkCheckWarnings(rawWarning);
  const matches = matchWidgetsToFkIssues(widgets, issues);
  for (const widget of widgets || []) {
    const hit = matches.get(String(widget.id));
    if (typeof widget.setFkWarning === 'function') {
      widget.setFkWarning(hit?.message || null);
    }
  }
  return { issues, matches };
}
