import { eventBus } from './src/core/EventBus.js';
import { postColumnDistinct } from '../../services/dashboardQueryService.js';
import {
  ACTIVE_FILTERS_BAR_VIRTUAL_WIDGET_ID,
  filterFieldKey,
  patternToSqlLike,
  syncFilterRowsByField,
} from '../../services/dashboardFilterUtils.js';
import {
  closeActiveFilterChipDropdown,
  showActiveFilterChipDropdown,
} from './activeFilterChipDropdown.js';
import { formatDateByPattern, formatTimeAuto } from './src/widgets/line-chart/lineChartScales.js';

const DISTINCT_LIMIT = 2000;
const DEBOUNCE_MS = 200;

function monotonicNow() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function dashboardFilterBurstActive(engine) {
  const ts = engine?.__dashboardFilterBurstUntilTs;
  if (!Number.isFinite(ts)) return false;
  return monotonicNow() < ts;
}
/** Кэш postColumnDistinct: снижает CPU/сеть при частых перерисовках панели. */
const DISTINCT_CACHE_TTL_MS = 45000;
const DISTINCT_CACHE_MAX = 96;
/** Не более N параллельных DISTINCT на один ререндер полосы. */
const DISTINCT_CONCURRENCY = 4;

/** @type {Map<string, { at: number, data: { values?: unknown[] } }>} */
const distinctResultCache = new Map();
/** @type {Map<string, Promise<{ values?: unknown[] }>>} */
const distinctInflight = new Map();

function trimDistinctCache() {
  while (distinctResultCache.size > DISTINCT_CACHE_MAX) {
    const first = distinctResultCache.keys().next();
    if (first.done) break;
    distinctResultCache.delete(first.value);
  }
}

function distinctCacheKey(modelId, body) {
  const pat = body.pattern == null ? '' : String(body.pattern);
  const lim = Number(body.limit) || DISTINCT_LIMIT;
  return `${modelId}|${body.table}|${body.column}|${pat}|${lim}`;
}

async function postColumnDistinctCached(modelId, body, signal) {
  const key = distinctCacheKey(modelId, body);
  const now = Date.now();
  const hit = distinctResultCache.get(key);
  if (hit && now - hit.at < DISTINCT_CACHE_TTL_MS) {
    return hit.data;
  }
  if (distinctInflight.has(key)) {
    return distinctInflight.get(key);
  }
  const p = postColumnDistinct(modelId, body, { signal })
    .then((data) => {
      distinctResultCache.set(key, { at: Date.now(), data });
      trimDistinctCache();
      distinctInflight.delete(key);
      return data;
    })
    .catch((e) => {
      distinctInflight.delete(key);
      throw e;
    });
  distinctInflight.set(key, p);
  return p;
}

/** Перед «тяжёлыми» запросами — не блокировать первый фрейм. */
function scheduleDistinctWork() {
  return new Promise((resolve) => {
    const ric = typeof requestIdleCallback === 'function' ? requestIdleCallback : null;
    if (ric) {
      ric(() => resolve(), { timeout: 800 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

async function mapPool(items, concurrency, mapper) {
  if (!items.length) return [];
  const results = new Array(items.length);
  let idx = 0;
  const nWorkers = Math.max(1, Math.min(concurrency, items.length));
  async function worker() {
    while (true) {
      let myIdx;
      // eslint-disable-next-line no-await-in-loop
      myIdx = idx++;
      if (myIdx >= items.length) return;
      // eslint-disable-next-line no-await-in-loop
      results[myIdx] = await mapper(items[myIdx], myIdx);
    }
  }
  await Promise.all(Array.from({ length: nWorkers }, () => worker()));
  return results;
}
function escAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escText(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pushActiveFieldFromRow(filterWidget, f, out, seenKey, widgetIdOverride = null) {
  if (f.modelId == null || !f.table || !f.field) return;
  const selected = Array.isArray(f.selectedValues)
    ? f.selectedValues.filter((x) => x !== '' && x != null)
    : [];
  const excluded = Array.isArray(f.excludedValues)
    ? f.excludedValues.filter((x) => x !== '' && x != null)
    : [];
  const likeActive = Boolean(patternToSqlLike(f.pattern || ''));
  if (selected.length === 0 && excluded.length === 0 && !likeActive) return;
  const key = filterFieldKey(f);
  if (!key || seenKey.has(key)) return;
  seenKey.add(key);
  const displayTitle =
    String(f.displayLabel ?? '').trim() || String(f.field ?? '');
  const isVirtual = widgetIdOverride === ACTIVE_FILTERS_BAR_VIRTUAL_WIDGET_ID;
  const widgetId =
    widgetIdOverride != null ? widgetIdOverride : filterWidget.id;
  out.push({
    widgetId,
    filterId: f.id,
    modelId: f.modelId,
    table: f.table,
    field: f.field,
    displayTitle,
    selectedValues: selected.map((x) => String(x)),
    excludedValues: excluded.map((x) => String(x)),
    selectedCount: selected.length,
    excludedCount: excluded.length,
    likeActive,
    patternUi: String(f.pattern || '').trim(),
    kind: isVirtual ? 'virtual-filter' : undefined,
  });
}

/**
 * Поля фильтра, по которым сейчас есть ограничение (выбранные значения, исключения или шаблон).
 * Включает `engine.__virtualDashboardFilters`, если для поля ещё нет строки в виджете «Фильтр».
 */
function gatherActiveFilterFields(engine) {
  const out = [];
  /** Одно активное поле = один чип (несколько виджетов «Фильтр» с тем же полем синхронизированы). */
  const seenKey = new Set();
  if (!engine?.widgetManager) return out;

  engine.widgetManager.getAllWidgets().forEach((w) => {
    if (w.type !== 'filter' || !Array.isArray(w.settings?.filters)) return;
    w.settings.filters.forEach((f) => {
      pushActiveFieldFromRow(w, f, out, seenKey, null);
    });
  });

  const virtualRows = Array.isArray(engine.__virtualDashboardFilters)
    ? engine.__virtualDashboardFilters
    : [];
  virtualRows.forEach((f) => {
    pushActiveFieldFromRow(null, f, out, seenKey, ACTIVE_FILTERS_BAR_VIRTUAL_WIDGET_ID);
  });

  return out;
}

/** Экспорт для тестов и внешней диагностики. */
export function gatherActiveDashboardFilterBarItems(engine) {
  return gatherActiveFilterFields(engine);
}

/** Активный диапазон по оси X с линейного графика (фильтр дашборда). */
function gatherLineChartBrushItems(engine) {
  const out = [];
  if (!engine?.widgetManager) return out;
  engine.widgetManager.getAllWidgets().forEach((w) => {
    if (w.type !== 'line-chart') return;
    const b = w.settings?.dashboardBrushX;
    if (!b?.field || !Number.isFinite(Number(b.xMin)) || !Number.isFinite(Number(b.xMax))) return;
    if (Number(b.xMax) < Number(b.xMin)) return;
    out.push({
      widgetId: w.id,
      table: b.table,
      field: b.field,
      fieldType: b.fieldType,
      xMin: Number(b.xMin),
      xMax: Number(b.xMax),
    });
  });
  return out;
}

function formatLineBrushRangeSubtitle(it) {
  const t = String(it.fieldType || '').toLowerCase();
  const span = Math.abs(it.xMax - it.xMin) || 1;
  if (t.includes('date') || t.includes('time') || Math.abs(it.xMin) > 1e11) {
    const pat = formatTimeAuto(Math.max(1, span)).pattern;
    return `${formatDateByPattern(new Date(it.xMin), pat)} — ${formatDateByPattern(new Date(it.xMax), pat)}`;
  }
  return `${it.xMin} — ${it.xMax}`;
}

function clearFilterField(engine, widgetId, filterId) {
  if (widgetId === ACTIVE_FILTERS_BAR_VIRTUAL_WIDGET_ID) {
    const rows = engine.__virtualDashboardFilters;
    if (!Array.isArray(rows)) return;
    const f = rows.find((x) => x.id === filterId);
    if (!f) return;
    f.selectedValues = [];
    f.excludedValues = [];
    f.pattern = '';
    syncFilterRowsByField(engine, f, {});
    const idx = rows.indexOf(f);
    if (idx >= 0) rows.splice(idx, 1);
    if (typeof engine.saveSnapshot === 'function') engine.saveSnapshot();
    closeActiveFilterChipDropdown();
    eventBus.emit('dashboard:filters-changed', { source: 'active-filters-bar' });
    return;
  }

  const w = engine.widgetManager?.getWidget(widgetId);
  if (!w || w.type !== 'filter' || !Array.isArray(w.settings?.filters)) return;
  const f = w.settings.filters.find((x) => x.id === filterId);
  if (!f) return;
  f.selectedValues = [];
  f.excludedValues = [];
  f.pattern = '';
  syncFilterRowsByField(engine, f, { sourceWidgetId: widgetId });
  if (typeof w.update === 'function') w.update();
  if (typeof engine.saveSnapshot === 'function') engine.saveSnapshot();
  closeActiveFilterChipDropdown();
  eventBus.emit('dashboard:filters-changed', { source: 'active-filters-bar' });
}

function clearLineChartBrush(engine, widgetId) {
  const w = engine.widgetManager?.getWidget(widgetId);
  if (!w || w.type !== 'line-chart' || !w.settings?.dashboardBrushX) return;
  delete w.settings.dashboardBrushX;
  if (typeof w.update === 'function') w.update();
  if (typeof engine.saveSnapshot === 'function') engine.saveSnapshot();
  closeActiveFilterChipDropdown();
  eventBus.emit('dashboard:filters-changed', { source: 'active-filters-bar-line-brush' });
}

function clearAllFilterFields(engine) {
  let touched = false;
  engine.widgetManager?.getAllWidgets().forEach((w) => {
    if (w.type !== 'filter' || !Array.isArray(w.settings?.filters)) return;
    let widgetTouched = false;
    w.settings.filters.forEach((f) => {
      const had =
        (Array.isArray(f.selectedValues) && f.selectedValues.length > 0) ||
        (Array.isArray(f.excludedValues) && f.excludedValues.length > 0) ||
        Boolean(patternToSqlLike(f.pattern || ''));
      if (!had) return;
      f.selectedValues = [];
      f.excludedValues = [];
      f.pattern = '';
      syncFilterRowsByField(engine, f, { sourceWidgetId: w.id });
      widgetTouched = true;
      touched = true;
    });
    if (widgetTouched && typeof w.update === 'function') w.update();
  });
  engine.widgetManager?.getAllWidgets().forEach((w) => {
    if (w.type !== 'line-chart' || !w.settings?.dashboardBrushX) return;
    delete w.settings.dashboardBrushX;
    touched = true;
    if (typeof w.update === 'function') w.update();
  });
  if (Array.isArray(engine.__virtualDashboardFilters) && engine.__virtualDashboardFilters.length > 0) {
    engine.__virtualDashboardFilters = [];
    touched = true;
  }
  if (touched) {
    if (typeof engine.saveSnapshot === 'function') engine.saveSnapshot();
    closeActiveFilterChipDropdown();
    eventBus.emit('dashboard:filters-changed', { source: 'active-filters-bar-clear-all' });
  }
}

async function buildChipsHtml(engine) {
  const items = gatherActiveFilterFields(engine);
  const brushItems = gatherLineChartBrushItems(engine);
  if (items.length === 0 && brushItems.length === 0) return '';

  await scheduleDistinctWork();

  const parts = await mapPool(items, DISTINCT_CONCURRENCY, async (it) => {
    let subtitle = '';
    let pct = 0;
    let capped = false;

    // Частый кейс: выбран ровно один элемент — показываем его, без тяжёлого distinct-запроса
    if (it.selectedCount === 1 && it.excludedCount === 0) {
      const v = String(it.selectedValues?.[0] ?? '');
      subtitle = v.length > 64 ? `${v.slice(0, 64)}…` : v;
      pct = 100;
    } else if (it.selectedCount === 0 && it.excludedCount === 1) {
      const v = String(it.excludedValues?.[0] ?? '');
      const vv = v.length > 64 ? `${v.slice(0, 64)}…` : v;
      subtitle = `исключено: ${vv}`;
      pct = 100;
    } else if (it.selectedCount > 0 || it.excludedCount > 0) {
      let M = 0;
      const burst = dashboardFilterBurstActive(engine);
      if (burst) {
        M = Math.max(it.selectedCount, it.excludedCount, 2);
        capped = true;
        if (it.selectedCount > 0 && it.excludedCount > 0) {
          subtitle = `${it.selectedCount} вкл., искл. ${it.excludedCount} (…) `;
        } else if (it.selectedCount > 0) {
          subtitle = `${it.selectedCount} выбрано (…) `;
        } else {
          subtitle = `исключено ${it.excludedCount} (…) `;
        }
        pct = 50;
      } else {
        try {
          const { values } = await postColumnDistinctCached(it.modelId, {
            table: it.table,
            column: it.field,
            pattern: '',
            limit: DISTINCT_LIMIT,
          }, engine?.requestSignal);
          M = (values || []).length;
          capped = M >= DISTINCT_LIMIT;
        } catch {
          M = 0;
        }
        const denom = Math.max(it.selectedCount, it.excludedCount, 1);
        if (M <= 0) M = denom;
        const capSuffix = capped ? '+' : '';
        if (it.selectedCount > 0 && it.excludedCount > 0) {
          pct = Math.min(
            100,
            Math.round(((it.selectedCount + it.excludedCount) / M) * 100),
          );
          subtitle = `${it.selectedCount} вкл., искл. ${it.excludedCount} из ${M}${capSuffix}`;
        } else if (it.selectedCount > 0) {
          pct = Math.min(100, Math.round((it.selectedCount / M) * 100));
          subtitle = `${it.selectedCount} из ${M}${capSuffix}`;
        } else {
          pct = Math.min(100, Math.round((it.excludedCount / M) * 100));
          subtitle = `исключено ${it.excludedCount} из ${M}${capSuffix}`;
        }
      }
    } else if (it.likeActive) {
      const p = it.patternUi.length > 48 ? `${it.patternUi.slice(0, 48)}…` : it.patternUi;
      subtitle = p || 'Шаблон';
      pct = 100;
    }

    const title = escAttr(`${it.table}.${it.field}`);
    const kind = it.kind === 'virtual-filter' ? 'virtual-filter' : '';
    const kindAttr = kind ? ` data-kind="${escAttr(kind)}"` : '';
    const chipClass =
      kind === 'virtual-filter'
        ? 'active-filter-chip active-filter-chip--virtual'
        : 'active-filter-chip';
    return `
        <div class="${chipClass}" data-widget-id="${escAttr(it.widgetId)}" data-filter-id="${escAttr(it.filterId)}"${kindAttr} title="${title}">
          <button type="button" class="active-filter-chip__close" data-action="clear-one" data-widget-id="${escAttr(it.widgetId)}" data-filter-id="${escAttr(it.filterId)}" title="Сбросить фильтр" aria-label="Сбросить">×</button>
          <div class="active-filter-chip__title">${escText(it.displayTitle ?? it.field)}</div>
          <div class="active-filter-chip__sub">${escText(subtitle)}</div>
          <div class="active-filter-chip__bar" role="presentation">
            <span class="active-filter-chip__bar-fill" style="width:${pct}%"></span>
          </div>
        </div>`;
  });

  const brushParts = brushItems.map((it) => {
    const titleAttr = escAttr(`${it.table}.${it.field}`);
    const subtitle = formatLineBrushRangeSubtitle(it);
    return `
        <div class="active-filter-chip active-filter-chip--line-brush" data-widget-id="${escAttr(it.widgetId)}" data-kind="line-brush" title="${titleAttr}">
          <button type="button" class="active-filter-chip__close" data-action="clear-line-brush" data-widget-id="${escAttr(it.widgetId)}" title="Сбросить период" aria-label="Сбросить">×</button>
          <div class="active-filter-chip__title">${escText(`Период: ${it.field}`)}</div>
          <div class="active-filter-chip__sub">${escText(subtitle)}</div>
        </div>`;
  });

  return [...parts, ...brushParts].join('');
}

/**
 * Панель активных фильтров под тулбаром (DashboardCreaterApp).
 * @returns {() => void}
 */
export function setupActiveFiltersBar(engine) {
  const root = document.getElementById('active-filters-bar');
  const app = document.getElementById('app');
  if (!root || !engine) {
    return () => {};
  }

  let debounceTimer = null;
  let gen = 0;

  const setStackClass = (hasChips) => {
    if (app) {
      if (hasChips) app.classList.add('has-active-filters');
      else app.classList.remove('has-active-filters');
    }
  };

  const render = async () => {
    const myGen = ++gen;
    closeActiveFilterChipDropdown();
    const chipsHtml = await buildChipsHtml(engine);
    if (myGen !== gen) return;
    const tools = chipsHtml
      ? `<div class="active-filters-bar__tools">
          <button type="button" class="active-filters-bar__tool-btn" data-action="clear-all-filters" title="Сбросить все фильтры" aria-label="Сбросить все фильтры">⌧</button>
        </div>`
      : '';
    root.innerHTML = tools + chipsHtml;
    const has = Boolean(chipsHtml);
    setStackClass(has);
    root.classList.toggle('active-filters-bar--empty', !has);
  };

  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void render();
    }, DEBOUNCE_MS);
  };

  const onClick = (e) => {
    const clearAll = e.target.closest('[data-action="clear-all-filters"]');
    if (clearAll) {
      e.preventDefault();
      clearAllFilterFields(engine);
      return;
    }
    const clrBrush = e.target.closest('[data-action="clear-line-brush"]');
    if (clrBrush?.dataset.widgetId) {
      e.preventDefault();
      clearLineChartBrush(engine, clrBrush.dataset.widgetId);
      return;
    }
    const btn = e.target.closest('[data-action="clear-one"]');
    if (btn?.dataset.widgetId && btn.dataset.filterId) {
      e.preventDefault();
      clearFilterField(engine, btn.dataset.widgetId, btn.dataset.filterId);
      return;
    }
    const chip = e.target.closest('.active-filter-chip');
    if (chip?.dataset.kind === 'line-brush') return;
    if (chip?.dataset.widgetId && chip.dataset.filterId) {
      showActiveFilterChipDropdown(engine, chip, chip.dataset.widgetId, chip.dataset.filterId);
    }
  };

  const unsubs = [
    eventBus.on('dashboard:filters-changed', schedule),
    eventBus.on('active-filters:sync', schedule),
    eventBus.on('widget:added', schedule),
    eventBus.on('widget:deleted', schedule),
    eventBus.on('widget:data-binding-updated', schedule),
    eventBus.on('dashboard:loaded', schedule),
  ];

  root.addEventListener('click', onClick);
  void render();

  return () => {
    unsubs.forEach((fn) => {
      if (typeof fn === 'function') fn();
    });
    root.removeEventListener('click', onClick);
    root.innerHTML = '';
    closeActiveFilterChipDropdown();
    setStackClass(false);
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}
