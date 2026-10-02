/**
 * Helpers for GFM markdown tables in AI replies.
 */

/**
 * Expand table rows that the model jammed onto one line, e.g.
 * `| A | B | |---|---| | C | D |` → proper multiline GFM.
 * @param {string} text
 * @returns {string}
 */
export function normalizeMarkdownTables(text) {
  const src = String(text || '');
  if (!src.includes('|')) return src;

  return src
    .split('\n')
    .map((line) => explodeCollapsedTableLine(line))
    .join('\n');
}

/**
 * @param {string} line
 * @returns {string}
 */
function explodeCollapsedTableLine(line) {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return line;
  // Only rewrite when a GFM separator is present on the same line as other cells
  if (!/\|[\t ]*:?-{2,}[\t ]*:?/.test(trimmed) && !/\|\s+\|/.test(trimmed)) {
    // Also explode pure multi-row data jammed without separator if empty cell boundary exists
    // and there are enough pipes for ≥2 rows of ≥2 cols
    if (!/\|\s+\|/.test(trimmed) || (trimmed.match(/\|/g) || []).length < 6) {
      return line;
    }
  }

  const rawCells = trimmed.split('|').map((c) => c.trim());
  if (rawCells[0] === '') rawCells.shift();
  if (rawCells.length && rawCells[rawCells.length - 1] === '') rawCells.pop();
  if (rawCells.length < 3) return line;

  const rows = [];
  let current = [];
  for (let i = 0; i < rawCells.length; i += 1) {
    const cell = rawCells[i];
    if (cell === '' && current.length > 0) {
      rows.push(current);
      current = [];
      continue;
    }
    if (cell === '') continue;
    current.push(cell);
  }
  if (current.length) rows.push(current);
  if (rows.length < 2) return line;

  return rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
}

/**
 * @param {HTMLTableElement} table
 * @returns {string[][]}
 */
export function tableElementToMatrix(table) {
  if (!table) return [];
  const rows = Array.from(table.querySelectorAll('tr'));
  return rows.map((tr) =>
    Array.from(tr.querySelectorAll('th,td')).map((cell) =>
      String(cell.textContent || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    ),
  );
}

/**
 * @param {string[][]} matrix
 * @param {'tsv'|'csv'|'markdown'} format
 */
export function matrixToClipboard(matrix, format = 'tsv') {
  const rows = Array.isArray(matrix) ? matrix : [];
  if (format === 'markdown') {
    if (!rows.length) return '';
    const escape = (c) => String(c).replace(/\|/g, '\\|');
    const header = rows[0] || [];
    const sep = header.map(() => '---');
    const lines = [
      `| ${header.map(escape).join(' | ')} |`,
      `| ${sep.join(' | ')} |`,
      ...rows.slice(1).map((r) => `| ${r.map(escape).join(' | ')} |`),
    ];
    return lines.join('\n');
  }

  const sep = format === 'csv' ? ',' : '\t';
  const quote = (cell) => {
    const s = String(cell ?? '');
    if (format === 'tsv') return s.replace(/\t/g, ' ').replace(/\n/g, ' ');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return rows.map((r) => r.map(quote).join(sep)).join('\n');
}

/**
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyTextToClipboard(text) {
  const value = String(text || '');
  if (!value) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
