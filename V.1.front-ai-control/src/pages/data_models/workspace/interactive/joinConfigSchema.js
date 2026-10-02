/**
 * Settings schema for the «Объединение» processing-block (DataCode JOIN / merge_tables).
 *
 * Docs: external/DataCode/docs/ru/2-язык/таблицы/join.md
 * Examples: examples/ru/08-создание модели данных/05-объединения_таблиц.dc
 */

import { sanitizeIdentifier } from './schema.js';

export const JOIN_MODE_OPTIONS = [
  { value: 'join', label: 'Соединение (JOIN)' },
  { value: 'merge', label: 'Сложение строк (merge_tables)' },
];

export const JOIN_TYPE_OPTIONS = [
  { value: 'inner', label: 'INNER — только совпадения' },
  { value: 'left', label: 'LEFT — все строки слева' },
  { value: 'right', label: 'RIGHT — все строки справа' },
  { value: 'full', label: 'FULL — все строки обеих таблиц' },
  { value: 'cross', label: 'CROSS — декартово произведение' },
  { value: 'semi', label: 'SEMI — слева, у которых есть совпадение' },
  { value: 'anti', label: 'ANTI — слева без совпадений' },
  { value: 'zip', label: 'ZIP — по позиции строк' },
  { value: 'asof', label: 'ASOF — по ближайшему времени' },
];

export const JOIN_FN = {
  inner: 'inner_join',
  left: 'left_join',
  right: 'right_join',
  full: 'full_join',
  cross: 'cross_join',
  semi: 'semi_join',
  anti: 'anti_join',
  zip: 'zip_join',
  asof: 'asof_join',
};

export const ASOF_DIRECTION_OPTIONS = [
  { value: 'backward', label: 'backward — ближайшее ≤' },
  { value: 'forward', label: 'forward — ближайшее ≥' },
  { value: 'nearest', label: 'nearest — ближайшее любое' },
];

export function joinNeedsKeys(joinType) {
  return !['cross', 'zip', 'asof'].includes(joinType);
}

export function joinKeepsRightColumns(joinType) {
  return joinType !== 'semi' && joinType !== 'anti';
}

export function createDefaultJoinKey() {
  return { leftColumn: '', rightColumn: '' };
}

export function createDefaultJoinStep(patch = {}) {
  return {
    id: patch.id || `js_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    connectionId: patch.connectionId ?? null,
    rightTableVariable: patch.rightTableVariable || '',
    keys: Array.isArray(patch.keys) && patch.keys.length
      ? patch.keys.map((k) => ({
        leftColumn: k?.leftColumn || '',
        rightColumn: k?.rightColumn || '',
      }))
      : [createDefaultJoinKey()],
    asofColumn: patch.asofColumn || '',
    asofBy: patch.asofBy || '',
    asofDirection: patch.asofDirection || 'backward',
  };
}

export function normalizeJoinSettings(settings = {}) {
  const joinType = JOIN_TYPE_OPTIONS.some((o) => o.value === settings.joinType)
    ? settings.joinType
    : 'left';
  const joinMode = settings.joinMode === 'merge' ? 'merge' : 'join';
  return {
    ...settings,
    joinMode,
    joinType,
    joinSeparateOutput: settings.joinSeparateOutput !== false,
    joinSteps: Array.isArray(settings.joinSteps)
      ? settings.joinSteps.map((step) => createDefaultJoinStep(step))
      : [],
  };
}

export function unionColumnLists(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const col of list || []) {
      const name = String(col || '').trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

export function joinResultColumns(leftColumns = [], rightColumns = [], joinType = 'left') {
  if (!joinKeepsRightColumns(joinType)) return [...(leftColumns || [])];
  return unionColumnLists(leftColumns, rightColumns);
}

export function isJoinSeparateOutput(settings = {}) {
  if (settings.joinSeparateOutput === true) return true;
  if (settings.joinSeparateOutput === false) return false;
  return true;
}

export function buildDefaultSeparateJoinVariableName(inputVariable = 'data', widgetId = null) {
  const base = sanitizeIdentifier(inputVariable, 'data');
  if (widgetId == null || widgetId === '') {
    return sanitizeIdentifier(`${base}_join`, 'joined');
  }
  return sanitizeIdentifier(`${base}_join_${widgetId}`, `${base}_join`);
}

export function resolveJoinOutputVariableName(settings = {}, inputVariable = 'data', context = {}) {
  const inputVar = sanitizeIdentifier(inputVariable, 'data');
  if (!isJoinSeparateOutput(settings)) return inputVar;
  const custom = settings.dataCodeVariableName?.trim();
  if (custom) {
    return sanitizeIdentifier(
      custom,
      buildDefaultSeparateJoinVariableName(inputVar, context.widgetId),
    );
  }
  return buildDefaultSeparateJoinVariableName(inputVar, context.widgetId);
}
