import { formatCompactNumber } from '../kpi/kpiFormat.js';

/**
 * Форматирование отображаемого значения датчика.
 * @param {number} value — сырое значение в шкале (между min и max)
 * @param {number} min
 * @param {number} max
 * @param {Record<string, unknown>} settings — showValue, valueFormat, valuePrecision, valueCustomPattern, valuePercentMode, valueSuffix, valueNumberNotation
 * @returns {string}
 */
export function formatGaugeDisplayValue(value, min, max, settings) {
  const prec = Math.min(8, Math.max(0, Number(settings.valuePrecision) || 0));
  const fmt = String(settings.valueFormat || 'number').toLowerCase();
  const suffix = String(settings.valueSuffix ?? '');
  const pad = 10 ** prec;

  const round = (n) => Math.round(n * pad) / pad;

  if (!Number.isFinite(value)) return '—';

  if (fmt === 'custom') {
    const pat = String(settings.valueCustomPattern || '{value}');
    const span = max - min || 1;
    const pctFill = ((value - min) / span) * 100;
    const rawRounded = round(value).toFixed(prec).replace(/\.?0+$/, '') || '0';
    const pctRounded = round(pctFill).toFixed(prec).replace(/\.?0+$/, '') || '0';
    return pat
      .replace(/\{value\}/g, rawRounded)
      .replace(/\{percent\}/g, pctRounded);
  }

  if (fmt === 'percent') {
    if (settings.valuePercentMode === 'literal') {
      return `${round(value).toFixed(prec)}%`;
    }
    const span = max - min || 1;
    const pctFill = ((value - min) / span) * 100;
    return `${round(pctFill).toFixed(prec)}%`;
  }

  const notation = String(settings.valueNumberNotation || 'standard').toLowerCase();
  if (notation === 'compact' && Math.abs(value) >= 1000) {
    const compactDec = Math.min(2, prec || 1);
    const s = formatCompactNumber(round(value), compactDec);
    return suffix && fmt === 'number' ? `${s}${suffix}` : s;
  }

  const s = round(value).toFixed(prec).replace(/\.?0+$/, '').replace(/^-$/, '0');
  return suffix && fmt === 'number' ? `${s}${suffix}` : s;
}
