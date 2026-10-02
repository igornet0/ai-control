/** @param {number} r @param {number} a */
export function polar(cx, cy, r, a) {
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/**
 * Кольцевой сектор: a0 < a1, радианы.
 */
export function donutSlicePath(cx, cy, rInner, rOuter, a0, a1) {
    const [x0o, y0o] = polar(cx, cy, rOuter, a0);
    const [x1o, y1o] = polar(cx, cy, rOuter, a1);
    const [x1i, y1i] = polar(cx, cy, rInner, a1);
    const [x0i, y0i] = polar(cx, cy, rInner, a0);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return [
        `M ${x0o} ${y0o}`,
        `A ${rOuter} ${rOuter} 0 ${large} 1 ${x1o} ${y1o}`,
        `L ${x1i} ${y1i}`,
        `A ${rInner} ${rInner} 0 ${large} 0 ${x0i} ${y0i}`,
        'Z',
    ].join(' ');
}

/**
 * Скругление углов сектора (упрощённо: дуга «капсула» на внешней дуге через stroke-linejoin).
 * При cornerR > 0 добавляем микро-смещение углов для визуального эффекта через inset.
 */
export function donutSlicePathRounded(cx, cy, rInner, rOuter, a0, a1, cornerR) {
    if (!cornerR || cornerR < 0.5) {
        return donutSlicePath(cx, cy, rInner, rOuter, a0, a1);
    }
    const mid = (a0 + a1) / 2;
    const span = a1 - a0;
    const inset = Math.min(cornerR / (rOuter + 1e-6), span * 0.15);
    const a0p = a0 + inset;
    const a1p = a1 - inset;
    if (a1p <= a0p + 1e-6) {
        return donutSlicePath(cx, cy, rInner, rOuter, a0, a1);
    }
    return donutSlicePath(cx, cy, rInner, rOuter, a0p, a1p);
}
