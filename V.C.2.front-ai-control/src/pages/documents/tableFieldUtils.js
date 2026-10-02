/** Поле листа отображается как таблица (displayType или тип в структуре). */
export function isTableFieldBlock(block, fieldsList) {
  if (!block || block.type !== 'field') return false;
  const displayType = block.displayType || 'form';
  if (displayType === 'table') return true;
  if (!block.field_name || !Array.isArray(fieldsList)) return false;
  const meta = fieldsList.find((f) => f.name === block.field_name);
  return meta?.type === 'table';
}

/** Значение похоже на строки таблицы (массив объектов). */
export function isTableFieldValue(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every((row) => row && typeof row === 'object' && !Array.isArray(row));
}

/** Безопасный текст для превью скалярного поля (не рендерить объекты в React). */
export function formatScalarFieldPreview(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    if (isTableFieldValue(value)) return `${value.length} строк`;
    return value.map((item) => formatScalarFieldPreview(item)).join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Строка таблицы считается пустой, если все ячейки пустые (по ключам колонок или по всем полям). */
export function isTableRowEmpty(row, columns) {
  if (!row || typeof row !== 'object') return true;
  const cols = Array.isArray(columns) ? columns : [];
  if (cols.length > 0) {
    return cols.every((col) => String(row[col.key] ?? '').trim() === '');
  }
  return Object.values(row).every((v) => String(v ?? '').trim() === '');
}

/** Удалить полностью пустые строки (для сохранения документа). */
export function stripEmptyTableRows(rows, columns) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => !isTableRowEmpty(row, columns));
}

/** Сохранение default_values шаблона: все строки, включая пустые. */
export function normalizeTableRowsForTemplateSave(rows, columns) {
  if (!Array.isArray(rows) || rows.length === 0) return undefined;
  const cols = Array.isArray(columns) ? columns : [];
  return rows.map((row) => {
    const r = row && typeof row === 'object' ? { ...row } : {};
    cols.forEach((col) => {
      if (r[col.key] == null) r[col.key] = '';
    });
    return r;
  });
}

/** Нормализация таблицы при сохранении документа. */
export function normalizeTableFieldValueForDocumentSave(rows, columns, { keepEmptyRows = false } = {}) {
  const normalized = normalizeTableRowsForTemplateSave(rows, columns);
  if (!normalized) return [];
  if (keepEmptyRows) return normalized;
  return stripEmptyTableRows(normalized, columns);
}

/** keepEmptyRows для поля из блоков листа шаблона. */
export function buildKeepEmptyRowsByFieldName(sheetBlocks) {
  const out = {};
  (Array.isArray(sheetBlocks) ? sheetBlocks : []).forEach((block) => {
    if (block?.type !== 'field' || !block.field_name) return;
    const isTable = (block.displayType || 'form') === 'table';
    if (isTable && block.keepEmptyRows === true) {
      out[block.field_name] = true;
    }
  });
  return out;
}
