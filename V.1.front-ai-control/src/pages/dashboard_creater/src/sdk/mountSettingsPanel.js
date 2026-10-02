import { createSettingsPanelApi } from './createSettingsPanelApi.js';

/**
 * Mount definition.settingsPanel sections into a host slot element.
 *
 * @param {HTMLElement} slotEl
 * @param {import('./defineWidget.js').WidgetDefinition|null|undefined} definition
 * @param {object} opts
 * @param {import('../core/WidgetBase.js').WidgetBase} opts.widget
 * @param {object|null} opts.engine
 * @param {(opts: object) => void} [opts.openFormulaEditor]
 * @returns {{ api: import('./createSettingsPanelApi.js').SettingsPanelApi|null, unmount: () => void }}
 */
export function mountSettingsPanelContribution(slotEl, definition, opts) {
  const unmountPrevious = () => {
    if (!slotEl) return;
    while (slotEl.firstChild) {
      slotEl.removeChild(slotEl.firstChild);
    }
  };

  unmountPrevious();

  const sections = definition?.settingsPanel?.sections;
  if (!slotEl || !Array.isArray(sections) || sections.length === 0) {
    if (slotEl) slotEl.style.display = 'none';
    return { api: null, unmount: unmountPrevious };
  }

  slotEl.style.display = 'block';
  const api = createSettingsPanelApi(opts);

  for (const section of sections) {
    if (!section || typeof section.render !== 'function') continue;

    const sectionEl = document.createElement('div');
    sectionEl.className = 'style-section expanded widget-sdk-settings-section';
    sectionEl.dataset.section = section.id || 'sdk';
    sectionEl.dataset.sdkSection = section.id || 'sdk';

    const header = document.createElement('div');
    header.className = 'style-section-header';
    header.innerHTML = `
      <span class="style-section-title">${escapeHtml(section.title || definition.displayName || 'Настройки')}</span>
      <div class="style-section-chevron">▼</div>
    `;
    header.addEventListener('click', () => {
      sectionEl.classList.toggle('expanded');
    });

    const body = document.createElement('div');
    body.className = 'style-section-body';
    const inner = document.createElement('div');
    inner.className = 'style-section-inner';

    let content;
    try {
      content = section.render(api);
    } catch (err) {
      console.error(`settingsPanel section "${section.id}" render failed`, err);
      content = document.createElement('div');
      content.textContent = `Ошибка панели: ${section.id}`;
    }

    if (typeof content === 'string') {
      inner.innerHTML = content;
    } else if (content instanceof DocumentFragment || content instanceof HTMLElement) {
      inner.appendChild(content);
    }

    body.appendChild(inner);
    sectionEl.appendChild(header);
    sectionEl.appendChild(body);
    slotEl.appendChild(sectionEl);
  }

  return {
    api,
    unmount() {
      api.destroy();
      unmountPrevious();
      if (slotEl) slotEl.style.display = 'none';
    },
  };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
