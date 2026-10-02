/**
 * Intent classification, structured reply parsing, sheet snapshot, and local
 * proposal apply for DashboardAiAssistant.
 */

import { eventBus } from '../src/core/EventBus.js';
import { applyDataFieldToWidget } from '../../../services/dashboardFilterUtils.js';
import { getDashboardFilterSnapshot } from '../../../services/dashboardFilterTransport.js';

export const DASHBOARD_OPS = [
  'add_widget',
  'update_settings',
  'update_styles',
  'copy_styles',
  'move_resize',
  'delete_widget',
  'bind_field',
];

/** Visual settings keys safe to copy between widgets (not data bindings). */
export const VISUAL_SETTINGS_KEYS = [
  'backgroundColor',
  'titleColor',
  'valueColor',
  'deltaColor',
  'titleSize',
  'showTitle',
  'kpiBackgroundMode',
  'kpiBackgroundRules',
  'kpiBackgroundDefaultColor',
  'kpiBackgroundDeltaNegativeColor',
  'kpiBackgroundDeltaPositiveColor',
  'barColorMode',
  'barPalette',
  'colors',
  'columnHeaderBackgroundColor',
  'cellPaddingX',
  'buttonStyle',
  'defaultButtonStyle',
  'fontSize',
  'fontFamily',
  'color',
  'align',
];

export const ALLOWED_WIDGET_TYPES = [
  'kpi',
  'table',
  'line-chart',
  'bar-chart',
  'pie-chart',
  'gauge',
  'text',
  'filter',
  'html',
  'image',
  'container',
  'button-widget',
  'data-input',
];

const ACT_RE = /(сделай|сделать|измени|изменить|добавь|добавить|переделай|переделать|примени|применить|создай|создать|настрой|настроить|удали|удалить|улучши|улучшить|переставь|переставить|размести|разместить|обнови|обновить|выполни|выполнить|оформи|оформить|стилизуй|стилизовать|дизай|скопируй\s+стиль|перенеси\s+стиль|перенести\s+стиль|сделай\s+красив)/i;
const DESCRIBE_RE = /(опиши|описать|что на полотне|что здесь|расскажи о дашборде|покажи структуру|что у меня|какие виджеты)/i;
const ANALYZE_RE = /(анализ|проанализируй|проанализировать|что показывает|какие значения|совет|посоветуй|вывод|инсайт|тренд|сравни)/i;
const HELP_RE = /(помоги|помощь|как |объясни|подскажи|что делать|инструкц)/i;
const SELF_DO_RE = /(сам|сама|само|автоматически|за меня|без меня|можешь это|сделай это|примени это|да\,?\s*сделай|ок\,?\s*сделай)/i;

/**
 * @param {string} text
 * @param {{ previousMode?: string|null, hasAttachedWidgets?: boolean, surface?: 'editor'|'viewer' }} [ctx]
 * @returns {'act'|'describe'|'analyze'|'help'}
 */
export function classifyDashboardIntent(text, ctx = {}) {
  const t = String(text || '').trim();
  if (!t) return ctx.surface === 'viewer' ? 'analyze' : 'help';

  const surface = ctx.surface === 'viewer' ? 'viewer' : 'editor';

  if (surface === 'viewer') {
    if (DESCRIBE_RE.test(t)) return 'describe';
    if (ANALYZE_RE.test(t) || HELP_RE.test(t) || t.length > 8) return 'analyze';
    return 'analyze';
  }

  // «Как добавить…» — help, не act (глагол внутри how-to)
  if (/^как\s/i.test(t) && !SELF_DO_RE.test(t)) return 'help';

  if (SELF_DO_RE.test(t) || ACT_RE.test(t)) return 'act';
  if (ctx.previousMode === 'act' && /^(да|ага|ок|хорошо|сделай|давай|конечно|yes|yep)/i.test(t)) {
    return 'act';
  }
  if (ANALYZE_RE.test(t)) return 'analyze';
  if (DESCRIBE_RE.test(t)) return 'describe';
  if (HELP_RE.test(t)) return 'help';
  if (ctx.hasAttachedWidgets && t.length > 12) return 'act';
  return 'help';
}

/**
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

export function safeJson(value, maxLen = 1800) {
  try {
    const s = JSON.stringify(value);
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}…`;
  } catch {
    return String(value);
  }
}

function resolveWidgetId(id, tempMap) {
  if (id == null) return null;
  const key = String(id);
  if (tempMap.has(key)) return tempMap.get(key);
  return key;
}

function placeNearExisting(engine, index = 0) {
  const widgets = engine?.widgetManager?.getAllWidgets?.() || [];
  if (!widgets.length) return { x: 80 + index * 40, y: 80 + index * 40 };
  let maxX = 0;
  let avgY = 0;
  widgets.forEach((w) => {
    maxX = Math.max(maxX, (w.x || 0) + (w.width || 280));
    avgY += w.y || 0;
  });
  avgY = Math.round(avgY / widgets.length);
  return { x: maxX + 40, y: Math.max(40, avgY + index * 32) };
}

function widgetTitle(w) {
  if (!w) return '';
  const s = w.settings || {};
  return String(s.title || s.name || w.title || w.name || w.type || '').trim();
}

function stripHeavySettings(settings) {
  if (!settings || typeof settings !== 'object') return {};
  const next = { ...settings };
  delete next.data;
  delete next._cache;
  delete next._lastRows;
  delete next.__aiLive;
  // Keep value for KPI/gauge (display), but cap long strings
  Object.keys(next).forEach((k) => {
    const v = next[k];
    if (typeof v === 'string' && v.length > 400) next[k] = `${v.slice(0, 400)}…`;
    if (Array.isArray(v) && v.length > 30 && k !== 'filters') {
      next[k] = v.slice(0, 8);
      next[`${k}__truncated`] = v.length;
    }
  });
  return next;
}

function summarizeLiveForWidget(w) {
  if (!w) return null;
  const s = w.settings || {};
  const type = w.type;
  if (type === 'kpi' || type === 'gauge') {
    return {
      kind: type,
      title: widgetTitle(w),
      value: s.value != null ? String(s.value) : null,
      delta: s.delta != null ? String(s.delta) : null,
    };
  }
  if (type === 'line-chart' || type === 'bar-chart' || type === 'pie-chart') {
    const data = Array.isArray(s.data) ? s.data : [];
    return {
      kind: type,
      title: widgetTitle(w),
      points: data.length,
      sample: data.slice(0, 15),
    };
  }
  if (type === 'table') {
    const data = Array.isArray(s.data) ? s.data : [];
    return {
      kind: 'table',
      title: widgetTitle(w),
      rowCount: data.length,
      sample: data.slice(0, 5),
    };
  }
  if (type === 'text' || type === 'html') {
    const content = String(s.text || s.html || s.content || '').trim();
    return {
      kind: type,
      title: widgetTitle(w),
      content: content.length > 300 ? `${content.slice(0, 300)}…` : content || null,
    };
  }
  return {
    kind: type,
    title: widgetTitle(w),
  };
}

function summarizeActiveFilters(engine) {
  try {
    const snap = getDashboardFilterSnapshot(engine, { force: true });
    const descriptors = Array.isArray(snap?.descriptors) ? snap.descriptors : [];
    const active = [];
    for (const d of descriptors) {
      const selected = Array.isArray(d.selectedValues)
        ? d.selectedValues.filter((x) => x !== '' && x != null)
        : [];
      const excluded = Array.isArray(d.excludedValues)
        ? d.excludedValues.filter((x) => x !== '' && x != null)
        : [];
      const pattern = d.pattern != null ? String(d.pattern).trim() : '';
      const hasRange = d.rangeMin != null || d.rangeMax != null;
      if (!selected.length && !excluded.length && !pattern && !hasRange) continue;
      active.push({
        modelId: d.modelId,
        table: d.table,
        field: d.field || d.column,
        selected: selected.slice(0, 20),
        excluded: excluded.slice(0, 20),
        pattern: pattern || null,
        rangeMin: d.rangeMin ?? null,
        rangeMax: d.rangeMax ?? null,
      });
    }
    const sql = Array.isArray(snap?.sqlPredicates) ? snap.sqlPredicates.slice(0, 40) : [];
    return { active, sqlPredicates: sql, count: active.length };
  } catch (e) {
    return { active: [], sqlPredicates: [], count: 0, error: e?.message || String(e) };
  }
}

function normalizeLinkedModelsList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.data_models)) return raw.data_models;
  return [];
}

function collectModelIdsFromWidgets(widgets, filters) {
  const ids = new Set();
  const push = (v) => {
    if (v == null || v === '') return;
    ids.add(String(v));
  };
  for (const w of widgets || []) {
    push(w?.dataSource?.modelId ?? w?.dataSource?.model_id);
    push(w?.settings?.modelId ?? w?.settings?.model_id);
    const bindings = w?.settings?.filters;
    if (Array.isArray(bindings)) {
      for (const f of bindings) push(f?.modelId ?? f?.model_id);
    }
  }
  for (const f of filters?.active || []) {
    push(f?.modelId);
  }
  for (const p of filters?.sqlPredicates || []) {
    push(p?.modelId ?? p?.model_id);
  }
  return [...ids];
}

function summarizeLinkedDataModels(engine, widgets, filters, opts = {}) {
  const linked = normalizeLinkedModelsList(
    opts.linkedModels ?? engine?.__linkedDataModels,
  );
  if (linked.length) {
    return linked.slice(0, 40).map((m) => {
      const id = m?.id ?? m?.model_id ?? m?.modelId;
      const name = m?.name || m?.title || m?.label || `модель #${id}`;
      const desc = m?.description || m?.comment || '';
      const tables = Array.isArray(m?.tables)
        ? m.tables.map((t) => (typeof t === 'string' ? t : t?.name)).filter(Boolean)
        : [];
      const bits = [`- «${name}» (id=${id ?? '?'})`];
      if (desc) bits.push(`  описание: ${String(desc).slice(0, 160)}`);
      if (tables.length) bits.push(`  таблицы: ${tables.slice(0, 20).join(', ')}`);
      return bits.join('\n');
    }).join('\n');
  }
  const ids = collectModelIdsFromWidgets(widgets, filters);
  if (!ids.length) return 'Не указаны (нет linked models и modelId на виджетах/фильтратрах).';
  return ids.map((id) => `- модель данных #${id} (из виджетов/фильтров; имя неизвестно)`).join('\n');
}

/**
 * True when the user needs field names/types (not row data) for detailed analysis / binding.
 * @param {string} text
 * @param {{ intent?: string }} [ctx]
 */
export function needsModelSchema(text, ctx = {}) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (
    /схем\w*|schema|полей|поля\b|колонк|таблиц|тип(?:ы|ов)?\s*данн|структур\w*\s+модел|какие\s+поля|какие\s+колонк|какие\s+таблиц|привяз|bind_field|valueField|xField|yField|формул|агрегац|группир|деталн\w*.{0,24}анализ|проанализируй.{0,60}модел|из\s+модел|по\s+модел|добавь\s+(?:kpi|график|таблиц|chart|диаграмм)|создай\s+(?:kpi|график|таблиц)/i.test(
      t,
    )
  ) {
    return true;
  }
  // act with data-ish verbs often needs fields to propose bind_field
  if (ctx.intent === 'act' && /kpi|chart|таблиц|фильтр|показател|метрик|сумм|средн|count/i.test(t)) {
    return true;
  }
  if (ctx.intent === 'analyze' && /модел|данн|показател|метрик|по\s+полям/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * Compact schema for LLM: table/field names + types only (no row values).
 * @param {{ tables?: Array, fields?: Array, models?: Array }|null} schema
 * @param {{ maxModels?: number, maxTablesPerModel?: number, maxFieldsPerTable?: number, modelIds?: Array<string|number>|null }} [opts]
 */
export function formatModelSchemaForPrompt(schema, opts = {}) {
  if (!schema) return '';
  const {
    maxModels = 8,
    maxTablesPerModel = 24,
    maxFieldsPerTable = 80,
    modelIds = null,
  } = opts;

  const allow = modelIds == null
    ? null
    : new Set((modelIds || []).map((id) => String(id)));

  const modelsMeta = Array.isArray(schema.models) ? schema.models : [];
  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  const tables = Array.isArray(schema.tables) ? schema.tables : [];

  // Group fields by modelId → tableName
  /** @type {Map<string, { name: string, schemaOk: boolean, schemaError: string|null, tables: Map<string, Array<{ name: string, type: string }>> }>} */
  const byModel = new Map();

  const ensureModel = (id, name, schemaOk = true, schemaError = null) => {
    const key = String(id);
    if (allow && !allow.has(key)) return null;
    if (!byModel.has(key)) {
      byModel.set(key, {
        name: name || `модель #${id}`,
        schemaOk,
        schemaError,
        tables: new Map(),
      });
    }
    return byModel.get(key);
  };

  for (const m of modelsMeta) {
    ensureModel(m.id, m.name, m.schemaOk !== false, m.schemaError || null);
  }

  for (const t of tables) {
    const mod = ensureModel(t.modelId, t.modelName);
    if (!mod || !mod.schemaOk) continue;
    if (!mod.tables.has(t.tableName)) mod.tables.set(t.tableName, []);
  }

  for (const f of fields) {
    const mod = ensureModel(f.modelId, f.modelName);
    if (!mod || !mod.schemaOk) continue;
    const tableName = f.tableName || 'unknown';
    if (!mod.tables.has(tableName)) mod.tables.set(tableName, []);
    const cols = mod.tables.get(tableName);
    if (cols.length >= maxFieldsPerTable) continue;
    const type = f.sqliteType || f.type || 'unknown';
    cols.push({ name: f.name, type: String(type) });
  }

  const modelEntries = [...byModel.entries()].slice(0, maxModels);
  if (!modelEntries.length) {
    return 'Схема полей недоступна (нет подключённых моделей или SQLite schema).';
  }

  const lines = [
    'Схема полей подключённых моделей (только имена и типы; строк данных НЕТ):',
  ];

  for (const [id, mod] of modelEntries) {
    if (!mod.schemaOk) {
      lines.push(`- «${mod.name}» (id=${id}): схема недоступна${mod.schemaError ? ` — ${mod.schemaError}` : ''}`);
      continue;
    }
    lines.push(`- «${mod.name}» (id=${id}):`);
    const tableEntries = [...mod.tables.entries()].slice(0, maxTablesPerModel);
    if (!tableEntries.length) {
      lines.push('  (таблиц нет)');
      continue;
    }
    for (const [tableName, cols] of tableEntries) {
      lines.push(`  таблица ${tableName}:`);
      if (!cols.length) {
        lines.push('    (поля не загружены)');
        continue;
      }
      for (const col of cols) {
        lines.push(`    - ${col.name}: ${col.type}`);
      }
      if ((mod.tables.get(tableName) || []).length >= maxFieldsPerTable) {
        lines.push(`    … (обрезано до ${maxFieldsPerTable} полей)`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Normalize getDashboardSchema() result into a plain cacheable object (no Map).
 * @param {{ tables?: Array, fields?: Array, models?: Array }|null} schema
 */
export function serializeDashboardSchema(schema) {
  if (!schema) return null;
  return {
    tables: Array.isArray(schema.tables) ? schema.tables : [],
    fields: Array.isArray(schema.fields) ? schema.fields : [],
    models: Array.isArray(schema.models) ? schema.models : [],
  };
}

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    if (value && typeof value === 'object') return { ...value };
    return value;
  }
}

function pickVisualSettings(settings) {
  const src = settings && typeof settings === 'object' ? settings : {};
  const out = {};
  for (const key of VISUAL_SETTINGS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) {
      out[key] = cloneJson(src[key]);
    }
  }
  return out;
}

/**
 * Compact sheet snapshot for the LLM system context.
 * @param {object} engine
 * @param {{ dashboardName?: string, dashboardId?: any, sheetId?: any, includeLive?: boolean, maxWidgets?: number, linkedModels?: any, modelSchema?: any, includeModelSchema?: boolean }} [opts]
 */
export function summarizeDashboardSheet(engine, opts = {}) {
  const {
    dashboardName = '',
    dashboardId = null,
    sheetId = null,
    includeLive = true,
    maxWidgets = 80,
  } = opts;

  if (!engine?.widgetManager) {
    return 'Снимок листа недоступен (движок ещё инициализируется).';
  }

  try {
    const widgets = engine.widgetManager.getAllWidgets?.() || [];
    const list = widgets.slice(0, maxWidgets);
    const widgetLines = list.map((w) => {
      const s = stripHeavySettings(w.settings || {});
      const styles = w.styles && typeof w.styles === 'object'
        ? safeJson(w.styles, 1600)
        : null;
      const ds = w.dataSource != null ? safeJson(w.dataSource, 500) : null;
      const lines = [
        `- id=${w.id}, type=${w.type}, title=${widgetTitle(w) || '—'}, x=${Math.round(w.x || 0)}, y=${Math.round(w.y || 0)}, w=${Math.round(w.width || 0)}, h=${Math.round(w.height || 0)}`,
        `  settings=${safeJson(s, 1200)}`,
      ];
      if (ds) lines.push(`  dataSource=${ds}`);
      if (styles) lines.push(`  styles=${styles}`);
      if (includeLive) {
        const live = summarizeLiveForWidget(w);
        if (live) lines.push(`  live=${safeJson(live, 900)}`);
      }
      return lines.join('\n');
    });

    const filters = summarizeActiveFilters(engine);
    const linkedBlock = summarizeLinkedDataModels(engine, widgets, filters, opts);
    const schemaSource = opts.modelSchema ?? engine?.__dashboardModelSchema ?? null;
    const schemaBlock = opts.includeModelSchema
      ? formatModelSchemaForPrompt(schemaSource)
      : '';
    const vars = {
      runtimeParams: typeof engine.getRuntimeParams === 'function' ? engine.getRuntimeParams() : null,
      dashboardVariables: engine.dashboardVariables || null,
    };

    return [
      `Дашборд: «${dashboardName || 'без имени'}» (id=${dashboardId ?? '?'})`,
      `Лист id=${sheetId ?? '?'}`,
      `Режим движка: ${engine.mode || '?'}`,
      `Подключённые модели данных:\n${linkedBlock}`,
      schemaBlock || null,
      `Виджетов: ${widgets.length}${widgets.length > maxWidgets ? ` (в снимке первые ${maxWidgets})` : ''}`,
      widgetLines.length ? `Виджеты:\n${widgetLines.join('\n')}` : 'Виджетов пока нет.',
      `Активные фильтры: ${filters.count}`,
      filters.count
        ? `Фильтры:\n${safeJson(filters.active, 2500)}`
        : 'Фильтры не выбраны (или нет ограничений).',
      `Переменные/параметры: ${safeJson(vars, 800)}`,
    ].filter(Boolean).join('\n');
  } catch (e) {
    return `Не удалось снять снимок листа: ${e?.message || e}`;
  }
}

export const DASHBOARD_WIDGET_CATALOG = `
## Типы виджетов и зачем они нужны (widget_type)
- kpi — числовой показатель (сумма/среднее/формула). settings: title, valueField/valueFormula, aggregation (sum|avg|count|min|max), kpiMode (simple|formula), titleSize, showTitle; цвета: backgroundColor, titleColor, valueColor, deltaColor; фон: kpiBackgroundMode (solid|rules|delta) + kpiBackgroundRules[].
- table — таблица строк. settings: title, columns, limit, columnHeaderBackgroundColor, cellPaddingX, titleColor.
- line-chart / bar-chart / pie-chart — графики. settings: title, xField/yField или dataSource; bar: barColorMode (solid|palette|gradient), barPalette[]; pie: colors[]; line: цвета серий в settings.
- gauge — шкала/спидометр. settings: title, value, min, max.
- text / html — текст или HTML. settings: text|content|html; цвет/шрифт лучше через styles.typography.
- filter — фильтр по полю модели. settings: filters[] { modelId, table, field }, buttonStyle { background, color, hoverBackground, borderRadius, … }, titleColor.
- image — картинка.
- container — группировка/рамка.
- button-widget — кнопки действий. settings: defaultButtonStyle + кнопки со style.
- data-input — форма ввода в модель. settings: modelId/table/fields.

dataSource часто: { modelId, table, field } или объект привязки. Не выдумывай modelId вне блока «Подключённые модели».
Поля/типы бери только из блока «Схема полей…» в снимке (если он есть). Никогда не включай и не проси строки данных.

## Схема styles (общая оболочка виджета)
styles = {
  appearance: { backgroundType: "solid"|"gradient"|"glass", backgroundColor, opacity, gradient?: { type, angle, color1, color2 }, glassBlur?, glassOpacity? },
  typography: { fontFamily, fontWeight, fontSize, letterSpacing, lineHeight, color, textShadow? },
  borders: { width, style, color, radius, neonGlow?: { enabled, intensity, spread, color } },
  shadows: [{ enabled, x, y, blur, spread, color }],
  layout: { alignment?: { horizontal, vertical } },
  animations?: { enabled, type, duration, easing, delay, loop },
  advancedCSS?: { custom }
}
Тип-специфичный вид (KPI fill, палитры chart, filter buttonStyle) — в settings, не в styles.

## Дизайн (обязательно учитывай)
- Сетка ~40px, зазоры 16–24px; KPI ряд сверху, крупные chart/table ниже.
- Единый визуальный язык: 1–2 акцента, согласованный radius (8–16), одна семья шрифтов.
- Акценты платформы: #00E0FF, #3D8BFF, #2D6BFF; текст на тёмном #E4E6EB; приглушённый #B0B3B8.
- Шрифты: Inter / Roboto / JetBrains Mono (не выдумывай экзотику).
- Красивый виджет = согласованные styles + визуальные settings (цвета KPI/chart), не только координаты.
- «Сделай красиво / оформи» → mode=act с update_styles (+ update_settings для цветов KPI/chart при необходимости).
- «Скопируй стиль с A на остальные / как у этого» → op copy_styles (source_widget_id + target_widget_ids). Если пользователь выбрал виджеты в фокусе: первый = источник, остальные = цели (если не сказано иначе).
`.trim();

/**
 * @param {'act'|'describe'|'analyze'|'help'} intent
 * @param {'editor'|'viewer'} surface
 */
export function buildDashboardResponseProtocol(intent, surface = 'editor') {
  if (surface === 'viewer') {
    return `
## Формат ответа (обязательно)
Верни ТОЛЬКО один JSON-объект:
{
  "mode": "analyze" | "help" | "describe",
  "summary": "текст на русском (советы, выводы по live-значениям и фильтрам)",
  "proposals": []
}

ЗАПРЕЩЕНО менять layout. proposals всегда [].
Опирайся на блок live=, подключённые модели и активные фильтры. Не выдумывай числа, которых нет в снимке.
mode сейчас ожидается: "${intent === 'describe' ? 'describe' : intent === 'help' ? 'help' : 'analyze'}".
`.trim();
  }

  const modeHint = intent === 'act'
    ? 'mode ОБЯЗАТЕЛЬНО "act". Дай конкретные proposals. Пользователь применит кнопкой «Применить». Для дизайна предпочитай update_styles / copy_styles / add_widget со styles.'
    : intent === 'describe'
      ? 'mode = "describe". proposals обычно [].'
      : intent === 'analyze'
        ? 'mode = "analyze". proposals обычно []. Можно кратко описать, что показывают виджеты.'
        : 'mode = "help". Дай совет текстом. proposals=[] если пользователь НЕ просил явно сделать изменения. Если спрашивают КАК оформить — опиши шаги; если просят СДЕЛАТЬ красиво — это act.';

  return `
## Формат ответа (обязательно)
Верни ТОЛЬКО один JSON-объект (без markdown вне JSON):
{
  "mode": "help" | "describe" | "analyze" | "act",
  "summary": "текст на русском",
  "proposals": [ /* только при mode=act */ ]
}

Операции (только editor + act):
- {"op":"add_widget","temp_id":"t1","widget_type":"kpi","x":80,"y":80,"width":240,"height":140,"settings":{...},"styles":{...},"reason":"..."}
- {"op":"update_settings","widget_id":"<id>","settings_patch":{...},"reason":"..."}
- {"op":"update_styles","widget_id":"<id>","styles_patch":{ appearance:{...}, typography:{...}, borders:{...}, shadows:[...] },"reason":"..."}
- {"op":"copy_styles","source_widget_id":"<id>","target_widget_ids":["<id2>","<id3>"],"include_visual_settings":true,"reason":"перенести дизайн"}
- {"op":"move_resize","widget_id":"<id>","x":0,"y":0,"width":300,"height":200,"reason":"..."}
- {"op":"delete_widget","widget_id":"<id>","reason":"..."}
- {"op":"bind_field","widget_id":"<id>","modelId":1,"tableName":"orders","fieldName":"amount","type":"float","reason":"..."}

Не выдумывай id существующих виджетов. Для новых — temp_id.
При help/describe/analyze не предлагай destructive ops без явной просьбы.
Для copy_styles: копирует styles целиком; при include_visual_settings=true также безопасные визуальные settings (цвета/палитры), без dataSource и привязок полей.

${DASHBOARD_WIDGET_CATALOG}

${modeHint}
`.trim();
}

/**
 * @param {string} rawContent
 * @param {string} [fallbackMode]
 * @param {'editor'|'viewer'} [surface]
 */
export function parseDashboardAiReply(rawContent, fallbackMode = 'help', surface = 'editor') {
  const parsed = extractJsonObject(rawContent);
  if (!parsed) {
    return {
      mode: fallbackMode,
      summary: String(rawContent || '').trim(),
      proposals: [],
      structured: false,
    };
  }

  let mode = ['act', 'describe', 'analyze', 'help'].includes(parsed.mode)
    ? parsed.mode
    : fallbackMode;

  if (surface === 'viewer' && mode === 'act') {
    mode = 'analyze';
  }

  const summary = String(
    parsed.summary || parsed.content || parsed.message || '',
  ).trim() || String(rawContent || '').trim();

  let proposals = Array.isArray(parsed.proposals)
    ? parsed.proposals
      .filter((p) => p && DASHBOARD_OPS.includes(p.op))
      .map((p, i) => ({
        ...p,
        id: p.id || `dash-${Date.now()}-${i}`,
        status: 'pending',
        _dashboard: true,
      }))
    : [];

  // Hybrid: only keep proposals for act in editor
  if (surface === 'viewer' || mode !== 'act') {
    proposals = [];
  }

  return { mode, summary, proposals, structured: true };
}

export function proposalLabel(p) {
  if (!p) return 'Изменение';
  switch (p.op) {
    case 'add_widget':
      return `Добавить ${p.widget_type || 'виджет'}${p.settings?.title ? `: ${p.settings.title}` : ''}`;
    case 'update_settings':
      return `Настройки #${p.widget_id}`;
    case 'update_styles':
      return `Стили #${p.widget_id}`;
    case 'copy_styles': {
      const targets = Array.isArray(p.target_widget_ids)
        ? p.target_widget_ids
        : (p.target_widget_id != null ? [p.target_widget_id] : []);
      return `Стиль #${p.source_widget_id} → ${targets.map((id) => `#${id}`).join(', ') || '…'}`;
    }
    case 'move_resize':
      return `Позиция/размер #${p.widget_id}`;
    case 'delete_widget':
      return `Удалить #${p.widget_id}`;
    case 'bind_field':
      return `Привязать ${p.tableName || ''}.${p.fieldName || ''} → #${p.widget_id}`;
    default:
      return p.op || 'Операция';
  }
}

/**
 * @returns {Promise<object>} proposal with updated status
 */
export async function applyDashboardProposal(engine, proposal, options = {}) {
  const { tempMap = new Map() } = options;
  if (!engine?.widgetManager) {
    throw new Error('Движок полотна недоступен');
  }
  if (engine.mode === 'viewer') {
    throw new Error('В режиме просмотра нельзя менять layout');
  }

  const wm = engine.widgetManager;
  const op = proposal.op;

  if (op === 'add_widget') {
    const type = proposal.widget_type || proposal.type;
    if (!type) throw new Error('Не указан widget_type');
    if (!ALLOWED_WIDGET_TYPES.includes(type) && !engine.widgetClasses?.[type]) {
      throw new Error(`Неизвестный тип виджета: ${type}`);
    }
    const idx = tempMap.size;
    const pos = placeNearExisting(engine, idx);
    const config = {
      x: proposal.x ?? pos.x,
      y: proposal.y ?? pos.y,
      settings: proposal.settings || {},
      styles: proposal.styles || {},
      ...(proposal.dataSource != null ? { dataSource: proposal.dataSource } : {}),
      ...(proposal.width ? { width: proposal.width } : {}),
      ...(proposal.height ? { height: proposal.height } : {}),
    };
    const widget = engine.addWidget(type, config);
    if (!widget) throw new Error('Не удалось добавить виджет');
    if (proposal.temp_id) tempMap.set(String(proposal.temp_id), String(widget.id));
    if (typeof widget.render === 'function') widget.render();
    eventBus.emit('widget:settings-changed', { widget });
    return { ...proposal, status: 'applied', widget_id: String(widget.id) };
  }

  if (op === 'update_settings') {
    const widgetId = resolveWidgetId(proposal.widget_id, tempMap);
    const widget = wm.getWidget(widgetId);
    if (!widget) throw new Error(`Виджет ${widgetId} не найден`);
    const patch = proposal.settings_patch || proposal.settings || {};
    widget.settings = { ...(widget.settings || {}), ...patch };
    if (typeof widget.render === 'function') widget.render();
    eventBus.emit('widget:settings-changed', { widget });
    return { ...proposal, status: 'applied', widget_id: String(widget.id) };
  }

  if (op === 'update_styles') {
    const widgetId = resolveWidgetId(proposal.widget_id, tempMap);
    const widget = wm.getWidget(widgetId);
    if (!widget) throw new Error(`Виджет ${widgetId} не найден`);
    const patch = proposal.styles_patch || proposal.styles || {};
    if (typeof widget.setStyles === 'function') {
      widget.setStyles(patch);
    } else {
      widget.styles = { ...(widget.styles || {}), ...patch };
      if (typeof widget.applyStyles === 'function') widget.applyStyles();
      eventBus.emit('widget:styles-changed', { widget });
    }
    return { ...proposal, status: 'applied', widget_id: String(widget.id) };
  }

  if (op === 'copy_styles') {
    const sourceId = resolveWidgetId(proposal.source_widget_id, tempMap);
    const source = wm.getWidget(sourceId);
    if (!source) throw new Error(`Источник стилей ${sourceId} не найден`);
    const rawTargets = Array.isArray(proposal.target_widget_ids)
      ? proposal.target_widget_ids
      : (proposal.target_widget_id != null ? [proposal.target_widget_id] : []);
    if (!rawTargets.length) throw new Error('copy_styles требует target_widget_ids');
    const includeVisual = proposal.include_visual_settings !== false;
    const styleClone = cloneJson(source.styles || {});
    const visualPatch = includeVisual ? pickVisualSettings(source.settings || {}) : {};
    const applied = [];
    for (const tid of rawTargets) {
      const targetId = resolveWidgetId(tid, tempMap);
      if (String(targetId) === String(sourceId)) continue;
      const target = wm.getWidget(targetId);
      if (!target) throw new Error(`Виджет ${targetId} не найден`);
      target.styles = cloneJson(styleClone);
      if (typeof target.applyStyles === 'function') target.applyStyles();
      else if (typeof target.setStyles === 'function') target.setStyles(cloneJson(styleClone));
      if (includeVisual && Object.keys(visualPatch).length) {
        target.settings = { ...(target.settings || {}), ...cloneJson(visualPatch) };
      }
      if (typeof target.render === 'function') target.render();
      eventBus.emit('widget:styles-changed', { widget: target });
      if (includeVisual && Object.keys(visualPatch).length) {
        eventBus.emit('widget:settings-changed', { widget: target });
      }
      applied.push(String(target.id));
    }
    return {
      ...proposal,
      status: 'applied',
      source_widget_id: String(source.id),
      target_widget_ids: applied,
    };
  }

  if (op === 'move_resize') {
    const widgetId = resolveWidgetId(proposal.widget_id, tempMap);
    const widget = wm.getWidget(widgetId);
    if (!widget) throw new Error(`Виджет ${widgetId} не найден`);
    if (proposal.width != null || proposal.height != null) {
      const w = proposal.width != null ? proposal.width : widget.width;
      const h = proposal.height != null ? proposal.height : widget.height;
      if (typeof widget.setSize === 'function') widget.setSize(w, h, wm);
      else {
        widget.width = w;
        widget.height = h;
        if (typeof widget.updatePosition === 'function') widget.updatePosition();
      }
    }
    if (proposal.x != null || proposal.y != null) {
      const x = proposal.x != null ? proposal.x : widget.x;
      const y = proposal.y != null ? proposal.y : widget.y;
      if (typeof widget.setPosition === 'function') widget.setPosition(x, y, wm);
      else {
        widget.x = x;
        widget.y = y;
        if (typeof widget.updatePosition === 'function') widget.updatePosition();
      }
    }
    eventBus.emit('widget:move-end', { widget });
    return { ...proposal, status: 'applied' };
  }

  if (op === 'delete_widget') {
    const widgetId = resolveWidgetId(proposal.widget_id, tempMap);
    wm.deleteWidget(widgetId);
    return { ...proposal, status: 'applied' };
  }

  if (op === 'bind_field') {
    const widgetId = resolveWidgetId(proposal.widget_id, tempMap);
    const widget = wm.getWidget(widgetId);
    if (!widget) throw new Error(`Виджет ${widgetId} не найден`);
    const payload = {
      modelId: proposal.modelId ?? proposal.model_id,
      tableName: proposal.tableName || proposal.table,
      fieldName: proposal.fieldName || proposal.field,
      type: proposal.type || proposal.fieldType || 'string',
      ...(proposal.kind === 'table' || proposal.bind_kind === 'table'
        ? { kind: 'table', fields: proposal.fields || [] }
        : {}),
    };
    if (!payload.modelId || !payload.tableName) {
      throw new Error('bind_field требует modelId и tableName');
    }
    const kind = applyDataFieldToWidget(widget, payload);
    if (kind === 'ignored') throw new Error('Виджет не принял привязку поля');
    if (typeof widget.render === 'function') widget.render();
    eventBus.emit('widget:settings-changed', { widget });
    return { ...proposal, status: 'applied', bind_kind: kind };
  }

  throw new Error(`Неизвестная операция: ${op}`);
}

export async function applyAllDashboardProposals(engine, proposals, options = {}) {
  const tempMap = options.tempMap || new Map();
  const results = [];
  for (const p of proposals || []) {
    if (p.status && p.status !== 'pending') {
      results.push(p);
      continue;
    }
    try {
      results.push(await applyDashboardProposal(engine, p, { ...options, tempMap }));
    } catch (e) {
      results.push({
        ...p,
        status: 'error',
        _error: e?.message || String(e),
      });
    }
  }
  return results;
}
