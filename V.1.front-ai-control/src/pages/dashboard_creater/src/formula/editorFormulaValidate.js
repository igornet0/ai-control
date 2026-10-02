import { compileFormula } from './compile.js';
import { formatFormulaError } from './errors.js';
import { parseSimpleTableFieldRef } from '../widgets/common/tableColumnFormula.js';
import { parseFieldRefWithWhere } from '../widgets/common/chartBindingFormula.js';
import { tryCompileColorFormula } from './colorExpr.js';

/**
 * @typedef {'aggregate' | 'grouped' | 'field' | 'field_where' | 'color'} EditorFormulaKind
 * @typedef {{
 *   ok: true,
 *   kind: EditorFormulaKind,
 *   parsed?: object,
 * }} EditorFormulaOk
 * @typedef {{ ok: false, error: string }} EditorFormulaErr
 */

/**
 * @param {string} formula
 * @param {{ allowFieldRef?: boolean, allowColorExpr?: boolean }} [opts]
 * @returns {EditorFormulaOk | EditorFormulaErr}
 */
export function validateEditorFormula(formula, opts = {}) {
  const raw = String(formula ?? '').trim();
  if (!raw) {
    return { ok: false, error: 'Пустая формула' };
  }

  if (opts.allowFieldRef) {
    const withWhere = parseFieldRefWithWhere(raw);
    if (withWhere) {
      return { ok: true, kind: 'field_where', parsed: withWhere };
    }
    const simple = parseSimpleTableFieldRef(raw);
    if (simple) {
      return { ok: true, kind: 'field', parsed: simple };
    }
  }

  if (opts.allowColorExpr || opts.allowFieldRef) {
    const color = tryCompileColorFormula(raw);
    if (color.ok) {
      return { ok: true, kind: 'color', parsed: color.ast };
    }
  }

  try {
    const { ast } = compileFormula(raw, { allowFieldRef: !!opts.allowFieldRef });
    if (ast?.t === 'for') {
      return { ok: true, kind: 'grouped', parsed: ast };
    }
    return { ok: true, kind: 'aggregate' };
  } catch (e) {
    return { ok: false, error: formatFormulaError(e) };
  }
}

/**
 * Формула для предпросмотра скаляра: поле+WHERE → AVG([field] WHERE …).
 * @param {string} formula
 * @param {EditorFormulaOk} validated
 * @returns {string | null} null — предпросмотр не через aggregate engine
 */
export function formulaForScalarPreview(formula, validated) {
  const raw = String(formula ?? '').trim();
  if (!validated?.ok) return raw;
  if (validated.kind === 'aggregate' || validated.kind === 'grouped') return raw;
  if (validated.kind === 'field') return null;
  if (validated.kind === 'field_where') {
    const p = /** @type {{ table: string, field: string }} */ (validated.parsed);
    const whereM = raw.match(/\bWHERE\b[\s\S]+$/i);
    if (!p?.table || !p?.field || !whereM) return null;
    return `AVG([${p.table}.${p.field}] ${whereM[0]})`;
  }
  return raw;
}
