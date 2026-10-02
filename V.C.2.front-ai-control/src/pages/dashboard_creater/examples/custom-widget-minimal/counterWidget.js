/**
 * Minimal custom widget example — create from scratch with settingsPanel.
 *
 * Register in the host after builtins:
 *   import counterDefinition from '../examples/custom-widget-minimal/counterWidget.js';
 *   engine.register(counterDefinition);
 */

import { defineWidget, WidgetBase } from '../../src/sdk/index.js';

class CounterWidget extends WidgetBase {
  constructor(config = {}) {
    super({
      ...config,
      type: 'example-counter',
      width: config.width || 220,
      height: config.height || 120,
    });
    this.settings = {
      label: 'Counter',
      value: 0,
      ...(config.settings || {}),
    };
  }

  render() {
    const content = this.element?.querySelector('.widget-content');
    if (!content) return;
    const label = this.settings.label != null ? String(this.settings.label) : 'Counter';
    const value = Number(this.settings.value) || 0;
    content.innerHTML = `
      <div style="padding:12px;display:flex;flex-direction:column;gap:8px;height:100%;box-sizing:border-box;">
        <div style="font-size:12px;opacity:0.75;">${escapeHtml(label)}</div>
        <div style="font-size:28px;font-weight:600;">${value}</div>
      </div>
    `;
  }

  toJSON() {
    return { ...super.toJSON(), settings: this.settings };
  }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const counterDefinition = defineWidget({
  type: 'example-counter',
  displayName: 'Example Counter',
  category: 'examples',
  defaultSize: { width: 220, height: 120 },
  defaultSettings: () => ({ label: 'Counter', value: 0 }),
  capabilities: { dataBinding: 'none', formulas: false, reloadable: false },
  WidgetClass: CounterWidget,
  settingsPanel: {
    sections: [
      {
        id: 'counter-content',
        title: 'Counter',
        render(api) {
          const wrap = document.createElement('div');

          const labelGroup = document.createElement('div');
          labelGroup.className = 'style-control-group';
          const labelEl = document.createElement('label');
          labelEl.className = 'style-label';
          labelEl.textContent = 'Подпись';
          const labelInput = document.createElement('input');
          labelInput.className = 'style-input';
          labelInput.value = api.getSettings().label || '';
          labelInput.addEventListener('input', () => {
            api.patchSettings({ label: labelInput.value });
            api.widget.render();
          });
          labelGroup.appendChild(labelEl);
          labelGroup.appendChild(labelInput);

          const valueGroup = document.createElement('div');
          valueGroup.className = 'style-control-group';
          const valueLabel = document.createElement('label');
          valueLabel.className = 'style-label';
          valueLabel.textContent = 'Значение';
          const valueInput = document.createElement('input');
          valueInput.type = 'number';
          valueInput.className = 'style-input';
          valueInput.value = String(api.getSettings().value ?? 0);
          valueInput.addEventListener('input', () => {
            api.patchSettings({ value: Number(valueInput.value) || 0 });
            api.widget.render();
          });
          valueGroup.appendChild(valueLabel);
          valueGroup.appendChild(valueInput);

          wrap.appendChild(labelGroup);
          wrap.appendChild(valueGroup);
          return wrap;
        },
      },
    ],
  },
  paletteDefaults: () => ({ settings: { label: 'Counter', value: 0 } }),
});

export default counterDefinition;
