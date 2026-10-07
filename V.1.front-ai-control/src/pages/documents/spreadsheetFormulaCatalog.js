import { FORMULA_FUNCTIONS } from './spreadsheetFormulaFunctions';

/** @typedef {{ id: string, name: string, aliases?: string[], description: string, example: string, category?: string }} FormulaCatalogItem */

/** Каталог для подсказок: русское имя основное, английское — псевдоним. */
/** @type {FormulaCatalogItem[]} */
export const SPREADSHEET_FORMULA_CATALOG = [
  ...FORMULA_FUNCTIONS.map((fn) => {
    const ru = (fn.ru || []).filter((n) => /[А-Яа-яЁё]/.test(n));
    const name = ru[0] || fn.name;
    const aliases = [fn.name, ...(fn.ru || [])].filter((n) => n !== name);
    return {
      id: fn.name.toLowerCase(),
      name,
      aliases,
      description: fn.description,
      example: fn.syntax,
      category: fn.category,
    };
  }),
  {
    id: 'sheetref',
    name: 'Лист!A1',
    aliases: ["'Лист 2'!A1"],
    description: 'Ссылка на ячейку другого листа. A1 в строке заголовков возвращает название столбца.',
    example: 'Лист2!B3 или \'Прайс\'!A1:C10',
    category: 'lookup',
  },
];

function catalogSearchKeys(item) {
  return [item.name, ...(item.aliases || [])];
}

/**
 * Префикс имени функции у курсора в формуле (=СУ…, =SUM(…).
 * @returns {{ prefix: string, tokenStart: number } | null}
 */
export function extractFormulaNamePrefix(value, cursorPos) {
  const raw = String(value ?? '');
  if (!raw.startsWith('=')) return null;
  const pos = Math.max(0, Math.min(cursorPos ?? raw.length, raw.length));
  const head = raw.slice(0, pos);
  const match = head.match(/(?:^=|[-+*/(,]\s*)([\p{L}_][\p{L}\p{N}_]*)$/u);
  if (!match) {
    return null;
  }
  return {
    prefix: match[1],
    tokenStart: head.length - match[1].length,
  };
}

/**
 * @param {string} prefix — начало имени функции (пустая строка = все)
 * @returns {FormulaCatalogItem[]}
 */
export function matchFormulaSuggestions(prefix) {
  const p = String(prefix ?? '').trim().toUpperCase();
  if (!p) return [];
  const list = SPREADSHEET_FORMULA_CATALOG.filter((item) => (
    catalogSearchKeys(item).some((key) => String(key).toUpperCase().startsWith(p))
  ));
  return list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

/**
 * @returns {{ value: string, selectionStart: number, selectionEnd: number }}
 */
export function applyFormulaSuggestion(value, selectionStart, selectionEnd, item) {
  const parsed = extractFormulaNamePrefix(value, selectionStart);
  const insertName = item?.name || '';
  const tokenStart = parsed?.tokenStart ?? selectionStart;
  const before = value.slice(0, tokenStart);
  const after = value.slice(selectionEnd);
  const nextValue = `${before}${insertName}(${after}`;
  const cursor = tokenStart + insertName.length + 1;
  return { value: nextValue, selectionStart: cursor, selectionEnd: cursor };
}
