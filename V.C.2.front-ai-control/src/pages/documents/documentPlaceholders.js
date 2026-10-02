/** Встроенные плейсхолдеры, обрабатываемые отдельно или в других модулях. */
const RESERVED_KEYS = new Set(['номер', 'вид', 'number', 'page', 'total', 'n']);

/** @param {Array<{ key?: string, value?: string }>|null|undefined} defaults */
export function globalDefaultsToMap(defaults) {
  const map = {};
  if (!Array.isArray(defaults)) return map;
  defaults.forEach((item) => {
    const key = item?.key != null ? String(item.key).trim() : '';
    if (key) map[key] = item.value ?? '';
  });
  return map;
}

export function buildPlaceholderVars({
  номер,
  number,
  вид,
  kindName,
  globalDefaults = {},
} = {}) {
  return { номер, number, вид, kindName, globalDefaults };
}

/**
 * Подстановка в текст: {номер}, {вид} и ключи из globalDefaults ({CPP}, {company_name}, …).
 * Неизвестные {ключи} остаются без изменений.
 */
export function resolveDocumentPlaceholders(text, vars = {}) {
  if (text == null || typeof text !== 'string') return '';
  const globals = vars.globalDefaults && typeof vars.globalDefaults === 'object'
    ? vars.globalDefaults
    : {};

  let result = text
    .replace(/\{номер\}/gi, String(vars.номер ?? vars.number ?? '—'))
    .replace(/\{вид\}/gi, String(vars.вид ?? vars.kindName ?? ''));

  result = result.replace(/\{([^}]+)\}/g, (match, rawKey) => {
    const key = String(rawKey).trim();
    if (!key || RESERVED_KEYS.has(key)) return match;
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return String(vars[key] ?? '');
    }
    if (Object.prototype.hasOwnProperty.call(globals, key)) {
      return String(globals[key] ?? '');
    }
    const found = Object.keys(globals).find((k) => k.toLowerCase() === key.toLowerCase());
    if (found) return String(globals[found] ?? '');
    return match;
  });

  return result;
}

/** Подстановка в шаблон заголовка документа. */
export function resolveTitleTemplate(tpl, vars = {}) {
  return resolveDocumentPlaceholders(tpl, vars);
}

export function resolveBlockContent(content, placeholderVars = {}) {
  return resolveDocumentPlaceholders(content ?? '', placeholderVars);
}

/** Подстановка {ключей} в значении поля (строка, ячейки таблицы). */
export function resolveFieldValuePlaceholders(value, vars = {}) {
  if (value == null) return value;
  if (typeof value === 'string') {
    return resolveDocumentPlaceholders(value, vars);
  }
  if (Array.isArray(value)) {
    return value.map((row) => {
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        const next = {};
        Object.keys(row).forEach((k) => {
          const cell = row[k];
          next[k] = typeof cell === 'string' ? resolveDocumentPlaceholders(cell, vars) : cell;
        });
        return next;
      }
      return typeof row === 'string' ? resolveDocumentPlaceholders(row, vars) : row;
    });
  }
  if (typeof value === 'object') {
    const next = {};
    Object.keys(value).forEach((k) => {
      next[k] = resolveFieldValuePlaceholders(value[k], vars);
    });
    return next;
  }
  return value;
}

/** Подстановка {ключей} во всех значениях field_data / default_values. */
export function resolveFieldDataPlaceholders(fieldData, vars = {}) {
  if (!fieldData || typeof fieldData !== 'object' || Array.isArray(fieldData)) {
    return fieldData;
  }
  const result = {};
  Object.keys(fieldData).forEach((k) => {
    result[k] = resolveFieldValuePlaceholders(fieldData[k], vars);
  });
  return result;
}
