/**
 * Derived analytics for line chart: MA, trend, compare, forecast, anomalies, viewport stats.
 */

/**
 * @param {{ x: number, y: number, idx?: number, rawX?: unknown }[]} points
 * @param {number} window
 */
export function movingAverageSeries(points, window) {
  const w = Math.max(2, Math.floor(Number(window) || 7));
  if (!points?.length) return [];
  const out = [];
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    sum += points[i].y;
    if (i >= w) sum -= points[i - w].y;
    if (i >= w - 1) {
      out.push({
        x: points[i].x,
        y: sum / w,
        idx: points[i].idx,
        rawX: points[i].rawX,
      });
    }
  }
  return out;
}

/**
 * Linear (degree 1) or quadratic (degree 2) regression over points.
 * @param {{ x: number, y: number }[]} points
 * @param {1|2} degree
 * @returns {{ x: number, y: number }[]}
 */
export function trendSeries(points, degree = 1) {
  const pts = (points || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length < 2) return [];
  const deg = degree === 2 ? 2 : 1;
  if (deg === 1) {
    const n = pts.length;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (const p of pts) {
      sx += p.x;
      sy += p.y;
      sxx += p.x * p.x;
      sxy += p.x * p.y;
    }
    const den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-18) return [];
    const a = (n * sxy - sx * sy) / den;
    const b = (sy - a * sx) / n;
    return pts.map((p) => ({ x: p.x, y: a * p.x + b, idx: p.idx, rawX: p.rawX }));
  }
  // Quadratic via normal equations (3x3)
  const n = pts.length;
  let sX = 0;
  let sX2 = 0;
  let sX3 = 0;
  let sX4 = 0;
  let sY = 0;
  let sXY = 0;
  let sX2Y = 0;
  for (const p of pts) {
    const x = p.x;
    const y = p.y;
    const x2 = x * x;
    sX += x;
    sX2 += x2;
    sX3 += x2 * x;
    sX4 += x2 * x2;
    sY += y;
    sXY += x * y;
    sX2Y += x2 * y;
  }
  // Solve [[n,sx,sx2],[sx,sx2,sx3],[sx2,sx3,sx4]] * [c,b,a] = [sy,sxy,sx2y]
  const M = [
    [n, sX, sX2],
    [sX, sX2, sX3],
    [sX2, sX3, sX4],
  ];
  const R = [sY, sXY, sX2Y];
  const coef = solve3(M, R);
  if (!coef) return [];
  const [c, b, a] = coef;
  return pts.map((p) => ({
    x: p.x,
    y: a * p.x * p.x + b * p.x + c,
    idx: p.idx,
    rawX: p.rawX,
  }));
}

function solve3(A, b) {
  const m = A.map((row, i) => [...row, b[i]]);
  const n = 3;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r;
    }
    if (Math.abs(m[piv][col]) < 1e-18) return null;
    if (piv !== col) {
      const tmp = m[col];
      m[col] = m[piv];
      m[piv] = tmp;
    }
    const div = m[col][col];
    for (let c = col; c <= n; c++) m[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r][col];
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  return [m[0][3], m[1][3], m[2][3]];
}

/**
 * Shift series by ms on X (previous period / year).
 * @param {{ x: number, y: number, idx?: number, rawX?: unknown }[]} points
 * @param {number} shiftMs — positive = look back (subtract from x for overlay alignment)
 */
export function compareShiftSeries(points, shiftMs) {
  const shift = Number(shiftMs) || 0;
  if (!points?.length || !shift) return [];
  return points.map((p) => ({
    x: p.x + shift,
    y: p.y,
    idx: p.idx,
    rawX: p.rawX,
  }));
}

/**
 * Infer compare shift from viewport / data span.
 * @param {'previous_period'|'previous_year'|'custom_shift'} mode
 * @param {number} x0
 * @param {number} x1
 * @param {number} [customMs]
 */
export function resolveCompareShiftMs(mode, x0, x1, customMs) {
  if (mode === 'previous_year') return 365.25 * 24 * 3600 * 1000;
  if (mode === 'custom_shift' && Number.isFinite(Number(customMs))) return Number(customMs);
  const span = Math.max(0, Number(x1) - Number(x0));
  return span > 0 ? span : 7 * 24 * 3600 * 1000;
}

/**
 * Simple linear forecast beyond last point.
 * @param {{ x: number, y: number }[]} points
 * @param {number} horizonPoints
 * @param {'linear'|'ma'} method
 * @param {number} [maWindow]
 * @param {number} [confidence] 0.8 | 0.95
 */
export function forecastSeries(points, horizonPoints, method = 'linear', maWindow = 7, confidence = 0.8) {
  const pts = (points || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const h = Math.max(1, Math.min(500, Math.floor(Number(horizonPoints) || 30)));
  if (pts.length < 2) return { line: [], bandLo: [], bandHi: [] };

  let step = 0;
  for (let i = 1; i < pts.length; i++) step += pts[i].x - pts[i - 1].x;
  step = step / (pts.length - 1) || 1;

  const last = pts[pts.length - 1];
  /** @type {{ x: number, y: number }[]} */
  const line = [];
  let baseY = last.y;
  let slope = 0;

  if (method === 'ma') {
    const ma = movingAverageSeries(pts, maWindow);
    baseY = ma.length ? ma[ma.length - 1].y : last.y;
    slope = 0;
  } else {
    const tr = trendSeries(pts, 1);
    if (tr.length >= 2) {
      const a = tr[tr.length - 1];
      const b = tr[tr.length - 2];
      slope = (a.y - b.y) / (a.x - b.x || 1);
      baseY = a.y;
    }
  }

  const residuals = [];
  const trFit = trendSeries(pts, 1);
  for (let i = 0; i < pts.length && i < trFit.length; i++) {
    residuals.push(pts[i].y - trFit[i].y);
  }
  const meanR = residuals.reduce((s, v) => s + v, 0) / (residuals.length || 1);
  const varR =
    residuals.reduce((s, v) => s + (v - meanR) ** 2, 0) / Math.max(1, residuals.length - 1);
  const std = Math.sqrt(Math.max(0, varR));
  const z = confidence >= 0.95 ? 1.96 : 1.28;

  /** @type {{ x: number, y: number }[]} */
  const bandLo = [];
  /** @type {{ x: number, y: number }[]} */
  const bandHi = [];

  for (let i = 1; i <= h; i++) {
    const x = last.x + step * i;
    const y = baseY + slope * step * i;
    line.push({ x, y });
    const half = z * std * Math.sqrt(i);
    bandLo.push({ x, y: y - half });
    bandHi.push({ x, y: y + half });
  }
  // Continuity with last historical point (drawn as start of forecast segment).
  if (line.length) {
    line.unshift({ x: last.x, y: last.y });
    bandLo.unshift({ x: last.x, y: last.y });
    bandHi.unshift({ x: last.x, y: last.y });
  }
  return { line, bandLo, bandHi };
}

/**
 * Z-score anomalies on points.
 * @param {{ x: number, y: number, idx?: number }[]} points
 * @param {number} [zThresh]
 */
export function detectAnomalies(points, zThresh = 2.5) {
  const pts = points || [];
  if (pts.length < 5) return [];
  const ys = pts.map((p) => p.y);
  const mean = ys.reduce((s, v) => s + v, 0) / ys.length;
  const variance = ys.reduce((s, v) => s + (v - mean) ** 2, 0) / ys.length;
  const std = Math.sqrt(variance) || 1e-9;
  const thr = Math.max(1.5, Number(zThresh) || 2.5);
  /** @type {{ point: object, expected: number, z: number, pct: number }[]} */
  const out = [];
  for (const p of pts) {
    const z = (p.y - mean) / std;
    if (Math.abs(z) >= thr) {
      out.push({
        point: p,
        expected: mean,
        z,
        pct: mean !== 0 ? ((p.y - mean) / Math.abs(mean)) * 100 : z * 100,
      });
    }
  }
  return out;
}

/**
 * Viewport stats for overlays.
 * @param {{ x: number, y: number }[]} points
 * @param {number} x0
 * @param {number} x1
 */
export function viewportStats(points, x0, x1) {
  const inView = (points || []).filter((p) => p.x >= x0 && p.x <= x1 && Number.isFinite(p.y));
  if (!inView.length) {
    return { count: 0, min: null, max: null, avg: null, median: null, sum: null, last: null };
  }
  let minP = inView[0];
  let maxP = inView[0];
  let sum = 0;
  for (const p of inView) {
    if (p.y < minP.y) minP = p;
    if (p.y > maxP.y) maxP = p;
    sum += p.y;
  }
  const sortedY = inView.map((p) => p.y).sort((a, b) => a - b);
  const mid = Math.floor(sortedY.length / 2);
  const median =
    sortedY.length % 2 ? sortedY[mid] : (sortedY[mid - 1] + sortedY[mid]) / 2;
  return {
    count: inView.length,
    min: minP,
    max: maxP,
    avg: sum / inView.length,
    median,
    sum,
    last: inView[inView.length - 1],
  };
}

/**
 * % change vs previous point in full series.
 * @param {{ x: number, y: number, idx?: number }[]} sorted
 * @param {{ x: number, y: number, idx?: number }} point
 */
export function pctChangeVsPrev(sorted, point) {
  if (!sorted?.length || !point) return null;
  let i = sorted.findIndex((p) => p === point || (p.idx != null && p.idx === point.idx && p.x === point.x));
  if (i < 0) {
    i = sorted.findIndex((p) => p.x === point.x && p.y === point.y);
  }
  if (i <= 0) return null;
  const prev = sorted[i - 1];
  if (!prev || !Number.isFinite(prev.y) || prev.y === 0) {
    if (!prev || !Number.isFinite(prev.y)) return null;
    return point.y === 0 ? 0 : null;
  }
  return ((point.y - prev.y) / Math.abs(prev.y)) * 100;
}

/**
 * Build derived series list from analytics config + raw series.
 * @param {object[]} rawSeries
 * @param {object} analytics
 * @param {{ x0: number, x1: number }} view
 * @param {'time'|'linear'|'category'} xType
 */
export function buildDerivedSeries(rawSeries, analytics, view, xType) {
  /** @type {object[]} */
  const derived = [];
  if (!analytics || typeof analytics !== 'object') return derived;
  const visibles = (rawSeries || []).filter((s) => s.kind === 'raw' && s.visible !== false);

  if (analytics.ma?.enabled) {
    const win = analytics.ma.window || 7;
    const targetId = analytics.ma.seriesId || 'all';
    for (const s of visibles) {
      if (targetId !== 'all' && s.id !== targetId) continue;
      const pts = movingAverageSeries(s.points, win);
      if (!pts.length) continue;
      derived.push({
        id: `ma:${s.id}`,
        label: `MA(${win}) ${s.label}`,
        color: s.color,
        visible: true,
        kind: 'ma',
        style: 'dashed',
        points: pts,
        sourceId: s.id,
      });
    }
  }

  if (analytics.trend?.enabled) {
    const deg = analytics.trend.degree === 2 ? 2 : 1;
    const targetId = analytics.trend.seriesId || 'all';
    for (const s of visibles) {
      if (targetId !== 'all' && s.id !== targetId) continue;
      const inView = (s.points || []).filter((p) => p.x >= view.x0 && p.x <= view.x1);
      const pts = trendSeries(inView.length >= 2 ? inView : s.points, deg);
      if (!pts.length) continue;
      derived.push({
        id: `trend:${s.id}`,
        label: `Тренд ${s.label}`,
        color: s.color,
        visible: true,
        kind: 'trend',
        style: 'dotted',
        points: pts,
        sourceId: s.id,
      });
    }
  }

  if (analytics.compare?.enabled && xType === 'time') {
    const shift = resolveCompareShiftMs(
      analytics.compare.mode || 'previous_period',
      view.x0,
      view.x1,
      analytics.compare.shiftMs,
    );
    const targetId = analytics.compare.seriesId || visibles[0]?.id;
    const s = visibles.find((x) => x.id === targetId) || visibles[0];
    if (s) {
      // Overlay historical values onto current X by adding shift to old points' x
      // Data at (x - shift) drawn at x: take points, add shift
      const pts = compareShiftSeries(s.points, shift);
      if (pts.length) {
        derived.push({
          id: `compare:${s.id}`,
          label: `Сравнение ${s.label}`,
          color: '#94a3b8',
          visible: true,
          kind: 'compare',
          style: 'dashed',
          points: pts,
          sourceId: s.id,
        });
      }
    }
  }

  // Forecast: time или linear (числа / epoch). Category — нет осмысленного шага по X.
  if (analytics.forecast?.enabled && xType !== 'category') {
    const targetId = analytics.forecast.seriesId || visibles[0]?.id;
    const s = visibles.find((x) => x.id === targetId) || visibles[0];
    if (s) {
      const fc = forecastSeries(
        s.points,
        analytics.forecast.horizon || 30,
        analytics.forecast.method || 'linear',
        analytics.ma?.window || 7,
        analytics.forecast.confidence || 0.8,
      );
      if (fc.line.length) {
        derived.push({
          id: `forecast:${s.id}`,
          label: `Прогноз ${s.label}`,
          color: s.color,
          visible: true,
          kind: 'forecast',
          style: 'dashed',
          points: fc.line,
          sourceId: s.id,
        });
        if (analytics.forecast.showBand !== false && fc.bandLo.length) {
          derived.push({
            id: `forecast-band:${s.id}`,
            label: `CI ${s.label}`,
            color: s.color,
            visible: true,
            kind: 'band',
            pointsLo: fc.bandLo,
            pointsHi: fc.bandHi,
            sourceId: s.id,
          });
        }
      }
    }
  }

  return derived;
}

/**
 * Bounds of forecast / CI series (for viewport expansion).
 * @param {object[]} derived
 */
export function forecastDerivedBounds(derived) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const s of derived || []) {
    if (s.kind === 'forecast' && s.visible !== false) {
      for (const p of s.points || []) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        any = true;
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    }
    if (s.kind === 'band' && s.visible !== false) {
      for (const p of [...(s.pointsLo || []), ...(s.pointsHi || [])]) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        any = true;
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    }
  }
  if (!any) return null;
  return { minX, maxX, minY, maxY };
}

/**
 * Expand viewport so forecast to the right of data is visible when the view
 * already includes the end of the historical series.
 * @param {{ x0: number, x1: number, y0: number, y1: number }} view
 * @param {object[]} rawSeries
 * @param {object[]} derived
 * @returns {{ view: typeof view, expanded: boolean }}
 */
export function expandViewForForecast(view, rawSeries, derived) {
  const fb = forecastDerivedBounds(derived);
  if (!fb || !view) return { view, expanded: false };

  let dataMaxX = -Infinity;
  for (const s of rawSeries || []) {
    if (s.visible === false || s.kind !== 'raw') continue;
    for (const p of s.points || []) {
      if (Number.isFinite(p.x)) dataMaxX = Math.max(dataMaxX, p.x);
    }
  }
  if (!Number.isFinite(dataMaxX)) return { view, expanded: false };

  const span = Math.max(view.x1 - view.x0, 1e-12);
  const nearEnd = view.x1 >= dataMaxX - span * 0.02;
  if (!nearEnd) return { view, expanded: false };

  let x0 = view.x0;
  let x1 = view.x1;
  let y0 = view.y0;
  let y1 = view.y1;
  let expanded = false;

  if (fb.maxX > x1) {
    x1 = fb.maxX;
    expanded = true;
  }
  if (Number.isFinite(fb.minY) && fb.minY < y0) {
    y0 = fb.minY;
    expanded = true;
  }
  if (Number.isFinite(fb.maxY) && fb.maxY > y1) {
    y1 = fb.maxY;
    expanded = true;
  }
  if (!expanded) return { view, expanded: false };

  const padY = Math.max((y1 - y0) * 0.04, 1e-9);
  return {
    view: { x0, x1, y0: y0 - padY, y1: y1 + padY },
    expanded: true,
  };
}
