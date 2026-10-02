/** @typedef {{ id: string, name: string, aliases?: string[], description: string, example: string }} FormulaCatalogItem */

/** @type {FormulaCatalogItem[]} */
export const SPREADSHEET_FORMULA_CATALOG = [
  {
    id: 'if',
    name: 'ЕСЛИ',
    aliases: ['IF'],
    description: 'Проверяет условие: если истина — возвращает второй аргумент, иначе третий.',
    example: 'ЕСЛИ(C, B*D, 0) или ЕСЛИ(B>10, B*D, 0) или ЕСЛИ(A!="", B*D, 0)',
  },
  {
    id: 'sum',
    name: 'СУММ',
    aliases: ['SUM'],
    description: 'Суммирует числа в диапазоне ячеек или во всём столбце. Можно ссылаться на другой лист.',
    example: 'СУММ(B2:B14) или СУММ(B) или СУММ(Лист2!B2:B10)',
  },
  {
    id: 'sheetref',
    name: 'Лист!A1',
    aliases: ["'Лист 2'!A1"],
    description: 'Ссылка на ячейку другого листа. A1 в строке заголовков возвращает название столбца.',
    example: 'Лист2!B3 или \'Прайс\'!A1',
  },
  {
    id: 'avg',
    name: 'СРЗНАЧ',
    aliases: ['AVG', 'AVERAGE', 'СРЕДНЕЕ'],
    description: 'Возвращает среднее арифметическое чисел в диапазоне или столбце.',
    example: 'СРЗНАЧ(B1:B10) или СРЗНАЧ(B)',
  },
  {
    id: 'min',
    name: 'МИН',
    aliases: ['MIN', 'МИНИМУМ'],
    description: 'Находит минимальное значение в диапазоне или столбце.',
    example: 'МИН(B1:B10) или МИН(B)',
  },
  {
    id: 'max',
    name: 'МАКС',
    aliases: ['MAX', 'МАКСИМУМ'],
    description: 'Находит максимальное значение в диапазоне или столбце.',
    example: 'МАКС(B1:B10) или МАКС(B)',
  },
  {
    id: 'count',
    name: 'СЧЁТ',
    aliases: ['COUNT', 'СЧЕТ', 'КОЛИЧЕСТВО'],
    description: 'Считает количество заполненных ячеек в диапазоне или столбце.',
    example: 'СЧЁТ(B1:B10) или СЧЁТ(B)',
  },
  {
    id: 'date',
    name: 'DATE',
    aliases: ['ДАТА'],
    description: 'Создаёт дату из года, месяца и дня (для столбцов типа «Дата»).',
    example: 'DATE(2026,1,15)',
  },
  {
    id: 'today',
    name: 'TODAY',
    aliases: ['СЕГОДНЯ'],
    description: 'Возвращает сегодняшнюю дату (для столбцов типа «Дата»).',
    example: 'TODAY()',
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
