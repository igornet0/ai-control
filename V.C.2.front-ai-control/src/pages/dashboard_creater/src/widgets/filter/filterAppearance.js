/**
 * Filter Appearance: способ выбора значения — часть дизайна виджета «Фильтр».
 * MVP: auto | select | segmented | chips | checkbox | slider.
 */

export const FILTER_APPEARANCE_IDS = Object.freeze([
  'auto',
  'select',
  'segmented',
  'chips',
  'checkbox',
  'slider',
]);

export const FILTER_SELECTION_IDS = Object.freeze(['auto', 'single', 'multiple']);

export const FILTER_APPEARANCE_OPTIONS = Object.freeze([
  { id: 'auto', label: 'Авто' },
  { id: 'select', label: 'Select' },
  { id: 'segmented', label: 'Segmented' },
  { id: 'chips', label: 'Chips' },
  { id: 'checkbox', label: 'Checkbox' },
  { id: 'slider', label: 'Slider' },
]);

export const FILTER_SELECTION_OPTIONS = Object.freeze([
  { id: 'auto', label: 'Авто' },
  { id: 'single', label: 'Один' },
  { id: 'multiple', label: 'Несколько' },
]);

const APPEARANCE_SET = new Set(FILTER_APPEARANCE_IDS);
const SELECTION_SET = new Set(FILTER_SELECTION_IDS);

/**
 * @param {unknown} raw
 * @returns {'auto'|'select'|'segmented'|'chips'|'checkbox'|'slider'}
 */
export function normalizeFilterAppearance(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  return APPEARANCE_SET.has(s) ? s : 'auto';
}

/**
 * @param {unknown} raw
 * @returns {'auto'|'single'|'multiple'}
 */
export function normalizeFilterSelection(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  return SELECTION_SET.has(s) ? s : 'auto';
}

/**
 * @param {object} f
 */
export function normalizeFilterRowAppearance(f) {
  if (!f || typeof f !== 'object') return f;
  f.appearance = normalizeFilterAppearance(f.appearance);
  f.selection = normalizeFilterSelection(f.selection);
  return f;
}

/**
 * @param {unknown} type
 */
export function isNumericFilterType(type) {
  const t = String(type || '').toLowerCase();
  return /int|integer|float|double|number|decimal|numeric|real|bigint/.test(t);
}

/**
 * Непрерывные числа — кандидаты на Slider в Auto. Integer/id остаются enum (Select/Chips).
 * @param {unknown} type
 */
export function isContinuousNumericFilterType(type) {
  const t = String(type || '').toLowerCase();
  return /float|double|decimal|numeric|real|number/.test(t) && !/int/.test(t);
}

/**
 * @param {unknown} type
 */
export function isBooleanFilterType(type) {
  const t = String(type || '').toLowerCase();
  return /bool/.test(t);
}

/**
 * Резолв Auto → конкретный UI. Без cardinality строковые поля остаются Select.
 * @param {object} fl
 * @param {{ distinctCount?: number|null }} [opts]
 * @returns {'select'|'segmented'|'chips'|'checkbox'|'slider'}
 */
export function resolveFilterAppearance(fl, opts = {}) {
  const stored = normalizeFilterAppearance(fl?.appearance);
  if (stored !== 'auto') return stored;

  if (isBooleanFilterType(fl?.type)) return 'segmented';
  if (isContinuousNumericFilterType(fl?.type)) return 'slider';

  const n = opts.distinctCount;
  if (n != null && Number.isFinite(Number(n))) {
    const c = Number(n);
    if (c <= 4) return 'segmented';
    if (c <= 12) return 'chips';
    return 'select';
  }
  return 'select';
}

/**
 * @param {object} fl
 * @param {'select'|'segmented'|'chips'|'checkbox'|'slider'} appearance
 * @returns {'single'|'multiple'}
 */
export function resolveFilterSelection(fl, appearance) {
  const stored = normalizeFilterSelection(fl?.selection);
  if (stored === 'single' || stored === 'multiple') return stored;
  if (appearance === 'segmented') return 'single';
  if (appearance === 'checkbox') return 'multiple';
  if (appearance === 'chips') return 'multiple';
  return 'multiple';
}

/**
 * Подпись выбранного в триггере Select.
 * @param {object} fl
 * @returns {string}
 */
export function formatFilterSelectionSummary(fl) {
  const sel = Array.isArray(fl?.selectedValues)
    ? fl.selectedValues.filter((x) => x != null && String(x) !== '')
    : [];
  const exc = Array.isArray(fl?.excludedValues)
    ? fl.excludedValues.filter((x) => x != null && String(x) !== '')
    : [];
  if (sel.length === 1) return String(sel[0]);
  if (sel.length > 1) return `${sel.length} выбрано`;
  if (exc.length === 1) return `кроме ${exc[0]}`;
  if (exc.length > 1) return `кроме ${exc.length}`;
  const pat = String(fl?.pattern || '').trim();
  if (pat) return pat;
  if (
    fl?.rangeMin != null &&
    fl?.rangeMax != null &&
    Number.isFinite(Number(fl.rangeMin)) &&
    Number.isFinite(Number(fl.rangeMax))
  ) {
    return `${fl.rangeMin} – ${fl.rangeMax}`;
  }
  return 'Все';
}

/**
 * @param {unknown[]} values
 * @returns {{ min: number, max: number } | null}
 */
export function numericDomainFromValues(values) {
  let min = Infinity;
  let max = -Infinity;
  for (const raw of values || []) {
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === max) {
    return { min, max: max + 1 };
  }
  return { min, max };
}

/**
 * Диапазон считается «неактивным», если совпадает с доменом (фильтр не сужает).
 * @param {object} fl
 * @param {{ min: number, max: number }} domain
 */
export function isFullFilterRange(fl, domain) {
  if (!domain) return true;
  const lo = Number(fl?.rangeMin);
  const hi = Number(fl?.rangeMax);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return true;
  return lo <= domain.min && hi >= domain.max;
}

/**
 * Убирает предикаты того же поля — иначе слайдер сам себе сжимает min/max.
 * @param {object[]} filters
 * @param {{ table?: string, field?: string }} fl
 */
export function filtersExcludingField(filters, fl) {
  const table = String(fl?.table || '').toLowerCase();
  const column = String(fl?.field || '').toLowerCase();
  if (!table || !column) return Array.isArray(filters) ? [...filters] : [];
  return (filters || []).filter((f) => {
    const t = String(f.table || '').toLowerCase();
    const c = String(f.column || f.field || '').toLowerCase();
    return t !== table || c !== column;
  });
}

/**
 * @param {unknown} minRaw
 * @param {unknown} maxRaw
 * @returns {{ min: number, max: number } | null}
 */
export function domainFromMinMax(minRaw, maxRaw) {
  const min = Number(minRaw);
  const max = Number(maxRaw);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === max) {
    const pad = Math.abs(max) > 1 ? 1 : 0.01;
    return { min, max: max + pad };
  }
  return { min: Math.min(min, max), max: Math.max(min, max) };
}
