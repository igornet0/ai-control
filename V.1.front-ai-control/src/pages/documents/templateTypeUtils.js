import { SPREADSHEET_BLOCK_TYPE } from './spreadsheetGridUtils';

/** Шаблон «таблица» (сетка): один блок spreadsheet на листе. */
export function isSpreadsheetTemplate(template) {
  const sc = template?.sheet_content;
  if (!Array.isArray(sc) || sc.length === 0) return false;
  return sc.length === 1 && sc[0]?.type === SPREADSHEET_BLOCK_TYPE;
}

/** @returns {'table' | 'document'} */
export function getTemplateKind(template) {
  return isSpreadsheetTemplate(template) ? 'table' : 'document';
}

/** Документ создан по шаблону-таблице (нужен загруженный шаблон в списке). */
export function isSpreadsheetDocument(doc, templates) {
  if (!doc?.template_id) return false;
  const list = Array.isArray(templates) ? templates : [];
  const t = list.find((x) => String(x.id) === String(doc.template_id));
  return t ? isSpreadsheetTemplate(t) : false;
}

/** Подпись типа для списков файлов и карточек проекта. */
export function getDocumentTypeLabel(doc, templates) {
  return isSpreadsheetDocument(doc, templates) ? 'Таблица' : 'Документ';
}
