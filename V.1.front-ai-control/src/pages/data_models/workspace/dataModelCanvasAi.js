/**
 * Intent classification, structured reply parsing, and local canvas proposal apply
 * for DataModelAiAssistant.
 */

import { eventBus } from './core/EventBus.js';
import { dataModelService } from '../../../services/dataModelService';
import { generateDataCodeFromConfig } from './interactive/dataCodeSync.js';
import { generateRelationshipDataCode } from './interactive/relationshipDataCodeSync.js';
import { collectRelationshipTableSources } from './interactive/relationshipSources.js';
import { resolveWidgetDataCodeContent } from './resolveWidgetDataCode.js';

export const CANVAS_OPS = [
  'add_widget',
  'update_settings',
  'add_connection',
  'delete_widget',
  'delete_connection',
  'move_widget',
];

/** Типы, между которыми нельзя тянуть порт-связь напрямую (нужен виджет relationship). */
const ENTITY_SOURCE_TYPES = new Set(['data-source', 'data-model']);

/**
 * Порт-связь (output→input) допустима только для потока обработки / входа в relationship.
 * Связь «сущность ↔ сущность» (два источника) — через виджет relationship.
 */
export function assertPortConnectionAllowed(fromWidget, toWidget) {
  if (!fromWidget || !toWidget) {
    throw new Error('Не найдены виджеты для связи');
  }
  const fromType = fromWidget.type;
  const toType = toWidget.type;

  if (ENTITY_SOURCE_TYPES.has(fromType) && ENTITY_SOURCE_TYPES.has(toType)) {
    throw new Error(
      'Нельзя соединять источники данных напрямую. '
      + 'Для связи сущностей (1:N и т.п.) добавьте виджет «Связь» (relationship) '
      + 'и подключите к нему оба источника.',
    );
  }

  if (fromType === 'relationship') {
    throw new Error('Виджет «Связь» не должен быть источником порт-связи (from).');
  }

  const allowedTargets = new Set([
    'processing-block',
    'formula',
    'relationship',
  ]);
  // data-source/data-model → processing/formula/relationship
  if (ENTITY_SOURCE_TYPES.has(fromType) && !allowedTargets.has(toType)) {
    throw new Error(
      `Недопустимая связь ${fromType} → ${toType}. `
      + 'Источник подключают к processing-block, formula или relationship.',
    );
  }
}

const ACT_RE = /\b(сделай|сделать|измени|изменить|добавь|добавить|переделай|переделать|примени|применить|создай|создать|настрой|настроить|удали|удалить|соедини|соединить|свяжи|связать|замени|заменить|обнови|обновить|выполни|выполнить)\b/i;
const DESCRIBE_RE = /\b(опиши|описать|что на полотне|что здесь|расскажи о модели|покажи структуру|что у меня)\b/i;
const HELP_RE = /\b(помоги|помощь|как |объясни|подскажи|что делать|инструкц)\b/i;
const SELF_DO_RE = /\b(сам|сама|само|автоматически|за меня|без меня|можешь это|сделай это|примени это|да\,?\s*сделай|ок\,?\s*сделай)\b/i;

/**
 * @param {string} text
 * @param {{ previousMode?: string|null, hasAttachedWidgets?: boolean }} [ctx]
 * @returns {'act'|'describe'|'help'}
 */
export function classifyDataModelIntent(text, ctx = {}) {
  const t = String(text || '').trim();
  if (!t) return 'help';

  if (SELF_DO_RE.test(t) || ACT_RE.test(t)) return 'act';
  if (ctx.previousMode === 'act' && /^(да|ага|ок|хорошо|сделай|давай|конечно|yes|yep)\b/i.test(t)) {
    return 'act';
  }
  if (DESCRIBE_RE.test(t)) return 'describe';
  if (ctx.hasAttachedWidgets && /\b(этот|эти|виджет|источник|блок)\b/i.test(t) && ACT_RE.test(t)) {
    return 'act';
  }
  if (HELP_RE.test(t)) return 'help';
  // Default: if attachments + request-like, lean act; else help
  if (ctx.hasAttachedWidgets && t.length > 12) return 'act';
  return 'help';
}

/**
 * Extract JSON object from model reply (raw or fenced).
 * @param {string} raw
 * @returns {object|null}
 */
export function extractJsonObject(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  let parsed = tryParse(text);
  if (parsed && typeof parsed === 'object') return parsed;

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    parsed = tryParse(fence[1].trim());
    if (parsed && typeof parsed === 'object') return parsed;
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    parsed = tryParse(text.slice(start, end + 1));
    if (parsed && typeof parsed === 'object') return parsed;
  }
  return null;
}

/**
 * Normalize assistant structured reply — see parseCanvasAiReply at end of file (with phase).
 */

function resolveWidgetId(id, tempMap) {
  if (id == null) return null;
  const key = String(id);
  if (tempMap.has(key)) return tempMap.get(key);
  return key;
}

function placeNearExisting(engine, index = 0) {
  const widgets = engine?.widgetManager?.getAllWidgets?.() || [];
  if (!widgets.length) return { x: 120 + index * 40, y: 120 + index * 40 };
  let maxX = 0;
  let avgY = 0;
  widgets.forEach((w) => {
    maxX = Math.max(maxX, (w.x || 0) + (w.width || 250));
    avgY += w.y || 0;
  });
  avgY = Math.round(avgY / widgets.length);
  return { x: maxX + 60, y: avgY + index * 40 };
}

function getWidgetFieldNames(widget) {
  if (!widget) return [];
  const s = widget.settings || {};
  const interactive = s.interactiveConfig?.table?.fields;
  if (Array.isArray(interactive) && interactive.length) {
    return interactive.map((f) => f?.name).filter(Boolean).map(String);
  }
  const cols = s.interactiveConfig?.table?.columns || s.interactiveConfig?.columns;
  if (Array.isArray(cols) && cols.length) {
    return cols.map((c) => (typeof c === 'string' ? c : c?.name)).filter(Boolean).map(String);
  }
  if (Array.isArray(s.fields) && s.fields.length) {
    return s.fields.map((f) => (typeof f === 'string' ? f : f?.name)).filter(Boolean).map(String);
  }
  return [];
}

function getWidgetTableVariable(widget) {
  if (!widget) return '';
  const s = widget.settings || {};
  const fromInteractive = s.interactiveConfig?.table?.name || s.interactiveConfig?.variable?.name;
  if (fromInteractive) {
    return String(fromInteractive).trim();
  }
  const raw = s.name || s.title || widget.name || '';
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || '';
}

function columnKey(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Сопоставляет имя колонки от модели с реальными полями виджета
 * (чинит усечения вроде categori → category_id).
 */
export function matchColumnName(requested, columns) {
  const req = String(requested || '').trim();
  const cols = (columns || []).map(String).filter(Boolean);
  if (!req) return '';
  if (!cols.length) return req;
  if (cols.includes(req)) return req;

  const lower = req.toLowerCase();
  const ci = cols.find((c) => c.toLowerCase() === lower);
  if (ci) return ci;

  const reqKey = columnKey(req);
  if (!reqKey) return req;

  const scored = cols.map((c) => {
    const key = columnKey(c);
    let score = 0;
    if (key === reqKey) score = 1000;
    else if (key.startsWith(reqKey) || reqKey.startsWith(key)) {
      score = 500 + Math.min(key.length, reqKey.length) * 10 - Math.abs(key.length - reqKey.length);
    } else if (key.includes(reqKey) || reqKey.includes(key)) {
      score = 200 + Math.min(key.length, reqKey.length);
    }
    // category / categori → category_id
    if (reqKey.length >= 4 && key.startsWith(reqKey.slice(0, Math.min(6, reqKey.length)))) {
      score = Math.max(score, 400 + reqKey.length);
    }
    return { c, score };
  }).filter((x) => x.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.c || req;
}

function guessFkColumn(pkWidget, fkWidget) {
  const fkFields = getWidgetFieldNames(fkWidget);
  if (!fkFields.length) return '';
  const pkTable = getWidgetTableVariable(pkWidget);
  const candidates = [];
  if (pkTable) {
    candidates.push(`${pkTable}_id`, `${pkTable}id`, pkTable);
  }
  const pkName = String(pkWidget?.settings?.name || '').toLowerCase();
  if (pkName) {
    const slug = pkName.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (slug) candidates.push(`${slug}_id`, `${slug}id`);
  }
  for (const cand of candidates) {
    const hit = matchColumnName(cand, fkFields);
    if (hit && fkFields.includes(hit)) return hit;
  }
  const idLike = fkFields.find((f) => /_id$/i.test(f) && f.toLowerCase() !== 'id');
  return idLike || '';
}

function normalizeColRefAgainstCanvas(ref, wm, tempMap) {
  if (!ref || typeof ref !== 'object') return ref;
  const widgetId = resolveWidgetId(ref.widgetId, tempMap);
  const widget = widgetId != null ? wm.getWidget(widgetId) : null;
  const fields = getWidgetFieldNames(widget);
  let column = matchColumnName(ref.column, fields);
  let tableVariable = String(ref.tableVariable || '').trim() || getWidgetTableVariable(widget);
  return {
    ...ref,
    widgetId: widgetId != null ? String(widgetId) : (ref.widgetId != null ? String(ref.widgetId) : null),
    tableVariable,
    column,
  };
}

/**
 * Чинит pk/fk/junction в settings relationship по реальным полям источников.
 */
export function normalizeRelationshipSettingsAgainstCanvas(settings, wm, tempMap = new Map()) {
  const next = { ...(settings || {}) };
  if (next.pk) next.pk = normalizeColRefAgainstCanvas(next.pk, wm, tempMap);
  if (Array.isArray(next.foreignKeys)) {
    next.foreignKeys = next.foreignKeys.map((fk) => {
      const normalized = normalizeColRefAgainstCanvas(fk, wm, tempMap);
      // Если колонка всё ещё не из списка полей — пробуем угадать FK
      const fkWidget = normalized.widgetId != null ? wm.getWidget(normalized.widgetId) : null;
      const fields = getWidgetFieldNames(fkWidget);
      if (normalized.column && fields.length && !fields.includes(normalized.column)) {
        const pkWidget = next.pk?.widgetId != null ? wm.getWidget(next.pk.widgetId) : null;
        const guessed = guessFkColumn(pkWidget, fkWidget);
        if (guessed) normalized.column = guessed;
      } else if (!normalized.column) {
        const pkWidget = next.pk?.widgetId != null ? wm.getWidget(next.pk.widgetId) : null;
        const guessed = guessFkColumn(pkWidget, fkWidget);
        if (guessed) normalized.column = guessed;
      }
      return normalized;
    });
  }
  if (next.left) next.left = normalizeColRefAgainstCanvas(next.left, wm, tempMap);
  if (next.right) next.right = normalizeColRefAgainstCanvas(next.right, wm, tempMap);
  if (next.junction && typeof next.junction === 'object') {
    const jWidgetId = resolveWidgetId(next.junction.widgetId, tempMap);
    const jWidget = jWidgetId != null ? wm.getWidget(jWidgetId) : null;
    const jFields = getWidgetFieldNames(jWidget);
    next.junction = {
      ...next.junction,
      widgetId: jWidgetId != null ? String(jWidgetId) : next.junction.widgetId,
      tableVariable: String(next.junction.tableVariable || '').trim() || getWidgetTableVariable(jWidget),
      leftColumn: matchColumnName(next.junction.leftColumn, jFields),
      rightColumn: matchColumnName(next.junction.rightColumn, jFields),
    };
  }
  if (!next.relationshipType) next.relationshipType = 'one-to-many';
  return next;
}

async function persistWidgetDataCode(modelId, widgetId, code) {
  if (!modelId || widgetId == null || !code?.trim()) return;
  try {
    await dataModelService.saveModelCode(
      modelId,
      { tabs: [{ name: 'Вкладка 1', content: code }], activeTab: 0 },
      false,
      widgetId,
    );
  } catch (e) {
    console.warn('[dataModelCanvasAi] DataCode save failed:', e);
  }
}

async function syncInteractiveSourceCode(widget, modelId) {
  const config = widget?.settings?.interactiveConfig;
  if (!config || widget.type !== 'data-source') return;
  try {
    const { code } = generateDataCodeFromConfig(config);
    if (code?.trim()) await persistWidgetDataCode(modelId, widget.id, code);
  } catch (e) {
    console.warn('[dataModelCanvasAi] interactive code sync failed:', e);
  }
}

async function syncRelationshipWidgetCode(widget, engine, modelId) {
  if (!widget || widget.type !== 'relationship') return;
  try {
    const sources = collectRelationshipTableSources(widget, engine.widgetManager);
    const code = generateRelationshipDataCode(widget.settings || {}, {
      sources,
      widgetManager: engine.widgetManager,
    });
    if (code?.trim()) await persistWidgetDataCode(modelId, widget.id, code);
  } catch (e) {
    console.warn('[dataModelCanvasAi] relationship code sync failed:', e);
  }
}

async function syncProcessingOrFormulaCode(widget, engine, modelId) {
  if (!widget) return;
  const isProc = widget.type === 'processing-block';
  const isFormula = widget.type === 'formula';
  if (!isProc && !isFormula) return;
  try {
    const code = resolveWidgetDataCodeContent(widget, '', engine.widgetManager);
    if (code?.trim()) await persistWidgetDataCode(modelId, widget.id, code);
  } catch (e) {
    console.warn('[dataModelCanvasAi] processing/formula code sync failed:', e);
  }
}

/**
 * После всех правок — ещё раз нормализовать relationship и пересобрать DataCode.
 */
export async function repairRelationshipWidgets(engine, { modelId = null, tempMap = new Map() } = {}) {
  const wm = engine?.widgetManager;
  if (!wm) return;
  const relationships = (wm.getAllWidgets?.() || []).filter((w) => w.type === 'relationship');
  for (const widget of relationships) {
    widget.settings = normalizeRelationshipSettingsAgainstCanvas(widget.settings || {}, wm, tempMap);
    if (typeof widget.render === 'function') widget.render();
    eventBus.emit('widget:settings:changed', { widget });
    await syncRelationshipWidgetCode(widget, engine, modelId);
  }
}

/**
 * Apply one canvas proposal against WorkspaceEngine.
 * @returns {Promise<object>} proposal with updated status
 */
export async function applyCanvasProposal(engine, proposal, options = {}) {
  const { onAddWidget = null, tempMap = new Map(), modelId = null } = options;
  if (!engine?.widgetManager) {
    throw new Error('Движок полотна недоступен');
  }
  const wm = engine.widgetManager;
  const op = proposal.op;

  if (op === 'add_widget') {
    const type = proposal.widget_type || proposal.type;
    if (!type) throw new Error('Не указан widget_type');
    const idx = tempMap.size;
    const pos = placeNearExisting(engine, idx);
    let settings = proposal.settings || {};
    if (type === 'relationship') {
      settings = normalizeRelationshipSettingsAgainstCanvas(settings, wm, tempMap);
    }
    // Для interactive source — убедимся что table.name задан
    if (type === 'data-source' && settings.sourceType === 'interactive' && settings.interactiveConfig?.table) {
      const table = settings.interactiveConfig.table;
      if (!table.name && settings.name) {
        settings = {
          ...settings,
          interactiveConfig: {
            ...settings.interactiveConfig,
            table: {
              ...table,
              name: String(settings.name)
                .toLowerCase()
                .replace(/[^a-z0-9_]+/g, '_')
                .replace(/^_+|_+$/g, '') || 'table',
            },
          },
        };
      }
    }
    const config = {
      x: proposal.x ?? pos.x,
      y: proposal.y ?? pos.y,
      settings,
      ...(proposal.width ? { width: proposal.width } : {}),
    };
    let widget;
    if (typeof onAddWidget === 'function') {
      widget = await onAddWidget(type, config);
    } else {
      widget = engine.addWidget(type, config);
    }
    if (!widget) throw new Error('Не удалось добавить виджет');
    if (proposal.temp_id) tempMap.set(String(proposal.temp_id), String(widget.id));
    if (type === 'data-source') await syncInteractiveSourceCode(widget, modelId);
    if (type === 'relationship') await syncRelationshipWidgetCode(widget, engine, modelId);
    if (type === 'processing-block' || type === 'formula') {
      await syncProcessingOrFormulaCode(widget, engine, modelId);
    }
    return { ...proposal, status: 'applied', widget_id: String(widget.id) };
  }

  if (op === 'update_settings') {
    const widgetId = resolveWidgetId(proposal.widget_id, tempMap);
    const widget = wm.getWidget(widgetId);
    if (!widget) throw new Error(`Виджет ${widgetId} не найден`);
    let patch = proposal.settings_patch || proposal.settings || {};
    if (widget.type === 'relationship') {
      patch = normalizeRelationshipSettingsAgainstCanvas(
        { ...(widget.settings || {}), ...patch },
        wm,
        tempMap,
      );
      widget.settings = patch;
    } else {
      widget.settings = { ...(widget.settings || {}), ...patch };
    }
    if (typeof widget.render === 'function') widget.render();
    eventBus.emit('widget:settings:changed', { widget });
    if (widget.type === 'data-source') await syncInteractiveSourceCode(widget, modelId);
    if (widget.type === 'relationship') await syncRelationshipWidgetCode(widget, engine, modelId);
    if (widget.type === 'processing-block' || widget.type === 'formula') {
      await syncProcessingOrFormulaCode(widget, engine, modelId);
    }
    return { ...proposal, status: 'applied', widget_id: String(widget.id) };
  }

  if (op === 'move_widget') {
    const widgetId = resolveWidgetId(proposal.widget_id, tempMap);
    const widget = wm.getWidget(widgetId);
    if (!widget) throw new Error(`Виджет ${widgetId} не найден`);
    if (proposal.x != null && proposal.y != null && typeof widget.setPosition === 'function') {
      widget.setPosition(proposal.x, proposal.y);
    } else {
      if (proposal.x != null) widget.x = proposal.x;
      if (proposal.y != null) widget.y = proposal.y;
      if (typeof widget.updatePosition === 'function') widget.updatePosition();
    }
    eventBus.emit('widget:moved', { widget });
    return { ...proposal, status: 'applied' };
  }

  if (op === 'add_connection') {
    const fromId = resolveWidgetId(proposal.from_widget_id, tempMap);
    const toId = resolveWidgetId(proposal.to_widget_id, tempMap);
    const from = wm.getWidget(fromId);
    const to = wm.getWidget(toId);
    if (!from || !to) throw new Error(`Не найдены виджеты связи ${fromId} → ${toId}`);
    assertPortConnectionAllowed(from, to);
    const conn = wm.createConnection(from, to, 'output', 'input');
    if (!conn) throw new Error('Не удалось создать связь (ожидается output → input)');
    return { ...proposal, status: 'applied', connection_id: conn.id };
  }

  if (op === 'delete_widget') {
    const widgetId = resolveWidgetId(proposal.widget_id, tempMap);
    wm.deleteWidget(widgetId);
    return { ...proposal, status: 'applied' };
  }

  if (op === 'delete_connection') {
    if (!proposal.connection_id) throw new Error('Не указан connection_id');
    wm.deleteConnection(proposal.connection_id);
    return { ...proposal, status: 'applied' };
  }

  throw new Error(`Неизвестная операция: ${op}`);
}

export async function applyAllCanvasProposals(engine, proposals, options = {}) {
  const tempMap = options.tempMap || new Map();
  const results = [];
  for (const p of proposals || []) {
    if (p.status && p.status !== 'pending') {
      results.push(p);
      continue;
    }
    try {
      results.push(await applyCanvasProposal(engine, p, { ...options, tempMap }));
    } catch (e) {
      results.push({
        ...p,
        status: 'error',
        _error: e?.message || String(e),
      });
    }
  }
  // После всех ops — ещё раз починить FK/PK и DataCode relationship
  try {
    await repairRelationshipWidgets(engine, { modelId: options.modelId || null, tempMap });
  } catch (e) {
    console.warn('[dataModelCanvasAi] repairRelationshipWidgets failed:', e);
  }
  return results;
}

export function proposalLabel(p) {
  if (!p) return 'Изменение';
  switch (p.op) {
    case 'add_widget':
      if ((p.widget_type || p.type) === 'relationship') {
        return `Добавить связь сущностей: ${p.settings?.name || 'relationship'}`;
      }
      return `Добавить ${p.widget_type || 'виджет'}${p.settings?.name || p.settings?.blockType ? `: ${p.settings.name || p.settings.blockType}` : ''}`;
    case 'update_settings':
      return `Изменить настройки #${p.widget_id}`;
    case 'add_connection':
      return `Порт-связь ${p.from_widget_id} → ${p.to_widget_id}`;
    case 'delete_widget':
      return `Удалить виджет #${p.widget_id}`;
    case 'delete_connection':
      return `Удалить связь #${p.connection_id}`;
    case 'move_widget':
      return `Переместить #${p.widget_id}`;
    default:
      return p.op || 'Операция';
  }
}

/**
 * Фаза работы: scaffold (каркас) → configure (заполнение настроек).
 */
export function classifyCanvasPhase(text, ctx = {}) {
  const t = String(text || '').trim().toLowerCase();
  if (ctx.forcePhase) return ctx.forcePhase;
  // Без \b — в JS границы слов плохо работают с кириллицей
  if (/(заполни|заполнить|настрой|настроить|конфиг|параметр|условия фильтра|агрегац|формул)/i.test(t)) {
    return 'configure';
  }
  if (ctx.previousPhase === 'scaffold' && /^(да|ага|ок|хорошо|продолж|дальше|заполни)/i.test(t)) {
    return 'configure';
  }
  // Создание модели с нуля / добавление источников — сначала каркас
  if (/(создай модель|нужна модель|учёт|учет|расход|доход|с нуля|пуст)/i.test(t)) {
    return 'scaffold';
  }
  if (ctx.hasUnderfilledWidgets) return 'configure';
  return ctx.previousPhase === 'scaffold' ? 'configure' : 'scaffold';
}

/**
 * Виджеты обработки/формул без заполненных настроек.
 */
export function findUnderfilledWidgets(engine) {
  const widgets = engine?.widgetManager?.getAllWidgets?.() || [];
  const underfilled = [];
  for (const w of widgets) {
    const s = w.settings || {};
    if (w.type === 'processing-block') {
      const bt = s.blockType;
      if (bt === 'filter' && !(s.filterConditions?.length || s.filterGroups?.length)) {
        underfilled.push({ id: w.id, type: w.type, blockType: bt, name: s.name || 'Фильтр', reason: 'нет filterConditions' });
      } else if (bt === 'aggregate' && !(s.aggregateMetrics?.length || s.aggregateGroupBy?.length)) {
        underfilled.push({ id: w.id, type: w.type, blockType: bt, name: s.name || 'Агрегация', reason: 'нет aggregateMetrics/groupBy' });
      } else if (bt === 'transform' && !(s.transformOperations?.length)) {
        underfilled.push({ id: w.id, type: w.type, blockType: bt, name: s.name || 'Трансформация', reason: 'нет transformOperations' });
      } else if (bt === 'join' && !(s.joinSteps?.length)) {
        underfilled.push({ id: w.id, type: w.type, blockType: bt, name: s.name || 'Join', reason: 'нет joinSteps' });
      }
    } else if (w.type === 'formula' && !(s.expressions?.length) && !(s.variables?.length)) {
      underfilled.push({ id: w.id, type: w.type, name: s.name || 'Формула', reason: 'нет expressions/variables' });
    }
  }
  return underfilled;
}

function buildUpstreamFieldsHint(engine) {
  const widgets = engine?.widgetManager?.getAllWidgets?.() || [];
  return widgets.map((w) => {
    const fields = getWidgetFieldNames(w);
    const table = getWidgetTableVariable(w);
    const s = w.settings || {};
    return {
      id: String(w.id),
      type: w.type,
      blockType: s.blockType || null,
      name: s.name || w.title || '',
      tableVariable: table || null,
      columns: fields,
    };
  });
}

export const WIDGET_SETTINGS_CATALOG = `
## Каталог настроек виджетов (обязательно заполнять)

### data-source interactive
settings: {
  "name": "transactions",
  "sourceType": "interactive",
  "interactiveConfig": {
    "kind": "table",
    "table": {
      "name": "transactions",
      "fields": [
        {"name":"id","type":"int","nullable":false,"primaryKey":true,"unique":true,"defaultValue":""},
        {"name":"category_id","type":"int","nullable":false,"primaryKey":false,"unique":false,"defaultValue":""},
        {"name":"type","type":"string","nullable":false,"primaryKey":false,"unique":false,"defaultValue":""},
        {"name":"amount","type":"float","nullable":false,"primaryKey":false,"unique":false,"defaultValue":"0"},
        {"name":"date","type":"datetime","nullable":true,"primaryKey":false,"unique":false,"defaultValue":""},
        {"name":"description","type":"string","nullable":true,"primaryKey":false,"unique":false,"defaultValue":""}
      ],
      "rows": []
    }
  }
}
Типы полей ТОЛЬКО: string|int|float|bool|datetime|array|object|image|audio|video|file (НЕ number/date/boolean).

### processing-block filter
settings: {
  "name":"Только расходы","blockType":"filter",
  "filterLogic":"and",
  "filterConditions":[{"id":"c1","field":"type","operator":"eq","value":"Расход"}],
  "filterGroups":[],
  "filterSeparateOutput":false
}
operators: eq|ne|gt|lt|gte|lte|contains|startsWith|endsWith|between|in|notIn
field — ТОЧНОЕ имя колонки upstream.

### processing-block aggregate
settings: {
  "name":"Сумма по категориям","blockType":"aggregate",
  "aggregateGroupBy":[{"id":"g1","field":"category_id"}],
  "aggregateMetrics":[{"id":"m1","enabled":true,"field":"amount","func":"sum","alias":"sum_amount","resultType":"float"}],
  "aggregateSeparateOutput":false
}
func: count|count_distinct|sum|avg|min|max|first|last|median|mode|stddev|variance|percentile|list|any

### processing-block transform
settings: {
  "name":"Трансформация","blockType":"transform",
  "transformOperations":[{"id":"op1","type":"renameColumn","enabled":true,"params":{"column":"old","newName":"new"}}],
  "transformSeparateOutput":false
}

### processing-block join
settings: {
  "name":"Объединение","blockType":"join","joinMode":"join","joinType":"left",
  "joinSeparateOutput":true,
  "joinSteps":[{"id":"js1","connectionId":null,"rightTableVariable":"orders","keys":[{"leftColumn":"id","rightColumn":"user_id"}],"asofColumn":"","asofBy":"","asofDirection":"backward"}]
}

### formula
settings: {
  "name":"Баланс",
  "expressions":[{"name":"balance","expression":"amount"}],
  "variables":[{"name":"suma","kind":"aggregate","func":"sum","field":"amount","exportGlobal":true}],
  "availableFields":["amount","type"]
}

### relationship
settings: {
  "name":"Категории → Транзакции","relationshipType":"one-to-many",
  "pk":{"widgetId":"<id>","tableVariable":"categories","column":"id"},
  "foreignKeys":[{"id":"fk1","widgetId":"<id>","tableVariable":"transactions","column":"category_id"}]
}
`.trim();

/**
 * System instructions for structured canvas replies.
 * @param {'act'|'describe'|'help'} intent
 * @param {'scaffold'|'configure'} [phase]
 */
export function buildCanvasResponseProtocol(intent, phase = 'scaffold') {
  const modeHint = intent === 'act'
    ? 'mode ОБЯЗАТЕЛЬНО "act".'
    : intent === 'describe'
      ? 'mode = "describe". proposals обычно [].'
      : 'mode = "help". Можно краткий план и при уверенности — proposals.';

  const phaseHint = phase === 'configure'
    ? `phase ОБЯЗАТЕЛЬНО "configure".
Сейчас НУЖНО только заполнить настройки уже существующих виджетов через update_settings.
НЕ создавай новые виджеты без крайней необходимости.
Для каждого underfilled processing-block / formula дай update_settings с ПОЛНЫМ settings_patch из каталога (filterConditions / aggregateMetrics / expressions и т.д.).
field/column бери ТОЛЬКО из списка columns upstream в снимке графа.`
    : `phase ОБЯЗАТЕЛЬНО "scaffold" (каркас модели).
Порядок: 1) interactive источники с полями 2) relationship + порт-связи источников→relationship
3) processing/formula виджеты МОЖНО добавить, но ЛУЧШЕ с уже заполненными settings из каталога
4) порт-связи потока данных.
Если добавляешь filter/aggregate/formula — сразу клади полные settings (не пустой blockType-only).
После scaffold пользователь отдельно запросит configure, если что-то останется пустым.`;

  return `
## Формат ответа (обязательно)
Верни ТОЛЬКО один JSON-объект (без markdown вне JSON):
{
  "mode": "help" | "describe" | "act",
  "phase": "scaffold" | "configure",
  "summary": "текст на русском",
  "proposals": [ /* операции */ ]
}

Операции:
- {"op":"update_settings","widget_id":"<id>","settings_patch":{...},"reason":"..."}
- {"op":"add_widget","temp_id":"t1","widget_type":"...","settings":{...},"reason":"..."}
- {"op":"add_connection","from_widget_id":"<id|temp_id>","to_widget_id":"<id|temp_id>","reason":"..."}
- {"op":"delete_widget","widget_id":"<id>","reason":"..."}
- {"op":"move_widget","widget_id":"<id>","x":number,"y":number,"reason":"..."}

## Фаза: ${phase}
${phaseHint}

## Критично: связи
- Порт-связь: источник → processing-block | formula | relationship.
- ЗАПРЕЩЕНО: data-source ↔ data-source / data-model.
- Entity FK: виджет relationship + порт-связи источников → relationship.

## Критично: имена колонок
- Копируй БУКВАЛЬНО из columns= / fields снимка. Не укорачивай (category_id ≠ categori).

${WIDGET_SETTINGS_CATALOG}

${modeHint}
Не выдумывай id. Для новых виджетов — temp_id.
`.trim();
}

/**
 * Нормализует ответ модели (включая phase).
 */
export function parseCanvasAiReply(rawContent, fallbackMode = 'help', fallbackPhase = 'scaffold') {
  const parsed = extractJsonObject(rawContent);
  if (!parsed) {
    return {
      mode: fallbackMode,
      phase: fallbackPhase,
      summary: String(rawContent || '').trim(),
      proposals: [],
      structured: false,
    };
  }

  const mode = ['act', 'describe', 'help'].includes(parsed.mode)
    ? parsed.mode
    : fallbackMode;
  const phase = ['scaffold', 'configure'].includes(parsed.phase)
    ? parsed.phase
    : fallbackPhase;

  const summary = String(
    parsed.summary || parsed.content || parsed.message || '',
  ).trim() || String(rawContent || '').trim();

  const proposals = Array.isArray(parsed.proposals)
    ? parsed.proposals
      .filter((p) => p && CANVAS_OPS.includes(p.op))
      .map((p, i) => ({
        ...p,
        id: p.id || `canvas-${Date.now()}-${i}`,
        status: 'pending',
        _canvas: true,
      }))
    : [];

  return { mode, phase, summary, proposals, structured: true };
}

export function buildConfigurePromptExtras(engine, underfilled) {
  const catalog = buildUpstreamFieldsHint(engine);
  return [
    '## Задача фазы configure',
    'Заполни настройки этих виджетов через update_settings (полные settings_patch):',
    JSON.stringify(underfilled, null, 2),
    '## Доступные виджеты и колонки на полотне',
    JSON.stringify(catalog, null, 2),
  ].join('\n');
}
