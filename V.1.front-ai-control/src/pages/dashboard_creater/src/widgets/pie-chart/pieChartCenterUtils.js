/**
 * Центр donut: форматирование чисел и шаблоны {sum} {avg} {value} {metric} …
 */

/**
 * @param {number} v
 * @param {'compact'|'standard'|'scientific'|'integer'} mode
 */
export function formatPieCenterNumber(v, mode = 'compact') {
    if (v == null || (typeof v === 'number' && Number.isNaN(v))) return '—';
    const n = Number(v);
    switch (mode) {
        case 'integer':
            return Math.round(n).toLocaleString('ru-RU');
        case 'scientific':
            return n.toExponential(2);
        case 'standard':
            return n.toLocaleString('ru-RU', { maximumFractionDigits: 6, minimumFractionDigits: 0 });
        case 'compact':
        default:
            try {
                return new Intl.NumberFormat('ru-RU', {
                    notation: 'compact',
                    compactDisplay: 'short',
                    maximumFractionDigits: 2,
                }).format(n);
            } catch {
                return String(n);
            }
    }
}

/** Сырое число, которое подставляется в {value} / логику «основной» метрики центра */
export function getCenterPrimaryRaw(cfg, stats, centerMeasureValue) {
    const C = cfg.center || {};
    const src = C.valueSource || 'segments';
    const agg = C.segmentAggregate || 'sum';
    const key = agg === 'total' ? 'sum' : agg;
    if (src === 'measure' && centerMeasureValue != null && Number.isFinite(Number(centerMeasureValue))) {
        return Number(centerMeasureValue);
    }
    if (key === 'count') return stats.count;
    return stats[key];
}

/** @param {{ value: number }[]} visibleItems */
export function computeSegmentStats(visibleItems) {
    const items = visibleItems || [];
    const sum = items.reduce((s, x) => s + (parseFloat(x.value) || 0), 0);
    const n = items.length;
    const vals = items.map((x) => parseFloat(x.value) || 0);
    return {
        sum,
        total: sum,
        count: n,
        avg: n > 0 ? sum / n : 0,
        min: n > 0 ? Math.min(...vals) : 0,
        max: n > 0 ? Math.max(...vals) : 0,
    };
}

/**
 * @param {object} cfg - normalized pie config
 * @param {ReturnType<typeof computeSegmentStats>} stats
 * @param {number|undefined} centerMeasureValue — серверная агрегация по мере
 */
export function buildCenterLabel(cfg, stats, centerMeasureValue) {
    const C = cfg.center || {};
    const numMode = C.numberFormat || 'compact';
    const fmt = (x) => formatPieCenterNumber(x, numMode);
    const fmtCount = (x) => (numMode === 'integer' ? String(Math.round(x)) : String(Math.round(x)));

    const src = C.valueSource || 'segments';
    const agg = C.segmentAggregate || 'sum';
    const key = agg === 'total' ? 'sum' : agg;
    const primaryNum = getCenterPrimaryRaw(cfg, stats, centerMeasureValue);

    const tpl = (C.template || '{value}').trim() || '{value}';

    const valueStr =
        src !== 'measure' && key === 'count'
            ? fmtCount(stats.count)
            : fmt(primaryNum);

    const metricNum =
        centerMeasureValue != null && Number.isFinite(Number(centerMeasureValue)) ? Number(centerMeasureValue) : primaryNum;

    const map = {
        sum: fmt(stats.sum),
        total: fmt(stats.total),
        avg: fmt(stats.avg),
        min: fmt(stats.min),
        max: fmt(stats.max),
        count: fmtCount(stats.count),
        value: valueStr,
        metric: fmt(metricNum),
    };

    let out = tpl;
    for (const [k, v] of Object.entries(map)) {
        out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return out;
}

/**
 * Подсказка при наведении на центр: точное число + пояснение, что это не «строки БД».
 */
export function buildPieCenterTooltip(cfg, stats, centerMeasureValue) {
    const C = cfg.center || {};
    const src = C.valueSource || 'segments';
    const agg = C.segmentAggregate || 'sum';
    const fn = (C.measureFn || 'sum').toUpperCase();
    const primary = getCenterPrimaryRaw(cfg, stats, centerMeasureValue);
    const primaryStr = Number(primary).toLocaleString('ru-RU', { maximumFractionDigits: 12, minimumFractionDigits: 0 });
    const sumSectorsStr = Number(stats.sum).toLocaleString('ru-RU', { maximumFractionDigits: 12, minimumFractionDigits: 0 });
    const lines = [];

    if (src === 'measure' && centerMeasureValue != null && Number.isFinite(Number(centerMeasureValue))) {
        lines.push(`Центр (SQL ${fn} по полю меры): ${primaryStr}`);
        lines.push(`Сумма секторов на круге (для сравнения): ${sumSectorsStr}`);
    } else {
        const aggRu =
            agg === 'avg'
                ? 'среднее по категориям (не взвешенное по числу строк)'
                : agg === 'count'
                  ? 'число категорий (секторов) на диаграмме'
                  : agg === 'min'
                    ? 'минимум среди секторов'
                    : agg === 'max'
                      ? 'максимум среди секторов'
                      : 'сумма меры по видимым секторам';
        lines.push(`Центр (${aggRu}): ${primaryStr}`);
        if (agg === 'sum' || agg === 'total') {
            lines.push(`Это та же величина, что сумма всех секторов: каждый сектор = SUM(мера) по своей категории.`);
        }
    }

    lines.push(`Компактный формат («млрд» и т.д.) — про величину суммы/меры, не про число строк.`);
    lines.push(`Чтобы показать примерное число строк (не NULL в колонке меры), выберите источник «Мера» и COUNT.`);
    lines.push(`Если сумма подозрительно велика — возможны дубли фактов из JOIN в запросе модели.`);

    return lines.join('\n');
}

/**
 * Подстановка для режима hover по сегменту
 */
export function buildCenterHoverLabel(cfg, metaItem, metaShare, _modelTotal, stats, centerMeasureValue) {
    const C = cfg.center || {};
    const numMode = C.numberFormat || 'compact';
    const fmt = (x) => formatPieCenterNumber(x, numMode);
    const tpl = (C.hoverTemplate || '{name}\n{percent}%').trim();
    const pct = (metaShare * 100).toFixed(cfg.labels?.percentDecimals ?? 1);
    const map = {
        name: metaItem.label,
        value: fmt(metaItem.value),
        percent: pct,
        total: fmt(stats.total),
        sum: fmt(stats.sum),
        avg: fmt(stats.avg),
        min: fmt(stats.min),
        max: fmt(stats.max),
        count: String(stats.count),
        metric: fmt(centerMeasureValue != null && Number.isFinite(Number(centerMeasureValue)) ? Number(centerMeasureValue) : stats.sum),
    };
    let out = tpl;
    for (const [k, v] of Object.entries(map)) {
        out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return out;
}
