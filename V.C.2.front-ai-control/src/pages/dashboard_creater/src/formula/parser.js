import { FormulaError } from './errors.js';
import {
  cloneWhere,
  flattenAndLeaves,
  normalizeLikePattern,
} from './localFilters.js';

/**
 * @typedef {import('./tokenizer.js').Token} Token
 * @typedef {import('./localFilters.js').WhereNode} WhereNode
 * @typedef {import('./localFilters.js').SqlLocalFilter} SqlLocalFilter
 */

const AGG = new Set(['SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'COUNT_DISTINCT']);
const CMP_OPS = new Set(['=', '!=', '>', '<', '>=', '<=']);
const CMP_TO_API = {
  '=': 'eq',
  '!=': 'ne',
  '>': 'gt',
  '<': 'lt',
  '>=': 'gte',
  '<=': 'lte',
};

/**
 * @param {Token[]} tokens
 * @param {{ allowFieldRef?: boolean }} [opts]
 */
export function parseExpression(tokens, opts = {}) {
  const allowFieldRef = !!opts.allowFieldRef;
  let idx = 0;

  function peek() {
    return tokens[idx] || { type: 'EOF', pos: 0, raw: '' };
  }

  function eat(expected) {
    const t = peek();
    if (expected && t.type !== expected) {
      throw new FormulaError(
        'SYNTAX',
        `Ожидалось «${expected}», найдено «${t.raw || t.type}»`,
        t.pos,
      );
    }
    idx += 1;
    return t;
  }

  function identUpper() {
    const t = peek();
    if (t.type !== 'IDENT') return '';
    return String(t.value || '').toUpperCase();
  }

  /** Полное выражение: OR / AND / сравнения / арифметика / IF / RGB / MATCH */
  function parseExpr() {
    return parseOr();
  }

  function parseOr() {
    let node = parseAnd();
    while (identUpper() === 'OR') {
      eat('IDENT');
      node = { t: 'logic', op: 'or', l: node, r: parseAnd() };
    }
    return node;
  }

  function parseAnd() {
    let node = parseCmp();
    while (identUpper() === 'AND') {
      eat('IDENT');
      node = { t: 'logic', op: 'and', l: node, r: parseCmp() };
    }
    return node;
  }

  function parseCmp() {
    let node = parseAddSub();
    const op = peek().type;
    if (CMP_OPS.has(op)) {
      eat(op);
      const r = parseAddSub();
      return { t: 'cmp', op, l: node, r };
    }
    return node;
  }

  function parseAddSub() {
    let node = parseMulDiv();
    while (peek().type === '+' || peek().type === '-') {
      const op = eat().type;
      const r = parseMulDiv();
      node = { t: 'bin', op, l: node, r };
    }
    return node;
  }

  function parseMulDiv() {
    let node = parseUnary();
    while (peek().type === '*' || peek().type === '/') {
      const op = eat().type;
      const r = parseUnary();
      node = { t: 'bin', op, l: node, r };
    }
    return node;
  }

  function parseUnary() {
    if (peek().type === '-') {
      eat('-');
      return { t: 'ua', x: parseUnary() };
    }
    return parsePrimary();
  }

  /**
   * @param {string} [ctx]
   * @returns {{ table: string, column: string }}
   */
  function parseQualifiedField(ctx = 'WHERE') {
    const fieldTok = peek();
    if (fieldTok.type !== 'IDENT') {
      throw new FormulaError('SYNTAX', `В ${ctx} ожидалось поле [таблица.колонка]`, fieldTok.pos);
    }
    eat('IDENT');
    const colName = String(fieldTok.value || '').trim();
    const dot = colName.indexOf('.');
    if (dot <= 0 || !colName.slice(dot + 1)) {
      throw new FormulaError(
        'SYNTAX',
        `В ${ctx} поле должно быть квалифицировано: [таблица.колонка]`,
        fieldTok.pos,
      );
    }
    const table = colName.slice(0, dot).trim();
    const column = colName.slice(dot + 1).trim();
    if (!table || !column) {
      throw new FormulaError(
        'SYNTAX',
        `В ${ctx} поле должно быть квалифицировано: [таблица.колонка]`,
        fieldTok.pos,
      );
    }
    return { table, column };
  }

  /**
   * @returns {{ table: string, column: string }[]}
   */
  function parseForFieldList() {
    /** @type {{ table: string, column: string }[]} */
    const fields = [parseQualifiedField('FOR')];
    while (peek().type === ',') {
      eat(',');
      fields.push(parseQualifiedField('FOR'));
    }
    const seen = new Set();
    for (const f of fields) {
      const k = `${f.table}.${f.column}`.toLowerCase();
      if (seen.has(k)) {
        throw new FormulaError(
          'SYNTAX',
          `Поле «[${f.table}.${f.column}]» повторяется в FOR`,
          peek().pos,
        );
      }
      seen.add(k);
    }
    return fields;
  }

  /**
   * @returns {string|number}
   */
  function parseLit() {
    const valTok = peek();
    if (valTok.type === 'NUMBER') {
      eat('NUMBER');
      return /** @type {number} */ (valTok.value);
    }
    if (valTok.type === 'STRING') {
      eat('STRING');
      return String(valTok.value ?? '');
    }
    throw new FormulaError(
      'SYNTAX',
      'Ожидалось число или строка в кавычках',
      valTok.pos,
    );
  }

  /**
   * @returns {WhereNode}
   */
  function parseWherePredicate() {
    const { table, column } = parseQualifiedField();

    // NOT IN
    if (identUpper() === 'NOT') {
      eat('IDENT');
      if (identUpper() !== 'IN') {
        throw new FormulaError('SYNTAX', 'После NOT ожидалось IN', peek().pos);
      }
      eat('IDENT');
      const values = parseInList();
      return { t: 'pred', table, column, op: 'not_in', values };
    }

    // IN
    if (identUpper() === 'IN') {
      eat('IDENT');
      const values = parseInList();
      return { t: 'pred', table, column, op: 'in', values };
    }

    // LIKE
    if (identUpper() === 'LIKE') {
      eat('IDENT');
      const patTok = peek();
      if (patTok.type !== 'STRING') {
        throw new FormulaError('SYNTAX', 'После LIKE ожидалась строка в кавычках', patTok.pos);
      }
      eat('STRING');
      return {
        t: 'pred',
        table,
        column,
        op: 'like',
        value: normalizeLikePattern(String(patTok.value ?? '')),
      };
    }

    const opTok = peek();
    if (!CMP_OPS.has(opTok.type)) {
      throw new FormulaError(
        'SYNTAX',
        'В WHERE ожидался оператор (=, !=, >, <, >=, <=, IN, NOT IN, LIKE)',
        opTok.pos,
      );
    }
    eat(opTok.type);
    const apiOp = CMP_TO_API[opTok.type];
    const value = parseLit();
    return { t: 'pred', table, column, op: apiOp, value };
  }

  /**
   * @returns {Array<string|number>}
   */
  function parseInList() {
    if (peek().type !== '(') {
      throw new FormulaError('SYNTAX', 'После IN ожидалась скобка «(»', peek().pos);
    }
    eat('(');
    /** @type {Array<string|number>} */
    const values = [];
    if (peek().type === ')') {
      throw new FormulaError('SYNTAX', 'Список IN не может быть пустым', peek().pos);
    }
    values.push(parseLit());
    while (peek().type === ',') {
      eat(',');
      values.push(parseLit());
    }
    if (peek().type !== ')') {
      throw new FormulaError('SYNTAX', 'Ожидалось «)» после списка IN', peek().pos);
    }
    eat(')');
    return values;
  }

  /**
   * @returns {WhereNode}
   */
  function parseWherePrimary() {
    if (peek().type === '(') {
      eat('(');
      const inner = parseWhereExpr();
      if (peek().type !== ')') {
        throw new FormulaError('SYNTAX', 'Не хватает «)» в WHERE', peek().pos);
      }
      eat(')');
      return inner;
    }
    return parseWherePredicate();
  }

  /**
   * @returns {WhereNode}
   */
  function parseWhereAnd() {
    const items = [parseWherePrimary()];
    while (identUpper() === 'AND') {
      eat('IDENT');
      items.push(parseWherePrimary());
    }
    if (items.length === 1) return items[0];
    return { t: 'and', items };
  }

  /**
   * @returns {WhereNode}
   */
  function parseWhereExpr() {
    const items = [parseWhereAnd()];
    while (identUpper() === 'OR') {
      eat('IDENT');
      items.push(parseWhereAnd());
    }
    if (items.length === 1) return items[0];
    return { t: 'or', items };
  }

  /**
   * @returns {WhereNode|null}
   */
  function parseWhereClause() {
    if (identUpper() !== 'WHERE') return null;
    eat('IDENT');
    return parseWhereExpr();
  }

  /**
   * @param {string} fn
   * @param {string} col
   * @param {boolean} ignoreFilters
   * @param {WhereNode|null} localWhere
   */
  function makeAgg(fn, col, ignoreFilters, localWhere) {
    /** @type {Record<string, unknown>} */
    const node = { t: 'agg', fn, col };
    if (ignoreFilters) node.ignoreFilters = true;
    const w = cloneWhere(localWhere);
    if (w) {
      node.localWhere = w;
      const flat = flattenAndLeaves(w);
      if (flat?.length) node.localFilters = flat;
    }
    return node;
  }

  function parseRgbCall(pos) {
    eat('(');
    const r = parseAddSub();
    if (peek().type !== ',') {
      throw new FormulaError('SYNTAX', 'RGB() ожидает 3 числа: RGB(r, g, b)', peek().pos);
    }
    eat(',');
    const g = parseAddSub();
    if (peek().type !== ',') {
      throw new FormulaError('SYNTAX', 'RGB() ожидает 3 числа: RGB(r, g, b)', peek().pos);
    }
    eat(',');
    const b = parseAddSub();
    if (peek().type !== ')') {
      throw new FormulaError('SYNTAX', 'Ожидалось «)» после RGB()', peek().pos);
    }
    eat(')');
    return { t: 'rgb', r, g, b, pos };
  }

  function parseIfCall(pos) {
    eat('(');
    const cond = parseExpr();
    if (peek().type !== ',') {
      throw new FormulaError('SYNTAX', 'IF() ожидает 3 аргумента: IF(условие, тогда, иначе)', peek().pos);
    }
    eat(',');
    const thenN = parseExpr();
    if (peek().type !== ',') {
      throw new FormulaError('SYNTAX', 'IF() ожидает 3 аргумента: IF(условие, тогда, иначе)', peek().pos);
    }
    eat(',');
    const elseN = parseExpr();
    if (peek().type !== ')') {
      throw new FormulaError('SYNTAX', 'Ожидалось «)» после IF()', peek().pos);
    }
    eat(')');
    return { t: 'if', cond, then: thenN, else: elseN, pos };
  }

  function parseMatchExpr(pos) {
    const subject = parseAddSub();
    if (peek().type !== '{') {
      throw new FormulaError('SYNTAX', 'После MATCH ожидалось «{»', peek().pos);
    }
    eat('{');
    /** @type {{ value: string|number, body: object }[]} */
    const cases = [];
    while (identUpper() === 'CASE') {
      eat('IDENT');
      const value = parseLit();
      if (peek().type !== '{') {
        throw new FormulaError('SYNTAX', 'После CASE значения ожидалось «{»', peek().pos);
      }
      eat('{');
      const body = parseExpr();
      if (peek().type !== '}') {
        throw new FormulaError('SYNTAX', 'Не хватает «}» после тела CASE', peek().pos);
      }
      eat('}');
      cases.push({ value, body });
    }
    /** @type {object|null} */
    let elseBody = null;
    if (identUpper() === 'ELSE') {
      eat('IDENT');
      if (peek().type !== '{') {
        throw new FormulaError('SYNTAX', 'После ELSE ожидалось «{»', peek().pos);
      }
      eat('{');
      elseBody = parseExpr();
      if (peek().type !== '}') {
        throw new FormulaError('SYNTAX', 'Не хватает «}» после ELSE', peek().pos);
      }
      eat('}');
    }
    if (peek().type !== '}') {
      throw new FormulaError('SYNTAX', 'Не хватает «}» после MATCH', peek().pos);
    }
    eat('}');
    if (cases.length === 0) {
      throw new FormulaError('SYNTAX', 'MATCH должен содержать хотя бы один CASE', pos);
    }
    return { t: 'match', subject, cases, else: elseBody, pos };
  }

  function parseAggCall(fn, name, pos) {
    eat('(');
    let col = null;
    let ignoreFilters = false;
    const p0 = peek();
    if (p0.type === ')') {
      if (fn === 'COUNT') {
        col = '*';
      } else {
        throw new FormulaError('SYNTAX', `Функция ${fn} требует аргумент (поле)`, p0.pos);
      }
    } else if (p0.type === '*') {
      eat('*');
      if (fn !== 'COUNT') {
        throw new FormulaError('SYNTAX', 'Символ «*» допустим только внутри COUNT()', p0.pos);
      }
      col = '*';
    } else if (p0.type === 'IDENT') {
      const tok = eat('IDENT');
      col = String(tok.value);
      ignoreFilters = !!tok.ignoreFilters;
    } else {
      throw new FormulaError('SYNTAX', 'Ожидалось имя поля или *', p0.pos);
    }

    const localWhere = parseWhereClause();

    if (peek().type !== ')') {
      throw new FormulaError('SYNTAX', 'Ожидалось «)» после аргумента функции', peek().pos);
    }
    eat(')');
    if (fn === 'COUNT_DISTINCT') {
      if (!col || col === '*') {
        throw new FormulaError('SYNTAX', 'COUNT_DISTINCT() требует имя поля', p0.pos);
      }
      return makeAgg('COUNT_DISTINCT', col, ignoreFilters, localWhere);
    }
    if (fn === 'COUNT') {
      return makeAgg('COUNT', col || '*', ignoreFilters, localWhere);
    }
    return makeAgg(fn, col, ignoreFilters, localWhere);
  }

  function parsePrimary() {
    const t = peek();
    if (t.type === 'NUMBER') {
      eat('NUMBER');
      return { t: 'num', v: /** @type {number} */ (t.value) };
    }
    if (t.type === 'VAR') {
      eat('VAR');
      return { t: 'var', name: String(t.value || '') };
    }
    if (t.type === 'STRING') {
      eat('STRING');
      return { t: 'str', v: String(t.value ?? '') };
    }
    if (t.type === '(') {
      eat('(');
      const inner = parseExpr();
      if (peek().type !== ')') {
        throw new FormulaError('SYNTAX', 'Не хватает закрывающей скобки «)»', peek().pos);
      }
      eat(')');
      return inner;
    }
    if (t.type === 'IDENT') {
      const name = String(t.value);
      const pos = t.pos;
      const ignoreFilters = !!t.ignoreFilters;
      eat('IDENT');
      const fn = name.toUpperCase();

      if (fn === 'NONE' || fn === 'NULL') {
        return { t: 'null' };
      }

      if (fn === 'MATCH' && peek().type !== '(') {
        return parseMatchExpr(pos);
      }

      if (peek().type === '(') {
        if (fn === 'RGB') return parseRgbCall(pos);
        if (fn === 'IF') return parseIfCall(pos);
        if (!AGG.has(fn)) {
          throw new FormulaError('UNKNOWN_FN', `Неизвестная функция: ${name}`, pos);
        }
        return parseAggCall(fn, name, pos);
      }

      if (allowFieldRef) {
        return { t: 'field', col: name, ignoreFilters };
      }
      throw new FormulaError(
        'BARE_FIELD',
        `Нельзя использовать поле «${name}» без агрегата. Например: SUM(${name})`,
        pos,
      );
    }
    throw new FormulaError('SYNTAX', `Неожиданный токен «${t.raw || t.type}»`, t.pos);
  }

  let ast = parseExpr();
  if (identUpper() === 'FOR') {
    const forPos = peek().pos;
    eat('IDENT');
    const by = parseForFieldList();
    if (!by.length) {
      throw new FormulaError('SYNTAX', 'После FOR укажите поле группировки: FOR [таблица.колонка]', forPos);
    }
    ast = { t: 'for', expr: ast, by, pos: forPos };
  }
  if (peek().type !== 'EOF') {
    throw new FormulaError('SYNTAX', `Лишние символы после выражения: «${peek().raw}»`, peek().pos);
  }
  return ast;
}
