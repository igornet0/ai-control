/**
 * Intent classification, structured reply parsing, and local field proposal apply
 * for DocumentAiAssistant / global document chat.
 */

import { parseDefaultFromEditString } from './structureFieldUtils';
import { validateCellValueForColumnType, SPREADSHEET_FIELD_FORMAT } from './spreadsheetGridUtils';
import { isCellFormula } from './spreadsheetCellFormula';
import {
  findIncompleteFields,
  resolveFieldType,
  isSpreadsheetFieldValue,
  buildSourceDocumentsBlock,
  buildSpreadsheetFormulaContext,
  applyTableRowsWithColumnDefaults,
  normalizeSpreadsheetFieldData,
  resolveFieldColumnsForApply,
} from './documentAiContext';
import { SPREADSHEET_MAX_DIM } from './spreadsheetGridUtils';

export const FORMULA_OVERWRITE_RE = /\b(формул|пересчит|измени\s+формул|замени\s+формул|обнови\s+формул|новую\s+формул|перепиши\s+формул|исправь\s+формул)/i;

export function userAllowsFormulaOverwrite(text) {
  return FORMULA_OVERWRITE_RE.test(String(text || '').trim());
}

export const DOCUMENT_FORMULA_PROMPT = `
## Формулы в spreadsheet
- В схеме поля spreadsheet есть formula_cells: ячейки с is_formula=true (formula + display_value — вычисленный результат).
- Не заменяй формулу обычным числом/текстом, если пользователь явно не просит изменить формулу.
- Заполняй операнды (ячейки-источники), а не итоговые formula_cells — результат пересчитается сам.
- Чтобы задать/изменить формулу, в value укажи строку с «=» (например "=B2*C2", "=SUM(col_1:col_1)").
- Для замены формулы константой пользователь должен явно попросить (например «замени формулу в …»).
`.trim();

export const DOCUMENT_ROWS_PROMPT = `
## Строки таблиц и spreadsheet
- Можно добавлять новые строки: для spreadsheet укажи row_index больше текущего (0-based, только тело таблицы без строки заголовков).
- Лимит сетки: до ${SPREADSHEET_MAX_DIM} строк на лист (см. row_stats / max_body_rows в схеме).
- Пустые ячейки новых строк при применении заполняются default_value колонок из схемы — не обязательно копировать значения по умолчанию в каждую ячейку.
- set_table_rows заменяет все строки поля — передай полный массив нужной длины; пустые ячейки получат default_value колонок.
- Если в снимке preview/truncated — это только лимит контекста чата, в документе строк может быть больше; добавляй строки по необходимости.
`.trim();

export const DOCUMENT_EDITOR_PROMPT = `
Ты — AI-помощник редактора документов 2A.

Тебе дан снимок документа: схема полей, текущие значения, список незаполненных полей.
Ты можешь объяснять, анализировать заполненность и предлагать конкретные изменения через proposals.
Пользователь применит их кнопкой «Применить» — сам документ не сохраняй, пока его не попросят.

## Типы полей
- string, number, date (YYYY-MM-DD), boolean
- table — массив строк-объектов { "col_0": "...", "col_1": "..." } или ключи из columns[].key
- spreadsheet — сетка листов (sheet_id из схемы, например sheet_0); правь отдельными ячейками через col_key (col_0, col_1, …) и row_index
- В схеме полей смотри sheets[].columns[] — все колонки шаблона, включая недавно добавленные

## Правила
- Не выдумывай имена полей: только из схемы снимка.
- Заполняй пустые поля осмысленными значениями из контекста документа / источников.
- Для таблиц не оставляй полностью пустые строки, если предлагаешь данные.
- Для spreadsheet указывай sheet_key, row_index (0-based), col_key (col_0, col_1, …). row_index может быть больше числа сохранённых строк — новая строка создастся автоматически.
- Ячейки с формулой помечены в схеме (formula_cells): смотри formula и display_value; не затирай формулу числом без явной просьбы.
- Для table/spreadsheet можно добавлять строки; смотри can_add_rows и row_stats в схеме.
- Числа — числа, даты — ISO, boolean — true/false.
- Не называй себя DeepSeek/ChatGPT/Claude. Отвечай на русском.
`.trim();

export const DOCUMENT_FILL_FROM_SOURCES_PROMPT = `
Если пользователь прикрепил документы-источники:
- Текущий документ в редакторе — ЦЕЛЕВОЙ: заполняй только его поля (proposals set_field / set_table_rows / set_spreadsheet_cells).
- Источники — уже заполненные документы: сопоставь поля по смыслу имён и колонок.
- Рассчитай производные значения (суммы, время, итоги), если это следует из данных источников.
- Не копируй номер/id источника в целевой документ.
- Предлагай заполнение пустых и улучшение неполных полей целевого документа.
`.trim();

export const DOCUMENT_CREATE_PROMPT = `
Если пользователь просит СОЗДАТЬ документ по шаблону на основе прикреплённых документов-источников:
- Сопоставь поля шаблона с данными источников (по смыслу имён колонок/полей).
- Рассчитай производные значения (суммы, длительность, итоги), если это следует из данных.
- Не копируй служебные id/номера источника как есть, если у нового документа свой номер.
- Верни proposal op=create_document с field_data только по полям целевого шаблона.
`.trim();

export const DOCUMENT_OPS = [
  'set_field',
  'set_title',
  'set_table_rows',
  'set_spreadsheet_cells',
  'replace_field_data',
  'create_document',
];

const ACT_RE = /\b(сделай|сделать|измени|изменить|добавь|добавить|заполни|заполнить|посчитай|рассчитай|создай|создать|обнови|обновить|исправь|подставь|предложи)\b/i;
const ANALYZE_RE = /\b(проанализируй|анализ|какие поля|что не заполнен|пустые поля|проверь|что заполнено)\b/i;
const HELP_RE = /\b(помоги|помощь|как |объясни|подскажи|что делать)\b/i;

export function classifyDocumentIntent(text, ctx = {}) {
  const t = String(text || '').trim();
  if (!t) return 'help';
  if (ctx.forceAct) return 'act';
  if (ACT_RE.test(t)) return 'act';
  if (ANALYZE_RE.test(t)) return 'analyze';
  if (HELP_RE.test(t)) return 'help';
  if (ctx.hasSources && t.length > 8) return 'act';
  return 'analyze';
}

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

function tryParseJsonValue(raw) {
  if (raw == null) return raw;
  if (typeof raw !== 'string') return raw;
  const s = raw.trim();
  if (!s) return '';
  if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
    try {
      return JSON.parse(s);
    } catch {
      return raw;
    }
  }
  return raw;
}

export function buildDocumentResponseProtocol(intent = 'analyze', { allowCreate = false } = {}) {
  const modeHint = intent === 'act'
    ? 'mode ОБЯЗАТЕЛЬНО "act". Заполни пустые поля и предложи правки существующих, если просили.'
    : intent === 'analyze'
      ? 'mode = "analyze". Опиши заполненность. Можно дать proposals для пустых полей.'
      : 'mode = "help". Кратко объясни, как пользоваться редактором. proposals обычно [].';

  const createOps = allowCreate
    ? `
- {"op":"create_document","template_id":<id шаблона>,"title":"опционально","field_data":{...},"reason":"..."}`
    : '';

  return `
## Формат ответа (обязательно)
Верни ТОЛЬКО один JSON-объект (без markdown вне JSON):
{
  "mode": "help" | "analyze" | "act",
  "summary": "текст на русском",
  "proposals": [ /* операции */ ]
}

Операции:
- {"op":"set_field","field_name":"<имя из схемы>","value":"...","reason":"..."}
- {"op":"set_title","value":"...","reason":"..."}
- {"op":"set_table_rows","field_name":"<имя>","rows":[{"col_0":"..."}],"reason":"..."}
- {"op":"set_spreadsheet_cells","field_name":"<имя>","changes":[{"sheet_key":"sheet_0","row_index":0,"col_key":"col_0","value":"..."}],"reason":"..."}${createOps}

${modeHint}
Не выдумывай field_name. Для spreadsheet не присылай весь workbook — только changes.
Не перезаписывай formula_cells константой, если пользователь не просил изменить формулу.
`.trim();
}

function normalizeLegacyProposal(p, i) {
  const field = String(p.field_name || '').trim();
  const value = tryParseJsonValue(p.proposed_value);
  const base = {
    id: p.id || `doc-${Date.now()}-${i}`,
    status: 'pending',
    reason: p.reason || '',
    original_value: p.original_value,
    proposed_value: p.proposed_value,
  };
  if (field === 'title') {
    return { ...base, op: 'set_title', value };
  }
  if (field === 'field_data' && value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...base, op: 'replace_field_data', value };
  }
  if (field.startsWith('field.')) {
    const name = field.slice(6);
    if (Array.isArray(value)) {
      return { ...base, op: 'set_table_rows', field_name: name, rows: value };
    }
    return { ...base, op: 'set_field', field_name: name, value };
  }
  if (field) {
    if (Array.isArray(value)) {
      return { ...base, op: 'set_table_rows', field_name: field, rows: value };
    }
    return { ...base, op: 'set_field', field_name: field, value };
  }
  return null;
}

export function parseDocumentAiReply(rawContent, fallbackMode = 'analyze') {
  const parsed = extractJsonObject(rawContent);
  if (!parsed) {
    return {
      mode: fallbackMode,
      summary: String(rawContent || '').trim(),
      proposals: [],
      structured: false,
    };
  }

  const mode = ['act', 'analyze', 'help'].includes(parsed.mode)
    ? parsed.mode
    : fallbackMode;
  const summary = String(
    parsed.summary || parsed.content || parsed.message || '',
  ).trim() || String(rawContent || '').trim();

  const rawList = Array.isArray(parsed.proposals) ? parsed.proposals : [];
  const proposals = rawList
    .map((p, i) => {
      if (!p || typeof p !== 'object') return null;
      if (DOCUMENT_OPS.includes(p.op)) {
        return {
          ...p,
          id: p.id || `doc-${Date.now()}-${i}`,
          status: 'pending',
        };
      }
      return normalizeLegacyProposal(p, i);
    })
    .filter(Boolean);

  return { mode, summary, proposals, structured: true };
}

export function proposalLabel(p) {
  if (!p) return 'изменение';
  if (p.op === 'create_document') {
    return `Создать документ из шаблона #${p.template_id ?? '—'}`;
  }
  if (p.op === 'set_title') return 'Заголовок';
  if (p.op === 'set_spreadsheet_cells') {
    return `${p.field_name}: ${Array.isArray(p.changes) ? p.changes.length : 0} ячеек`;
  }
  if (p.op === 'set_table_rows') {
    return `${p.field_name}: ${Array.isArray(p.rows) ? p.rows.length : 0} строк`;
  }
  if (p.op === 'replace_field_data') return 'Все поля документа';
  return p.field_name || p.op || 'изменение';
}

export function formatProposalValue(p) {
  if (p.op === 'set_title' || p.op === 'set_field') {
    const v = p.value;
    if (v != null && typeof v === 'object') {
      try { return JSON.stringify(v, null, 2); } catch { return String(v); }
    }
    return v == null ? '' : String(v);
  }
  if (p.op === 'set_table_rows') {
    try { return JSON.stringify(p.rows || [], null, 2); } catch { return String(p.rows); }
  }
  if (p.op === 'set_spreadsheet_cells') {
    const lines = (p.changes || []).map((c) => (
      `${c.sheet_key || 'sheet_0'} ${c.col_key}[${c.row_index}] → ${c.value}`
    ));
    return lines.join('\n');
  }
  if (p.op === 'create_document') {
    try { return JSON.stringify(p.field_data || {}, null, 2); } catch { return ''; }
  }
  if (p.op === 'replace_field_data') {
    try { return JSON.stringify(p.value || {}, null, 2); } catch { return ''; }
  }
  return p.proposed_value != null ? String(p.proposed_value) : '';
}

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? {}));
  } catch {
    return {};
  }
}

export function validateProposalValue(fieldType, value, dataType = null) {
  if (dataType) {
    return validateCellValueForColumnType(value, dataType);
  }
  if (fieldType === 'table') {
    return { ok: Array.isArray(value), message: 'Ожидается массив строк' };
  }
  if (fieldType === 'spreadsheet') {
    return { ok: true };
  }
  if (fieldType === 'number') {
    const parsed = parseDefaultFromEditString(value, 'number');
    return parsed === undefined && value !== 0 && value !== '0'
      ? { ok: false, message: 'Ожидается число' }
      : { ok: true };
  }
  if (fieldType === 'date') {
    const s = String(value ?? '').trim();
    if (!s) return { ok: true };
    const cell = validateCellValueForColumnType(s, 'date');
    return cell.ok ? cell : { ok: false, message: 'Ожидается дата' };
  }
  if (fieldType === 'boolean') {
    if (typeof value === 'boolean') return { ok: true };
    const parsed = parseDefaultFromEditString(value, 'boolean');
    return parsed === undefined
      ? { ok: false, message: 'Ожидается да/нет' }
      : { ok: true };
  }
  return { ok: true };
}

function coerceScalar(fieldType, value) {
  if (fieldType === 'number') {
    const n = parseDefaultFromEditString(value, 'number');
    return n === undefined ? value : n;
  }
  if (fieldType === 'boolean') {
    if (typeof value === 'boolean') return value;
    const b = parseDefaultFromEditString(value, 'boolean');
    return b === undefined ? value : b;
  }
  if (fieldType === 'date') {
    return value == null ? '' : String(value);
  }
  return value;
}

function getSpreadsheetCellRaw(workbook, sheetKey, rowIndex, colKey) {
  if (!workbook || !sheetKey) return '';
  const rows = workbook[sheetKey];
  if (!Array.isArray(rows) || rowIndex < 0) return '';
  const v = rows[rowIndex]?.[colKey];
  return v == null ? '' : String(v);
}

function formatFormulaBlockError(blocked) {
  const cells = blocked.slice(0, 5).map((b) => (
    `${b.sheet_key || 'sheet_0'}!${b.col_key || '?'}[${b.row_index}]`
  )).join(', ');
  const more = blocked.length > 5 ? ` и ещё ${blocked.length - 5}` : '';
  return `Нельзя заменить формулы без явного запроса: ${cells}${more}. Напишите, например: «измени формулу в …».`;
}

function getSpreadsheetCellFormula(workbook, fieldName, sheetKey, rowIndex, colKey, sheetBlocks) {
  const raw = getSpreadsheetCellRaw(workbook, sheetKey, rowIndex, colKey);
  if (isCellFormula(raw)) return raw;
  if (!sheetBlocks || !fieldName) return '';
  const { formulaByKey } = buildSpreadsheetFormulaContext(fieldName, workbook, sheetBlocks);
  return formulaByKey.get(`${sheetKey}|${rowIndex}|${colKey}`)?.formula || '';
}

function findBlockedFormulaChanges(workbook, changes, {
  allowFormulaOverwrite = false,
  fieldName = null,
  sheetBlocks = null,
} = {}) {
  if (allowFormulaOverwrite) return [];
  const blocked = [];
  (changes || []).forEach((ch) => {
    const sheetKey = ch.sheet_key || ch.sheetKey || 'sheet_0';
    const rowIndex = Number(ch.row_index ?? ch.rowIndex);
    const colKey = ch.col_key || ch.colKey;
    if (!colKey || !Number.isFinite(rowIndex) || rowIndex < 0) return;
    const cur = getSpreadsheetCellFormula(workbook, fieldName, sheetKey, rowIndex, colKey, sheetBlocks);
    const nextStr = ch.value == null ? '' : String(ch.value);
    if (isCellFormula(cur) && !isCellFormula(nextStr) && !ch.overwrite_formula) {
      blocked.push({ sheet_key: sheetKey, row_index: rowIndex, col_key: colKey, formula: cur });
    }
  });
  return blocked;
}

function applySpreadsheetChanges(current, changes, {
  allowFormulaOverwrite = false,
  fieldName = null,
  sheetBlocks = null,
} = {}) {
  const workbook = isSpreadsheetFieldValue(current)
    ? cloneJson(current)
    : { __format: SPREADSHEET_FIELD_FORMAT };
  const blocked = findBlockedFormulaChanges(workbook, changes, {
    allowFormulaOverwrite,
    fieldName,
    sheetBlocks,
  });
  if (blocked.length) {
    throw new Error(formatFormulaBlockError(blocked));
  }
  (changes || []).forEach((ch) => {
    const sheetKey = ch.sheet_key || ch.sheetKey || 'sheet_0';
    const rowIndex = Number(ch.row_index ?? ch.rowIndex);
    const colKey = ch.col_key || ch.colKey;
    if (!colKey || !Number.isFinite(rowIndex) || rowIndex < 0) return;
    if (rowIndex >= SPREADSHEET_MAX_DIM) {
      throw new Error(`row_index ${rowIndex} превышает лимит сетки (${SPREADSHEET_MAX_DIM - 1} строк тела)`);
    }
    const rows = Array.isArray(workbook[sheetKey]) ? [...workbook[sheetKey]] : [];
    while (rows.length <= rowIndex) rows.push({});
    const row = { ...(rows[rowIndex] || {}) };
    row[colKey] = ch.value;
    rows[rowIndex] = row;
    workbook[sheetKey] = rows;
  });
  if (!workbook.__format) workbook.__format = SPREADSHEET_FIELD_FORMAT;
  if (fieldName && sheetBlocks) {
    return normalizeSpreadsheetFieldData(fieldName, workbook, sheetBlocks);
  }
  return workbook;
}

/**
 * @returns {{ fieldData: object, title: string|null }}
 */
export function applyDocumentProposal(fieldData, proposal, options = {}) {
  const {
    fieldsList = [],
    sheetBlocks = null,
    title = null,
    allowFormulaOverwrite = false,
  } = options;
  let nextData = { ...(fieldData || {}) };
  let nextTitle = null;

  const op = proposal?.op;
  if (op === 'set_title') {
    nextTitle = proposal.value == null ? '' : String(proposal.value);
    return { fieldData: nextData, title: nextTitle };
  }

  if (op === 'replace_field_data') {
    const value = proposal.value && typeof proposal.value === 'object' && !Array.isArray(proposal.value)
      ? proposal.value
      : {};
    return { fieldData: { ...nextData, ...value }, title: nextTitle };
  }

  if (op === 'create_document') {
    throw new Error('Создание документа применяется отдельно');
  }

  const fieldName = proposal.field_name;
  if (!fieldName) throw new Error('Не указано имя поля');
  const fieldType = resolveFieldType(fieldName, fieldsList, sheetBlocks);

  if (op === 'set_table_rows') {
    const rows = Array.isArray(proposal.rows) ? proposal.rows : [];
    const check = validateProposalValue('table', rows);
    if (!check.ok) throw new Error(check.message || 'Некорректные строки таблицы');
    const columns = resolveFieldColumnsForApply(fieldName, fieldsList, sheetBlocks);
    const colList = Array.isArray(columns) && columns[0]?.columns
      ? columns[0].columns
      : columns;
    nextData[fieldName] = applyTableRowsWithColumnDefaults(rows, colList);
    return { fieldData: nextData, title: nextTitle };
  }

  if (op === 'set_spreadsheet_cells') {
    const changes = Array.isArray(proposal.changes) ? proposal.changes : [];
    if (!changes.length) throw new Error('Нет изменений ячеек');
    nextData[fieldName] = applySpreadsheetChanges(
      nextData[fieldName],
      changes,
      {
        allowFormulaOverwrite: allowFormulaOverwrite || proposal.allow_formula_overwrite,
        fieldName,
        sheetBlocks,
      },
    );
    return { fieldData: nextData, title: nextTitle };
  }

  if (op === 'set_field') {
    if (fieldType === 'table' && Array.isArray(proposal.value)) {
      const columns = resolveFieldColumnsForApply(fieldName, fieldsList, sheetBlocks);
      nextData[fieldName] = applyTableRowsWithColumnDefaults(proposal.value, columns);
      return { fieldData: nextData, title: nextTitle };
    }
    if (fieldType === 'spreadsheet' && proposal.value && typeof proposal.value === 'object') {
      nextData[fieldName] = normalizeSpreadsheetFieldData(fieldName, proposal.value, sheetBlocks);
      return { fieldData: nextData, title: nextTitle };
    }
    const check = validateProposalValue(fieldType, proposal.value);
    if (!check.ok) throw new Error(check.message || `Некорректное значение для «${fieldName}»`);
    nextData[fieldName] = coerceScalar(fieldType, proposal.value);
    return { fieldData: nextData, title: nextTitle };
  }

  void title;
  throw new Error(`Неизвестная операция ${op || '—'}`);
}

export function applyAllDocumentProposals(fieldData, proposals, options = {}) {
  let nextData = { ...(fieldData || {}) };
  let nextTitle = options.title ?? null;
  const results = [];
  for (const p of proposals || []) {
    if (p.status && p.status !== 'pending') {
      results.push(p);
      continue;
    }
    if (p.op === 'create_document') {
      results.push({ ...p, status: 'error', _error: 'Создание документа применяется отдельно' });
      continue;
    }
    try {
      const applied = applyDocumentProposal(nextData, p, { ...options, title: nextTitle });
      nextData = applied.fieldData;
      if (applied.title != null) nextTitle = applied.title;
      results.push({ ...p, status: 'applied' });
    } catch (e) {
      results.push({ ...p, status: 'error', _error: e?.message || String(e) });
    }
  }
  return { fieldData: nextData, title: nextTitle, results };
}

export async function applyCreateDocumentProposal(proposal) {
  const templateId = Number(proposal?.template_id);
  if (!Number.isFinite(templateId)) {
    throw new Error('Не указан шаблон для создания документа');
  }
  const { documentService } = await import('../../services/documentService');
  const created = await documentService.createFromTemplate(templateId);
  const patch = {};
  if (proposal.field_data && typeof proposal.field_data === 'object') {
    patch.field_data = { ...(created.field_data || {}), ...proposal.field_data };
  }
  if (proposal.title) patch.title = proposal.title;
  if (Object.keys(patch).length) {
    await documentService.updateDocument(created.id, patch);
  }
  const fresh = await documentService.getDocument(created.id);
  return { ...proposal, status: 'applied', created_document: fresh };
}

export async function persistDocumentFieldProposal(proposal, documentId, options = {}) {
  const id = Number(documentId);
  if (!Number.isFinite(id)) throw new Error('Не указан документ');
  const { documentService } = await import('../../services/documentService');
  const doc = await documentService.getDocument(id);
  const applied = applyDocumentProposal(doc.field_data || {}, proposal, {
    fieldsList: options.fieldsList || [],
    sheetBlocks: options.sheetBlocks || null,
    title: doc.title,
    allowFormulaOverwrite: options.allowFormulaOverwrite,
  });
  const patch = { field_data: applied.fieldData };
  if (applied.title != null) patch.title = applied.title;
  await documentService.updateDocument(id, patch);
  return { ...proposal, status: 'applied' };
}

export function buildEditorExtraContext({
  intent = 'analyze',
  allowCreate = false,
  documentSnapshot,
  sourceDocuments = [],
  templates = [],
  fillFromSources = false,
} = {}) {
  const sourceBlock = sourceDocuments.length
    ? (typeof sourceDocuments[0] === 'string'
      ? `## Документы-источники (уже заполнены)\n${sourceDocuments.join('\n\n')}`
      : buildSourceDocumentsBlock(sourceDocuments))
    : null;
  const parts = [
    DOCUMENT_EDITOR_PROMPT,
    DOCUMENT_FORMULA_PROMPT,
    DOCUMENT_ROWS_PROMPT,
    fillFromSources ? DOCUMENT_FILL_FROM_SOURCES_PROMPT : null,
    allowCreate ? DOCUMENT_CREATE_PROMPT : null,
    buildDocumentResponseProtocol(intent, { allowCreate }),
    `## Классификация текущего запроса\nintent=${intent}`,
    '## Целевой документ (редактируется сейчас)',
    documentSnapshot || null,
    templates.length ? templates.join('\n\n') : null,
    sourceBlock,
  ];
  return parts.filter(Boolean).join('\n\n');
}

export { findIncompleteFields };
