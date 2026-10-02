import {
  orderWidgetsForDataCodeTabs,
  tabNameForWidget,
  widgetIdKey,
} from './widgetGraphOrder.js';
import { parseDbWidgetId } from './widgetDbSync.js';
import { resolveWidgetDataCodeContent } from './resolveWidgetDataCode.js';

function getFolderLikeContainer(settings) {
  if (!settings) return null;
  if (settings.sourceType === 'archive') return settings.selectedArchive;
  if (settings.sourceType === 'folder') return settings.selectedFolder;
  return null;
}

export function collectEditorUploadFiles(widgets = []) {
  const files = [];
  for (const widget of widgets || []) {
    const s = widget?.settings || {};
    if (s.sourceType === 'file' && s.selectedFile?.file) {
      files.push({ filename: s.selectedFile.name, file: s.selectedFile.file });
      continue;
    }
    if (s.sourceType === 'json' && s.jsonSourceType === 'local' && s.selectedFile?.file) {
      files.push({ filename: s.selectedFile.name, file: s.selectedFile.file });
      continue;
    }
    if (
      (s.sourceType === 'folder' && (s.fileDeliveryMode || 'local') === 'local')
      || s.sourceType === 'archive'
    ) {
      const container = getFolderLikeContainer(s);
      const folderFiles = container?.files || [];
      for (const f of folderFiles) {
        if (!f?.file) continue;
        const filePath = f.relativePath || f.name || f.file.name;
        files.push({ filename: filePath, file: f.file });
      }
    }
  }
  return files.length ? files : null;
}

export function extractSavedTabContent(codeResponse) {
  const tabs = codeResponse?.code_data?.tabs;
  if (!Array.isArray(tabs) || !tabs.length) return '';
  return tabs
    .map((t) => (typeof t?.content === 'string' ? t.content : ''))
    .filter((c) => c.trim())
    .join('\n\n');
}

function parseTabWidgetId(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeDismissedWidgetIds(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const value of raw) {
    const id = parseTabWidgetId(value);
    if (id == null) continue;
    const key = widgetIdKey(id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

/**
 * Widget tabs closed in the editor stay closed across reopen/compile.
 * Open tabs are removed from the dismissed set; canvas widgets missing from
 * open tabs are added (so a close persists). Brand-new canvas widgets are not
 * dismissed until the user closes them.
 */
export function resolveDismissedWidgetIds({
  openTabs = [],
  previousDismissed = [],
  canvasWidgetIds = null,
} = {}) {
  const openKeys = new Set();
  for (const tab of openTabs || []) {
    const id = parseTabWidgetId(tab?.widgetId);
    if (id != null) openKeys.add(widgetIdKey(id));
  }

  const next = new Set();
  for (const id of normalizeDismissedWidgetIds(previousDismissed)) {
    const key = widgetIdKey(id);
    if (!openKeys.has(key)) next.add(key);
  }

  if (Array.isArray(canvasWidgetIds)) {
    for (const raw of canvasWidgetIds) {
      const id = parseTabWidgetId(raw);
      if (id == null) continue;
      const key = widgetIdKey(id);
      if (!openKeys.has(key)) next.add(key);
    }
  }

  return [...next].map((key) => Number(key)).filter((n) => Number.isFinite(n));
}

/**
 * Model-level execute_datacode payload used to restore free tabs / order
 * between editor openings. Legacy detail-page stubs are ignored.
 */
export function isUsableEditorSession(session) {
  const tabs = session?.tabs;
  if (!Array.isArray(tabs) || !tabs.length) return false;
  if (session.editorSession === true) return true;
  if (tabs.some((t) => parseTabWidgetId(t?.widgetId) != null)) return true;
  return tabs.some((t) => String(t?.content || '').trim());
}

export function buildEditorSessionPayload(
  tabs = [],
  activeTab = 0,
  {
    dismissedWidgetIds = null,
    previousDismissed = [],
    canvasWidgetIds = null,
  } = {},
) {
  const dismissed = Array.isArray(dismissedWidgetIds)
    ? normalizeDismissedWidgetIds(dismissedWidgetIds)
    : resolveDismissedWidgetIds({
        openTabs: tabs,
        previousDismissed,
        canvasWidgetIds,
      });

  return {
    editorSession: true,
    activeTab: Number.isFinite(Number(activeTab)) ? Number(activeTab) : 0,
    dismissedWidgetIds: dismissed,
    tabs: (tabs || []).map((tab) => {
      const out = {
        name: tab?.name || 'Вкладка',
        content: typeof tab?.content === 'string' ? tab.content : '',
      };
      const widgetId = parseTabWidgetId(tab?.widgetId);
      if (widgetId != null) out.widgetId = widgetId;
      return out;
    }),
  };
}

/**
 * Rebuild widget-bound tabs from the canvas, then restore free tabs / order /
 * renames from the last saved editor session.
 */
export function mergeEditorSessionTabs({
  widgetTabs = [],
  savedSession = null,
  selectedWidgetId = null,
} = {}) {
  const baseTabs = Array.isArray(widgetTabs) ? widgetTabs : [];
  if (!isUsableEditorSession(savedSession)) {
    let activeTab = 0;
    if (selectedWidgetId != null) {
      const selectedKey = widgetIdKey(selectedWidgetId);
      const idx = baseTabs.findIndex(
        (t) => t.widgetId != null && widgetIdKey(t.widgetId) === selectedKey,
      );
      if (idx >= 0) activeTab = idx;
    }
    return { tabs: baseTabs, activeTab };
  }

  const widgetById = new Map();
  for (const tab of baseTabs) {
    const id = parseTabWidgetId(tab?.widgetId);
    if (id == null) continue;
    widgetById.set(widgetIdKey(id), tab);
  }

  const dismissedKeys = new Set(
    normalizeDismissedWidgetIds(savedSession.dismissedWidgetIds).map((id) => widgetIdKey(id)),
  );
  // Opening the editor from a specific widget restores that tab.
  if (selectedWidgetId != null) {
    dismissedKeys.delete(widgetIdKey(selectedWidgetId));
  }

  const usedWidgetKeys = new Set();
  const merged = [];

  for (const saved of savedSession.tabs) {
    const widgetId = parseTabWidgetId(saved?.widgetId);
    if (widgetId != null) {
      const key = widgetIdKey(widgetId);
      const fresh = widgetById.get(key);
      if (!fresh) continue;
      usedWidgetKeys.add(key);
      dismissedKeys.delete(key);
      merged.push({
        ...fresh,
        name: saved?.name || fresh.name,
        content: fresh.content,
        widgetId: fresh.widgetId,
      });
      continue;
    }
    merged.push({
      name: saved?.name || 'Вкладка',
      content: typeof saved?.content === 'string' ? saved.content : '',
      widgetId: null,
    });
  }

  for (const tab of baseTabs) {
    const id = parseTabWidgetId(tab?.widgetId);
    if (id == null) continue;
    const key = widgetIdKey(id);
    if (usedWidgetKeys.has(key)) continue;
    if (dismissedKeys.has(key)) continue;
    merged.push(tab);
  }

  let activeTab = Number.isFinite(Number(savedSession.activeTab))
    ? Number(savedSession.activeTab)
    : 0;
  if (selectedWidgetId != null) {
    const selectedKey = widgetIdKey(selectedWidgetId);
    const idx = merged.findIndex(
      (t) => t.widgetId != null && widgetIdKey(t.widgetId) === selectedKey,
    );
    if (idx >= 0) activeTab = idx;
  }
  if (activeTab < 0 || activeTab >= merged.length) activeTab = 0;

  return { tabs: merged, activeTab };
}

/**
 * @param {object} params
 * @param {object[]} params.widgets
 * @param {object[]} [params.connections]
 * @param {Map<string, string>|Record<string, string>} [params.savedCodeByWidgetId]
 * @param {object} [params.widgetManager] used to generate empty tabs from widget settings
 * @param {string|number} [params.selectedWidgetId]
 * @param {object|null} [params.savedEditorSession] model-level code_data from last editor open
 */
export function buildDataCodeEditorTabs({
  widgets = [],
  connections = null,
  savedCodeByWidgetId = {},
  widgetManager = null,
  selectedWidgetId = null,
  savedEditorSession = null,
} = {}) {
  const { ordered, levels } = orderWidgetsForDataCodeTabs(widgets, connections);
  const savedMap = savedCodeByWidgetId instanceof Map
    ? savedCodeByWidgetId
    : new Map(Object.entries(savedCodeByWidgetId || {}));

  const widgetTabs = ordered.map((widget) => {
    const dbId = parseDbWidgetId(widget);
    const savedRaw = savedMap.get(widgetIdKey(dbId ?? widget.id));
    const saved = typeof savedRaw === 'string' ? savedRaw : '';
    return {
      name: tabNameForWidget(widget),
      content: saved.trim()
        ? saved
        : resolveWidgetDataCodeContent(widget, '', widgetManager),
      widgetId: dbId,
    };
  });

  const { tabs, activeTab } = mergeEditorSessionTabs({
    widgetTabs,
    savedSession: savedEditorSession,
    selectedWidgetId,
  });

  return {
    tabs,
    activeTab,
    ordered,
    levels,
  };
}

/**
 * Drop deleted widgets from a saved editor session payload.
 * @returns {object|null} next payload, or null if nothing changed
 */
export function pruneEditorSessionPayload(session, deletedWidgetIds = []) {
  if (!isUsableEditorSession(session)) return null;
  const deleted = new Set(
    (deletedWidgetIds || [])
      .map((id) => parseTabWidgetId(id))
      .filter((id) => id != null)
      .map((id) => widgetIdKey(id)),
  );
  if (!deleted.size) return null;

  const tabs = (session.tabs || []).filter((tab) => {
    const id = parseTabWidgetId(tab?.widgetId);
    if (id == null) return true;
    return !deleted.has(widgetIdKey(id));
  });
  const dismissedWidgetIds = normalizeDismissedWidgetIds(session.dismissedWidgetIds).filter(
    (id) => !deleted.has(widgetIdKey(id)),
  );
  const tabsChanged = tabs.length !== (session.tabs || []).length;
  const dismissedChanged =
    dismissedWidgetIds.length !== normalizeDismissedWidgetIds(session.dismissedWidgetIds).length;
  if (!tabsChanged && !dismissedChanged) return null;

  const activeTab = Math.min(
    Number.isFinite(Number(session.activeTab)) ? Number(session.activeTab) : 0,
    Math.max(0, tabs.length - 1),
  );
  return buildEditorSessionPayload(tabs, activeTab, { dismissedWidgetIds });
}
