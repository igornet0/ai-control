/**
 * Палитры и адаптация цветов под фон / тему.
 */

function hexToRgb(hex) {
    let h = (hex || '#888').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
    };
}

function rgbToHex(r, g, b) {
    const x = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${x(r)}${x(g)}${x(b)}`;
}

function mix(a, b, t) {
    return {
        r: a.r + (b.r - a.r) * t,
        g: a.g + (b.g - a.g) * t,
        b: a.b + (b.b - a.b) * t,
    };
}

/** Осветлить / затемнить для градиента */
export function shadeHex(hex, amount) {
    const rgb = hexToRgb(hex);
    const target = amount >= 0 ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
    const m = mix(rgb, target, Math.min(1, Math.abs(amount)));
    return rgbToHex(m.r, m.g, m.b);
}

/**
 * Автопалитра: равномерный обход оттенков + насыщенность под тему.
 * @param {number} count
 * @param {{ dark?: boolean, bgLum?: number, seedColors?: string[] }} opts
 */
export function generatePalette(count, opts = {}) {
    const { dark = true, bgLum = 0.12, seedColors = [] } = opts;
    const out = [];
    const baseHueStart = dark ? 195 : 210;
    const spread = 320;
    const sat = dark ? 72 : 65;
    const light = dark ? Math.min(58, 42 + bgLum * 40) : Math.max(38, 55 - bgLum * 25);

    for (let i = 0; i < count; i++) {
        if (i < seedColors.length && seedColors[i]) {
            out.push(seedColors[i]);
            continue;
        }
        const t = count <= 1 ? 0 : i / Math.max(1, count - 1);
        const h = (baseHueStart + t * spread) % 360;
        out.push(hslToHex(h, sat, light));
    }
    return out;
}

function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** Слегка сместить цвет относительно фона для контраста */
export function adaptColorForBackground(hex, bgHex) {
    const c = hexToRgb(hex);
    const b = hexToRgb(bgHex);
    const lumC = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const lumB = 0.2126 * b.r + 0.7152 * b.g + 0.0722 * b.b;
    if (Math.abs(lumC - lumB) < 45) {
        return lumB > 128 ? shadeHex(hex, -0.25) : shadeHex(hex, 0.2);
    }
    return hex;
}

const DEFAULT_PIE_PALETTE = ['#00E0FF', '#3D8BFF', '#005DFF', '#00FFB8', '#FF6B6B', '#FFD93D', '#A78BFA', '#34D399'];

/**
 * Интерполяция палитры на N сегментов (режим «Градиент»).
 * @param {string[]} palette
 * @param {number} count
 * @returns {string[]}
 */
export function samplePaletteSpectrum(palette, count) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (n <= 0) return [];
    const raw = (Array.isArray(palette) ? palette : [])
        .map((c) => String(c || '').trim())
        .filter((c) => /^#[0-9a-fA-F]{3,8}$/.test(c));
    const colors = raw.length ? raw : [...DEFAULT_PIE_PALETTE];
    if (colors.length === 1 || n === 1) {
        return Array.from({ length: n }, () => colors[0]);
    }
    const out = [];
    for (let i = 0; i < n; i += 1) {
        const t = i / (n - 1);
        const f = t * (colors.length - 1);
        const i0 = Math.floor(f);
        const i1 = Math.min(colors.length - 1, i0 + 1);
        const local = f - i0;
        const a = hexToRgb(colors[i0]);
        const b = hexToRgb(colors[i1]);
        const m = mix(a, b, local);
        out.push(rgbToHex(m.r, m.g, m.b));
    }
    return out;
}

/**
 * Цвета секторов по режиму панели (как у столбчатой).
 * @param {{
 *   count: number,
 *   mode?: string,
 *   solid?: string,
 *   palette?: string[],
 *   dark?: boolean,
 *   bgLum?: number,
 * }} opts
 * @returns {string[]}
 */
export function resolvePieItemColors(opts = {}) {
    const count = Math.max(0, Math.floor(Number(opts.count) || 0));
    const mode = String(opts.mode || 'palette').toLowerCase();
    const solidRaw = String(opts.solid || '').trim();
    const solid = /^#[0-9a-fA-F]{3,8}$/.test(solidRaw) ? solidRaw : '#00E0FF';
    const palette = Array.isArray(opts.palette)
        ? opts.palette.map((c) => String(c || '').trim()).filter(Boolean)
        : [];

    if (mode === 'solid') {
        return Array.from({ length: count }, () => solid);
    }
    if (mode === 'gradient') {
        const seeds = palette.length >= 1 ? palette : [...DEFAULT_PIE_PALETTE];
        return samplePaletteSpectrum(seeds, count);
    }
    // palette / auto
    return generatePalette(count, {
        dark: opts.dark !== false,
        bgLum: opts.bgLum ?? 0.15,
        seedColors: palette.length ? palette : [...DEFAULT_PIE_PALETTE],
    });
}

export { DEFAULT_PIE_PALETTE };
