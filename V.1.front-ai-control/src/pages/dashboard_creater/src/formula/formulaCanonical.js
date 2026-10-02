/**
 * Canonical representation of dashboard formula AST (agg / bin / ua / num)
 * for stable hashing and structural dedupe.
 */

import { sha256Hex } from './formulaHasher.js';
import { canonicalizeWhere, whereFromLocalFilters } from './localFilters.js';

function stableCanonicalJson(obj) {
  return JSON.stringify(obj, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = {};
      Object.keys(v)
        .sort()
        .forEach((key) => {
          o[key] = v[key];
        });
      return o;
    }
    return v;
  });
}

function compareCanonical(a, b) {
  const sa = stableCanonicalJson(a);
  const sb = stableCanonicalJson(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * Flatten nested same-op binary chains.
 * @param {object} node
 * @param {string} op
 */
function flattenOp(node, op) {
  if (!node || node.t !== 'bin' || node.op !== op) return [node];
  return [...flattenOp(node.l, op), ...flattenOp(node.r, op)];
}

/**
 * @param {object} node parsed AST fragment
 */
export function canonicalAst(node) {
  if (!node || typeof node !== 'object') return node;
  if (node.t === 'num') {
    const v = Number(node.v);
    return { t: 'num', v: Number.isFinite(v) ? v : 0 };
  }
  if (node.t === 'var') {
    return { t: 'var', name: String(node.name || '') };
  }
  if (node.t === 'agg') {
    const fn = String(node.fn || '').toUpperCase();
    let col = node.col == null ? '' : String(node.col).trim();
    const ignoreFilters = !!node.ignoreFilters;
    let localWhere = canonicalizeWhere(node.localWhere);
    if (!localWhere && node.localFilters) {
      localWhere = whereFromLocalFilters(node.localFilters);
    }
    /** @type {Record<string, unknown>} */
    const out = { t: 'agg', fn, col };
    if (ignoreFilters) out.ignoreFilters = true;
    if (localWhere) out.localWhere = localWhere;
    return out;
  }
  if (node.t === 'for') {
    return {
      t: 'for',
      expr: canonicalAst(node.expr),
      by: (node.by || []).map((f) => ({
        table: String(f.table || '').trim(),
        column: String(f.column || '').trim(),
      })),
    };
  }
  if (node.t === 'ua') {
    const inner = canonicalAst(node.x);
    if (inner?.t === 'ua') return canonicalAst(inner.x);
    if (inner?.t === 'num') return { t: 'num', v: -inner.v };
    return { t: 'ua', x: inner };
  }
  if (node.t === 'bin') {
    const op = node.op;
    const l = canonicalAst(node.l);
    const r = canonicalAst(node.r);
    const simple = { t: 'bin', op, l, r };

    if (op === '+' || op === '*') {
      const parts = flattenOp(simple, op).map((p) => canonicalAst(p));
      parts.sort(compareCanonical);
      if (parts.length === 0) return { t: 'num', v: op === '+' ? 0 : 1 };
      let acc = parts[0];
      for (let i = 1; i < parts.length; i++) {
        acc = { t: 'bin', op, l: acc, r: parts[i] };
      }
      return acc;
    }

    return simple;
  }
  return node;
}

/** Structural Merkle-ish hash bottom-up over canonical JSON fragments. */
export function hashCanonicalAst(node) {
  const can = canonicalAst(node);
  return hashCanonicalNode(can);
}

function hashCanonicalNode(can) {
  if (!can || typeof can !== 'object') return sha256Hex(String(can));
  if (can.t === 'num') return sha256Hex(`num:${can.v}`);
  if (can.t === 'var') return sha256Hex(`var:${can.name}`);
  if (can.t === 'agg') {
    const base = `agg:${String(can.fn).toLowerCase()}:${can.col}`;
    let h = can.ignoreFilters ? `${base}:$` : base;
    if (can.localWhere) {
      h = `${h}:w:${stableCanonicalJson(can.localWhere)}`;
    }
    return sha256Hex(h);
  }
  if (can.t === 'for') {
    const he = hashCanonicalNode(can.expr);
    const by = (can.by || [])
      .map((f) => `${String(f.table || '').trim()}.${String(f.column || '').trim()}`)
      .join(',');
    return sha256Hex(`for:${by}:${he}`);
  }
  if (can.t === 'ua') {
    const hx = hashCanonicalNode(can.x);
    return sha256Hex(`ua:${hx}`);
  }
  if (can.t === 'bin') {
    const hl = hashCanonicalNode(can.l);
    const hr = hashCanonicalNode(can.r);
    return sha256Hex(`bin:${can.op}:${hl}:${hr}`);
  }
  return sha256Hex(stableCanonicalJson(can));
}

/**
 * @param {string} formulaText
 * @param {object} ast parsed root
 */
export function formulaStructureFingerprint(formulaText, ast) {
  const can = canonicalAst(ast);
  return {
    formulaVersion: sha256Hex(String(formulaText ?? '').trim()),
    canonicalJson: stableCanonicalJson(can),
    rootHash: hashCanonicalNode(can),
  };
}
