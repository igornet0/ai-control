/**
 * Lightweight dependency index: widgetId → subtree hashes; subtree → widget set.
 * Used for targeted invalidation hints (Phase B).
 */

/** @type {WeakMap<object, FormulaSheetGraph>} */
const graphs = new WeakMap();

export class FormulaSheetGraph {
  constructor() {
    /** @type {Map<string, Set<string>>} widgetId -> subtree hashes */
    this.widgetToSubtrees = new Map();
    /** @type {Map<string, Set<string>>} subtreeHash -> widget ids */
    this.subtreeToWidgets = new Map();
    /** @type {Map<string, Set<string>>} widgetId -> formula root hashes */
    this.widgetRoots = new Map();
  }

  /**
   * @param {string} widgetId
   * @param {string[]} subtreeHashes
   * @param {string[]} rootHashes
   */
  register(widgetId, subtreeHashes, rootHashes = []) {
    const wid = String(widgetId || 'anonymous');
    this.unregister(wid);

    const st = new Set(subtreeHashes.map(String).filter(Boolean));
    this.widgetToSubtrees.set(wid, st);
    st.forEach((h) => {
      if (!this.subtreeToWidgets.has(h)) this.subtreeToWidgets.set(h, new Set());
      this.subtreeToWidgets.get(h).add(wid);
    });

    const rh = new Set(rootHashes.map(String).filter(Boolean));
    this.widgetRoots.set(wid, rh);
  }

  /** @param {string} widgetId */
  unregister(widgetId) {
    const wid = String(widgetId || 'anonymous');
    const prev = this.widgetToSubtrees.get(wid);
    if (prev) {
      prev.forEach((h) => {
        const ws = this.subtreeToWidgets.get(h);
        if (ws) {
          ws.delete(wid);
          if (!ws.size) this.subtreeToWidgets.delete(h);
        }
      });
    }
    this.widgetToSubtrees.delete(wid);
    this.widgetRoots.delete(wid);
  }

  /**
   * @param {Iterable<string>} changedSubtreeHashes
   * @returns {Set<string>} widget ids
   */
  widgetsImpactedBySubtrees(changedSubtreeHashes) {
    const out = new Set();
    for (const h of changedSubtreeHashes) {
      const ws = this.subtreeToWidgets.get(String(h));
      if (ws) ws.forEach((w) => out.add(w));
    }
    return out;
  }

  /** @param {Iterable<string>} changedRootHashes */
  widgetsImpactedByRoots(changedRootHashes) {
    const set = new Set(changedRootHashes);
    const out = new Set();
    this.widgetRoots.forEach((roots, wid) => {
      for (const r of roots) {
        if (set.has(r)) {
          out.add(wid);
          break;
        }
      }
    });
    return out;
  }
}

export function getFormulaSheetGraph(engine) {
  if (!engine || typeof engine !== 'object') return null;
  let g = graphs.get(engine);
  if (!g) {
    g = new FormulaSheetGraph();
    graphs.set(engine, g);
  }
  return g;
}

/**
 * Collect all subtree structural hashes from an AST (post-alias agg nodes include alias but hash ignores it via hashFn).
 * @param {object} ast
 * @param {(n: object) => string} hashFn
 */
export function collectSubtreeHashes(ast, hashFn) {
  const out = [];
  function walk(n) {
    if (!n || typeof n !== 'object') return;
    out.push(hashFn(n));
    if (n.t === 'bin') {
      walk(n.l);
      walk(n.r);
    } else if (n.t === 'ua') walk(n.x);
    else if (n.t === 'for') walk(n.expr);
  }
  walk(ast);
  return out;
}

/** @returns {string[]} */
export function listWidgetsImpactedBySubtreeHashes(engine, subtreeHashes) {
  const g = getFormulaSheetGraph(engine);
  if (!g || !subtreeHashes || !subtreeHashes.length) return [];
  return [...g.widgetsImpactedBySubtrees(subtreeHashes)];
}
