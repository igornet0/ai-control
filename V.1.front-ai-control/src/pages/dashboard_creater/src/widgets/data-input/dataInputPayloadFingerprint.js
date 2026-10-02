/**
 * Stable fingerprint for data-input payloads (anti-duplicate submit).
 */

function normalizeValue(value) {
  if (value == null) return null;
  if (typeof File !== 'undefined' && value instanceof File) {
    return `file:${value.name}:${value.size}:${value.lastModified}`;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const out = {};
    for (const key of keys) {
      out[key] = normalizeValue(value[key]);
    }
    return out;
  }
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  return String(value);
}

/**
 * @param {Record<string, unknown>|null|undefined} data
 * @returns {string}
 */
export function fingerprintDataInputPayload(data) {
  if (!data || typeof data !== 'object') return '';
  return JSON.stringify(normalizeValue(data));
}
