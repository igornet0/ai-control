/**
 * Public Widget SDK entry.
 * Prefer importing from here (or package exports) instead of deep paths.
 */

export { defineWidget } from './defineWidget.js';
export { createWidgetContext, resolveWidgetContext } from './WidgetContext.js';
export { createSettingsPanelApi } from './createSettingsPanelApi.js';
export { mountSettingsPanelContribution } from './mountSettingsPanel.js';
export {
  builtinDefinitions,
  registerBuiltins,
  getPaletteEntriesFromEngine,
} from './builtins.js';

export { WidgetBase } from '../core/WidgetBase.js';
export { WorkspaceEngine, WIDGET_CLIPBOARD_PREFIX } from '../core/WorkspaceEngine.js';
export { WidgetManager } from '../core/WidgetManager.js';
export { eventBus } from '../core/EventBus.js';
export { Serializer } from '../core/Serializer.js';

export { htmlDefinition, renderHtmlSettingsPanel } from '../widgets/html/htmlDefinition.js';
export { CustomHTMLWidget } from '../widgets/CustomHTMLWidget.js';
export { TextWidget } from '../widgets/TextWidget.js';
export { KpiWidget } from '../widgets/KpiWidget.js';
export { TableWidget } from '../widgets/TableWidget.js';
export { GaugeWidget } from '../widgets/GaugeWidget.js';
export { LineChartWidget } from '../widgets/LineChartWidget.js';
export { BarChartWidget } from '../widgets/BarChartWidget.js';
export { PieChartWidget } from '../widgets/PieChartWidget.js';
export { ContainerWidget } from '../widgets/ContainerWidget.js';
export { FilterWidget } from '../widgets/FilterWidget.js';
export { WidgetButton } from '../widgets/WidgetButton.js';
export { DataInputWidget } from '../widgets/DataInputWidget.js';
