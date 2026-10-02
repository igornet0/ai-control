import {
  BUTTON_ICON_OPTIONS,
  drawButtonIcon,
  getButtonIconLabel,
  getButtonIconNoneSvg,
  getButtonIconSize,
  getButtonIconSvg,
  hasButtonIcon,
} from './buttonIcons.js';

export const DEFAULT_BUTTON_STYLE = Object.freeze({
  background: '#2D6BFF',
  color: '#FFFFFF',
  borderColor: '#2D6BFF',
  borderWidth: 1,
  borderRadius: 8,
  padding: [8, 16],
  fontFamily: 'Inter, sans-serif',
  fontSize: 14,
  fontWeight: 600,
  textAlign: 'center',
  shadowBlur: 10,
  shadowColor: 'rgba(45, 107, 255, 0.35)',
  hoverBackground: '#3D7BFF',
  activeBackground: '#1E57E2',
  disabledBackground: '#6B7280',
  disabledColor: '#D1D5DB',
  iconPosition: 'left',
});

export {
  BUTTON_ICON_OPTIONS,
  getButtonIconLabel,
  getButtonIconNoneSvg,
  getButtonIconSvg,
  hasButtonIcon,
};

/** @deprecated use getButtonIconSvg — kept for older imports */
export function getButtonIconGlyph(iconId) {
  if (iconId == null || iconId === '') return '';
  return hasButtonIcon(iconId) ? '■' : String(iconId).slice(0, 2);
}

function asNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizePadding(padding) {
  if (Array.isArray(padding) && padding.length >= 2) {
    return [asNumber(padding[0], 8), asNumber(padding[1], 16)];
  }
  const n = asNumber(padding, 8);
  return [n, n];
}

function pickDefined(obj = {}) {
  const out = {};
  Object.keys(obj || {}).forEach((key) => {
    if (obj[key] != null && obj[key] !== '') out[key] = obj[key];
  });
  return out;
}

export function normalizeButtonStyle(style = {}) {
  const normalized = {
    ...DEFAULT_BUTTON_STYLE,
    ...pickDefined(style),
  };
  normalized.borderWidth = Math.max(0, asNumber(normalized.borderWidth, DEFAULT_BUTTON_STYLE.borderWidth));
  normalized.borderRadius = clamp(asNumber(normalized.borderRadius, DEFAULT_BUTTON_STYLE.borderRadius), 0, 48);
  normalized.fontSize = clamp(asNumber(normalized.fontSize, DEFAULT_BUTTON_STYLE.fontSize), 8, 72);
  normalized.fontWeight = asNumber(normalized.fontWeight, DEFAULT_BUTTON_STYLE.fontWeight);
  normalized.fontFamily = String(normalized.fontFamily || DEFAULT_BUTTON_STYLE.fontFamily);
  normalized.padding = normalizePadding(normalized.padding);
  normalized.shadowBlur = Math.max(0, asNumber(normalized.shadowBlur, DEFAULT_BUTTON_STYLE.shadowBlur));
  normalized.iconPosition = ['left', 'right', 'top'].includes(normalized.iconPosition)
    ? normalized.iconPosition
    : 'left';
  return normalized;
}

/** Partial style object for storage (only explicit keys). */
export function normalizeButtonStylePartial(style = {}) {
  if (!style || typeof style !== 'object') return {};
  const allowed = Object.keys(DEFAULT_BUTTON_STYLE);
  const out = {};
  allowed.forEach((key) => {
    if (style[key] == null || style[key] === '') return;
    if (key === 'padding') {
      out.padding = normalizePadding(style.padding);
      return;
    }
    if (key === 'fontSize' || key === 'fontWeight' || key === 'borderWidth' || key === 'borderRadius' || key === 'shadowBlur') {
      const n = Number(style[key]);
      if (Number.isFinite(n)) out[key] = n;
      return;
    }
    out[key] = style[key];
  });
  Object.keys(style).forEach((key) => {
    if (!key.endsWith('Formula')) return;
    const v = String(style[key] ?? '').trim();
    if (v) out[key] = v;
  });
  return out;
}

/**
 * Merge cascade: defaults ← typography ← shared ← custom override
 */
export function resolveButtonDrawStyle({
  typography = {},
  defaultButtonStyle = {},
  buttonStyle = {},
  useCustomStyle = false,
} = {}) {
  const fromTypography = pickDefined({
    fontFamily: typography.fontFamily,
    fontWeight: typography.fontWeight,
    fontSize: typography.fontSize,
    color: typography.color,
  });
  const shared = normalizeButtonStylePartial(defaultButtonStyle);
  const custom = useCustomStyle ? normalizeButtonStylePartial(buttonStyle) : {};
  return normalizeButtonStyle({
    ...fromTypography,
    ...shared,
    ...custom,
  });
}

export function createUniqueButtonId(existingIds = []) {
  const used = new Set(
    (Array.isArray(existingIds) ? existingIds : [])
      .map((x) => (x == null ? '' : String(x).trim()))
      .filter(Boolean),
  );
  const make = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `btn_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    }
    return `btn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  };
  for (let i = 0; i < 24; i += 1) {
    const id = make();
    if (!used.has(id)) return id;
  }
  return `btn_${Date.now()}_${used.size}`;
}

/**
 * Стабилизирует id кнопок: сохраняет существующие, чинит пустые и дубликаты.
 * @param {Array<object>} buttons
 * @returns {Array<object>}
 */
export function ensureUniqueButtonIds(buttons) {
  const list = Array.isArray(buttons) ? buttons : [];
  const seen = new Set();
  return list.map((btn) => {
    const next = btn && typeof btn === 'object' ? { ...btn } : {};
    let id = next.id != null ? String(next.id).trim() : '';
    if (!id || seen.has(id)) {
      id = createUniqueButtonId(seen);
    }
    seen.add(id);
    next.id = id;
    return next;
  });
}

export function normalizeButtonConfig(raw = {}, index = 0) {
  const rawId = raw.id != null ? String(raw.id).trim() : '';
  const id = rawId || `btn_${index + 1}`;
  const useCustomStyle = raw.useCustomStyle === true;
  return {
    id,
    label: raw.label == null ? `Button ${index + 1}` : String(raw.label),
    icon: raw.icon || null,
    disabled: raw.disabled === true,
    useCustomStyle,
    style: normalizeButtonStylePartial(raw.style || {}),
    action: raw.action && typeof raw.action === 'object' ? { ...raw.action } : { type: 'custom', payload: {} },
  };
}

function fontCss(style) {
  const family = style.fontFamily || DEFAULT_BUTTON_STYLE.fontFamily;
  return `${style.fontWeight} ${style.fontSize}px ${family}`;
}

function measureTextWidth(ctx, text, style) {
  if (!ctx) return String(text || '').length * Math.max(7, style.fontSize * 0.55);
  ctx.save();
  ctx.font = fontCss(style);
  const width = ctx.measureText(String(text || '')).width;
  ctx.restore();
  return width;
}

function resolveIconLayout(iconId, fontSize) {
  if (!iconId || !hasButtonIcon(iconId)) {
    if (!iconId) return { size: 0, width: 0, known: false };
    const fallbackSize = getButtonIconSize(fontSize);
    return { size: fallbackSize, width: fallbackSize + 6, known: false, fallbackText: String(iconId).slice(0, 2) };
  }
  const size = getButtonIconSize(fontSize);
  return { size, width: size + 6, known: true };
}

export class ButtonItem {
  constructor(config, index, resolvedStyle = null) {
    this.index = index;
    this.config = normalizeButtonConfig(config, index);
    this.drawStyle = resolvedStyle
      ? normalizeButtonStyle(resolvedStyle)
      : normalizeButtonStyle(this.config.useCustomStyle ? this.config.style : {});
    this.hitbox = { x: 0, y: 0, width: 0, height: 0 };
    this.state = 'default';
  }

  setState(nextState) {
    this.state = nextState;
  }

  setHitbox(rect) {
    this.hitbox = { ...rect };
  }

  containsPoint(x, y) {
    const r = this.hitbox;
    return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
  }

  getPreferredSize(ctx) {
    const style = this.drawStyle;
    const [padY, padX] = style.padding;
    const label = String(this.config.label || '').trim();
    const iconLayout = resolveIconLayout(this.config.icon, style.fontSize);
    if (!label && iconLayout.size) {
      const side = Math.ceil(iconLayout.size + padY * 2);
      return { width: Math.max(side, 32), height: Math.max(side, 32) };
    }
    const labelWidth = label ? measureTextWidth(ctx, label, style) : 0;
    const iconWidth = iconLayout.size ? (label ? iconLayout.width : iconLayout.size) : 0;
    const width = Math.ceil(labelWidth + iconWidth + padX * 2);
    const height = Math.ceil(Math.max(style.fontSize + padY * 2, iconLayout.size + padY * 2, 30));
    return { width, height };
  }

  draw(ctx) {
    const { x, y, width, height } = this.hitbox;
    const style = this.drawStyle;
    const disabled = this.config.disabled;
    const bg = disabled
      ? style.disabledBackground
      : this.state === 'active'
        ? style.activeBackground
        : this.state === 'hover'
          ? style.hoverBackground
          : style.background;
    const fg = disabled ? style.disabledColor : style.color;

    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, x, y, width, height, style.borderRadius);
    ctx.fillStyle = bg;
    ctx.shadowBlur = style.shadowBlur;
    ctx.shadowColor = style.shadowColor;
    ctx.fill();
    ctx.shadowBlur = 0;

    if (style.borderWidth > 0) {
      ctx.lineWidth = style.borderWidth;
      ctx.strokeStyle = style.borderColor || bg;
      ctx.stroke();
    }

    ctx.font = fontCss(style);
    ctx.fillStyle = fg;
    ctx.textBaseline = 'middle';

    const label = String(this.config.label || '').trim();
    const iconLayout = resolveIconLayout(this.config.icon, style.fontSize);
    const midY = y + height / 2;

    const drawIconAt = (iconX) => {
      if (!iconLayout.size) return;
      const iconY = midY - iconLayout.size / 2;
      if (iconLayout.known) {
        drawButtonIcon(ctx, this.config.icon, iconX, iconY, iconLayout.size, fg);
        return;
      }
      ctx.fillText(iconLayout.fallbackText || '', iconX, midY);
    };

    if (!label && iconLayout.size) {
      drawIconAt(x + (width - iconLayout.size) / 2);
      ctx.restore();
      return;
    }

    const labelWidth = label ? ctx.measureText(label).width : 0;
    const contentWidth = labelWidth + (label && iconLayout.size ? iconLayout.width : iconLayout.size || 0);
    let cursorX = x + Math.max(8, (width - contentWidth) / 2);

    if (iconLayout.size && style.iconPosition !== 'right') {
      drawIconAt(cursorX);
      cursorX += iconLayout.width;
    }
    if (label) ctx.fillText(label, cursorX, midY);
    if (iconLayout.size && style.iconPosition === 'right') {
      drawIconAt(cursorX + labelWidth + 6);
    }
    ctx.restore();
  }
}

function roundRectPath(ctx, x, y, width, height, radius) {
  const r = clamp(radius, 0, Math.min(width, height) / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
}
