/** Цвета и CSS-переменные для блока «Недавние» в сайдбаре документов. */

export const RECENT_KIND_CLASS = {
  template_document: 'recentItemKindTemplateDocument',
  template_table: 'recentItemKindTemplateTable',
  document: 'recentItemKindDocument',
  table_record: 'recentItemKindTableRecord',
};

function hslAccent(hue, saturation = 72, lightness = 56, alpha = 1) {
  if (alpha >= 1) return `hsl(${hue} ${saturation}% ${lightness}%)`;
  return `hsla(${hue} ${saturation}% ${lightness}% / ${alpha})`;
}

/**
 * @param {import('./documentsRecentStorage').RecentOpenedKind} kind
 * @param {number | null | undefined} documentKindId
 * @returns {Record<string, string>}
 */
export function getRecentItemAccentStyle(kind, documentKindId) {
  const kindId = Number(documentKindId) || 0;

  switch (kind) {
    case 'template_document':
      return {
        '--recent-accent': '#f97316',
        '--recent-accent-soft': 'rgba(249, 115, 22, 0.14)',
        '--recent-accent-strong': 'rgba(249, 115, 22, 0.28)',
        '--recent-accent-muted': 'rgba(253, 186, 116, 0.9)',
      };
    case 'template_table':
      return {
        '--recent-accent': '#ef4444',
        '--recent-accent-soft': 'rgba(239, 68, 68, 0.14)',
        '--recent-accent-strong': 'rgba(239, 68, 68, 0.28)',
        '--recent-accent-muted': 'rgba(252, 165, 165, 0.95)',
      };
    case 'table_record': {
      const hue = 138 + ((kindId * 17) % 32);
      return {
        '--recent-accent': hslAccent(hue, 62, 46),
        '--recent-accent-soft': hslAccent(hue, 62, 46, 0.14),
        '--recent-accent-strong': hslAccent(hue, 62, 46, 0.3),
        '--recent-accent-muted': hslAccent(hue, 55, 68),
      };
    }
    case 'document':
    default: {
      const hue = 214 + ((kindId * 23) % 38);
      return {
        '--recent-accent': hslAccent(hue, 78, 58),
        '--recent-accent-soft': hslAccent(hue, 78, 58, 0.14),
        '--recent-accent-strong': hslAccent(hue, 78, 58, 0.3),
        '--recent-accent-muted': hslAccent(hue, 70, 72),
      };
    }
  }
}

export function getRecentItemKindClass(kind) {
  return RECENT_KIND_CLASS[kind] || RECENT_KIND_CLASS.document;
}
