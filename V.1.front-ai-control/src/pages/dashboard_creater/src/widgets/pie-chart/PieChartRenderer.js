import { normalizePieConfig, resolvePieTypographySizes } from './pieChartConfig.js';
import {
    adaptColorForBackground,
    shadeHex,
    resolvePieItemColors,
} from './pieChartPalette.js';
import { buildPieModel } from './pieChartDataModel.js';
import { donutSlicePathRounded, polar } from './pieChartMath.js';
import { computeSegmentStats, buildCenterLabel, buildPieCenterTooltip } from './pieChartCenterUtils.js';
import { evaluateSliceColorAst, tryCompileColorFormula } from '../../formula/colorExpr.js';

export { buildPieModel };

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, doc) {
    const e = doc.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) {
        if (v == null) continue;
        e.setAttribute(k, String(v));
    }
    return e;
}

function formatValue(v) {
    if (Math.abs(v) >= 1e6) return v.toExponential(2);
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(v >= 100 ? 0 : 2);
}

function buildLabelText(item, share, cfg) {
    const L = cfg.labels;
    const p = (share * 100).toFixed(L.percentDecimals);
    const parts = [];
    if (L.showName) parts.push(item.label);
    if (L.showPercent) parts.push(`${p}%`);
    if (L.showValue) parts.push(formatValue(item.value));
    return parts.join(' ');
}

/**
 * @param {object} params
 * @param {object[]} params.data
 * @param {string} params.labelField
 * @param {string} params.valueField
 * @param {object} params.settings - widget.settings (raw)
 * @param {object} params.typography
 * @param {object} params.appearance
 * @param {Set<number>} params.hiddenSet - orderIndex скрытых
 */
export function renderPieChartSvg(params) {
    const { data, labelField, valueField, settings, typography, appearance, hiddenSet } = params;
    const ownerDoc = params.document || (typeof document !== 'undefined' ? document : null);
    if (!ownerDoc || !ownerDoc.createElementNS) {
        const cfg0 = normalizePieConfig(settings, typography, appearance);
        return { svg: null, model: { items: [], total: 0 }, cfg: cfg0, sliceMetas: [], rotatingG: null, centerTextEl: null, centerMetric: null };
    }
    const cfg = normalizePieConfig(settings, typography, appearance);

    const model = buildPieModel(data, labelField, valueField, cfg);
    if (model.items.length === 0 || model.total <= 0) {
        return { svg: null, model, cfg, sliceMetas: [], rotatingG: null, centerTextEl: null, centerMetric: null };
    }

    const pieMode = String(cfg.pieColorMode || settings.pieColorMode || 'palette').toLowerCase();
    const paletteColors = Array.isArray(cfg.colors)
        ? cfg.colors
        : Array.isArray(settings.colors)
          ? settings.colors
          : [];
    const resolvedColors = resolvePieItemColors({
        count: model.items.length,
        mode: pieMode,
        solid: cfg.pieSolidColor || settings.pieSolidColor,
        palette: paletteColors,
        dark: cfg._resolvedDark,
        bgLum: cfg._bgLum ?? 0.15,
    });

    const bgHex = appearance?.backgroundColor || '#1a1d24';
    const useCustom = pieMode === 'solid' || pieMode === 'gradient' || pieMode === 'palette' || cfg.colorMode === 'custom';
    model.items.forEach((it, i) => {
        let c = resolvedColors[i % resolvedColors.length] || '#00E0FF';
        if (!useCustom) {
            c = adaptColorForBackground(c, bgHex);
        }
        it.color = c;
    });

    const thrRaw = settings._resolvedSliceThreshold;
    const thrN = thrRaw != null && Number.isFinite(Number(thrRaw)) ? Number(thrRaw) : null;
    const colorFormula = String(settings.pieSliceThresholdFormula || '').trim();
    const colorTry = colorFormula ? tryCompileColorFormula(colorFormula) : { ok: false };
    if (colorTry.ok) {
        model.items.forEach((it) => {
            const hex = evaluateSliceColorAst(colorTry.ast, {
                label: it.label,
                value: it.value,
                dimQualified: settings._pieDimQualified,
                labelField,
            });
            if (hex) it.color = hex;
        });
    } else if (thrN != null) {
        const hi = String(settings.pieSliceAboveColor || '#34d399').trim();
        const lo = String(settings.pieSliceBelowColor || '#f87171').trim();
        const hiSafe = /^#[0-9a-fA-F]{3,8}$/.test(hi) ? hi : '#34d399';
        const loSafe = /^#[0-9a-fA-F]{3,8}$/.test(lo) ? lo : '#f87171';
        model.items.forEach((it) => {
            it.color = it.value >= thrN ? hiSafe : loSafe;
        });
    }

    // Объёмный градиент на сегменте: явный флаг или режим «Градиент»
    const gradientsOn =
        !!cfg.gradients?.enabled ||
        (pieMode === 'gradient' && settings.gradients?.enabled !== false);

    const visible = model.items.filter((it) => !hiddenSet.has(it.orderIndex));
    const sumVal = visible.reduce((s, it) => s + it.value, 0);
    const segmentStats = computeSegmentStats(visible);
    const centerMeasureValue = settings.centerMeasureValue;
    const getCenterText = () => buildCenterLabel(cfg, segmentStats, centerMeasureValue);

    const vb = 520;
    const cx = vb / 2;
    const cy = vb / 2;
    const outerR = 198;
    const innerR = cfg.donut ? Math.min(outerR - 12, outerR * cfg.innerRadius) : 0;

    const svg = el('svg', { viewBox: `0 0 ${vb} ${vb}`, preserveAspectRatio: 'xMidYMid meet' }, ownerDoc);
    svg.setAttribute('class', 'pie-chart-svg');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.display = 'block';

    const defs = el('defs', {}, ownerDoc);
    const styleEl = el('style', {}, ownerDoc);
    styleEl.textContent = `
      .pie-slice-path { cursor: pointer; transition: filter 0.22s ease-out, opacity 0.22s ease-out; }
      .pie-slice-hover-wrap { transition: filter 0.22s ease-out, transform 0.22s ease-out; }
      .pie-chart-svg { cursor: grab; }
      .pie-chart-svg:active { cursor: grabbing; }
      .pie-slice-g.is-hovered .pie-slice-path { filter: brightness(1.15) drop-shadow(0 0 6px rgba(0,224,255,0.35)); }
      .pie-slice-g.is-selected .pie-slice-path { filter: brightness(1.18) drop-shadow(0 0 8px rgba(0,224,255,0.55)); stroke: rgba(255,255,255,0.85); stroke-width: 1.5; }
      .pie-slice-g.is-selected.is-hovered .pie-slice-path { filter: brightness(1.22) drop-shadow(0 0 10px rgba(0,224,255,0.65)); }
      .pie-slice-anim { opacity: 0; animation: pieSliceFade 0.55s ease-out forwards; }
      @keyframes pieSliceFade { from { opacity: 0; } to { opacity: 1; } }
      .pie-label { pointer-events: none; user-select: none; }
      .pie-center-text { pointer-events: none; user-select: none; }
    `;
    defs.appendChild(styleEl);
    svg.appendChild(defs);

    if (gradientsOn) {
        model.items.forEach((it) => {
            const id = `pie-grad-${it.orderIndex}`;
            const c0 = shadeHex(it.color, cfg.gradients.type === 'radial' ? 0.12 : -0.08);
            const c1 = shadeHex(it.color, cfg.gradients.type === 'radial' ? -0.18 : 0.1);
            if (cfg.gradients.type === 'radial') {
                const rg = el('radialGradient', { id, cx: '40%', cy: '35%', r: '75%' }, ownerDoc);
                rg.appendChild(el('stop', { offset: '0%', 'stop-color': c0 }, ownerDoc));
                rg.appendChild(el('stop', { offset: '100%', 'stop-color': c1 }, ownerDoc));
                defs.appendChild(rg);
            } else {
                const lg = el('linearGradient', { id, x1: '0%', y1: '0%', x2: '100%', y2: '100%' }, ownerDoc);
                lg.appendChild(el('stop', { offset: '0%', 'stop-color': c0 }, ownerDoc));
                lg.appendChild(el('stop', { offset: '100%', 'stop-color': c1 }, ownerDoc));
                defs.appendChild(lg);
            }
        });
    }

    const rootG = el('g', { class: 'pie-chart-root' }, ownerDoc);
    svg.appendChild(rootG);

    /** Slices + segment labels rotate together; center value stays outside this group. */
    const rotatingG = el('g', { class: 'pie-rotating' }, ownerDoc);
    rootG.appendChild(rotatingG);

    const n = visible.length;
    const padBetween = Math.min(Math.max(0, cfg.segmentPad), n > 0 ? (2 * Math.PI - 0.02) / n : 0);
    const totalGap = padBetween * n;
    const avail = Math.max(0.01, Math.PI * 2 - totalGap);

    let angle = -Math.PI / 2 + (n > 0 ? padBetween / 2 : 0);
    const sliceMetas = [];
    const fontFam = typography.fontFamily || 'Inter';
    const typoSizes = resolvePieTypographySizes(typography, { outerR, innerR });
    const labelColor = typography.color || '#E4E6EB';
    const minRad = ((cfg.labels.minAngleDeg || 6) * Math.PI) / 180;

    const labelsG = el('g', { class: 'pie-labels', fill: labelColor, 'font-family': `${fontFam}, sans-serif` }, ownerDoc);

    visible.forEach((item, visIdx) => {
        const share = sumVal > 0 ? item.value / sumVal : 0;
        const sweep = share * avail;
        const a0 = angle;
        const a1 = angle + sweep;
        angle = a1 + padBetween;

        const mid = (a0 + a1) / 2;
        const pathD = donutSlicePathRounded(cx, cy, innerR, outerR, a0, a1, cfg.segmentCornerRadius);
        const fill = gradientsOn ? `url(#pie-grad-${item.orderIndex})` : item.color;

        const g = el('g', { class: 'pie-slice-g' }, ownerDoc);
        g.dataset.sliceIndex = String(item.orderIndex);

        const hoverWrap = el('g', { class: 'pie-slice-hover-wrap' }, ownerDoc);
        const path = el('path', {
            class: 'pie-slice-path pie-slice-anim',
            d: pathD,
            fill,
            stroke: 'rgba(0,0,0,0.22)',
            'stroke-width': 0.85,
            'stroke-linejoin': 'round',
        }, ownerDoc);
        path.style.animationDelay = `${visIdx * 0.035}s`;
        hoverWrap.appendChild(path);
        g.appendChild(hoverWrap);
        rotatingG.appendChild(g);

        sliceMetas.push({
            orderIndex: item.orderIndex,
            group: g,
            hoverWrap,
            path,
            midAngle: mid,
            item,
            share,
        });

        const pos = cfg.labels.position;
        if (pos !== 'hidden' && sweep >= minRad) {
            const text = buildLabelText(item, share, cfg);
            if (text) {
                let tx;
                let ty;
                if (pos === 'inside') {
                    const rTxt = innerR + (outerR - innerR) * 0.55;
                    [tx, ty] = polar(cx, cy, rTxt, mid);
                } else {
                    const rTxt = outerR + Math.max(20, typoSizes.labelOutsideFs * 2.2);
                    [tx, ty] = polar(cx, cy, rTxt, mid);
                }
                // Position follows pie rotation; counter-rotate so glyph stays upright
                const labelWrap = el('g', { class: 'pie-label-wrap' }, ownerDoc);
                labelWrap.dataset.labelX = String(tx);
                labelWrap.dataset.labelY = String(ty);
                const t = el('text', {
                    class: 'pie-label',
                    x: '0',
                    y: '0',
                    'font-size': pos === 'inside' ? typoSizes.labelFs : typoSizes.labelOutsideFs,
                    'font-weight': typoSizes.fontWeight,
                    fill: labelColor,
                    'text-anchor': 'middle',
                    'dominant-baseline': 'middle',
                }, ownerDoc);
                t.textContent = text;
                labelWrap.appendChild(t);
                labelsG.appendChild(labelWrap);
            }
        }
    });

    rotatingG.appendChild(labelsG);

    const initialRotation = Number(settings.pieRotationDeg);
    const rot0 = Number.isFinite(initialRotation) ? initialRotation : 0;
    if (rot0 !== 0) {
        rotatingG.setAttribute('transform', `rotate(${rot0} ${cx} ${cy})`);
    }
    labelsG.querySelectorAll('.pie-label-wrap').forEach((wrap) => {
        const lx = wrap.getAttribute('data-label-x') || wrap.dataset.labelX;
        const ly = wrap.getAttribute('data-label-y') || wrap.dataset.labelY;
        wrap.setAttribute('transform', `translate(${lx},${ly}) rotate(${-rot0})`);
    });

    let centerG = null;
    let centerTextEl = null;
    if (cfg.donut && cfg.center.enabled) {
        centerG = el('g', { class: 'pie-center' }, ownerDoc);
        const centerTip = el('title', {}, ownerDoc);
        centerTip.textContent = buildPieCenterTooltip(cfg, segmentStats, centerMeasureValue);
        centerG.appendChild(centerTip);
        centerTextEl = el('text', {
            class: 'pie-center-text',
            x: String(cx),
            y: String(cy),
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-family': `${fontFam}, sans-serif`,
            'font-weight': typoSizes.centerFontWeight,
            'font-size': String(typoSizes.centerFs),
            fill: labelColor,
        }, ownerDoc);
        centerTextEl.textContent = getCenterText();
        centerG.appendChild(centerTextEl);
        // Append after rotatingG so center stays upright and above slices
        rootG.appendChild(centerG);
    }

    return {
        svg,
        model,
        cfg,
        sliceMetas,
        rotatingG,
        centerTextEl,
        centerMetric: {
            cx,
            cy,
            sumVal,
            stats: segmentStats,
            centerMeasureValue,
            getCenterText,
        },
    };
}
