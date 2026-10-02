/**
 * LOD: downsampling для линейных графиков (отсортированный по x массив точек).
 *
 * Целевое число точек зависит только от ширины plot (viewport), без ручных порогов.
 * На экране обычно тысячи пикселей — нет смысла рисовать сотни тысяч исходных точек.
 */

/**
 * @typedef {{ x: number, y: number, idx: number }} LinePt
 */

/** Нижняя/верхняя граница отрисовываемых точек (BI-бюджет). */
export const LOD_RENDER_MIN = 2000;
export const LOD_RENDER_MAX = 10000;
/** Сколько representative-точек на CSS-пиксель ширины plot. */
export const LOD_SAMPLES_PER_PX = 3;

/**
 * Бюджет точек для текущего viewport по ширине области графика.
 * @param {number} plotWidthPx
 * @returns {number}
 */
export function resolveLodTargetPointCount(plotWidthPx) {
    const w = Math.max(1, Math.floor(Number(plotWidthPx) || 0));
    const raw = Math.floor(w * LOD_SAMPLES_PER_PX);
    return Math.min(LOD_RENDER_MAX, Math.max(LOD_RENDER_MIN, raw));
}

/**
 * Downsample видимых точек под ширину plot.
 * @param {LinePt[]} points
 * @param {number} plotWidthPx
 * @param {'lttb'|'minmax'|string} [mode]
 * @returns {LinePt[]}
 */
export function downsampleForViewport(points, plotWidthPx, mode = 'minmax') {
    if (!points || !points.length) return [];
    const target = resolveLodTargetPointCount(plotWidthPx);
    if (points.length <= target) return points.slice();
    const m = String(mode || 'minmax').toLowerCase();
    if (m === 'lttb') {
        return downsampleLTTB(points, target);
    }
    // Min/Max: ~target/2 buckets → до ~target точек, пики не теряются.
    return downsampleMinMax(points, Math.max(2, Math.floor(target / 2)));
}

/**
 * Largest-Triangle-Three-Buckets (Steinarsson).
 * @param {LinePt[]} data - отсортирован по x
 * @param {number} threshold - целевое число точек (>= 3)
 * @returns {LinePt[]}
 */
export function downsampleLTTB(data, threshold) {
    if (!data || data.length <= 2) return data ? data.slice() : [];
    const t = Math.max(3, Math.floor(threshold));
    if (data.length <= t) return data.slice();

    const sampled = [];
    sampled.push(data[0]);

    const every = (data.length - 2) / (t - 2);

    let a = 0;

    for (let i = 0; i < t - 2; i++) {
        let avgX = 0;
        let avgY = 0;
        let avgRangeStart = Math.floor((i + 1) * every) + 1;
        let avgRangeEnd = Math.floor((i + 2) * every) + 1;
        if (avgRangeEnd > data.length) avgRangeEnd = data.length;

        const avgRangeLength = avgRangeEnd - avgRangeStart;
        if (avgRangeLength <= 0) continue;

        for (let j = avgRangeStart; j < avgRangeEnd; j++) {
            avgX += data[j].x;
            avgY += data[j].y;
        }
        avgX /= avgRangeLength;
        avgY /= avgRangeLength;

        const rangeOffs = Math.floor(i * every) + 1;
        const rangeTo = Math.floor((i + 1) * every) + 1;

        const pointAX = data[a].x;
        const pointAY = data[a].y;

        let maxArea = -1;
        /** @type {LinePt | null} */
        let maxAreaPoint = null;
        let nextA = a;

        for (let j = rangeOffs; j < rangeTo && j < data.length; j++) {
            const area = Math.abs(
                (pointAX - avgX) * (data[j].y - pointAY) - (pointAX - data[j].x) * (avgY - pointAY),
            );
            if (area > maxArea) {
                maxArea = area;
                maxAreaPoint = data[j];
                nextA = j;
            }
        }

        if (maxAreaPoint) {
            sampled.push(maxAreaPoint);
            a = nextA;
        }
    }

    sampled.push(data[data.length - 1]);
    return sampled;
}

/**
 * По X-диапазону делим на buckets; в каждом сохраняем min и max по y (огибающая).
 * @param {LinePt[]} data - отсортирован по x
 * @param {number} bucketCount
 * @returns {LinePt[]}
 */
export function downsampleMinMax(data, bucketCount) {
    if (!data || data.length <= 2) return data ? data.slice() : [];
    const b = Math.max(2, Math.floor(bucketCount));
    if (data.length <= b * 2) return data.slice();

    const out = [];
    out.push(data[0]);
    const n = data.length;

    for (let bi = 0; bi < b; bi++) {
        const i0 = Math.floor((bi / b) * (n - 1));
        const i1 = Math.min(n - 1, Math.floor(((bi + 1) / b) * (n - 1)));
        if (i1 < i0) continue;

        let minPt = data[i0];
        let maxPt = data[i0];
        for (let i = i0; i <= i1; i++) {
            const p = data[i];
            if (p.y < minPt.y) minPt = p;
            if (p.y > maxPt.y) maxPt = p;
        }
        if (minPt.idx === maxPt.idx) {
            out.push(minPt);
        } else if (minPt.x <= maxPt.x) {
            out.push(minPt, maxPt);
        } else {
            out.push(maxPt, minPt);
        }
    }

    out.push(data[n - 1]);

    out.sort((p, q) => p.idx - q.idx);
    const dedup = [];
    let lastIdx = -1;
    for (const p of out) {
        if (p.idx !== lastIdx) {
            dedup.push(p);
            lastIdx = p.idx;
        }
    }
    return dedup;
}
