import { FormulaError } from './errors.js';

/**
 * @typedef {{ type: 'lit', text: string } | { type: 'ph', formula: string }} TemplatePart
 */

/**
 * Разбор шаблона с плейсхолдерами `{ ... }` (вложенные `{` внутри поддерживаются через глубину).
 * @param {string} template
 * @returns {TemplatePart[]}
 */
export function parseTemplate(template) {
  const s = String(template ?? '');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const open = s.indexOf('{', i);
    if (open === -1) {
      if (i < s.length) out.push({ type: 'lit', text: s.slice(i) });
      break;
    }
    if (open > i) {
      out.push({ type: 'lit', text: s.slice(i, open) });
    }
    let depth = 1;
    let k = open + 1;
    while (k < s.length && depth > 0) {
      const ch = s[k];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      k += 1;
    }
    if (depth !== 0) {
      throw new FormulaError('TEMPLATE', 'В шаблоне не закрыта фигурная скобка { … }', open);
    }
    const inner = s.slice(open + 1, k - 1).trim();
    out.push({ type: 'ph', formula: inner });
    i = k;
  }
  return out;
}

/**
 * Уникальные формулы из плейсхолдеров (порядок первого появления).
 * @param {TemplatePart[]} parts
 * @returns {string[]}
 */
export function uniquePlaceholderFormulas(parts) {
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    if (p.type !== 'ph') continue;
    const f = p.formula;
    if (seen.has(f)) continue;
    seen.add(f);
    out.push(f);
  }
  return out;
}
