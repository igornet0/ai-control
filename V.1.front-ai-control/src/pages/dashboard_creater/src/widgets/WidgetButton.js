import { WidgetBase } from '../core/WidgetBase.js';
import { eventBus } from '../core/EventBus.js';
import {
  ButtonItem,
  normalizeButtonConfig,
  normalizeButtonStylePartial,
  resolveButtonDrawStyle,
  ensureUniqueButtonIds,
  createUniqueButtonId,
} from './button/ButtonItem.js';
import { ButtonActionDispatcher } from './button/ButtonAction.js';
import { createDashWidgetHeadingElement, normalizeWidgetTitleSettings } from './common/widgetTitle.js';

const DEFAULT_LAYOUT = Object.freeze({
  direction: 'row',
  wrap: true,
  gap: 8,
  padding: 10,
  align: 'start',
});

function asNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeLayout(layout = {}) {
  return {
    direction: layout.direction === 'column' ? 'column' : 'row',
    wrap: layout.wrap !== false,
    gap: Math.max(0, asNumber(layout.gap, DEFAULT_LAYOUT.gap)),
    padding: Math.max(0, asNumber(layout.padding, DEFAULT_LAYOUT.padding)),
    align: ['start', 'center', 'end', 'stretch'].includes(layout.align) ? layout.align : DEFAULT_LAYOUT.align,
  };
}

function normalizeConfig(settings = {}) {
  const buttons = Array.isArray(settings.buttons) && settings.buttons.length > 0
    ? settings.buttons
    : [
        {
          id: createUniqueButtonId(),
          label: 'Open Sheet',
          icon: 'arrow',
          action: { type: 'navigate', target: '1', payload: {} },
        },
      ];
  const next = {
    ...settings,
    type: 'button_widget',
    layout: normalizeLayout(settings.layout || {}),
    buttons: ensureUniqueButtonIds(
      buttons.map((button, index) => normalizeButtonConfig(button, index)),
    ),
    defaultButtonStyle: normalizeButtonStylePartial(settings.defaultButtonStyle || {}),
    interactiveInEditor: settings.interactiveInEditor === true,
  };
  normalizeWidgetTitleSettings(next, {
    defaultTitle: 'Кнопки',
    defaultShow: false,
  });
  return next;
}

export class WidgetButton extends WidgetBase {
  constructor(config = {}) {
    super({
      ...config,
      type: 'button-widget',
      width: config.width || 360,
      height: config.height || 120,
    });
    this.settings = normalizeConfig(config.settings || {});
    this._canvas = null;
    this._ctx = null;
    this._buttons = [];
    this._hoverButtonId = null;
    this._activeButtonId = null;
    this._dpr = 1;
    this._resizeObserver = null;
    this._actionDispatcher = new ButtonActionDispatcher(
      typeof window !== 'undefined' ? window.engine : null,
    );
    this._boundMouseMove = (e) => this._handlePointerMove(e);
    this._boundMouseLeave = () => this._handlePointerLeave();
    this._boundMouseDown = (e) => this._handlePointerDown(e);
    this._boundMouseUp = (e) => this._handlePointerUp(e);
    this._boundClick = (e) => this._handleClick(e);
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._redrawTimer = null;
    /** Уже ждём layout после нулевого rect — не крутим таймер бесконечно. */
    this._awaitingLayoutRedraw = false;
    this._modeUnsub = eventBus.on('mode:changed', () => {
      if (this._canvas) {
        this._canvas.style.cursor = this._isInteractive() ? 'pointer' : 'default';
        this._scheduleRedraw();
      }
    });
  }

  /** Перерисовка после layout/CSS (двойной rAF + лёгкий fallback). */
  _scheduleRedraw() {
    if (this._redrawTimer != null) {
      clearTimeout(this._redrawTimer);
      this._redrawTimer = null;
    }
    const paint = () => {
      if (!this._canvas || !this.element) return;
      this._draw();
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(paint));
    }
    this._redrawTimer = setTimeout(() => {
      this._redrawTimer = null;
      paint();
    }, 48);
  }

  _isInteractive() {
    const mode = typeof window !== 'undefined' && window.engine ? window.engine.mode : 'editor';
    return mode === 'viewer' || this.settings.interactiveInEditor === true;
  }

  _ensureCanvas(content) {
    if (!content) return;
    content.textContent = '';
    const shell = document.createElement('div');
    shell.className = 'dash-widget-shell dash-widget-shell--column button-widget-shell';
    // Inline fallbacks — пока main.css не применил .dash-widget-shell--column
    shell.style.display = 'flex';
    shell.style.flexDirection = 'column';
    shell.style.width = '100%';
    shell.style.height = '100%';
    shell.style.minHeight = '0';
    shell.style.padding = '0';
    shell.style.boxSizing = 'border-box';

    const heading = createDashWidgetHeadingElement(this.settings);
    if (heading) {
      heading.style.flexShrink = '0';
      heading.style.padding = '0.35rem 0.5rem 0';
      shell.appendChild(heading);
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'button-widget-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.flex = '1';
    canvas.style.minHeight = '0';
    canvas.style.display = 'block';
    canvas.style.cursor = this._isInteractive() ? 'pointer' : 'default';
    shell.appendChild(canvas);
    content.appendChild(shell);

    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._attachCanvasEvents();
    this._observeResize(shell);
  }

  _attachCanvasEvents() {
    if (!this._canvas) return;
    this._detachCanvasEvents();
    this._canvas.addEventListener('mousemove', this._boundMouseMove);
    this._canvas.addEventListener('mouseleave', this._boundMouseLeave);
    this._canvas.addEventListener('mousedown', this._boundMouseDown);
    this._canvas.addEventListener('mouseup', this._boundMouseUp);
    this._canvas.addEventListener('click', this._boundClick);
  }

  _detachCanvasEvents() {
    if (!this._canvas) return;
    this._canvas.removeEventListener('mousemove', this._boundMouseMove);
    this._canvas.removeEventListener('mouseleave', this._boundMouseLeave);
    this._canvas.removeEventListener('mousedown', this._boundMouseDown);
    this._canvas.removeEventListener('mouseup', this._boundMouseUp);
    this._canvas.removeEventListener('click', this._boundClick);
  }

  _observeResize(target) {
    if (!target || typeof ResizeObserver === 'undefined') return;
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this._resizeObserver = new ResizeObserver(() => {
      this._syncCanvasSize();
      this._draw();
    });
    this._resizeObserver.observe(target);
  }

  _syncCanvasSize() {
    if (!this._canvas || !this._ctx) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    // clientWidth/Height — layout без CSS transform scale(zoom).
    // getBoundingClientRect() включает зум → bitmap раздувается и кнопки прыгают.
    let cssW = this._canvas.clientWidth;
    let cssH = this._canvas.clientHeight;
    if (cssW < 2 || cssH < 2) {
      cssW = Math.max(cssW, Number(this.width) || 0, 120);
      cssH = Math.max(cssH, Number(this.height) || 0, 48);
      // Не крутим таймер, пока виджет скрыт (неактивная вкладка шкафа).
      const hidden = this.element?.style?.display === 'none';
      if (!hidden && !this._awaitingLayoutRedraw) {
        this._awaitingLayoutRedraw = true;
        this._scheduleRedraw();
      }
    } else {
      this._awaitingLayoutRedraw = false;
    }
    const width = Math.max(1, Math.floor(cssW * dpr));
    const height = Math.max(1, Math.floor(cssH * dpr));
    if (this._canvas.width !== width || this._canvas.height !== height) {
      this._canvas.width = width;
      this._canvas.height = height;
    }
    this._dpr = dpr;
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Layout-размер canvas в CSS px (без viewport zoom). */
  _layoutSize() {
    if (!this._canvas) {
      return {
        width: Math.max(1, Number(this.width) || 1),
        height: Math.max(1, Number(this.height) || 1),
      };
    }
    const fromClientW = this._canvas.clientWidth;
    const fromClientH = this._canvas.clientHeight;
    const fromBitmapW = this._dpr > 0 ? this._canvas.width / this._dpr : 0;
    const fromBitmapH = this._dpr > 0 ? this._canvas.height / this._dpr : 0;
    return {
      width: Math.max(1, fromClientW >= 2 ? fromClientW : fromBitmapW || Number(this.width) || 1),
      height: Math.max(1, fromClientH >= 2 ? fromClientH : fromBitmapH || Number(this.height) || 1),
    };
  }

  getWidgetColorFormulaMap() {
    const s = this.settings || {};
    const shared = s.defaultButtonStyle || {};
    /** @type {Record<string, { hex?: string, formula?: string }>} */
    const map = {
      titleColor: { hex: s.titleColor, formula: s.titleColorFormula },
      sharedBackground: { hex: shared.background, formula: shared.backgroundFormula },
      sharedColor: { hex: shared.color, formula: shared.colorFormula },
      sharedHoverBackground: {
        hex: shared.hoverBackground,
        formula: shared.hoverBackgroundFormula,
      },
      sharedActiveBackground: {
        hex: shared.activeBackground,
        formula: shared.activeBackgroundFormula,
      },
      sharedBorderColor: { hex: shared.borderColor, formula: shared.borderColorFormula },
    };
    (Array.isArray(s.buttons) ? s.buttons : []).forEach((btn, i) => {
      const st = btn?.style || {};
      map[`btn_${i}_background`] = { hex: st.background, formula: st.backgroundFormula };
      map[`btn_${i}_color`] = { hex: st.color, formula: st.colorFormula };
      map[`btn_${i}_hoverBackground`] = {
        hex: st.hoverBackground,
        formula: st.hoverBackgroundFormula,
      };
      map[`btn_${i}_activeBackground`] = {
        hex: st.activeBackground,
        formula: st.activeBackgroundFormula,
      };
      map[`btn_${i}_borderColor`] = { hex: st.borderColor, formula: st.borderColorFormula };
    });
    return map;
  }

  _applyResolvedButtonColors(style, resolveKey) {
    const r = this._resolvedWidgetColors || {};
    const out = { ...style };
    const keys = ['background', 'color', 'hoverBackground', 'activeBackground', 'borderColor'];
    keys.forEach((k) => {
      const hex = r[resolveKey(k)];
      if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/i.test(hex)) out[k] = hex;
    });
    return out;
  }

  _resolveButtonStyle(buttonCfg = {}) {
    const idx = buttonCfg.__index ?? 0;
    const base = resolveButtonDrawStyle({
      typography: this.styles?.typography || {},
      defaultButtonStyle: this._applyResolvedButtonColors(
        this.settings?.defaultButtonStyle || {},
        (k) => `shared${k.charAt(0).toUpperCase()}${k.slice(1)}`,
      ),
      buttonStyle: buttonCfg.useCustomStyle
        ? this._applyResolvedButtonColors(buttonCfg.style || {}, (k) => `btn_${idx}_${k}`)
        : buttonCfg.style || {},
      useCustomStyle: buttonCfg.useCustomStyle === true,
    });
    return base;
  }

  _buildButtonItems() {
    this._buttons = (this.settings.buttons || []).map((cfg, index) => {
      const resolved = this._resolveButtonStyle({ ...cfg, __index: index });
      return new ButtonItem(cfg, index, resolved);
    });
    return this._buttons;
  }

  _layoutButtons() {
    if (!this._ctx || !this._canvas) return;
    const layout = normalizeLayout(this.settings.layout || {});
    const cssWidth = this._canvas.width / this._dpr;
    const cssHeight = this._canvas.height / this._dpr;
    const innerX = layout.padding;
    const innerY = layout.padding;
    const innerWidth = Math.max(10, cssWidth - layout.padding * 2);
    const innerHeight = Math.max(10, cssHeight - layout.padding * 2);

    const buttons = this._buildButtonItems();
    if (buttons.length === 0) return;

    if (layout.direction === 'column') {
      const itemHeight = Math.max(32, (innerHeight - layout.gap * (buttons.length - 1)) / buttons.length);
      buttons.forEach((button, idx) => {
        const pref = button.getPreferredSize(this._ctx);
        const iconOnly = !String(button.config.label || '').trim();
        const y = innerY + idx * (itemHeight + layout.gap);
        button.setHitbox({
          x: innerX,
          y,
          width: iconOnly ? Math.min(pref.width, innerWidth) : innerWidth,
          height: iconOnly ? Math.max(pref.height, 32) : itemHeight,
        });
      });
      return;
    }

    let cursorX = innerX;
    let cursorY = innerY;
    let rowHeight = 0;
    buttons.forEach((button) => {
      const pref = button.getPreferredSize(this._ctx);
      const iconOnly = !String(button.config.label || '').trim();
      const minW = iconOnly ? Math.min(pref.width, 32) : 70;
      const width = Math.max(minW, Math.min(pref.width, innerWidth));
      const height = Math.max(iconOnly ? 32 : 30, pref.height);
      const nextWrap = layout.wrap && cursorX > innerX && cursorX + width > innerX + innerWidth;
      if (nextWrap) {
        cursorX = innerX;
        cursorY += rowHeight + layout.gap;
        rowHeight = 0;
      }
      const y = cursorY;
      button.setHitbox({ x: cursorX, y, width, height });
      cursorX += width + layout.gap;
      rowHeight = Math.max(rowHeight, height);
    });
  }

  _draw() {
    if (!this._ctx || !this._canvas) return;
    this._syncCanvasSize();
    const ctx = this._ctx;
    const w = this._canvas.width / this._dpr;
    const h = this._canvas.height / this._dpr;
    ctx.clearRect(0, 0, w, h);
    this._layoutButtons();

    const interactive = this._isInteractive();
    if (this._canvas) {
      this._canvas.style.cursor = interactive ? 'pointer' : 'default';
    }

    this._buttons.forEach((button) => {
      if (button.config.id === this._activeButtonId) button.setState('active');
      else if (button.config.id === this._hoverButtonId) button.setState('hover');
      else button.setState('default');
      button.draw(ctx);
    });
  }

  _eventPoint(evt) {
    if (!this._canvas) return { x: -1, y: -1 };
    const rect = this._canvas.getBoundingClientRect();
    const layout = this._layoutSize();
    // GBR учитывает zoom; hitbox'ы в layout-координатах canvas — нормализуем.
    const scaleX = layout.width / Math.max(1e-6, rect.width || layout.width);
    const scaleY = layout.height / Math.max(1e-6, rect.height || layout.height);
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY,
    };
  }

  _findButtonByPoint(point) {
    return this._buttons.find((button) => button.containsPoint(point.x, point.y)) || null;
  }

  _handlePointerMove(evt) {
    if (!this._isInteractive()) return;
    const point = this._eventPoint(evt);
    const hit = this._findButtonByPoint(point);
    const nextHover = hit ? hit.config.id : null;
    if (nextHover !== this._hoverButtonId) {
      this._hoverButtonId = nextHover;
      this._draw();
    }
  }

  _handlePointerLeave() {
    this._hoverButtonId = null;
    this._activeButtonId = null;
    this._draw();
  }

  _handlePointerDown(evt) {
    if (!this._isInteractive()) return;
    evt.stopPropagation();
    const point = this._eventPoint(evt);
    const hit = this._findButtonByPoint(point);
    this._activeButtonId = hit ? hit.config.id : null;
    this._draw();
  }

  _handlePointerUp(evt) {
    if (!this._isInteractive()) return;
    evt.stopPropagation();
    this._activeButtonId = null;
    this._draw();
  }

  _handleClick(evt) {
    if (!this._isInteractive()) return;
    evt.stopPropagation();
    const point = this._eventPoint(evt);
    const hit = this._findButtonByPoint(point);
    if (!hit || hit.config.disabled) return;
    this.onClick(hit.config.id);
  }

  onClick(buttonId) {
    const button = this._buttons.find((item) => item.config.id === buttonId);
    if (!button) return { ok: false };
    return this.dispatchAction(button.config.action, { buttonId });
  }

  dispatchAction(action, extraContext = {}) {
    this._actionDispatcher.engine = typeof window !== 'undefined' ? window.engine : this._actionDispatcher.engine;
    return this._actionDispatcher.dispatch(action, {
      ...extraContext,
      widgetId: this.id,
    });
  }

  applyStyles() {
    super.applyStyles();
    if (this._canvas && this._ctx) this._draw();
  }

  updateConfig(config = {}) {
    const next = normalizeConfig({
      ...this.settings,
      ...config,
    });
    this.settings = next;
    this.update();
  }

  /**
   * Синхронизация DOM-заголовка без полного пересоздания canvas
   * (иначе update() после панели стилей не показывает showTitle).
   */
  _syncHeading() {
    const content = this.element?.querySelector('.widget-content');
    const shell = content?.querySelector('.button-widget-shell');
    if (!shell) return false;
    shell.querySelectorAll(':scope > .dash-widget-heading').forEach((el) => el.remove());
    const heading = createDashWidgetHeadingElement(this.settings);
    if (heading) {
      heading.style.flexShrink = '0';
      heading.style.padding = '0.35rem 0.5rem 0';
      const canvas = shell.querySelector('.button-widget-canvas');
      if (canvas) shell.insertBefore(heading, canvas);
      else shell.insertBefore(heading, shell.firstChild);
    }
    return true;
  }

  render() {
    const content = this.element.querySelector('.widget-content');
    if (!content) return;
    this._ensureCanvas(content);
    this._draw();
    this._scheduleRedraw();
  }

  update() {
    if (!this.element) return;
    if (!this._canvas) {
      this.render();
      this.applyStyles();
      return;
    }
    this.settings = normalizeConfig(this.settings || {});
    this._syncHeading();
    this.applyStyles();
    this._scheduleRedraw();
  }

  destroy() {
    this._detachCanvasEvents();
    if (this._redrawTimer != null) {
      clearTimeout(this._redrawTimer);
      this._redrawTimer = null;
    }
    if (this._modeUnsub) {
      this._modeUnsub();
      this._modeUnsub = null;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    this._actionDispatcher?.destroy?.();
    super.destroy();
  }

  toJSON() {
    return {
      ...super.toJSON(),
      settings: normalizeConfig(this.settings),
    };
  }

  fromJSON(json) {
    super.fromJSON(json);
    this.settings = normalizeConfig(json.settings || this.settings);
    this.render();
  }
}
