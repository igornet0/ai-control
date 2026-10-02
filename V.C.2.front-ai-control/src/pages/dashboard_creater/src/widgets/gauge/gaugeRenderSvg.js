import { resolveGaugeFillStyle, lightenColor, hexToRgb } from './gaugeColor.js';
import { buildDashWidgetHeadingHtml } from '../common/widgetTitle.js';
import { buildGaugeTargetZones } from './gaugeSettingsSchema.js';

function escGaugeHeading(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {number} min
 * @param {number} max
 * @param {number} value
 * @returns {number} 0..1
 */
function gaugeNorm01(min, max, value) {
  const span = max - min;
  if (!Number.isFinite(span) || span === 0) return 0;
  return Math.max(0, Math.min(1, (Number(value) - min) / span));
}

/**
 * @param {Array<{ from: number, to: number, color: string }>} zones
 * @param {number} value
 * @param {string} fallback
 */
function zoneColorAtValue(zones, value, fallback) {
  if (!Array.isArray(zones) || !zones.length) return fallback;
  for (const z of zones) {
    if (value >= z.from && value <= z.to) return z.color || fallback;
  }
  return zones[zones.length - 1]?.color || fallback;
}

/**
 * @param {string} hex
 * @param {number} alpha
 * @param {string} fallback
 */
function hexToRgba(hex, alpha, fallback) {
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * @param {object} p
 * @returns {{ trackHtml: string, markersHtml: string }}
 */
function buildProgressBarZonesMarkup(p) {
  const {
    zones,
    targets,
    paintTrack,
    trackColorRgba,
    padX,
    barY,
    barH,
    innerW,
    rx,
    min,
    max,
    barNeonStyle,
    trackClipId,
  } = p;

  const trackClipAttr = trackClipId ? `clip-path="url(#${trackClipId})"` : '';

  let trackHtml = '';
  if (paintTrack && zones.length) {
    // Зоны — плоские сегменты; скругление всего бара даёт общий rounded clip
    // (иначе только первая зона со rx, а правый край остаётся «обрубленным»).
    const zoneRects = zones
      .map((z) => {
        const x0 = padX + gaugeNorm01(min, max, z.from) * innerW;
        const x1 = padX + gaugeNorm01(min, max, z.to) * innerW;
        const w = Math.max(0, x1 - x0);
        if (w <= 0) return '';
        const fill = hexToRgba(z.color, 0.55, trackColorRgba);
        return `<rect class="gauge-progress-zone" data-zone-id="${escapeAttr(z.targetId || '')}" x="${x0}" y="${barY}" width="${w}" height="${barH}" fill="${fill}" />`;
      })
      .join('');
    trackHtml = `<g class="gauge-progress-zones" ${trackClipAttr} style="${barNeonStyle}">${zoneRects}</g>`;
  } else {
    trackHtml = `<rect class="gauge-progress-track" x="${padX}" y="${barY}" width="${innerW}" height="${barH}" rx="${rx}" ry="${rx}"
            fill="${trackColorRgba}" style="${barNeonStyle}" />`;
  }

  const markerY0 = Math.max(1, barY - 5);
  const markerY1 = barY + barH + 3;
  const markersHtml = (targets || [])
    .map((t) => {
      const n = gaugeNorm01(min, max, t.value);
      // Чуть внутрь краёв, чтобы риска/подпись не обрезались SVG
      const x = padX + Math.min(0.995, Math.max(0.005, n)) * innerW;
      const label = String(t.label || '').trim() || String(Math.round(Number(t.value)));
      const color = escapeAttr(t.color || '#f59e0b');
      const anchor = n > 0.92 ? 'end' : n < 0.08 ? 'start' : 'middle';
      return `<g class="gauge-target-marker" data-target-id="${escapeAttr(t.id || '')}">
        <line x1="${x}" y1="${markerY0}" x2="${x}" y2="${markerY1}" stroke="${color}" stroke-width="2" />
        <text x="${x}" y="${Math.max(9, markerY0 - 1)}" text-anchor="${anchor}" fill="${color}" font-size="9" font-family="sans-serif">${escapeHtml(label)}</text>
      </g>`;
    })
    .join('');

  return { trackHtml, markersHtml };
}

/**
 * @param {object} p
 * @returns {{ trackHtml: string, markersHtml: string }}
 */
function buildArcZonesMarkup(p) {
  const {
    zones,
    targets,
    paintTrack,
    trackColorRgba,
    thickness,
    centerX,
    centerY,
    radius,
    startAngle,
    endAngle,
    cap,
    min,
    max,
    rotateSvg,
  } = p;

  const angleRange = endAngle - startAngle;
  let trackHtml = '';
  if (paintTrack && zones.length) {
    trackHtml = zones
      .map((z) => {
        const a0 = startAngle + gaugeNorm01(min, max, z.from) * angleRange;
        const a1 = startAngle + gaugeNorm01(min, max, z.to) * angleRange;
        if (!(a1 > a0 + 1e-6)) return '';
        const { d } = arcPathD(centerX, centerY, radius, a0, a1);
        const stroke = hexToRgba(z.color, 0.7, trackColorRgba);
        return `<path class="gauge-track-zone" data-zone-id="${escapeAttr(z.targetId || '')}" d="${d}" fill="none" stroke="${stroke}" stroke-width="${thickness}" stroke-linecap="butt" />`;
      })
      .join('');
  } else {
    const { d: trackPath } = arcPathD(centerX, centerY, radius, startAngle, endAngle);
    trackHtml = `<path class="gauge-track" d="${trackPath}" fill="none" stroke="${trackColorRgba}" stroke-width="${thickness}" stroke-linecap="${cap}" />`;
  }

  const tickOuter = radius + thickness * 0.55;
  const tickInner = Math.max(0, radius - thickness * 0.55);
  const counter = Number.isFinite(rotateSvg) ? -rotateSvg : 0;
  const markersHtml = (targets || [])
    .map((t) => {
      const n = gaugeNorm01(min, max, t.value);
      const ang = startAngle + n * angleRange;
      const rad = (ang * Math.PI) / 180;
      const x1 = centerX + tickInner * Math.cos(rad);
      const y1 = centerY + tickInner * Math.sin(rad);
      const x2 = centerX + tickOuter * Math.cos(rad);
      const y2 = centerY + tickOuter * Math.sin(rad);
      const lx = centerX + (tickOuter + 10) * Math.cos(rad);
      const ly = centerY + (tickOuter + 10) * Math.sin(rad);
      const label = String(t.label || '').trim() || `(${Math.round(Number(t.value))})`;
      const color = escapeAttr(t.color || '#f59e0b');
      return `<g class="gauge-target-marker" data-target-id="${escapeAttr(t.id || '')}">
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.5" stroke-linecap="round" />
        <text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="9" font-family="sans-serif" transform="rotate(${counter} ${lx} ${ly})">${escapeHtml(label)}</text>
      </g>`;
    })
    .join('');

  return { trackHtml, markersHtml };
}

/**
 * Горизонтальный прогресс-бар (прямоугольная полоса).
 */
function buildProgressBarGaugeMarkup(p) {
  const {
    widgetId,
    settings,
    typography,
    dataBound,
    unboundHintHtml,
    displayText,
    v,
    percent,
    normalized01,
    computeError,
    box,
    interactionEnabled = false,
    resolvedTargets = [],
    scaleMin,
    scaleMax,
  } = p;

  const gw = Math.max(32, Number(box.width) || 200);
  const gh = Math.max(20, Number(box.height) || 40);

  const targets = Array.isArray(resolvedTargets) ? resolvedTargets : [];
  const hasTargetMarkers = targets.length > 0;

  const padRatio = Number(settings.gaugePaddingRatio) || 0.08;
  const padX = Math.min(gw * 0.2, Math.max(6, gw * padRatio));
  const padY = Math.min(gh * 0.35, Math.max(2, gh * padRatio * 0.4));
  const innerW = Math.max(8, gw - 2 * padX);

  let barH = Number(settings.thickness);
  if (!Number.isFinite(barH) || barH < 1) barH = 20;
  // Место сверху под подписи маркеров целей
  const markerReserve = hasTargetMarkers ? Math.min(14, Math.max(8, gh * 0.18)) : 0;
  barH = Math.max(8, Math.min(barH, Math.max(14, gh - 2 * padY - markerReserve - 4)));
  const barY = Math.max(padY + markerReserve, (gh - barH) / 2);

  const reqRx = Math.max(0, Number(settings.progressBarCornerRadius) || 0);
  const rx = Math.min(reqRx, barH / 2, innerW / 2);

  const clipW = Math.max(0, innerW * (Math.max(0, Math.min(100, percent)) / 100));

  const fontFamily = typography.fontFamily || 'Inter';
  const fontSize = typography.fontSize
    ? Math.max(11, Math.round(typography.fontSize * 1.25))
    : Math.max(12, Math.round(Math.min(gw, gh) / 14));
  const fontWeight = typography.fontWeight || '600';

  const finalGaugeColor = String(settings.gaugeColor || '#ffffff');
  const finalFillBase = String(settings.fillColor || '#00ff80');
  const tc = String(settings.textColor ?? '').trim();
  const finalTextColor = tc || String(typography.color || '#ffffff');

  const idSafe = String(widgetId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const clipId = `gpb_clip_${idSafe}`;
  const trackClipId = `gpb_track_clip_${idSafe}`;
  const fillGradId = `fill-gradient-pb_${idSafe}`;
  const glowFilterId = `gauge-glow-pb_${idSafe}`;

  const fillResolved = resolveGaugeFillStyle(normalized01, finalFillBase, settings);
  let fillGradientDef = '';
  let fillAttr = '';
  if (fillResolved.useGradient && fillResolved.gradientStops?.length) {
    const stops = fillResolved.gradientStops
      .map((s) => `<stop offset="${s.offset}" style="stop-color:${s.color};stop-opacity:1" />`)
      .join('');
    fillGradientDef = `<linearGradient id="${fillGradId}" gradientUnits="userSpaceOnUse"
      x1="${padX}" y1="${barY + barH / 2}" x2="${padX + innerW}" y2="${barY + barH / 2}">${stops}</linearGradient>`;
    fillAttr = `url(#${fillGradId})`;
  } else {
    fillAttr = fillResolved.strokeCss || finalFillBase;
  }

  const trackRgb = hexToRgb(finalGaugeColor);
  const to = Number(settings.trackOpacity);
  const trackOp = Number.isFinite(to) ? Math.max(0.03, Math.min(1, to)) : 0.12;
  const trackColorRgba = trackRgb
    ? `rgba(${trackRgb.r}, ${trackRgb.g}, ${trackRgb.b}, ${trackOp})`
    : 'rgba(255,255,255,0.12)';

  const neonEnabled = settings.neonEnabled !== false;
  const neonColor = String(settings.neonColor || '#78ff82');
  const glowIntensity = Number(settings.glowIntensity) || 10;
  const neonRgb = hexToRgb(neonColor);
  const neonRgba1 = neonRgb ? `rgba(${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}, 0.4)` : 'rgba(120,255,130,0.4)';
  const neonRgba2 = neonRgb ? `rgba(${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}, 0.25)` : 'rgba(120,255,130,0.25)';
  const neonRgbaText1 = neonRgb ? `rgba(${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}, 0.5)` : 'rgba(120,255,130,0.5)';
  const neonRgbaText2 = neonRgb ? `rgba(${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}, 0.25)` : 'rgba(120,255,130,0.25)';

  const barNeonStyle = neonEnabled
    ? `filter: drop-shadow(0 0 2px ${neonRgba1}) drop-shadow(0 0 6px ${neonRgba2});`
    : '';
  const textNeonStyle = neonEnabled
    ? `text-shadow: 0 0 3px ${neonRgbaText1}, 0 0 8px ${neonRgbaText2};`
    : '';

  const safeClipW = clipW > 0 ? clipW : 0;
  const fillRx = safeClipW > 0 ? Math.min(rx, safeClipW / 2) : 0;
  const clipPathDef =
    safeClipW <= 0
      ? ''
      : `<clipPath id="${clipId}"><rect x="${padX}" y="${barY}" width="${safeClipW}" height="${barH}" rx="${fillRx}" ry="${fillRx}" /></clipPath>`;
  const trackClipDef = `<clipPath id="${trackClipId}"><rect x="${padX}" y="${barY}" width="${innerW}" height="${barH}" rx="${rx}" ry="${rx}" /></clipPath>`;

  const tipLines = [];
  if (computeError) tipLines.push(`Ошибка: ${computeError}`);
  tipLines.push(`Значение: ${v}`);
  if (settings.tooltipShowFormula !== false && String(settings.valueFormula || '').trim()) {
    tipLines.push(`Формула: ${String(settings.valueFormula).trim()}`);
  }
  const tipText = tipLines.join('\n');
  const titleAttr = tipText ? `title="${escapeAttr(tipText)}"` : '';
  const showVal = settings.showValue !== false;

  const animMs = settings.animationEnabled !== false ? Number(settings.animationSpeed) || 500 : 0;
  const ease = String(settings.animationEasing || 'cubic-bezier(0.16, 1, 0.3, 1)');
  const fillPaintAttr = fillAttr.startsWith('url(') ? fillAttr : escapeAttr(fillAttr);

  const fillClipAttr = safeClipW > 0 ? `clip-path="url(#${clipId})"` : '';
  const fillRect = `<rect class="gauge-progress-fill" x="${padX}" y="${barY}" width="${innerW}" height="${barH}"
        fill="${fillPaintAttr}" style="${barNeonStyle}" ${fillClipAttr} />`;

  const min = Number.isFinite(Number(scaleMin)) ? Number(scaleMin) : Number(settings.min) || 0;
  const max = Number.isFinite(Number(scaleMax)) ? Number(scaleMax) : Number(settings.max) || 100;
  const paintTrack = settings.targetsPaintTrack !== false;
  const zones = buildGaugeTargetZones(min, max, targets);
  const { trackHtml, markersHtml } = buildProgressBarZonesMarkup({
    zones,
    targets,
    paintTrack,
    trackColorRgba,
    padX,
    barY,
    barH,
    innerW,
    rx,
    min,
    max,
    barNeonStyle,
    trackClipId,
  });

  return `
    <div class="dash-widget-shell dash-widget-shell--column gauge-widget-shell gauge-widget-shell--progress-bar" style="font-family:'${fontFamily}', -apple-system, sans-serif;"
      data-gauge-interactive="${interactionEnabled ? 'true' : 'false'}" data-gauge-widget-id="${escapeAttr(String(widgetId))}">
      ${buildDashWidgetHeadingHtml(settings, escGaugeHeading)}
      <div class="gauge-wrapper gauge-wrapper--progress-bar" style="position: relative; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;"
        ${titleAttr}>
        ${!dataBound ? unboundHintHtml : ''}
        <svg class="gauge-svg gauge-svg--progress-bar" viewBox="0 0 ${gw} ${gh}" preserveAspectRatio="none" style="
            width: 100%; height: 100%; display:block; flex-shrink:0; overflow: visible;">
          <defs>
            <filter id="${glowFilterId}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="${glowIntensity / 2}" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            ${fillGradientDef}
            ${trackClipDef}
            ${clipPathDef}
          </defs>
          ${trackHtml}
          ${safeClipW > 0 ? fillRect : ''}
          ${markersHtml}
        </svg>
        ${showVal
          ? `<div class="gauge-value" style="
              position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
              width: 100%; text-align: center; font-size: ${fontSize}px; font-weight: ${fontWeight};
              color: ${finalTextColor}; ${textNeonStyle}
              font-family: '${fontFamily}', -apple-system, sans-serif;
              pointer-events: none; transition: all ${animMs}ms ${ease}; text-wrap:balance;">
              ${escapeHtml(displayText)}
            </div>`
          : ''}
      </div>
    </div>`;
}

/**
 * @param {object} p
 * @param {string} p.widgetId
 * @param {Record<string, unknown>} p.settings
 * @param {object} p.typography
 * @param {boolean} p.dataBound
 * @param {string} p.unboundHintHtml
 * @param {string} p.displayText
 * @param {number} p.v — clamped value min..max
 * @param {number} p.percent — 0..100
 * @param {number} p.normalized01 — 0..1
 * @param {string} [p.computeError]
 * @param {{ width: number, height: number }} p.box
 * @param {boolean} [p.interactionEnabled]
 * @param {Array<{ id?: string, label?: string, value: number, color?: string }>} [p.resolvedTargets]
 * @param {number} [p.scaleMin]
 * @param {number} [p.scaleMax]
 * @returns {string}
 */
export function buildGaugeMarkup(p) {
  const {
    widgetId,
    settings,
    typography,
    dataBound,
    unboundHintHtml,
    displayText,
    v,
    percent,
    normalized01,
    computeError,
    box,
    interactionEnabled = false,
    resolvedTargets = [],
    scaleMin,
    scaleMax,
  } = p;

  const gtype = String(settings.gaugeStyleType || 'arc').toLowerCase();
  if (gtype === 'progress_bar') {
    return buildProgressBarGaugeMarkup(p);
  }

  const size = Math.min(box.width, box.height);
  const svgSize = size;

  let startAngle = Number(settings.startAngle);
  let endAngle = Number(settings.endAngle);
  if (!Number.isFinite(startAngle)) startAngle = -130;
  if (!Number.isFinite(endAngle)) endAngle = 130;

  if (gtype === 'full_circle') {
    startAngle = -90;
    endAngle = 270;
  } else if (gtype === 'thin_line') {
    const sweep = Number(settings.thinLineSweepDeg) || 300;
    startAngle = -sweep / 2;
    endAngle = sweep / 2;
  } else if (gtype === 'segmented') {
    startAngle = -130;
    endAngle = 130;
  }

  let thickness = Number(settings.thickness) || 16;
  if (gtype === 'thin_line') thickness = Math.max(2, Math.min(8, thickness * 0.35));
  if (gtype === 'donut') {
    const ratio = Number(settings.donutInnerRatio) || 0.62;
    const padRatio = Number(settings.gaugePaddingRatio) || 0.12;
    const outerEdge = svgSize / 2 - svgSize * padRatio;
    const innerEdge = outerEdge * ratio;
    thickness = Math.max(6, outerEdge - innerEdge);
  }

  const padBase = Math.max(thickness / 2 + 6, svgSize * (Number(settings.gaugePaddingRatio) || 0.12));
  const padding = Math.max(thickness / 2 + 4, padBase);
  let radius = (svgSize - padding * 2) / 2;
  if (gtype === 'donut') {
    const ratio = Number(settings.donutInnerRatio) || 0.62;
    const outer = (svgSize - padding * 2) / 2;
    const inner = outer * ratio;
    radius = (outer + inner) / 2;
  }

  const centerX = svgSize / 2;
  const centerY = svgSize / 2;
  const angleRange = endAngle - startAngle;

  const dialTurn = Number(settings.dialRotation);
  const dialTurnDeg = Number.isFinite(dialTurn) ? dialTurn : 0;
  const rotateSvg = dialTurnDeg + (gtype === 'full_circle' ? 90 : startAngle + 90);

  const fontFamily = typography.fontFamily || 'Inter';
  const fontSize = typography.fontSize ? Math.max(28, typography.fontSize * 2) : Math.max(28, size / 7);
  const fontWeight = typography.fontWeight || '600';

  const finalGaugeColor = String(settings.gaugeColor || '#ffffff');
  const finalFillBase = String(settings.fillColor || '#00ff80');
  const tc = String(settings.textColor ?? '').trim();
  const finalTextColor = tc || String(typography.color || '#ffffff');

  const fillResolved = resolveGaugeFillStyle(normalized01, finalFillBase, settings);
  let fillGradientDef = '';
  let fillUrl = '';
  if (fillResolved.useGradient && fillResolved.gradientStops?.length) {
    const stops = fillResolved.gradientStops
      .map((s) => `<stop offset="${s.offset}" style="stop-color:${s.color};stop-opacity:1" />`)
      .join('');
    fillGradientDef = `<linearGradient id="fill-gradient-${widgetId}" x1="0%" y1="0%" x2="100%" y2="0%">${stops}</linearGradient>`;
    fillUrl = `url(#fill-gradient-${widgetId})`;
  } else {
    fillUrl = fillResolved.strokeCss || finalFillBase;
  }

  const trackRgb = hexToRgb(finalGaugeColor);
  const to = Number(settings.trackOpacity);
  const trackOp = Number.isFinite(to) ? Math.max(0.03, Math.min(1, to)) : 0.07;
  const trackColorRgba = trackRgb
    ? `rgba(${trackRgb.r}, ${trackRgb.g}, ${trackRgb.b}, ${trackOp})`
    : 'rgba(255,255,255,0.07)';

  const neonEnabled = settings.neonEnabled !== false;
  const neonColor = String(settings.neonColor || '#78ff82');
  const glowIntensity = Number(settings.glowIntensity) || 10;
  const neonRgb = hexToRgb(neonColor);
  const neonRgba1 = neonRgb ? `rgba(${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}, 0.4)` : 'rgba(120,255,130,0.4)';
  const neonRgba2 = neonRgb ? `rgba(${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}, 0.25)` : 'rgba(120,255,130,0.25)';
  const neonRgba3 = neonRgb ? `rgba(${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}, 0.15)` : 'rgba(120,255,130,0.15)';
  const neonRgbaText1 = neonRgb ? `rgba(${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}, 0.5)` : 'rgba(120,255,130,0.5)';
  const neonRgbaText2 = neonRgb ? `rgba(${neonRgb.r}, ${neonRgb.g}, ${neonRgb.b}, 0.25)` : 'rgba(120,255,130,0.25)';

  const fillNeonStyle = neonEnabled
    ? `filter: drop-shadow(0 0 2px ${neonRgba1}) drop-shadow(0 0 4px ${neonRgba2}) drop-shadow(0 0 8px ${neonRgba3});`
    : '';
  const indicatorNeonStyle = neonEnabled
    ? `filter: drop-shadow(0 0 2px ${neonColor}) drop-shadow(0 0 4px ${neonRgba2}) drop-shadow(0 0 6px ${neonRgba3});`
    : '';
  const textNeonStyle = neonEnabled
    ? `text-shadow: 0 0 3px ${neonRgbaText1}, 0 0 6px ${neonRgbaText1}, 0 0 10px ${neonRgbaText2};`
    : '';

  const cap = settings.roundCaps !== false ? 'round' : 'butt';
  const animMs = settings.animationEnabled !== false ? Number(settings.animationSpeed) || 500 : 0;
  const ease = String(settings.animationEasing || 'cubic-bezier(0.16, 1, 0.3, 1)');

  let arcsHtml = '';
  let markersHtml = '';
  const currentAngle = startAngle + (angleRange * percent) / 100;
  const currentRad = (currentAngle * Math.PI) / 180;

  const scaleLo = Number.isFinite(Number(scaleMin)) ? Number(scaleMin) : Number(settings.min) || 0;
  const scaleHi = Number.isFinite(Number(scaleMax)) ? Number(scaleMax) : Number(settings.max) || 100;
  const targets = Array.isArray(resolvedTargets) ? resolvedTargets : [];
  const paintTrack = settings.targetsPaintTrack !== false;
  const zones = buildGaugeTargetZones(scaleLo, scaleHi, targets);

  if (gtype === 'segmented') {
    const n = Number(settings.segmentedCount) || 12;
    const gapDeg = Number(settings.segmentedGapDeg) || 3;
    const usable = angleRange - (n - 1) * gapDeg;
    const segW = usable / n;
    for (let i = 0; i < n; i++) {
      const a0 = startAngle + i * (segW + gapDeg);
      const a1 = a0 + segW;
      const { d, len } = arcPathD(centerX, centerY, radius, a0, a1);
      const segStartPct = (i / n) * 100;
      const segEndPct = ((i + 1) / n) * 100;
      let localPct = 0;
      if (percent >= segEndPct) localPct = 100;
      else if (percent > segStartPct) localPct = ((percent - segStartPct) / (segEndPct - segStartPct)) * 100;
      const fillOff = len - (len * localPct) / 100;
      const fillCol =
        fillResolved.useGradient && fillUrl.startsWith('url(')
          ? fillUrl
          : fillResolved.strokeCss || finalFillBase;
      const midVal = scaleLo + ((i + 0.5) / n) * (scaleHi - scaleLo);
      const segTrack =
        paintTrack && zones.length
          ? hexToRgba(zoneColorAtValue(zones, midVal, finalGaugeColor), 0.55, trackColorRgba)
          : trackColorRgba;
      arcsHtml += `
        <path class="gauge-track${paintTrack && zones.length ? '-zone' : ''}" d="${d}" fill="none" stroke="${segTrack}" stroke-width="${thickness}" stroke-linecap="${cap}" />
        <path class="gauge-fill" d="${d}" fill="none" stroke="${fillCol}" stroke-width="${thickness}" stroke-linecap="${cap}"
          stroke-dasharray="${len}" stroke-dashoffset="${fillOff}"
          style="transition: stroke-dashoffset ${animMs}ms ${ease}; ${fillNeonStyle}" />`;
    }
    const markerPack = buildArcZonesMarkup({
      zones: [],
      targets,
      paintTrack: false,
      trackColorRgba,
      thickness,
      centerX,
      centerY,
      radius,
      startAngle,
      endAngle,
      cap,
      min: scaleLo,
      max: scaleHi,
      rotateSvg: rotateSvg,
    });
    markersHtml = markerPack.markersHtml;
  } else {
    const { d: trackPath, len: arcLength } = arcPathD(centerX, centerY, radius, startAngle, endAngle);
    const fillOffset = arcLength - (arcLength * percent) / 100;
    const fillCol =
      fillResolved.useGradient && fillUrl.startsWith('url(') ? fillUrl : fillResolved.strokeCss || finalFillBase;
    const zonePack = buildArcZonesMarkup({
      zones,
      targets,
      paintTrack,
      trackColorRgba,
      thickness,
      centerX,
      centerY,
      radius,
      startAngle,
      endAngle,
      cap,
      min: scaleLo,
      max: scaleHi,
      rotateSvg: rotateSvg,
    });
    arcsHtml = `
      ${zonePack.trackHtml}
      <path class="gauge-fill" d="${trackPath}" fill="none" stroke="${fillCol}" stroke-width="${thickness}" stroke-linecap="${cap}"
        stroke-dasharray="${arcLength}" stroke-dashoffset="${fillOffset}"
        style="transition: stroke-dashoffset ${animMs}ms ${ease}; ${fillNeonStyle}" />`;
    markersHtml = zonePack.markersHtml;
  }

  const indType = String(settings.indicatorType || 'dot');
  const indColor = String(settings.indicatorColor || '').trim() || fillResolved.strokeCss || finalFillBase;
  const indSize =
    Number(settings.indicatorSize) > 0 ? Number(settings.indicatorSize) : Math.max(4, thickness / 2 + 1);

  const indX = centerX + radius * Math.cos(currentRad);
  const indY = centerY + radius * Math.sin(currentRad);

  const indicatorGradDef =
    indType === 'dot'
      ? `<radialGradient id="indicator-gradient-${widgetId}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
        <stop offset="70%" style="stop-color:${lightenColor(indColor, 10)};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${indColor};stop-opacity:1" />
      </radialGradient>`
      : '';

  let indicatorHtml = '';
  if (indType === 'dot') {
    indicatorHtml = `
      <circle class="gauge-indicator" cx="${indX}" cy="${indY}" r="${indSize}"
        fill="url(#indicator-gradient-${widgetId})" style="${indicatorNeonStyle} transition: all ${animMs}ms ${ease};" />`;
  } else if (indType === 'needle') {
    const L = Math.min(radius * 0.42, size * 0.22);
    const tail = Math.max(3, indSize * 0.55);
    const W = Math.max(2.5, indSize * 0.3);
    const hubR = Math.max(2.5, indSize * 0.42);
    const ang = currentAngle + 90;
    indicatorHtml = `
      <g class="gauge-indicator-needle" transform="rotate(${ang} ${centerX} ${centerY})">
        <polygon points="${centerX},${centerY - L} ${centerX + W},${centerY + tail} ${centerX},${centerY + tail * 0.45} ${centerX - W},${centerY + tail}"
          fill="${indColor}" style="${indicatorNeonStyle} transition: all ${animMs}ms ${ease};" />
        <circle cx="${centerX}" cy="${centerY}" r="${hubR}" fill="${indColor}" style="${indicatorNeonStyle}" />
      </g>`;
  } else {
    const ix2 = centerX + (radius + indSize) * Math.cos(currentRad);
    const iy2 = centerY + (radius + indSize) * Math.sin(currentRad);
    indicatorHtml = `
      <line class="gauge-indicator-line" x1="${centerX}" y1="${centerY}" x2="${ix2}" y2="${iy2}"
        stroke="${indColor}" stroke-width="${Math.max(2, indSize / 3)}" stroke-linecap="${cap}"
        style="${indicatorNeonStyle} transition: all ${animMs}ms ${ease};" />`;
  }

  const gradMidDef = `<linearGradient id="gauge-gradient-${widgetId}" x1="0%" y1="0%" x2="100%" y2="0%">
           <stop offset="0%" style="stop-color:${finalGaugeColor};stop-opacity:0.3" />
           <stop offset="100%" style="stop-color:${finalGaugeColor};stop-opacity:1" />
         </linearGradient>`;

  const tipLines = [];
  if (computeError) tipLines.push(`Ошибка: ${computeError}`);
  tipLines.push(`Значение: ${v}`);
  if (settings.tooltipShowFormula !== false && String(settings.valueFormula || '').trim()) {
    tipLines.push(`Формула: ${String(settings.valueFormula).trim()}`);
  }
  const tipText = tipLines.join('\n');

  const titleAttr = tipText ? `title="${escapeAttr(tipText)}"` : '';
  const showVal = settings.showValue !== false;

  return `
    <div class="dash-widget-shell dash-widget-shell--column gauge-widget-shell" style="font-family:'${fontFamily}', -apple-system, sans-serif;"
      data-gauge-interactive="${interactionEnabled ? 'true' : 'false'}" data-gauge-widget-id="${escapeAttr(String(widgetId))}">
      ${buildDashWidgetHeadingHtml(settings, escGaugeHeading)}
      <div class="gauge-wrapper" style="position: relative; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;"
        ${titleAttr}>
        ${!dataBound ? unboundHintHtml : ''}
        <svg class="gauge-svg" viewBox="0 0 ${svgSize} ${svgSize}" preserveAspectRatio="xMidYMid meet" style="
            width: 100%; height: 100%; aspect-ratio: 1 / 1; transform: rotate(${rotateSvg}deg);">
          <defs>
            <filter id="gauge-glow-${widgetId}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="${glowIntensity / 2}" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            ${gradMidDef}
            ${fillGradientDef}
            ${indicatorGradDef}
          </defs>
          ${arcsHtml}
          ${markersHtml}
          ${indicatorHtml}
        </svg>
        ${showVal
          ? `<div class="gauge-value" style="
              position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
              width: 100%; text-align: center; font-size: ${fontSize}px; font-weight: ${fontWeight};
              color: ${finalTextColor}; ${textNeonStyle}
              font-family: '${fontFamily}', -apple-system, sans-serif;
              pointer-events: none; transition: all ${animMs}ms ${ease};">
              ${escapeHtml(displayText)}
            </div>`
          : ''}
      </div>
    </div>`;
}

function arcPathD(cx, cy, r, startDeg, endDeg) {
  const sweepDeg = Math.abs(endDeg - startDeg);
  const startRad = (startDeg * Math.PI) / 180;

  /** Полная окружность: одна эллиптическая дуга SVG не работает (M и конец совпадают). */
  if (sweepDeg >= 359.99) {
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const midDeg = startDeg + 180;
    const midRad = (midDeg * Math.PI) / 180;
    const xMid = cx + r * Math.cos(midRad);
    const yMid = cy + r * Math.sin(midRad);
    const len = 2 * Math.PI * r;
    return {
      d: `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${xMid} ${yMid} A ${r} ${r} 0 1 1 ${x1} ${y1}`,
      len,
    };
  }

  const endRad = (endDeg * Math.PI) / 180;
  const largeArcFlag = sweepDeg > 180 ? 1 : 0;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const len = r * Math.abs(endRad - startRad);
  return {
    d: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    len,
  };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}
