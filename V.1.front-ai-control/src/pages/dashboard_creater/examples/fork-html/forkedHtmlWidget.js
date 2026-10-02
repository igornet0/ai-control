/**
 * Fork of the built-in HTML widget — extend class + definition.
 *
 *   import forkedHtmlDefinition from '../examples/fork-html/forkedHtmlWidget.js';
 *   engine.register(forkedHtmlDefinition);
 */

import { defineWidget, CustomHTMLWidget, htmlDefinition } from '../../src/sdk/index.js';

class PrefixedHtmlWidget extends CustomHTMLWidget {
  constructor(config = {}) {
    super({
      ...config,
      type: 'example-fork-html',
    });
    this.settings = {
      html: '',
      prefix: '<!-- forked -->',
      ...(config.settings || {}),
    };
  }

  render() {
    const content = this.element?.querySelector('.widget-content');
    if (!content) return;
    const prefix = this.settings.prefix != null ? String(this.settings.prefix) : '';
    const html = this.settings.html != null ? String(this.settings.html) : '';
    if (!html.trim()) {
      super.render();
      return;
    }
    content.innerHTML = `<div class="dash-widget-shell custom-html-widget-shell">${prefix}${html}</div>`;
  }
}

function renderForkedHtmlPanel(api) {
  const wrap = document.createElement('div');

  const prefixGroup = document.createElement('div');
  prefixGroup.className = 'style-control-group';
  const prefixLabel = document.createElement('label');
  prefixLabel.className = 'style-label';
  prefixLabel.textContent = 'Prefix';
  const prefixInput = document.createElement('input');
  prefixInput.className = 'style-input';
  prefixInput.value = api.getSettings().prefix || '';
  prefixInput.addEventListener('input', () => {
    api.patchSettings({ prefix: prefixInput.value });
    api.widget.render();
  });
  prefixGroup.appendChild(prefixLabel);
  prefixGroup.appendChild(prefixInput);

  const htmlGroup = document.createElement('div');
  htmlGroup.className = 'style-control-group';
  const htmlLabel = document.createElement('label');
  htmlLabel.className = 'style-label';
  htmlLabel.textContent = 'HTML-код';
  const ta = document.createElement('textarea');
  ta.className = 'style-input';
  ta.rows = 10;
  ta.value = api.getSettings().html != null ? String(api.getSettings().html) : '';
  ta.addEventListener('input', () => {
    api.patchSettings({ html: ta.value });
    api.widget.render();
  });
  htmlGroup.appendChild(htmlLabel);
  htmlGroup.appendChild(ta);

  wrap.appendChild(prefixGroup);
  wrap.appendChild(htmlGroup);
  return wrap;
}

export const forkedHtmlDefinition = defineWidget({
  ...htmlDefinition,
  type: 'example-fork-html',
  displayName: 'Forked HTML',
  category: 'examples',
  WidgetClass: PrefixedHtmlWidget,
  defaultSettings: () => ({
    html: '<div style="padding:12px">Forked HTML</div>',
    prefix: '<!-- forked -->',
  }),
  settingsPanel: {
    sections: [
      {
        id: 'forked-html',
        title: 'Forked HTML',
        render: renderForkedHtmlPanel,
      },
    ],
  },
  paletteDefaults: () => ({
    settings: {
      html: '<div style="padding:12px;color:#E4E6EB;">Forked HTML</div>',
      prefix: '<!-- forked -->',
    },
  }),
});

export default forkedHtmlDefinition;
