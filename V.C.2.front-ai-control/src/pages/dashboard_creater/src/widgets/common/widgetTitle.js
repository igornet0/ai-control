/**
 * Общие поля заголовка виджета: showTitle / title / titleSize / titleColor / titleColorFormula.
 * Совместимо с bar/pie/table/kpi в панели стилей.
 * heading принимает уже resolved hex (через opts.resolvedColor или settings.titleColor).
 */

/**
 * @param {Record<string, unknown>} settings
 * @param {{ defaultTitle?: string, defaultShow?: boolean, defaultColor?: string }} [opts]
 */
export function normalizeWidgetTitleSettings(settings, opts = {}) {
  const {
    defaultTitle = '',
    defaultShow = false,
    defaultColor = '#8B5CF6',
  } = opts;
  const out = settings && typeof settings === 'object' ? settings : {};
  if (typeof out.showTitle !== 'boolean') {
    out.showTitle = defaultShow;
  }
  const t = out.title != null ? String(out.title).trim() : '';
  out.title = t || defaultTitle;
  let ts = parseInt(out.titleSize, 10);
  if (!Number.isFinite(ts)) ts = 14;
  out.titleSize = Math.min(48, Math.max(8, ts));
  const c = String(out.titleColor || '').trim();
  out.titleColor = /^#[0-9a-fA-F]{6}$/i.test(c) ? c : defaultColor;
  out.titleColorFormula =
    out.titleColorFormula != null ? String(out.titleColorFormula).trim() : '';
  return out;
}

/**
 * @param {Record<string, unknown>|null|undefined} settings
 * @param {{ resolvedColor?: string }} [opts]
 * @returns {string} inline style attribute fragment (without leading space) or ''
 */
export function widgetTitleInlineStyle(settings, opts = {}) {
  if (settings?.showTitle !== true) return '';
  const parts = [];
  const ts = parseInt(settings.titleSize, 10);
  if (Number.isFinite(ts)) {
    parts.push(`font-size:${Math.min(48, Math.max(8, ts))}px`);
  }
  const resolved = String(opts.resolvedColor || '').trim();
  const c = /^#[0-9a-fA-F]{6}$/i.test(resolved)
    ? resolved
    : String(settings.titleColor || '').trim();
  if (/^#[0-9a-fA-F]{6}$/i.test(c)) {
    parts.push(`color:${c}`);
  }
  return parts.length ? parts.join(';') : '';
}

/**
 * @param {Record<string, unknown>|null|undefined} settings
 * @param {(s: string) => string} esc
 * @param {{ resolvedColor?: string }} [opts]
 */
export function buildDashWidgetHeadingHtml(settings, esc, opts = {}) {
  if (settings?.showTitle !== true) return '';
  const style = widgetTitleInlineStyle(settings, opts);
  const styleAttr = style ? ` style="${style}"` : '';
  return `<div class="dash-widget-heading"${styleAttr}>${esc(String(settings.title ?? ''))}</div>`;
}

/**
 * @param {Record<string, unknown>|null|undefined} settings
 * @param {{ resolvedColor?: string }} [opts]
 * @returns {HTMLElement|null}
 */
export function createDashWidgetHeadingElement(settings, opts = {}) {
  if (settings?.showTitle !== true) return null;
  const el = document.createElement('div');
  el.className = 'dash-widget-heading';
  el.textContent = String(settings.title ?? '');
  const style = widgetTitleInlineStyle(settings, opts);
  if (style) el.setAttribute('style', style);
  return el;
}
