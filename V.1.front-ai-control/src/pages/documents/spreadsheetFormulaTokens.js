/**
 * Лексер формул таблиц (как в Excel / Google Таблицах).
 *
 * Используется вычислителем, подсветкой ссылок при правке формулы и сдвигом ссылок
 * при копировании / автозаполнении. Модуль без зависимостей, чтобы его можно было
 * импортировать из spreadsheetGridUtils без циклов.
 *
 * Поддерживается:
 *  - A1, $A$1, A$1, $A1, A1:B5, B:B, 1:1, Лист2!A1, 'Лист 2'!A1:B3, Лист2!B (весь столбец);
 *  - числа 12, 1.5, .5, 1e3 и «1,5» (десятичная запятая — когда аргументы разделены «;»
 *    или запятая стоит вне скобок функции);
 *  - строки "…" (кавычка экранируется удвоением) и устаревшие '…' вне ссылок на лист;
 *  - операторы + - * / ^ & % = <> < > <= >= (и устаревшие != ==), разделители , и ;.
 */

export const MAX_COLUMN_LETTERS = 3;

/** «A» → 0, «AB» → 27; -1 если не буквы столбца. */
export function columnLabelToIndex(label) {
  const letters = String(label ?? '').toUpperCase();
  if (!/^[A-Z]+$/.test(letters)) return -1;
  let col = 0;
  for (let i = 0; i < letters.length; i += 1) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

/** 0 → «A», 27 → «AB». */
export function columnIndexToLabel(index) {
  let label = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

const SHEET_QUOTED_RE = /^'((?:[^']|'')+)'!/;
const SHEET_BARE_RE = /^([^\s'!+\-*/^&(),;:<>=%"{}]+)!/u;
const CELL_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)/;
const COL_RANGE_RE = /^(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})/;
const ROW_RANGE_RE = /^(\$?)(\d+):(\$?)(\d+)/;
const COL_ONLY_RE = /^(\$?)([A-Za-z]{1,3})/;
const IDENT_RE = /^[\p{L}_][\p{L}\p{N}_.]*/u;
const NUMBER_RE = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
const NUMBER_COMMA_RE = /^\d+,\d+(?:[eE][+-]?\d+)?/;
const IDENT_CHAR_RE = /[\p{L}\p{N}_.]/u;
const TWO_CHAR_OPS = ['<=', '>=', '<>', '!=', '=='];
const ONE_CHAR_OPS = '+-*/^&%=<>';

function isIdentChar(ch) {
  return ch != null && IDENT_CHAR_RE.test(ch);
}

/** Есть ли «;» вне строк — тогда запятая всегда десятичная (русская раскладка Excel). */
function detectSemicolonSeparators(body) {
  let inString = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '"') inString = !inString;
    else if (!inString && ch === ';') return true;
  }
  return false;
}

function nextNonSpaceChar(s, from) {
  let i = from;
  while (i < s.length && /\s/.test(s[i])) i += 1;
  return s[i];
}

function parseCellParts(m) {
  const c = columnLabelToIndex(m[2]);
  const r = parseInt(m[4], 10) - 1;
  if (c < 0 || r < 0) return null;
  return { r, c, absC: m[1] === '$', absR: m[3] === '$' };
}

/**
 * Попробовать прочитать ссылку с позиции i.
 * @returns {{ token: object, end: number } | null}
 */
function readReference(s, i) {
  const rest = s.slice(i);
  const quoted = rest.match(SHEET_QUOTED_RE);
  if (quoted) {
    return readReferenceAfterSheet(s, i, quoted[1].replace(/''/g, "'"), quoted[0]);
  }
  const bare = rest.match(SHEET_BARE_RE);
  if (bare && !/^\d+$/.test(bare[1])) {
    const withSheet = readReferenceAfterSheet(s, i, bare[1], bare[0]);
    // «A1!=5» — устаревший оператор !=, а не лист «A1».
    if (withSheet) return withSheet;
  }
  return readReferenceAfterSheet(s, i, null, '');
}

function readReferenceAfterSheet(s, i, sheetName, sheetText) {
  const rest = s.slice(i);
  const offset = sheetText.length;
  const tail = rest.slice(offset);
  const base = { type: 'ref', sheetName, sheetText, start: i };

  const cell = tail.match(CELL_RE);
  if (cell) {
    let len = cell[0].length;
    const a = parseCellParts(cell);
    let b = null;
    const afterA = tail.slice(len);
    if (afterA.startsWith(':')) {
      const second = afterA.slice(1).match(CELL_RE);
      if (second) {
        b = parseCellParts(second);
        len += 1 + second[0].length;
      }
    }
    const nextCh = tail[len];
    if (a && !isIdentChar(nextCh) && (b || nextCh !== ':')) {
      // «LOG10(» — это функция, а не ячейка LOG10.
      if (!b && !sheetName && nextNonSpaceChar(tail, len) === '(') return null;
      return {
        token: { ...base, kind: b ? 'range' : 'cell', a, b: b || a, end: i + offset + len },
        end: i + offset + len,
      };
    }
  }

  const colRange = tail.match(COL_RANGE_RE);
  if (colRange && !isIdentChar(tail[colRange[0].length])) {
    const c0 = columnLabelToIndex(colRange[2]);
    const c1 = columnLabelToIndex(colRange[4]);
    if (c0 >= 0 && c1 >= 0) {
      const len = colRange[0].length;
      return {
        token: {
          ...base,
          kind: 'cols',
          a: { r: 0, c: c0, absC: colRange[1] === '$', absR: false },
          b: { r: 0, c: c1, absC: colRange[3] === '$', absR: false },
          end: i + offset + len,
        },
        end: i + offset + len,
      };
    }
  }

  const rowRange = tail.match(ROW_RANGE_RE);
  if (rowRange && !isIdentChar(tail[rowRange[0].length]) && (sheetName || /^[$\d]/.test(tail))) {
    const r0 = parseInt(rowRange[2], 10) - 1;
    const r1 = parseInt(rowRange[4], 10) - 1;
    if (r0 >= 0 && r1 >= 0) {
      const len = rowRange[0].length;
      return {
        token: {
          ...base,
          kind: 'rows',
          a: { r: r0, c: 0, absR: rowRange[1] === '$', absC: false },
          b: { r: r1, c: 0, absR: rowRange[3] === '$', absC: false },
          end: i + offset + len,
        },
        end: i + offset + len,
      };
    }
  }

  // Устаревший синтаксис: Лист2!B — весь столбец другого листа.
  if (sheetName) {
    const colOnly = tail.match(COL_ONLY_RE);
    if (colOnly && !isIdentChar(tail[colOnly[0].length])) {
      const c = columnLabelToIndex(colOnly[2]);
      const len = colOnly[0].length;
      return {
        token: {
          ...base,
          kind: 'cols',
          a: { r: 0, c, absC: colOnly[1] === '$', absR: false },
          b: { r: 0, c, absC: colOnly[1] === '$', absR: false },
          legacyColumn: true,
          end: i + offset + len,
        },
        end: i + offset + len,
      };
    }
  }
  return null;
}

/**
 * Разбить тело формулы (без ведущего «=») на токены с позициями.
 * @param {string} body
 * @param {{ keepWhitespace?: boolean }} [opts]
 * @returns {Array<object>}
 */
export function tokenizeFormulaBody(body, { keepWhitespace = false } = {}) {
  const s = String(body ?? '');
  const semicolonMode = detectSemicolonSeparators(s);
  const tokens = [];
  let depth = 0;
  let i = 0;

  const push = (tok) => tokens.push(tok);

  while (i < s.length) {
    const ch = s[i];

    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j += 1;
      if (keepWhitespace) push({ type: 'ws', text: s.slice(i, j), start: i, end: j });
      i = j;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      let value = '';
      let closed = false;
      while (j < s.length) {
        if (s[j] === '"' && s[j + 1] === '"') {
          value += '"';
          j += 2;
          continue;
        }
        if (s[j] === '"') {
          closed = true;
          j += 1;
          break;
        }
        value += s[j];
        j += 1;
      }
      push(closed
        ? { type: 'str', value, start: i, end: j }
        : { type: 'error', message: 'Незакрытая кавычка', start: i, end: j });
      i = j;
      continue;
    }

    if (ch === "'" || ch === '$' || /[A-Za-z0-9]/.test(ch) || (ch !== '.' && /[\p{L}_]/u.test(ch))) {
      const ref = readReference(s, i);
      if (ref) {
        push({ ...ref.token, text: s.slice(i, ref.end) });
        i = ref.end;
        continue;
      }
    }

    if (ch === "'") {
      // Устаревшая строка в одинарных кавычках (не ссылка на лист).
      const close = s.indexOf("'", i + 1);
      if (close > i) {
        push({ type: 'str', value: s.slice(i + 1, close), start: i, end: close + 1, legacyQuote: true });
        i = close + 1;
      } else {
        push({ type: 'error', message: 'Незакрытая кавычка', start: i, end: s.length });
        i = s.length;
      }
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      const rest = s.slice(i);
      const commaAllowed = semicolonMode || depth === 0;
      const commaNum = commaAllowed ? rest.match(NUMBER_COMMA_RE) : null;
      const num = commaNum || rest.match(NUMBER_RE);
      if (num) {
        const text = num[0];
        push({ type: 'num', value: parseFloat(text.replace(',', '.')), start: i, end: i + text.length });
        i += text.length;
        continue;
      }
    }

    if (/[\p{L}_]/u.test(ch)) {
      const m = s.slice(i).match(IDENT_RE);
      const name = m[0];
      const end = i + name.length;
      const isFunc = nextNonSpaceChar(s, end) === '(';
      push({ type: isFunc ? 'func' : 'ident', name, start: i, end });
      i = end;
      continue;
    }

    const two = s.slice(i, i + 2);
    if (TWO_CHAR_OPS.includes(two)) {
      push({ type: 'op', op: two, start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (ONE_CHAR_OPS.includes(ch)) {
      push({ type: 'op', op: ch, start: i, end: i + 1 });
      i += 1;
      continue;
    }
    if (ch === '(') {
      depth += 1;
      push({ type: 'lparen', start: i, end: i + 1 });
      i += 1;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      push({ type: 'rparen', start: i, end: i + 1 });
      i += 1;
      continue;
    }
    if (ch === ',' || ch === ';') {
      push({ type: 'sep', start: i, end: i + 1 });
      i += 1;
      continue;
    }

    push({ type: 'error', message: `Неожиданный символ «${ch}»`, start: i, end: i + 1 });
    i += 1;
  }

  tokens.forEach((t) => {
    if (t.text == null) t.text = s.slice(t.start, t.end);
  });
  return tokens;
}

/** Формула ли это (начинается с «=» и не пустая). */
export function isFormulaText(raw) {
  const s = String(raw ?? '').trim();
  return s.startsWith('=') && s.length > 1;
}

/**
 * Токены формулы с позициями относительно полного текста (включая «=»).
 */
export function tokenizeFormula(formula, opts) {
  const raw = String(formula ?? '');
  const eq = raw.indexOf('=');
  if (eq < 0) return [];
  const offset = eq + 1;
  return tokenizeFormulaBody(raw.slice(offset), opts).map((t) => ({
    ...t,
    start: t.start + offset,
    end: t.end + offset,
  }));
}

function formatRefPart({ r, c, absR, absC }, kind) {
  if (kind === 'cols') return `${absC ? '$' : ''}${columnIndexToLabel(c)}`;
  if (kind === 'rows') return `${absR ? '$' : ''}${r + 1}`;
  return `${absC ? '$' : ''}${columnIndexToLabel(c)}${absR ? '$' : ''}${r + 1}`;
}

/** Собрать текст ссылки из токена (с префиксом листа как в исходнике). */
export function formatRefToken(tok) {
  const a = formatRefPart(tok.a, tok.kind);
  if (tok.legacyColumn) return `${tok.sheetText || ''}${a}`;
  const body = tok.kind === 'cell' ? a : `${a}:${formatRefPart(tok.b, tok.kind)}`;
  return `${tok.sheetText || ''}${body}`;
}

const NON_COLUMN_IDENTS = new Set(['TRUE', 'FALSE']);

/** Голая буква столбца (устаревшее «B» = ячейка B текущей строки). */
export function isBareColumnIdent(tok) {
  return tok?.type === 'ident'
    && /^[A-Za-z]{1,3}$/.test(tok.name)
    && !NON_COLUMN_IDENTS.has(tok.name.toUpperCase());
}

/**
 * Сдвинуть относительные ссылки формулы (копирование / автозаполнение, как в Excel).
 * Абсолютные части ($A, $1) и строки в кавычках не меняются; ссылка за край листа → #REF!.
 */
export function shiftFormulaReferences(formula, rowOffset, colOffset) {
  if (!isFormulaText(formula) || (!rowOffset && !colOffset)) return formula;
  const raw = String(formula);
  const tokens = tokenizeFormula(raw, { keepWhitespace: true });
  let out = raw.slice(0, tokens[0]?.start ?? raw.length);
  let cursor = tokens[0]?.start ?? raw.length;

  tokens.forEach((tok) => {
    out += raw.slice(cursor, tok.start);
    cursor = tok.end;
    if (tok.type === 'ref') {
      const shiftPart = (p) => ({
        ...p,
        r: tok.kind === 'cols' || p.absR ? p.r : p.r + rowOffset,
        c: tok.kind === 'rows' || p.absC ? p.c : p.c + colOffset,
      });
      const a = shiftPart(tok.a);
      const b = shiftPart(tok.b);
      if (a.r < 0 || a.c < 0 || b.r < 0 || b.c < 0) {
        out += '#REF!';
        return;
      }
      out += formatRefToken({ ...tok, a, b });
      return;
    }
    if (colOffset && isBareColumnIdent(tok)) {
      const c = columnLabelToIndex(tok.name) + colOffset;
      out += c >= 0 ? columnIndexToLabel(c) : '#REF!';
      return;
    }
    out += raw.slice(tok.start, tok.end);
  });
  out += raw.slice(cursor);
  return out;
}

/**
 * Все ссылки формулы с позициями — для цветной подсветки в строке формулы и на сетке.
 * @returns {Array<{ start: number, end: number, sheetName: string|null, kind: string,
 *   r0: number, c0: number, r1: number, c1: number, bareColumn?: boolean }>}
 */
export function extractFormulaReferences(formula) {
  if (!String(formula ?? '').trim().startsWith('=')) return [];
  const out = [];
  tokenizeFormula(formula).forEach((tok) => {
    if (tok.type === 'ref') {
      out.push({
        start: tok.start,
        end: tok.end,
        sheetName: tok.sheetName,
        kind: tok.kind,
        r0: Math.min(tok.a.r, tok.b.r),
        r1: Math.max(tok.a.r, tok.b.r),
        c0: Math.min(tok.a.c, tok.b.c),
        c1: Math.max(tok.a.c, tok.b.c),
      });
    } else if (isBareColumnIdent(tok)) {
      const c = columnLabelToIndex(tok.name);
      out.push({
        start: tok.start,
        end: tok.end,
        sheetName: null,
        kind: 'barecol',
        bareColumn: true,
        r0: 0,
        r1: 0,
        c0: c,
        c1: c,
      });
    }
  });
  return out;
}
