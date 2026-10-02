import { defineWidget } from '../../sdk/defineWidget.js';
import { CustomHTMLWidget } from '../CustomHTMLWidget.js';

/**
 * Render HTML widget settings into the SDK settings-panel slot.
 * @param {import('../../sdk/createSettingsPanelApi.js').SettingsPanelApi} api
 */
export function renderHtmlSettingsPanel(api) {
  const wrap = document.createElement('div');
  wrap.className = 'style-control-group';

  const label = document.createElement('label');
  label.className = 'style-label';
  label.htmlFor = 'html-widget-code-sdk';
  label.textContent = 'HTML-код';

  const ta = document.createElement('textarea');
  ta.className = 'style-input html-widget-code-input';
  ta.id = 'html-widget-code-sdk';
  ta.rows = 12;
  ta.spellcheck = false;
  ta.autocomplete = 'off';
  ta.placeholder = '<div style="padding:12px">Hello</div>';
  ta.value = api.getSettings().html != null ? String(api.getSettings().html) : '';

  const hint = document.createElement('div');
  hint.style.cssText =
    'margin-top:0.45rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;';
  hint.textContent =
    'Содержимое вставляется во виджет как HTML. Стили фона/рамки виджета настраиваются в секциях «Внешний вид» и «Границы».';

  let debounceTimer = null;
  const apply = () => {
    debounceTimer = null;
    api.patchSettings({ html: ta.value });
    const w = api.widget;
    if (typeof w.render === 'function') w.render();
    else if (typeof w.update === 'function') w.update();
  };

  ta.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(apply, 300);
  });
  ta.addEventListener('blur', () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    apply();
  });

  wrap.appendChild(label);
  wrap.appendChild(ta);
  wrap.appendChild(hint);
  return wrap;
}

export const htmlDefinition = defineWidget({
  type: 'html',
  displayName: 'HTML',
  category: 'content',
  defaultSize: { width: 400, height: 300 },
  defaultSettings: () => ({ html: '' }),
  capabilities: {
    dataBinding: 'none',
    formulas: false,
    reloadable: false,
  },
  WidgetClass: CustomHTMLWidget,
  settingsPanel: {
    sections: [
      {
        id: 'html-content',
        title: 'HTML',
        render: renderHtmlSettingsPanel,
      },
    ],
  },
  paletteDefaults: () => ({
    settings: {
      html: '<div style="padding:12px;color:#E4E6EB;">Custom HTML</div>',
    },
  }),
});
