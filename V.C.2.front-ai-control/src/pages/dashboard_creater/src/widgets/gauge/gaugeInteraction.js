import { eventBus } from '../../core/EventBus.js';

/**
 * Подписать клик по датчику (режим интерактивности в настройках).
 * @param {HTMLElement|null} root — .widget-content или корень виджета
 * @param {{ widgetId: string, enabled: boolean, getNumericValue: () => number }} opts
 * @returns {() => void}
 */
export function attachGaugeInteraction(root, opts) {
  if (!root || !opts.enabled) return () => {};
  const shell = /** @type {HTMLElement|null} */ (
    root.querySelector('.gauge-widget-shell[data-gauge-interactive="true"]')
  );
  const wrap = shell?.querySelector('.gauge-wrapper');
  if (!wrap) return () => {};

  const onClick = () => {
    eventBus.emit('gauge:click', {
      widgetId: opts.widgetId,
      value: opts.getNumericValue(),
    });
  };

  wrap.style.cursor = 'pointer';
  wrap.addEventListener('click', onClick);
  return () => {
    wrap.removeEventListener('click', onClick);
    wrap.style.cursor = '';
  };
}
