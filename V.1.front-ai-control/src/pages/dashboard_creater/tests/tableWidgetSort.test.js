import { describe, expect, it } from '@jest/globals';

/**
 * Локальная копия логики сортировки TableWidget (без DOM).
 * @param {Record<string, unknown>[]} rows
 * @param {string} columnKey
 * @param {'asc'|'desc'} dir
 */
function sortTableRowsByColumn(rows, columnKey, dir) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  const mul = dir === 'desc' ? -1 : 1;
  list.sort((a, b) => {
    const va = a?.[columnKey];
    const vb = b?.[columnKey];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const na = typeof va === 'number' ? va : Number(String(va).trim().replace(',', '.'));
    const nb = typeof vb === 'number' ? vb : Number(String(vb).trim().replace(',', '.'));
    if (Number.isFinite(na) && Number.isFinite(nb)) {
      if (na === nb) return 0;
      return na < nb ? -mul : mul;
    }
    const sa = String(va);
    const sb = String(vb);
    return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' }) * mul;
  });
  return list;
}

/**
 * После полной сортировки в UI остаётся только maxRows (окно с «начала» порядка).
 * DESC + slice(0, maxRows) ≡ топ с конца полного ASC-порядка.
 */
function takeSortedWindow(rows, columnKey, dir, maxRows) {
  return sortTableRowsByColumn(rows, columnKey, dir).slice(0, maxRows);
}

describe('tableWidget sort', () => {
  it('sorts numbers asc/desc', () => {
    const rows = [{ amount: 120 }, { amount: 45 }, { amount: 200 }];
    expect(sortTableRowsByColumn(rows, 'amount', 'asc').map((r) => r.amount)).toEqual([45, 120, 200]);
    expect(sortTableRowsByColumn(rows, 'amount', 'desc').map((r) => r.amount)).toEqual([200, 120, 45]);
  });

  it('sorts strings', () => {
    const rows = [{ status: 'cancelled' }, { status: 'active' }, { status: 'pending' }];
    expect(sortTableRowsByColumn(rows, 'status', 'asc').map((r) => r.status)).toEqual([
      'active',
      'cancelled',
      'pending',
    ]);
  });

  it('keeps maxRows window from full sorted set (not only preloaded chunk)', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ amount: (i + 1) * 10 }));
    const maxRows = 3;
    expect(takeSortedWindow(rows, 'amount', 'asc', maxRows).map((r) => r.amount)).toEqual([10, 20, 30]);
    expect(takeSortedWindow(rows, 'amount', 'desc', maxRows).map((r) => r.amount)).toEqual([100, 90, 80]);
  });
});
