import { defineWidget } from '../sdk/defineWidget.js';
import { TextWidget } from '../widgets/TextWidget.js';
import { TableWidget } from '../widgets/TableWidget.js';
import { KpiWidget } from '../widgets/KpiWidget.js';
import { LineChartWidget } from '../widgets/LineChartWidget.js';
import { BarChartWidget } from '../widgets/BarChartWidget.js';
import { PieChartWidget } from '../widgets/PieChartWidget.js';
import { GaugeWidget } from '../widgets/GaugeWidget.js';
import { ContainerWidget } from '../widgets/ContainerWidget.js';
import { FilterWidget } from '../widgets/FilterWidget.js';
import { WidgetButton } from '../widgets/WidgetButton.js';
import { DataInputWidget } from '../widgets/DataInputWidget.js';
import { htmlDefinition } from '../widgets/html/htmlDefinition.js';
import { imageDefinition } from '../widgets/image/imageDefinition.js';

/**
 * Built-in widget definitions (metadata + classes).
 * Type-specific editor UI for most builtins still lives in WidgetStylePanel;
 * `html` uses SDK `settingsPanel` as the migration proof.
 */
export const builtinDefinitions = [
  defineWidget({
    type: 'text',
    displayName: 'Текст',
    category: 'content',
    defaultSize: { width: 300, height: 100 },
    capabilities: { dataBinding: 'single-field', formulas: true, reloadable: true },
    WidgetClass: TextWidget,
  }),
  defineWidget({
    type: 'table',
    displayName: 'Таблица',
    category: 'data',
    defaultSize: { width: 480, height: 320 },
    capabilities: { dataBinding: 'multi-field', formulas: true, reloadable: true },
    WidgetClass: TableWidget,
    paletteDefaults: () => ({
      settings: {
        data: [
          { name: 'Элемент 1', value: 100, status: 'Активен' },
          { name: 'Элемент 2', value: 200, status: 'Активен' },
          { name: 'Элемент 3', value: 150, status: 'Неактивен' },
        ],
        columns: ['name', 'value', 'status'],
      },
    }),
  }),
  defineWidget({
    type: 'line-chart',
    displayName: 'Линейный график',
    category: 'charts',
    defaultSize: { width: 480, height: 280 },
    capabilities: { dataBinding: 'dim-measure', formulas: true, reloadable: true },
    WidgetClass: LineChartWidget,
    paletteDefaults: () => ({
      settings: {
        data: [
          { x: 'Янв', y: 10 },
          { x: 'Фев', y: 20 },
          { x: 'Мар', y: 15 },
          { x: 'Апр', y: 25 },
          { x: 'Май', y: 30 },
        ],
      },
    }),
  }),
  defineWidget({
    type: 'bar-chart',
    displayName: 'Столбчатая диаграмма',
    category: 'charts',
    defaultSize: { width: 480, height: 280 },
    capabilities: { dataBinding: 'dim-measure', formulas: true, reloadable: true },
    WidgetClass: BarChartWidget,
    paletteDefaults: () => ({
      settings: {
        data: [
          { x: 'Янв', y: 10 },
          { x: 'Фев', y: 20 },
          { x: 'Мар', y: 15 },
          { x: 'Апр', y: 25 },
          { x: 'Май', y: 30 },
        ],
      },
    }),
  }),
  defineWidget({
    type: 'pie-chart',
    displayName: 'Круговая диаграмма',
    category: 'charts',
    defaultSize: { width: 360, height: 320 },
    capabilities: { dataBinding: 'dim-measure', formulas: true, reloadable: true },
    WidgetClass: PieChartWidget,
    paletteDefaults: () => ({
      settings: {
        data: [
          { label: 'Категория A', value: 30 },
          { label: 'Категория B', value: 45 },
          { label: 'Категория C', value: 25 },
        ],
      },
    }),
  }),
  defineWidget({
    type: 'kpi',
    displayName: 'KPI',
    category: 'metrics',
    defaultSize: { width: 280, height: 160 },
    capabilities: { dataBinding: 'single-field', formulas: true, reloadable: true },
    WidgetClass: KpiWidget,
    paletteDefaults: () => ({
      settings: {
        title: 'Общая сумма',
        value: '1,234',
        unit: '₽',
        trend: 'up',
        trendValue: '+12%',
      },
    }),
  }),
  defineWidget({
    type: 'gauge',
    displayName: 'Датчик',
    category: 'metrics',
    defaultSize: { width: 280, height: 220 },
    capabilities: { dataBinding: 'single-field', formulas: true, reloadable: true },
    WidgetClass: GaugeWidget,
    paletteDefaults: () => ({
      settings: {
        value: 65,
        min: 0,
        max: 100,
        theme: 'neon',
        gaugeColor: '#00f0ff',
        fillColor: '#00ff80',
        valueSuffix: '%',
        dialRotation: 0,
      },
    }),
  }),
  htmlDefinition,
  imageDefinition,
  defineWidget({
    type: 'container',
    displayName: 'Шкаф',
    category: 'layout',
    defaultSize: { width: 500, height: 400 },
    capabilities: { dataBinding: 'none', formulas: false, reloadable: false },
    WidgetClass: ContainerWidget,
  }),
  defineWidget({
    type: 'filter',
    displayName: 'Фильтр',
    category: 'data',
    defaultSize: { width: 280, height: 320 },
    capabilities: { dataBinding: 'multi-field', formulas: false, reloadable: false },
    WidgetClass: FilterWidget,
    paletteDefaults: () => ({
      settings: { title: 'Фильтры', filters: [], allowExportToProfile: false },
      styles: { typography: { color: '#000000' } },
    }),
  }),
  defineWidget({
    type: 'button-widget',
    displayName: 'Кнопки',
    category: 'actions',
    aliases: ['button_widget'],
    defaultSize: { width: 320, height: 80 },
    capabilities: { dataBinding: 'none', formulas: false, reloadable: false },
    WidgetClass: WidgetButton,
    paletteDefaults: () => ({
      settings: {
        layout: { direction: 'row', wrap: true },
        buttons: [
          {
            id: 'btn_1',
            label: 'Лист 2',
            icon: 'arrow',
            action: { type: 'navigate', target: '2', payload: {} },
          },
          {
            id: 'btn_2',
            label: 'NL',
            icon: 'filter',
            action: {
              type: 'filter',
              target: 'global',
              payload: { field: 'country', value: 'Netherlands' },
            },
          },
        ],
      },
    }),
  }),
  defineWidget({
    type: 'data_input',
    displayName: 'Ввод данных',
    category: 'data',
    defaultSize: { width: 360, height: 280 },
    capabilities: { dataBinding: 'multi-field', formulas: false, reloadable: false },
    WidgetClass: DataInputWidget,
  }),
];

/**
 * Register all built-in widget definitions on an engine.
 * @param {import('../core/WorkspaceEngine.js').WorkspaceEngine} engine
 */
export function registerBuiltins(engine) {
  if (!engine || typeof engine.register !== 'function') {
    throw new Error('registerBuiltins: engine with register() is required');
  }
  for (const def of builtinDefinitions) {
    engine.register(def);
  }
}

/**
 * Palette entries derived from definitions (excludes hideFromPalette / aliases-only).
 * @param {import('../core/WorkspaceEngine.js').WorkspaceEngine} engine
 * @returns {{ type: string, label: string, category: string }[]}
 */
export function getPaletteEntriesFromEngine(engine) {
  if (!engine || typeof engine.getWidgetDefinitions !== 'function') {
    return builtinDefinitions
      .filter((d) => !d.hideFromPalette)
      .map((d) => ({ type: d.type, label: d.displayName, category: d.category }));
  }
  return engine
    .getWidgetDefinitions()
    .filter((d) => !d.hideFromPalette)
    .map((d) => ({ type: d.type, label: d.displayName || d.type, category: d.category || 'custom' }));
}
