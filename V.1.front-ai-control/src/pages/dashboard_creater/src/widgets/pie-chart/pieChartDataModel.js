/**
 * Подготовка сегментов: «Прочее», сортировка, итоги.
 */

/**
 * @param {object[]} rows
 * @param {string} labelField
 * @param {string} valueField
 * @param {object} cfg - normalized pie config
 * @returns {{ items: object[], total: number }}
 */
export function buildPieModel(rows, labelField, valueField, cfg) {
    const raw = (rows || []).map((row, idx) => ({
        id: idx,
        label: String(row[labelField] ?? ''),
        value: Math.max(0, parseFloat(row[valueField]) || 0),
    }));

    let items = raw.filter((x) => x.value > 0);
    if (items.length === 0) {
        return { items: [], total: 0 };
    }

    let total = items.reduce((s, x) => s + x.value, 0);
    if (total <= 0) {
        return { items: [], total: 0 };
    }

    if (cfg.legend.groupSmallIntoOther !== false) {
        const th = cfg.legend.otherThreshold;
        const small = items.filter((x) => x.value / total < th);
        const large = items.filter((x) => x.value / total >= th);

        if (small.length >= 1 && large.length >= 1) {
            const otherVal = small.reduce((s, x) => s + x.value, 0);
            items = [
                ...large,
                {
                    id: `other-${large.length}`,
                    label: cfg.legend.otherLabel,
                    value: otherVal,
                    isOther: true,
                    mergedFrom: small.map((x) => x.id),
                },
            ];
            total = items.reduce((s, x) => s + x.value, 0);
        }
    }

    const sort = cfg.legend.sort;
    if (sort === 'value') {
        items = [...items].sort((a, b) => b.value - a.value);
    } else if (sort === 'alpha') {
        items = [...items].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    }

    items.forEach((it, i) => {
        it.orderIndex = i;
    });

    return { items, total };
}
