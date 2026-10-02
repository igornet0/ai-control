/**
 * Inline SVG для конструктора дашбордов (BI): currentColor, единый стиль штриха.
 * viewBox 0 0 24 24, stroke-width 1.75 (кроме мелких кнопок).
 */

export const svgWidgetText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/><path d="M8 9h4"/></svg>`;

export const svgWidgetTable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>`;

export const svgWidgetLineChart = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 2 5-7"/></svg>`;

export const svgWidgetBarChart = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 20V10"/><path d="M9 20V4"/><path d="M15 20v-7"/><path d="M21 20v-13"/><path d="M3 20h18"/></svg>`;

export const svgWidgetPieChart = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z"/><path d="M12 3v9h9a9 9 0 0 0-9-9z"/></svg>`;

export const svgWidgetKpi = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8"/><path d="M8 13h5"/><path d="M8 17h6"/><circle cx="17" cy="8" r="1.5" fill="currentColor" stroke="none"/></svg>`;

/** Датчик: дуга ~270°, неон, яркая точка на конце, значение в центре (как референс HUD). */
export const svgWidgetGauge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><defs><filter id="dcGaugePalGlow" x="-55%" y="-55%" width="210%" height="210%"><feGaussianBlur stdDeviation="0.9" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M6.35 17.65A8 8 0 1 1 17.65 17.65" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.22"/><path d="M6.35 17.65A8 8 0 1 1 17.65 17.65" fill="none" stroke="currentColor" stroke-width="2.45" stroke-linecap="round" stroke-linejoin="round" filter="url(#dcGaugePalGlow)"/><circle cx="17.65" cy="17.65" r="2.05" fill="#fff" stroke="currentColor" stroke-width="0.55"/><text x="12" y="11.35" text-anchor="middle" dominant-baseline="middle" fill="rgba(255,255,255,0.96)" font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif" font-size="5.2" font-weight="700">100%</text></svg>`;

export const svgWidgetHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/><path d="M14 4l-4 16"/></svg>`;

/** Медиа: кадр + play (изображение / видео / PDF / embed). */
export const svgWidgetImage = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 6 3-6 3V9z" fill="currentColor" stroke="none"/></svg>`;

export const svgWidgetContainer = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v5H4z"/><path d="M5 11h16v5H5z"/><path d="M6 18h16v3H6z"/></svg>`;

export const svgWidgetFilter = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>`;

export const svgWidgetButton = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="10" rx="4"/><path d="m11 10 3 2-3 2"/></svg>`;

export const svgWidgetDataInput = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8"/><path d="M8 12h5"/><path d="M8 16h6"/><path d="M16 16h2v2h-2z"/></svg>`;

/** Заголовок панели стилей — «настройка» виджета */
export const svgStylePanelHeader = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;

/** Модальное окно редактора формулы (агрегаты BI) */
export const svgFormulaEditor = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 6h4"/><path d="M9 10h6"/><path d="M9 14h4"/><path d="M16 8l3 4-3 4"/><path d="M19 12h3"/></svg>`;

/** Кнопка «открыть редактор формулы» у полей панели: fx + мини-окно */
export const svgFormulaFxOpen = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="13" y="4" width="8" height="7" rx="1.25"/><path d="M5 7V5a1 1 0 0 1 1-1h4"/><text x="3.5" y="15.5" fill="currentColor" stroke="none" font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="12" font-weight="800">fx</text><path d="M4 19h16"/></svg>`;

/** Кнопка «стили» у вкладки контейнера */
export const svgPaletteBrush = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 11 4 4"/><path d="M17.5 6.5 19 5c1.5-1.5 3-1 4 .5s.5 3-1 4.5l-9 9a2.12 2.12 0 0 1-3 0l-2.5-2.5"/><path d="M5 21c.5-3.5 2.5-5 6-5"/></svg>`;

/** Подтверждение / отмена в выпадающих фильтрах */
export const svgCheck = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;

export const svgCross = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

/** Ручка перетаскивания вкладок */
export const svgDragHandle = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="9" cy="7" r="1.5"/><circle cx="15" cy="7" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="17" r="1.5"/><circle cx="15" cy="17" r="1.5"/></svg>`;

/** Кнопки панели: отмена / повтор */
export const svgToolbarUndo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`;

export const svgToolbarRedo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>`;

/** Вернуть камеру к точке Home (левый верх / настроенная метка) */
export const svgToolbarHome = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9 20v-6h6v6"/></svg>`;

/** Открыть настройки точки Home */
export const svgToolbarHomeSettings = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/></svg>`;

export const widgetPaletteIcons = {
  text: svgWidgetText,
  table: svgWidgetTable,
  'line-chart': svgWidgetLineChart,
  'bar-chart': svgWidgetBarChart,
  'pie-chart': svgWidgetPieChart,
  kpi: svgWidgetKpi,
  gauge: svgWidgetGauge,
  html: svgWidgetHtml,
  image: svgWidgetImage,
  container: svgWidgetContainer,
  filter: svgWidgetFilter,
  'button-widget': svgWidgetButton,
  button_widget: svgWidgetButton,
  data_input: svgWidgetDataInput,
};
