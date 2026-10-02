/**
 * Читаемые ошибки формульного движка (без eval).
 */

export class FormulaError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} [pos]
   */
  constructor(code, message, pos = undefined) {
    super(message);
    this.name = 'FormulaError';
    this.code = code;
    this.pos = pos;
  }
}

/**
 * Текст ошибки FastAPI/axios: detail строкой или массивом validation errors.
 * @param {unknown} err
 */
export function formatHttpOrAxiosError(err) {
  const d = err?.response?.data?.detail;
  if (d == null) return '';
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) {
    return d
      .map((x) => (typeof x === 'object' && x != null ? x.msg || JSON.stringify(x) : String(x)))
      .filter(Boolean)
      .join('; ');
  }
  if (typeof d === 'object' && d !== null && typeof d.message === 'string') {
    return d.message;
  }
  return typeof d === 'object' ? JSON.stringify(d) : String(d);
}

/** KPI / Gauge / текст — FOR даёт набор групп, а не скаляр. */
export const GROUPED_FORMULA_SCALAR_HINT =
  'Формула с FOR возвращает группы, а не одно число. Используйте в таблице или графике (столбцы / пирог).';

export function formatFormulaError(err) {
  if (err instanceof FormulaError) {
    const at = err.pos != null ? ` (позиция ${err.pos})` : '';
    return `${err.message}${at}`;
  }
  const http = formatHttpOrAxiosError(err);
  if (http) return http;
  return String(err?.message || err);
}
