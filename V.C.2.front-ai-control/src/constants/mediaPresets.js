/** Image size presets: CSS display → serve @2x. Keep in sync with src/app/services/media_presets.py */

export const MEDIA_PRESETS = {
  avatar_xs: { width: 56, height: 56, fit: 'cover', display: 28 },
  avatar_sm: { width: 68, height: 68, fit: 'cover', display: 34 },
  avatar_md: { width: 80, height: 80, fit: 'cover', display: 40 },
  avatar_lg: { width: 160, height: 160, fit: 'cover', display: 80 },
  dashboard_cover: { width: 480, height: 360, fit: 'cover', displayWidth: 240, displayHeight: 180 },
  dashboard_card: { width: 500, height: 500, fit: 'cover', display: 250 },
  sheet_cover: { width: 600, height: 280, fit: 'cover', displayHeight: 140 },
  selector_thumb: { width: 200, height: 176, fit: 'cover', displayHeight: 88 },
  chat_inline: { width: 576, height: 512, fit: 'cover', displayWidth: 288, displayHeight: 256 },
  widget_image: { width: 1280, height: 1280, fit: 'contain' },
};

export function getMediaPreset(name) {
  if (!name) return null;
  return MEDIA_PRESETS[String(name)] || null;
}

export function isApiMediaRef(ref) {
  return typeof ref === 'string' && ref.startsWith('/api');
}

export function isStaticOrHttpRef(ref) {
  if (!ref || typeof ref !== 'string') return false;
  return ref.startsWith('/static') || ref.startsWith('http://') || ref.startsWith('https://');
}
