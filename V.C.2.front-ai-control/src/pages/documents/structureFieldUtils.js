import { copyDefaultTableColumns } from './documentTableColumns';

/** Подставить default из шаблона, если в поле структуры не задано */
export function mergeFieldsWithTemplateDefaults(fields, templateDefaultValues = {}) {
  const dv =
    templateDefaultValues && typeof templateDefaultValues === 'object' ? templateDefaultValues : {};
  return (Array.isArray(fields) ? fields : []).map((f) => {
    const name = String(f.name ?? '').trim();
    let def = f.default;
    if (def === undefined && name && Object.prototype.hasOwnProperty.call(dv, name)) {
      def = dv[name];
    }
    return def === undefined ? { ...f } : { ...f, default: def };
  });
}

/** Строка для поля ввода в конструкторе структуры */
export function defaultValueToEditString(value, type) {
  if (value === undefined || value === null) return '';
  if (type === 'table' || Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  }
  if (type === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/** Разбор ввода пользователя в значение по умолчанию */
export function parseDefaultFromEditString(str, type) {
  const s = String(str ?? '').trim();
  if (!s && type !== 'boolean') return undefined;
  if (type === 'table') {
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  if (type === 'number') {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }
  if (type === 'boolean') {
    if (['true', '1', 'да', 'yes'].includes(s.toLowerCase())) return true;
    if (['false', '0', 'нет', 'no'].includes(s.toLowerCase())) return false;
    return undefined;
  }
  if (type === 'date') return s;
  return s || undefined;
}

/** Словарь default_values шаблона из полей структуры */
export function buildTemplateDefaultValuesFromFields(fields) {
  const out = {};
  for (const f of fields) {
    const name = String(f.name ?? '').trim();
    if (!name || f.default === undefined || f.default === null) continue;
    if (f.type === 'boolean' || f.type === 'number' || f.type === 'table' || Array.isArray(f.default)) {
      out[name] = f.default;
      continue;
    }
    if (String(f.default).trim() !== '') out[name] = f.default;
  }
  return out;
}

/** Нормализация полей таблицы перед сохранением */
export function normalizeStructureFieldsForSave(fields) {
  const list = Array.isArray(fields) ? fields : [];
  return list.map((f) => {
    let field = { ...f };
    if (field.default === undefined || field.default === null || field.default === '') {
      const { default: _removed, ...rest } = field;
      field = rest;
    }
    if (field.type === 'table' && (!Array.isArray(field.columns) || field.columns.length === 0)) {
      return { ...field, columns: copyDefaultTableColumns() };
    }
    return field;
  });
}

export function validateStructureFields(fields) {
  const list = Array.isArray(fields) ? fields : [];
  for (const f of list) {
    if (f.type !== 'table') continue;
    const cols = Array.isArray(f.columns) && f.columns.length > 0 ? f.columns : copyDefaultTableColumns();
    const keys = cols.map((c) => String(c.key ?? '').trim()).filter(Boolean);
    if (keys.length === 0) {
      return `Укажите ключи колонок для поля «${f.name || 'Таблица'}».`;
    }
    const uniq = new Set(keys);
    if (uniq.size !== keys.length) {
      return `Ключи колонок должны быть уникальными (поле «${f.name || 'Таблица'}»).`;
    }
    if (f.default !== undefined && f.default !== null && !Array.isArray(f.default)) {
      return `Значение по умолчанию для «${f.name || 'Таблица'}» должно быть JSON-массивом строк.`;
    }
  }
  return null;
}
