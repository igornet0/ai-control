import { FormulaError } from './errors.js';

/** @typedef {{ type: string, pos: number, raw: string, value?: number|string, ignoreFilters?: boolean }} Token */

const WS = /\s/;

function isIdentStart(c) {
  return /[A-Za-z_]/.test(c);
}

function isIdentPart(c) {
  return /[A-Za-z0-9_.]/.test(c);
}

/**
 * @param {string} input
 * @returns {Token[]}
 */
export function tokenize(input) {
  const s = String(input ?? '');
  const out = [];
  let i = 0;
  const n = s.length;

  const push = (t) => {
    out.push(t);
  };

  while (i < n) {
    const c = s[i];
    if (WS.test(c)) {
      i += 1;
      continue;
    }
    const pos = i;

    if (c === '!' && i + 1 < n && s[i + 1] === '=') {
      push({ type: '!=', pos, raw: '!=' });
      i += 2;
      continue;
    }
    if (c === '>' && i + 1 < n && s[i + 1] === '=') {
      push({ type: '>=', pos, raw: '>=' });
      i += 2;
      continue;
    }
    if (c === '<' && i + 1 < n && s[i + 1] === '=') {
      push({ type: '<=', pos, raw: '<=' });
      i += 2;
      continue;
    }
    if (c === '=' || c === '>' || c === '<') {
      push({ type: c, pos, raw: c });
      i += 1;
      continue;
    }

    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let value = '';
      while (j < n) {
        const ch = s[j];
        if (ch === '\\' && j + 1 < n) {
          value += s[j + 1];
          j += 2;
          continue;
        }
        if (ch === quote) break;
        value += ch;
        j += 1;
      }
      if (j >= n) {
        throw new FormulaError('SYNTAX', `Не закрыта строка ${quote}…${quote}`, pos);
      }
      const raw = s.slice(i, j + 1);
      push({ type: 'STRING', pos, raw, value });
      i = j + 1;
      continue;
    }

    if (
      c === '+' ||
      c === '-' ||
      c === '*' ||
      c === '/' ||
      c === '(' ||
      c === ')' ||
      c === ',' ||
      c === '{' ||
      c === '}'
    ) {
      push({ type: c, pos, raw: c });
      i += 1;
      continue;
    }
    if (/\d/.test(c)) {
      let j = i;
      while (j < n && /\d/.test(s[j])) j += 1;
      if (j < n && s[j] === '.') {
        j += 1;
        while (j < n && /\d/.test(s[j])) j += 1;
      }
      const raw = s.slice(i, j);
      const v = Number(raw);
      if (!Number.isFinite(v)) {
        throw new FormulaError('BAD_NUMBER', `Некорректное число: «${raw}»`, pos);
      }
      push({ type: 'NUMBER', pos, raw, value: v });
      i = j;
      continue;
    }
    if (c === '.' && i + 1 < n && /\d/.test(s[i + 1])) {
      let j = i + 1;
      while (j < n && /\d/.test(s[j])) j += 1;
      const raw = s.slice(i, j);
      const v = Number(raw);
      if (!Number.isFinite(v)) {
        throw new FormulaError('BAD_NUMBER', `Некорректное число: «${raw}»`, pos);
      }
      push({ type: 'NUMBER', pos, raw, value: v });
      i = j;
      continue;
    }
    /** $[Таблица.Имя] — поле без учёта фильтров дашборда */
    if (c === '$' && i + 1 < n && s[i + 1] === '[') {
      let j = i + 2;
      while (j < n && s[j] !== ']') j += 1;
      if (j >= n) {
        throw new FormulaError('SYNTAX', 'Не закрыта квадратная скобка «]»', pos);
      }
      const inner = s.slice(i + 2, j).trim();
      if (!inner) {
        throw new FormulaError('SYNTAX', 'Пустое имя поля внутри «$[]»', pos);
      }
      const raw = s.slice(i, j + 1);
      push({ type: 'IDENT', pos, raw, value: inner, ignoreFilters: true });
      i = j + 1;
      continue;
    }
    /** Поля данных в квадратных скобках: `[Таблица.Имя]` — поддержка Unicode и имён таблиц из SQLite */
    if (c === '[') {
      let j = i + 1;
      while (j < n && s[j] !== ']') j += 1;
      if (j >= n) {
        throw new FormulaError('SYNTAX', 'Не закрыта квадратная скобка «]»', pos);
      }
      const inner = s.slice(i + 1, j).trim();
      if (!inner) {
        throw new FormulaError('SYNTAX', 'Пустое имя поля внутри «[]»', pos);
      }
      const raw = s.slice(i, j + 1);
      push({ type: 'IDENT', pos, raw, value: inner });
      i = j + 1;
      continue;
    }
    /** @name — скалярная переменная модели (локальный runtime) */
    if (c === '@') {
      if (i + 1 >= n || !isIdentStart(s[i + 1])) {
        throw new FormulaError('SYNTAX', 'После «@» укажите имя переменной', pos);
      }
      let j = i + 1;
      while (j < n && isIdentPart(s[j])) j += 1;
      const name = s.slice(i + 1, j);
      const raw = s.slice(i, j);
      push({ type: 'VAR', pos, raw, value: name });
      i = j;
      continue;
    }
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < n && isIdentPart(s[j])) j += 1;
      const raw = s.slice(i, j);
      push({ type: 'IDENT', pos, raw, value: raw });
      i = j;
      continue;
    }
    throw new FormulaError('BAD_CHAR', `Неожиданный символ «${c}»`, pos);
  }
  push({ type: 'EOF', pos: n, raw: '' });
  return out;
}
