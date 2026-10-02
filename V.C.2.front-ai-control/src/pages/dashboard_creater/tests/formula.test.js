import { beforeEach, describe, expect, it } from 'vitest';
import { tokenize } from '../src/formula/tokenizer.js';
import { parseExpression } from '../src/formula/parser.js';
import {
  compileFormula,
  mergeAggSpecsInOrder,
  toSqliteAggregations,
  buildKeyToAliasMap,
  normalizeAggColumnForBaseTable,
  applyAliasesToAsts,
  aggKey,
  formulaGroupBy,
  unwrapGroupedAst,
  groupBySignature,
  normalizeGroupByColumns,
} from '../src/formula/compile.js';
import { evaluateAst, evaluateAstValue, parseDateTimeLikeToEvalMs, isSingleMinMaxAggFormula, formatEvalResultForDisplay, formatAggTimestampMsForDisplay, rgbChannelsToHex } from '../src/formula/evaluate.js';
import { compileFormulaBundle, clearFormulaAstCache, getCompiledFormula } from '../src/formula/cache.js';
import { parseTemplate, uniquePlaceholderFormulas } from '../src/formula/template.js';
import { FormulaError } from '../src/formula/errors.js';
import { isFormulaCacheV3 } from '../src/formula/formulaFeatures.js';
import { tryCompileColorFormula, evaluateSliceColorAst } from '../src/formula/colorExpr.js';

describe('tokenizer', () => {
  it('tokenizes arithmetic and calls', () => {
    const t = tokenize('SUM(a) + 2 * 3');
    const types = t.map((x) => x.type).filter((x) => x !== 'EOF');
    expect(types.join('')).toContain('IDENT');
    expect(types).toContain('+');
    expect(types).toContain('*');
  });

  it('tokenizes bracket field refs (unicode table.column)', () => {
    const f = 'COUNT([Номенклатура_17_07_25.Группа])';
    const t = tokenize(f).filter((x) => x.type !== 'EOF');
    expect(t.map((x) => x.type).join(' ')).toMatch(/IDENT/);
    const id = t.find((x) => x.type === 'IDENT' && String(x.value).includes('Группа'));
    expect(id?.value).toBe('Номенклатура_17_07_25.Группа');
  });

  it('tokenizes $[table.field] with ignoreFilters', () => {
    const t = tokenize('SUM($[sample_table.Price])').filter((x) => x.type !== 'EOF');
    const id = t.find((x) => x.type === 'IDENT' && x.value === 'sample_table.Price');
    expect(id?.ignoreFilters).toBe(true);
    expect(id?.raw).toBe('$[sample_table.Price]');
  });

  it('tokenizes @variable names', () => {
    const t = tokenize('@sum_amount_sum + 1').filter((x) => x.type !== 'EOF');
    expect(t[0]).toMatchObject({ type: 'VAR', value: 'sum_amount_sum', raw: '@sum_amount_sum' });
    expect(t[1].type).toBe('+');
  });
});

describe('parser', () => {
  it('respects precedence', () => {
    const ast = parseExpression(tokenize('1 + 2 * 3'));
    expect(ast.t).toBe('bin');
    expect(ast.op).toBe('+');
    expect(ast.r.t).toBe('bin');
    expect(ast.r.op).toBe('*');
  });

  it('rejects bare field', () => {
    expect(() => parseExpression(tokenize('revenue + 1'))).toThrow(FormulaError);
  });

  it('parses @variable as primary', () => {
    const ast = parseExpression(tokenize('@sum_amount_sum + 1'));
    expect(ast.t).toBe('bin');
    expect(ast.l).toEqual({ t: 'var', name: 'sum_amount_sum' });
    expect(ast.r).toEqual({ t: 'num', v: 1 });
  });

  it('allows COUNT empty as rows', () => {
    const ast = parseExpression(tokenize('COUNT()'));
    expect(ast.t).toBe('agg');
    expect(ast.fn).toBe('COUNT');
  });

  it('parses SUM(...) FOR [table.field]', () => {
    const ast = parseExpression(tokenize('SUM([orders.qty]) FOR [orders.region_id]'));
    expect(ast.t).toBe('for');
    expect(ast.by).toEqual([{ table: 'orders', column: 'region_id' }]);
    expect(ast.expr.t).toBe('agg');
    expect(ast.expr.fn).toBe('SUM');
  });

  it('parses FOR after arithmetic and multiple group fields', () => {
    const ast = parseExpression(
      tokenize('SUM([orders.qty]) / COUNT(*) FOR [orders.region_id], [orders.category]'),
    );
    expect(ast.t).toBe('for');
    expect(ast.expr.t).toBe('bin');
    expect(ast.by).toEqual([
      { table: 'orders', column: 'region_id' },
      { table: 'orders', column: 'category' },
    ]);
  });

  it('rejects unqualified FOR field', () => {
    expect(() => parseExpression(tokenize('SUM([orders.qty]) FOR [region_id]'))).toThrow(FormulaError);
  });
});

describe('compile + evaluate', () => {
  it('dedupes identical aggregates', () => {
    const a1 = compileFormula('SUM(x) + SUM(x)');
    const merged = mergeAggSpecsInOrder([a1.aggs]);
    expect(merged.length).toBe(1);
    const m = buildKeyToAliasMap(merged);
    const aggs = toSqliteAggregations(merged, m);
    expect(aggs.length).toBe(1);
    expect(aggs[0].fn).toBe('sum');
  });

  it('keeps filtered and unfiltered aggregates separate', () => {
    const { aggs } = compileFormula('SUM([sample_table.Price]) + SUM($[sample_table.Price])');
    expect(aggs).toHaveLength(2);
    expect(aggs[0].ignoreFilters).toBeFalsy();
    expect(aggs[1].ignoreFilters).toBe(true);
    expect(aggs[0].key).not.toBe(aggs[1].key);
    expect(aggKey('SUM', 'sample_table.Price', false)).toBe('sum:sample_table.Price');
    expect(aggKey('SUM', 'sample_table.Price', true)).toBe('sum:sample_table.Price:$');
    const merged = mergeAggSpecsInOrder([aggs]);
    expect(merged).toHaveLength(2);
  });

  it('dedupes identical unfiltered aggregates', () => {
    const { aggs } = compileFormula('SUM($[a]) + SUM($[a])');
    const merged = mergeAggSpecsInOrder([aggs]);
    expect(merged).toHaveLength(1);
    expect(merged[0].ignoreFilters).toBe(true);
  });

  it('parses WHERE with number and AND string', () => {
    const { ast, aggs } = compileFormula(
      'SUM([source_data_124.value] WHERE [source_data_124.id] = 23 AND [source_data_124.status] = "active")',
    );
    expect(ast.t).toBe('agg');
    expect(aggs).toHaveLength(1);
    expect(aggs[0].localFilters).toEqual(
      expect.arrayContaining([
        { table: 'source_data_124', column: 'id', op: 'eq', value: 23 },
        { table: 'source_data_124', column: 'status', op: 'eq', value: 'active' },
      ]),
    );
    expect(aggs[0].localWhere?.t).toBe('and');
    expect(aggs[0].key).toContain(':w:');
  });

  it('parses IN, NOT IN, LIKE and OR with precedence', () => {
    const inn = compileFormula('SUM([t.v] WHERE [t.id] IN (1, 23, 2))');
    expect(inn.aggs[0].localWhere).toMatchObject({
      t: 'pred',
      op: 'in',
      values: expect.arrayContaining([1, 2, 23]),
    });
    const notIn = compileFormula('SUM([t.v] WHERE [t.id] NOT IN (1, 2))');
    expect(notIn.aggs[0].localWhere).toMatchObject({ t: 'pred', op: 'not_in' });

    const like = compileFormula('SUM([t.v] WHERE [t.name] LIKE "*acme%")');
    expect(like.aggs[0].localWhere).toMatchObject({
      t: 'pred',
      op: 'like',
      value: '%acme%',
    });

    const orAnd = compileFormula('SUM([t.v] WHERE [t.a] = 1 OR [t.b] = 2 AND [t.c] = 3)');
    expect(orAnd.aggs[0].localWhere?.t).toBe('or');
    expect(orAnd.aggs[0].localFilters).toBeUndefined();

    const a = compileFormula('SUM([t.v] WHERE ([t.a] = 1 OR [t.b] = 2) AND [t.c] = 3)');
    const b = compileFormula('SUM([t.v] WHERE [t.a] = 1 OR ([t.b] = 2 AND [t.c] = 3))');
    expect(a.aggs[0].key).not.toBe(b.aggs[0].key);
  });

  it('keeps same agg with different WHERE as separate keys', () => {
    const a = compileFormula('SUM([t.v] WHERE [t.id] = 1)');
    const b = compileFormula('SUM([t.v] WHERE [t.id] = 2)');
    expect(a.aggs[0].key).not.toBe(b.aggs[0].key);
    const merged = mergeAggSpecsInOrder([a.aggs, b.aggs]);
    expect(merged).toHaveLength(2);
  });

  it('COUNT(* WHERE …) is valid', () => {
    const { aggs } = compileFormula('COUNT(* WHERE [orders.id] = 5)');
    expect(aggs[0].fn).toBe('count');
    expect(aggs[0].column).toBe('*');
    expect(aggs[0].localFilters).toEqual([
      { table: 'orders', column: 'id', op: 'eq', value: 5 },
    ]);
  });

  it('rejects unqualified field in WHERE', () => {
    expect(() => compileFormula('SUM([t.v] WHERE [id] = 1)')).toThrow(FormulaError);
  });

  it('SUM($[t.v] WHERE …) keeps ignoreFilters and localFilters', () => {
    const { aggs } = compileFormula('SUM($[t.v] WHERE [t.id] = 9)');
    expect(aggs[0].ignoreFilters).toBe(true);
    expect(aggs[0].localFilters?.[0]).toMatchObject({ column: 'id', op: 'eq', value: 9 });
  });

  it('toSqliteAggregations strips base_table prefix from column', () => {
    const a1 = compileFormula('SUM(line_data_table.value) / AVG(line_data_table.value)');
    const merged = mergeAggSpecsInOrder([a1.aggs]);
    const m = buildKeyToAliasMap(merged);
    const aggs = toSqliteAggregations(merged, m, 'line_data_table');
    expect(aggs.map((x) => x.column)).toEqual(['value', 'value']);
  });

  it('compileFormula accepts bracket-qualified columns', () => {
    const { aggs } = compileFormula('SUM([line_data_table.value])');
    expect(aggs[0].column).toBe('line_data_table.value');
    const merged = mergeAggSpecsInOrder([aggs]);
    const m = buildKeyToAliasMap(merged);
    expect(toSqliteAggregations(merged, m, 'line_data_table')[0].column).toBe('value');
  });

  it('normalizeAggColumnForBaseTable leaves bare names and COUNT(*)', () => {
    expect(normalizeAggColumnForBaseTable('value', 'line_data_table')).toBe('value');
    expect(normalizeAggColumnForBaseTable('line_data_table.value', 'line_data_table')).toBe('value');
    expect(normalizeAggColumnForBaseTable('*', 't')).toBe('*');
  });

  it('normalizeAggColumnForBaseTable splits table.column when table matches base', () => {
    expect(normalizeAggColumnForBaseTable('line_data_table.amount', 'line_data_table')).toBe(
      'amount',
    );
    expect(normalizeAggColumnForBaseTable('Line_Data_Table.amount', 'line_data_table')).toBe(
      'amount',
    );
    expect(normalizeAggColumnForBaseTable('other.amount', 'line_data_table')).toBe('other.amount');
  });

  it('evaluates division by zero', () => {
    const { ast, aggs } = compileFormula('1 / 0');
    expect(aggs.length).toBe(0);
    expect(() => evaluateAst(ast, {})).toThrow(FormulaError);
  });

  it('evaluates @variable from fieldCtx', () => {
    const { ast } = compileFormula('@sum_amount_sum + 1');
    const n = evaluateAst(ast, {}, null, {
      getVar: (name) => (name === 'sum_amount_sum' ? 41 : undefined),
      hasVar: (name) => name === 'sum_amount_sum',
    });
    expect(n).toBe(42);
  });

  it('throws UNKNOWN_VAR for missing @variable', () => {
    const { ast } = compileFormula('@missing');
    expect(() =>
      evaluateAst(ast, {}, null, {
        getVar: () => undefined,
        hasVar: () => false,
      }),
    ).toThrow(FormulaError);
  });

  it('MIN/MAX coerce SQLite datetime strings to epoch ms', () => {
    const { ast, aggs } = compileFormula('MAX(ts) - MIN(ts)');
    const merged = mergeAggSpecsInOrder([aggs]);
    const m = buildKeyToAliasMap(merged);
    applyAliasesToAsts([ast], m);
    const row = { t_0: '2026-01-10 15:00:00', t_1: '2026-01-10 12:00:00' };
    const v = evaluateAst(ast, row);
    expect(v).toBeGreaterThan(0);
    expect(Number.isFinite(v)).toBe(true);
  });

  it('parseDateTimeLikeToEvalMs handles YMD and SQLite text', () => {
    const d0 = parseDateTimeLikeToEvalMs('2026-02-28');
    expect(d0).toBe(new Date(2026, 1, 28, 0, 0, 0, 0).getTime());
    const d1 = parseDateTimeLikeToEvalMs('2026-05-01 08:30:00');
    expect(Number.isFinite(d1)).toBe(true);
    expect(d1).toBeGreaterThan(d0);
  });

  it('isSingleMinMaxAggFormula matches qualified column', () => {
    expect(isSingleMinMaxAggFormula(' MAX(line_data_table.timestamp) ')).toBe(true);
    expect(isSingleMinMaxAggFormula('MAX([line_data_table.timestamp])')).toBe(true);
    expect(isSingleMinMaxAggFormula('MAX($[line_data_table.timestamp])')).toBe(true);
    expect(isSingleMinMaxAggFormula('MAX(a) + 1')).toBe(false);
  });

  it('formatEvalResultForDisplay uses locale date for lone MAX', () => {
    const ms = parseDateTimeLikeToEvalMs('2026-06-01 12:00:00');
    const s = formatEvalResultForDisplay(ms, 'MAX(ts)');
    expect(s).not.toMatch(/e\+/i);
    expect(s.length).toBeGreaterThan(4);
  });

  it('formatAggTimestampMsForDisplay utc matches Intl with timeZone UTC', () => {
    const ms = Date.parse('2026-07-10T18:07:32.000Z');
    const ref = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(ms));
    expect(formatAggTimestampMsForDisplay(ms, { timestampDisplay: 'utc' })).toBe(ref);
  });

  it('formatEvalResultForDisplay passes utc option for MIN/MAX', () => {
    const ms = Date.parse('2026-07-10T18:07:32.000Z');
    const utcOut = formatEvalResultForDisplay(ms, 'MIN(ts)', { timestampDisplay: 'utc' });
    const localOut = formatEvalResultForDisplay(ms, 'MIN(ts)', { timestampDisplay: 'local' });
    const refUtc = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(ms));
    expect(utcOut).toBe(refUtc);
    expect(localOut.length).toBeGreaterThan(4);
  });

  it('compiles FOR into groupBy and still collects aggs', () => {
    const { ast, aggs, groupBy } = compileFormula('SUM([orders.qty]) FOR [orders.region_id]');
    expect(ast.t).toBe('for');
    expect(groupBy).toEqual([{ table: 'orders', column: 'region_id' }]);
    expect(aggs).toHaveLength(1);
    expect(aggs[0].fn).toBe('sum');
    expect(aggs[0].column).toBe('orders.qty');
    expect(formulaGroupBy(ast)).toEqual(groupBy);
    expect(unwrapGroupedAst(ast).t).toBe('agg');
    expect(normalizeGroupByColumns(groupBy, 'orders')).toEqual(['region_id']);
  });

  it('keeps WHERE inside agg with FOR outside', () => {
    const { ast, aggs, groupBy } = compileFormula(
      'SUM([orders.qty] WHERE [orders.status] = "paid") FOR [orders.region_id]',
    );
    expect(groupBy).toEqual([{ table: 'orders', column: 'region_id' }]);
    expect(aggs[0].localFilters).toEqual([
      { table: 'orders', column: 'status', op: 'eq', value: 'paid' },
    ]);
    expect(unwrapGroupedAst(ast).t).toBe('agg');
  });

  it('rejects FOR without an aggregate', () => {
    expect(() => compileFormula('1 FOR [orders.region_id]')).toThrow(FormulaError);
  });

  it('evaluates FOR node as inner expression on a row', () => {
    const { ast, aggs } = compileFormula('SUM([orders.qty]) FOR [orders.region_id]');
    const merged = mergeAggSpecsInOrder([aggs]);
    const m = buildKeyToAliasMap(merged);
    applyAliasesToAsts([ast], m);
    const alias = m.get(aggs[0].key);
    expect(evaluateAst(ast, { [alias]: 12, region_id: 'EU' })).toBe(12);
  });

  it('groupBySignature is order-sensitive', () => {
    expect(
      groupBySignature([
        { table: 't', column: 'a' },
        { table: 't', column: 'b' },
      ]),
    ).not.toBe(
      groupBySignature([
        { table: 't', column: 'b' },
        { table: 't', column: 'a' },
      ]),
    );
  });

  it('compiles model-like KPI formula into aggregate specs', () => {
    const src = 'SUM([orders.amount]) / AVG([orders.amount])';
    const { aggs } = compileFormula(src);
    const merged = mergeAggSpecsInOrder([aggs]);
    const aliasMap = buildKeyToAliasMap(merged);
    const sqliteAggs = toSqliteAggregations(merged, aliasMap, 'orders');
    expect(sqliteAggs).toHaveLength(2);
    expect(sqliteAggs.map((x) => x.fn)).toEqual(['sum', 'avg']);
    expect(sqliteAggs.map((x) => x.column)).toEqual(['amount', 'amount']);
  });
});

describe('template', () => {
  it('parses placeholders', () => {
    const parts = parseTemplate('A {SUM(x)} B {AVG(y)}');
    expect(parts.length).toBe(4);
    const u = uniquePlaceholderFormulas(parts);
    expect(u).toEqual(['SUM(x)', 'AVG(y)']);
  });
});

describe('cache', () => {
  beforeEach(() => {
    clearFormulaAstCache();
  });

  it('reuses AST cache', () => {
    const a = getCompiledFormula('SUM(a)');
    const b = getCompiledFormula('SUM(a)');
    expect(a.ast).not.toBe(b.ast);
    expect(compileFormulaBundle(['SUM(a)', 'SUM(a)']).mergedAggs.length).toBe(1);
  });

  it('canonical commutative forms share hash and AST cache key', () => {
    if (!isFormulaCacheV3()) return;
    const h1 = getCompiledFormula('SUM(a) + 1').canonicalHash;
    const h2 = getCompiledFormula('1 + SUM(a)').canonicalHash;
    expect(h1 && h2).toBeTruthy();
    expect(h1).toBe(h2);
  });

  it('FOR changes canonical hash vs ungrouped', () => {
    if (!isFormulaCacheV3()) return;
    const h1 = getCompiledFormula('SUM([orders.qty])').canonicalHash;
    const h2 = getCompiledFormula('SUM([orders.qty]) FOR [orders.region_id]').canonicalHash;
    expect(h1).toBeTruthy();
    expect(h2).toBeTruthy();
    expect(h1).not.toBe(h2);
  });
});

describe('IF / RGB / MATCH color expressions', () => {
  it('parses nested IF with RGB and None', () => {
    const { ast } = compileFormula(
      'IF([payments.status]="paid", RGB(150, 34, 35), IF([payments.status]="failed", RGB(150, 20, 35), None))',
      { allowFieldRef: true },
    );
    expect(ast.t).toBe('if');
    expect(ast.then.t).toBe('rgb');
    expect(ast.else.t).toBe('if');
    expect(ast.else.else.t).toBe('null');
  });

  it('evaluates IF + RGB against field context', () => {
    const { ast } = compileFormula(
      'IF([payments.status]="paid", RGB(150, 34, 35), None)',
      { allowFieldRef: true },
    );
    const paid = evaluateAstValue(ast, {}, null, {
      getField: (c) => (c === 'payments.status' ? 'paid' : null),
    });
    expect(paid).toBe(rgbChannelsToHex(150, 34, 35));
    const other = evaluateAstValue(ast, {}, null, {
      getField: (c) => (c === 'payments.status' ? 'pending' : null),
    });
    expect(other).toBeNull();
  });

  it('parses and evaluates MATCH CASE', () => {
    const { ast } = compileFormula(
      `MATCH [payments.status] {
        CASE "paid" { RGB(150, 34, 35) }
        CASE "failed" { RGB(150, 20, 35) }
        ELSE { None }
      }`,
      { allowFieldRef: true },
    );
    expect(ast.t).toBe('match');
    expect(ast.cases).toHaveLength(2);
    const failed = evaluateAstValue(ast, {}, null, {
      getField: () => 'failed',
    });
    expect(failed).toBe(rgbChannelsToHex(150, 20, 35));
  });

  it('evaluateSliceColorAst binds dimension label', () => {
    const compiled = tryCompileColorFormula(
      'IF([payments.status]="paid", RGB(34, 197, 94), None)',
    );
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(
      evaluateSliceColorAst(compiled.ast, {
        label: 'paid',
        dimQualified: 'payments.status',
        labelField: 'status',
      }),
    ).toBe(rgbChannelsToHex(34, 197, 94));
  });

  it('rejects bare field without allowFieldRef', () => {
    expect(() =>
      compileFormula('IF([payments.status]="paid", RGB(1,2,3), None)'),
    ).toThrow(FormulaError);
  });
});
