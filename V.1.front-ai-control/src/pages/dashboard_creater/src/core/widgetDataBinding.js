/**
 * Привязка виджетов дашборда к модели данных и единое пустое состояние.
 */

import { formulaHasQualifiedTableRefs } from '../formula/formulaInference.js';
import { normalizeGaugeSettings } from '../widgets/gauge/gaugeSettingsSchema.js';
import { chartDimMeasBindingsOk } from '../widgets/common/chartBindingFormula.js';

const TYPES_NEEDING_DATA = new Set([
  'table',
  'line-chart',
  'bar-chart',
  'pie-chart',
  'kpi',
  'gauge',
  'filter',
  'data_input',
  'image',
]);

export function widgetTypeNeedsDataBinding(type) {
  return TYPES_NEEDING_DATA.has(type);
}

export function isDataBindingUnavailable(widget) {
  return widget?.settings?.dataBindingStatus === 'unavailable';
}

/** @param {{ type: string, dataSource?: object, settings?: object }} widget */
export function hasDataBinding(widget) {
  if (!widget) return false;
  if (isDataBindingUnavailable(widget)) return false;
  const t = widget.type;
  const ds = widget.dataSource;

  if (t === 'table') {
    const fields = widget.settings?.bindingFields;
    if (Array.isArray(fields) && fields.length > 0 && ds?.modelId != null && !!ds?.table) {
      return true;
    }
    return !!(ds?.modelId != null && ds?.table && ds?.field);
  }
  if (t === 'kpi') {
    const s = widget.settings || {};
    const vf = String(s.valueFormula || '').trim();
    if (vf && formulaHasQualifiedTableRefs(vf)) return true;
    const formulaBound = vf && String(s.dateField || '').trim();
    return (
      ds?.modelId != null &&
      !!ds?.table &&
      (!!ds?.field || !!formulaBound)
    );
  }
  if (t === 'gauge') {
    const s = normalizeGaugeSettings(widget.settings || {}, { dataSource: ds || {} });
    const vs = String(s.valueSource || 'field_value');
    if (vs === 'static_value') {
      const hasStatic =
        s.staticValue != null &&
        s.staticValue !== '' &&
        Number.isFinite(Number(s.staticValue));
      const hasLegacyValue =
        s.value != null &&
        s.value !== '' &&
        Number.isFinite(Number(s.value));
      return hasStatic || hasLegacyValue;
    }
    if (vs === 'formula_value') {
      const vf = String(s.valueFormula || '').trim();
      if (vf && formulaHasQualifiedTableRefs(vf)) return true;
      return ds?.modelId != null && !!ds?.table;
    }
    if (vs === 'field_value' || vs === 'aggregated_value') {
      return ds?.modelId != null && !!ds?.table && !!ds?.field;
    }
    return false;
  }
  if (t === 'line-chart' || t === 'bar-chart' || t === 'pie-chart') {
    const s = widget.settings || {};
    if (t === 'line-chart') {
      return chartDimMeasBindingsOk(s.bindingDimension, s.bindingMeasure, s.bindingMeasures);
    }
    return chartDimMeasBindingsOk(s.bindingDimension, s.bindingMeasure);
  }
  if (t === 'filter') {
    return Array.isArray(widget.settings?.filters) && widget.settings.filters.length > 0;
  }
  if (t === 'data_input') {
    return !!(widget.settings?.table && widget.settings?.modelId);
  }
  if (t === 'text') {
    if (widget.settings?.mode !== 'dynamic') return true;
    const hasDs = ds?.modelId != null && !!ds?.table;
    const hasStaticText = String(widget.settings?.text ?? '').trim().length > 0;
    const hasTemplate = String(widget.settings?.template ?? '').trim().length > 0;
    return hasDs || hasStaticText || hasTemplate;
  }
  if (t === 'image') {
    const hasDs = ds?.modelId != null && !!ds?.table && !!ds?.field;
    const hasStatic = String(widget.settings?.staticSrc ?? '').trim().length > 0;
    return hasDs || hasStatic;
  }
  return true;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {object} [typography] — из widget.styles.typography
 * @param {'data'|'text'|'html'|'unavailable'} [variant]
 */
export function renderWidgetEmptyInnerHtml(typography = {}, variant = 'data') {
  const fontFamily = typography.fontFamily || 'Inter';
  const color = typography.color || '#E4E6EB';
  const ff = esc(fontFamily).replace(/'/g, '&#39;');

  let title;
  let line1;
  let line2;
  if (variant === 'unavailable') {
    title = 'Поле данных недоступно';
    line1 =
      'Привязка указывает на модель, которой нет на дашборде, или поле не найдено в новой схеме.';
    line2 = 'Обновите привязку: перетащите поле с вкладки «Данные» на этот виджет.';
  } else if (variant === 'text') {
    title = 'Нет текста';
    line1 =
      'Введите текст или шаблон в панели настроек справа (режим «Динамический» — поле «Шаблон», «Статический» — поле «Текст»).';
    line2 = '';
  } else if (variant === 'html') {
    title = 'Нет HTML';
    line1 = 'Добавьте разметку в панели настроек справа.';
    line2 = '';
  } else {
    title = 'Нет привязки к данным';
    line1 =
      'Перетащите поле с вкладки «Данные» на этот виджет.';
    line2 =
      'При необходимости уточните параметры в панели настроек справа.';
  }

  const hintBlock = line2
    ? `<p class="widget-data-empty__hint">${line2}</p>`
    : '';

  return `
    <div class="widget-data-empty" style="font-family:'${ff}',sans-serif;color:${esc(color)};">
      <div class="widget-data-empty__title">${esc(title)}</div>
      <p class="widget-data-empty__text">${line1}</p>
      ${hintBlock}
    </div>`;
}

/** Текст баннера в панели стилей (чуть развёрнутее). */
export function getStylePanelDataBindingHintText() {
  return 'Чтобы виджет показал данные: откройте вкладку «Данные» слева и перетащите поле на виджет. Дополнительные параметры — в этой панели ниже.';
}

/** Empty-state HTML that reflects unavailable remapped bindings. */
export function renderWidgetDataPlaceholder(widget, typography = {}) {
  const variant = isDataBindingUnavailable(widget) ? 'unavailable' : 'data';
  return renderWidgetEmptyInnerHtml(typography, variant);
}

export function widgetNeedsStylePanelDataHint(widget) {
  if (!widget) return false;
  if (isDataBindingUnavailable(widget)) return true;
  if (widget.type === 'text' && widget.settings?.mode === 'dynamic') {
    const ds = widget.dataSource;
    const hasDs = ds?.modelId != null && !!ds?.table;
    const hasStaticText = String(widget.settings?.text ?? '').trim().length > 0;
    const hasTemplate = String(widget.settings?.template ?? '').trim().length > 0;
    return !(hasDs || hasStaticText || hasTemplate);
  }
  if (!widgetTypeNeedsDataBinding(widget.type)) return false;
  return !hasDataBinding(widget);
}
