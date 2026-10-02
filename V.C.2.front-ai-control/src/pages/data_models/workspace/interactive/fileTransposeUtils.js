export function cellToColumnLabel(cell, index) {
  if (cell === null || cell === undefined) return `Column_${index + 1}`;
  const str = String(cell).trim();
  return str || `Column_${index + 1}`;
}

/**
 * Matrix transpose from header row downward; returns column names from the first transposed row.
 */
export function computeTransposedColumnNames(matrix, headerRowIndex = 0) {
  if (!Array.isArray(matrix) || matrix.length === 0) return [];

  const dataMatrix = matrix.slice(Math.max(0, headerRowIndex));
  if (!dataMatrix.length) return [];

  const maxCols = dataMatrix.reduce(
    (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
    0,
  );
  if (!maxCols) return [];

  const transposed = [];
  for (let col = 0; col < maxCols; col += 1) {
    const column = [];
    for (let row = 0; row < dataMatrix.length; row += 1) {
      column.push(dataMatrix[row]?.[col] ?? '');
    }
    transposed.push(column);
  }

  const headerRow = transposed[0] || [];
  return headerRow.map((cell, idx) => cellToColumnLabel(cell, idx));
}

export function resolveColumnsFromRawRows(rawRows, headerRowNum = 1, isTransposed = false) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) return [];

  const headerRowIndex = Math.max(0, (headerRowNum || 1) - 1);
  if (isTransposed) {
    return computeTransposedColumnNames(rawRows, headerRowIndex);
  }

  const headerRow = rawRows[headerRowIndex] || [];
  return headerRow.map((col, idx) => cellToColumnLabel(col, idx));
}
