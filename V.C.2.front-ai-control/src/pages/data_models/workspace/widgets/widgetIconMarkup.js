const baseSvg = (inner, { size = 24, color = 'currentColor' } = {}) => {
  const s = String(size);
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:inline-block;vertical-align:middle;color:${color}">${inner}</svg>`;
};

export const WidgetIconMarkup = {
  dataSource: (color) =>
    baseSvg(
      [
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
        '<path d="M14 2v6h6" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
        '<path d="M8 13h8M8 17h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
      ].join(''),
      { size: 22, color }
    ),

  dataModel: (color) =>
    baseSvg(
      [
        '<ellipse cx="12" cy="5" rx="7" ry="2.5" stroke="currentColor" stroke-width="1.5"/>',
        '<path d="M5 5v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5" stroke="currentColor" stroke-width="1.5"/>',
        '<path d="M5 9v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V9" stroke="currentColor" stroke-width="1.5"/>',
        '<path d="M5 13v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4" stroke="currentColor" stroke-width="1.5"/>',
      ].join(''),
      { size: 22, color }
    ),

  filter: (color) =>
    baseSvg(
      '<path d="M4 5h16l-5.5 7.2V19l-5 2v-8.8L4 5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
      { size: 22, color }
    ),

  transform: (color) =>
    baseSvg(
      [
        '<path d="M5.5 9.5A7 7 0 0 1 12 5h.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        '<path d="M9 5h3.5V8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
        '<path d="M18.5 14.5A7 7 0 0 1 12 19h-.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        '<path d="M15 19h-3.5v-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
      ].join(''),
      { size: 22, color }
    ),

  formula: (color) =>
    baseSvg(
      [
        '<path d="M10.5 4.5L6 12l4.5 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
        '<path d="M6 4.5h7.5M6 19.5h7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
      ].join(''),
      { size: 22, color }
    ),

  aggregate: (color) =>
    baseSvg(
      [
        '<path d="M4 19V5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        '<path d="M4 19h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        '<rect x="6" y="12" width="3" height="7" rx="0.5" stroke="currentColor" stroke-width="1.5"/>',
        '<rect x="11" y="8" width="3" height="11" rx="0.5" stroke="currentColor" stroke-width="1.5"/>',
        '<rect x="16" y="14" width="3" height="5" rx="0.5" stroke="currentColor" stroke-width="1.5"/>',
      ].join(''),
      { size: 22, color }
    ),

  join: (color) =>
    baseSvg(
      [
        '<circle cx="9" cy="12" r="5.5" stroke="currentColor" stroke-width="1.5"/>',
        '<circle cx="15" cy="12" r="5.5" stroke="currentColor" stroke-width="1.5"/>',
      ].join(''),
      { size: 22, color }
    ),

  relationship: (color) =>
    baseSvg(
      [
        '<circle cx="6" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>',
        '<circle cx="18" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>',
        '<path d="M9 12h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        '<path d="M14 10l2 2-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
      ].join(''),
      { size: 22, color }
    ),

  dataSourceByType: (type, color) => {
    const icons = {
      file: [
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
        '<path d="M14 2v6h6" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
        '<path d="M8 13h8M8 17h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
      ].join(''),
      folder: [
        '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h4l1.5 2H18.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
        '<path d="M3 10h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
      ].join(''),
      archive: [
        '<rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/>',
        '<path d="M4 9h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        '<path d="M12 9v8M9.5 13h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
      ].join(''),
      api: [
        '<rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>',
        '<path d="M7 12h.01M11 12h.01M15 12h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
      ].join(''),
      database: [
        '<ellipse cx="12" cy="6" rx="7" ry="2.5" stroke="currentColor" stroke-width="1.5"/>',
        '<path d="M5 6v5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" stroke="currentColor" stroke-width="1.5"/>',
        '<path d="M5 11v5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-5" stroke="currentColor" stroke-width="1.5"/>',
      ].join(''),
      json: [
        '<path d="M9 4.5C7.5 6 7 7.7 7 10v4c0 2.3-.5 4-2 5.5M15 4.5C16.5 6 17 7.7 17 10v4c0 2.3.5 4 2 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        '<path d="M11 8h2M11 12h2M11 16h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
      ].join(''),
      interactive: [
        '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5"/>',
        '<path d="M12 8v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
      ].join(''),
      databridge: [
        '<path d="M7 7h10v10H7z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
        '<path d="M3 12h4M17 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        '<circle cx="3" cy="12" r="1.5" fill="currentColor"/>',
        '<circle cx="21" cy="12" r="1.5" fill="currentColor"/>',
      ].join(''),
    };
    return baseSvg(icons[type] || icons.file, { size: 22, color });
  },
};

