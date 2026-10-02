function formatValue(v) {
    if (Math.abs(v) >= 1e6) return v.toExponential(2);
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(v >= 100 ? 0 : 2);
}

function legendLineText(item, grandTotal, cfg) {
    const pct = grandTotal > 0 ? ((item.value / grandTotal) * 100).toFixed(cfg.labels.percentDecimals) : '0';
    const fmt = cfg.legend.format;
    if (fmt) {
        return fmt
            .replace(/\{name\}/g, item.label)
            .replace(/\{value\}/g, formatValue(item.value))
            .replace(/\{percent\}/g, pct);
    }
    const parts = [];
    if (cfg.legend.showName) parts.push(item.label);
    if (cfg.legend.showValue) parts.push(formatValue(item.value));
    if (cfg.legend.showPercent) parts.push(`${pct}%`);
    return parts.join(' · ');
}

function matchesQuery(item, q) {
    if (!q || !q.trim()) return true;
    const s = q.trim().toLowerCase();
    return String(item.label).toLowerCase().includes(s);
}

/**
 * @param {object} params
 * @param {{ items: object[], total: number }} params.model
 * @param {object} params.cfg - normalized
 * @param {object} params.typography
 * @param {Set<number>} params.hiddenSet
 * @param {() => object|undefined|null} [params.getFilterRow] — строка filters[] для подсветки IN/NOT IN
 */
export function createPieLegendElement(params) {
    const { model, cfg, typography, hiddenSet } = params;
    const getFilterRow =
        typeof params.getFilterRow === 'function' ? params.getFilterRow : null;
    const wrap = document.createElement('div');
    wrap.className = 'pie-widget-legend';

    const leg = cfg.legend;
    let searchInput = null;
    if (leg.searchEnabled) {
        searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.className = 'pie-legend-search style-input';
        searchInput.setAttribute('aria-label', 'Поиск в легенде');
        searchInput.placeholder = 'Поиск…';
        wrap.appendChild(searchInput);
    }

    const scroll = document.createElement('div');
    scroll.className = 'pie-legend-scroll';
    const sideLegend = leg.position === 'left' || leg.position === 'right';
    if (sideLegend) {
        scroll.classList.add('pie-legend-scroll--side-fill');
    } else {
        scroll.style.maxHeight = `${leg.maxHeight}px`;
    }

    const list = document.createElement('div');
    const flow = leg.itemFlow === 'row' ? 'row' : 'column';
    list.className = `pie-legend-list pie-legend-list--flow-${flow}`;
    list.style.gap = `${leg.itemGap}px`;

    const fontSize = leg.fontSize ?? Math.max(11, Math.round((typography.fontSize || 14) * 0.85));
    const fontWeight = leg.fontWeight ?? typography.fontWeight ?? '500';
    const color = leg.color ?? typography.color ?? '#E4E6EB';

    const grandTotal = model.total;

    const renderRows = (query) => {
        list.innerHTML = '';
        const q = query ?? '';
        model.items.forEach((item) => {
            if (!matchesQuery(item, q)) return;

            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'pie-legend-row';
            row.dataset.orderIndex = String(item.orderIndex);
            if (hiddenSet.has(item.orderIndex)) {
                row.classList.add('pie-legend-row--hidden');
            }
            if (getFilterRow) {
                const fr = getFilterRow();
                if (fr) {
                    const v = String(item.label ?? '');
                    const inS = new Set(
                        (Array.isArray(fr.selectedValues) ? fr.selectedValues : []).map((x) => String(x)),
                    );
                    const exS = new Set(
                        (Array.isArray(fr.excludedValues) ? fr.excludedValues : []).map((x) => String(x)),
                    );
                    if (exS.has(v)) row.classList.add('pie-legend-row--filter-excluded');
                    else if (inS.has(v)) row.classList.add('pie-legend-row--filter-included');
                }
            }
            if (!leg.interactive) {
                row.disabled = true;
                row.classList.add('pie-legend-row--static');
            }

            if (leg.showColor) {
                const sw = document.createElement('span');
                sw.className = `pie-legend-swatch pie-legend-swatch--${leg.iconShape}`;
                sw.style.width = `${leg.iconSize}px`;
                sw.style.height = `${leg.iconSize}px`;
                sw.style.background = item.color;
                row.appendChild(sw);
            }

            const text = document.createElement('span');
            text.className = 'pie-legend-text';
            text.textContent = legendLineText(item, grandTotal, cfg);
            text.style.fontSize = `${fontSize}px`;
            text.style.fontWeight = fontWeight;
            text.style.color = color;
            row.appendChild(text);

            list.appendChild(row);
        });
    };

    renderRows('');

    if (searchInput) {
        searchInput.addEventListener('input', () => renderRows(searchInput.value));
    }

    scroll.appendChild(list);
    wrap.appendChild(scroll);

    return {
        element: wrap,
        list,
        refresh: () => renderRows(searchInput ? searchInput.value : ''),
        getSearchValue: () => (searchInput ? searchInput.value : ''),
    };
}
