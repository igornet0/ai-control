/**
 * Каталог операций виджета «Трансформация».
 * Каждая операция описывает UI-параметры и тип для генерации DataCode.
 */

export const TRANSFORM_OPERATION_GROUPS = [
  {
    id: 'columns',
    label: 'Колонки',
    operations: [
      { type: 'renameColumn', label: 'Переименовать колонку', params: ['column', 'newName'] },
      { type: 'selectColumns', label: 'Оставить только выбранные', params: ['columns'] },
      { type: 'dropColumn', label: 'Удалить колонку', params: ['column'] },
      { type: 'reorderColumns', label: 'Изменить порядок', params: ['columns'] },
      { type: 'addColumn', label: 'Добавить колонку', params: ['name', 'value'] },
    ],
  },
  {
    id: 'types',
    label: 'Типы данных',
    operations: [
      { type: 'changeType', label: 'Изменить тип', params: ['column', 'targetType', 'dateFormat', 'decimalSeparator'] },
    ],
  },
  {
    id: 'text',
    label: 'Текст',
    operations: [
      { type: 'trim', label: 'Trim', params: ['columns'] },
      { type: 'upper', label: 'Upper', params: ['columns'] },
      { type: 'lower', label: 'Lower', params: ['columns'] },
      { type: 'capitalize', label: 'Capitalize', params: ['columns'] },
      { type: 'replace', label: 'Replace', params: ['column', 'find', 'replaceWith'] },
      { type: 'splitColumn', label: 'Разделить', params: ['column', 'delimiter', 'targetColumns'] },
      { type: 'joinColumns', label: 'Объединить', params: ['columns', 'targetColumn', 'separator'] },
    ],
  },
  {
    id: 'numbers',
    label: 'Числа',
    operations: [
      { type: 'round', label: 'Round', params: ['column', 'decimals'] },
      { type: 'ceil', label: 'Ceil', params: ['column'] },
      { type: 'floor', label: 'Floor', params: ['column'] },
      { type: 'abs', label: 'Abs', params: ['column'] },
    ],
  },
  {
    id: 'dates',
    label: 'Даты',
    operations: [
      { type: 'extractDatePart', label: 'Извлечь часть даты', params: ['column', 'part', 'targetColumn'] },
    ],
  },
  {
    id: 'nulls',
    label: 'Пустые значения',
    operations: [
      { type: 'fillEmpty', label: 'Заменить пустые', params: ['column', 'value'] },
      { type: 'dropEmptyRows', label: 'Удалить строки с пустым', params: ['column'] },
    ],
  },
  {
    id: 'rows',
    label: 'Строки',
    operations: [
      { type: 'distinct', label: 'Удалить дубликаты', params: ['columns'] },
      { type: 'sort', label: 'Сортировка', params: ['sorts'] },
      { type: 'rowNumber', label: 'Нумерация строк', params: ['targetColumn', 'startFrom'] },
    ],
  },
  {
    id: 'values',
    label: 'Значения',
    operations: [
      { type: 'valueMap', label: 'Переименовать значения', params: ['column', 'mappings'] },
    ],
  },
];

export const TRANSFORM_TYPE_OPTIONS = [
  { value: 'string', label: 'string' },
  { value: 'int', label: 'int' },
  { value: 'float', label: 'float' },
  { value: 'bool', label: 'bool' },
  { value: 'datetime', label: 'datetime' },
];

export const DATE_PART_OPTIONS = [
  { value: 'year', label: 'Год' },
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'day', label: 'День' },
  { value: 'hour', label: 'Час' },
  { value: 'minute', label: 'Минута' },
  { value: 'weekday', label: 'День недели' },
  { value: 'week', label: 'Номер недели' },
];

const ALL_OPERATIONS = TRANSFORM_OPERATION_GROUPS.flatMap((g) => g.operations);

export function getTransformOperationMeta(type) {
  return ALL_OPERATIONS.find((op) => op.type === type) || null;
}

export function createDefaultTransformOperation(type, availableFields = []) {
  const meta = getTransformOperationMeta(type);
  const firstField = availableFields[0] || '';
  const base = {
    id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    enabled: true,
    params: {},
  };

  switch (type) {
    case 'renameColumn':
      base.params = { column: firstField, newName: '' };
      break;
    case 'selectColumns':
    case 'reorderColumns':
      base.params = { columns: availableFields.slice(0, Math.min(3, availableFields.length)) };
      break;
    case 'dropColumn':
      base.params = { column: firstField };
      break;
    case 'addColumn':
      base.params = { name: 'NewColumn', value: '' };
      break;
    case 'changeType':
      base.params = { column: firstField, targetType: 'int', dateFormat: '', decimalSeparator: '.' };
      break;
    case 'trim':
    case 'upper':
    case 'lower':
    case 'capitalize':
      base.params = { columns: firstField ? [firstField] : [] };
      break;
    case 'replace':
      base.params = { column: firstField, find: '', replaceWith: '' };
      break;
    case 'splitColumn':
      base.params = { column: firstField, delimiter: ' ', targetColumns: ['Part1', 'Part2'] };
      break;
    case 'joinColumns':
      base.params = {
        columns: availableFields.slice(0, 2),
        targetColumn: 'Merged',
        separator: ' ',
      };
      break;
    case 'round':
      base.params = { column: firstField, decimals: 0 };
      break;
    case 'ceil':
    case 'floor':
    case 'abs':
      base.params = { column: firstField };
      break;
    case 'extractDatePart':
      base.params = { column: firstField, part: 'year', targetColumn: `${firstField}_year` };
      break;
    case 'fillEmpty':
      base.params = { column: firstField, value: '' };
      break;
    case 'dropEmptyRows':
      base.params = { column: firstField };
      break;
    case 'distinct':
      base.params = { columns: availableFields.slice(0, Math.min(2, availableFields.length)) };
      break;
    case 'sort':
      base.params = {
        sorts: firstField ? [{ column: firstField, ascending: true }] : [],
      };
      break;
    case 'rowNumber':
      base.params = { targetColumn: 'RowNumber', startFrom: 1 };
      break;
    case 'valueMap':
      base.params = {
        column: firstField,
        mappings: [{ from: '', to: '' }],
      };
      break;
    default:
      base.params = meta?.params ? Object.fromEntries(meta.params.map((p) => [p, ''])) : {};
  }

  return base;
}
