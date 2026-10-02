/**
 * Dashboard-scoped variables persisted in dashboards.layout_config.dashboard_variables.
 * Shared namespace with model @vars: dashboard values take precedence.
 */

import { normalizeLayoutConfig } from './dashboardAutoRefresh.js';
import { coerceVariableInput, parseVariableValue } from '../services/dashboardModelVariables.js';

export const DASHBOARD_VARIABLES_LAYOUT_KEY = 'dashboard_variables';

const ALLOWED_TYPES = new Set(['Number', 'String', 'Bool']);

/**
 * @param {unknown} raw
 * @returns {Array<{ name: string, type: string, value: unknown, description: string }>}
 */
export function normalizeDashboardVariablesList(raw) {
  const list = Array.isArray(raw) ? raw : [];
  /** @type {Array<{ name: string, type: string, value: unknown, description: string }>} */
  const out = [];
  const seen = new Set();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const name = String(item.name ?? item.key ?? '')
      .trim()
      .replace(/[^A-Za-z0-9_]/g, '_');
    if (!name || seen.has(name)) continue;
    seen.add(name);
    let type = String(item.type || 'Number').trim() || 'Number';
    if (!ALLOWED_TYPES.has(type)) {
      const low = type.toLowerCase();
      if (low === 'bool' || low === 'boolean') type = 'Bool';
      else if (low === 'string' || low === 'text') type = 'String';
      else type = 'Number';
    }
    const value = parseVariableValue(type, item.value);
    out.push({
      name,
      type,
      value,
      description: String(item.description ?? '').trim(),
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/**
 * @param {{ layout_config?: unknown }|null|undefined} dashboard
 */
export function getDashboardVariablesFromDashboard(dashboard) {
  const layout = normalizeLayoutConfig(dashboard?.layout_config);
  return normalizeDashboardVariablesList(layout[DASHBOARD_VARIABLES_LAYOUT_KEY]);
}

/**
 * @param {{ layout_config?: unknown }|null|undefined} dashboard
 * @param {Array<{ name: string, type?: string, value?: unknown, description?: string }>} variables
 */
export function buildLayoutConfigWithDashboardVariables(dashboard, variables) {
  const prev = normalizeLayoutConfig(dashboard?.layout_config);
  return {
    ...prev,
    [DASHBOARD_VARIABLES_LAYOUT_KEY]: normalizeDashboardVariablesList(variables),
  };
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isValidDashboardVariableName(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name || '').trim());
}

/**
 * @param {string} type
 * @param {unknown} raw
 */
export function coerceDashboardVariableValue(type, raw) {
  return coerceVariableInput(type || 'Number', raw);
}

export { ALLOWED_TYPES as DASHBOARD_VARIABLE_TYPES };
