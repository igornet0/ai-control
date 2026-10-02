import { eventBus } from './src/core/EventBus.js';
import { postColumnDistinct } from '../../services/dashboardQueryService.js';
import { loadDistinctPartition, formatDistinctTruncationHint } from '../../services/dashboardCrossFilterEngine.js';
import {
  syncFilterRowsByField,
  resetFiltersForStaleDistinctChoice,
  onlyActiveDashboardFilterIsSameField,
  isPendingFilterDistinctFromCommitted,
  ACTIVE_FILTERS_BAR_VIRTUAL_WIDGET_ID,
} from '../../services/dashboardFilterUtils.js';
import { svgCheck, svgCross } from './icons/dashboardCreaterIcons.js';

function pendingPairFromRow(fl) {
  return {
    inc: new Set((fl.selectedValues || []).map((x) => String(x))),
    exc: new Set((fl.excludedValues || []).map((x) => String(x))),
  };
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function encAttr(s) {
  return encodeURIComponent(String(s ?? ''));
}

let cleanupOpen = null;
let debounceEmit = null;
let debounceFetch = null;

function emitFiltersDebounced() {
  if (debounceEmit) clearTimeout(debounceEmit);
  debounceEmit = setTimeout(() => {
    debounceEmit = null;
    eventBus.emit('dashboard:filters-changed', { source: 'active-filter-chip-dropdown' });
  }, 280);
}

/**
 * Закрыть выпадашку с панели активных фильтров (если открыта).
 */
export function closeActiveFilterChipDropdown() {
  if (debounceFetch) {
    clearTimeout(debounceFetch);
    debounceFetch = null;
  }
  if (debounceEmit) {
    clearTimeout(debounceEmit);
    debounceEmit = null;
  }
  if (typeof cleanupOpen === 'function') {
    cleanupOpen();
    cleanupOpen = null;
  }
}

/**
 * Раскрыть тот же UI, что у фильтра, но от якоря-чипа на панели активных фильтров.
 * @param {*} engine
 * @param {HTMLElement} anchorEl — .active-filter-chip
 * @param {string} widgetId
 * @param {string} filterId
 */
export function showActiveFilterChipDropdown(engine, anchorEl, widgetId, filterId) {
  if (!engine || !anchorEl || !widgetId || !filterId) return;

  const isVirtual = widgetId === ACTIVE_FILTERS_BAR_VIRTUAL_WIDGET_ID;
  let widget = null;
  let fl = null;

  if (isVirtual) {
    const rows = Array.isArray(engine.__virtualDashboardFilters) ? engine.__virtualDashboardFilters : [];
    fl = rows.find((x) => x.id === filterId);
    if (!fl) return;
  } else {
    widget = engine.widgetManager?.getWidget(widgetId);
    if (!widget || widget.type !== 'filter') return;
    fl = widget.settings?.filters?.find((x) => x.id === filterId);
    if (!fl) return;
  }

  closeActiveFilterChipDropdown();

  if (!isVirtual) {
    widget._expandedFilterId = null;
    if (typeof widget._teardownOpenDropdown === 'function') {
      widget._teardownOpenDropdown();
    }
    if (typeof widget.render === 'function') {
      widget.render();
    }
  }

  const rowSyncOpts = isVirtual ? {} : { sourceWidgetId: widget.id };

  const dropdown = document.createElement('div');
  dropdown.className = 'filter-dropdown filter-dropdown--elevated filter-dropdown--from-active-bar';
  dropdown.setAttribute('data-active-filter-dropdown', '1');
  dropdown.innerHTML = `
    <div class="filter-dropdown-top">
      <div class="filter-values-confirm-bar" role="toolbar" aria-label="Подтверждение выбора">
        <button type="button" class="filter-confirm-btn filter-confirm-btn--apply" title="Применить выбор" aria-label="Применить выбор">${svgCheck}</button>
        <button type="button" class="filter-confirm-btn filter-confirm-btn--cancel" title="Отменить изменения" aria-label="Отменить изменения">${svgCross}</button>
      </div>
    </div>
    <div class="filter-dropdown-body">
      <div class="filter-dropdown-hint">Шаблон (* → любые символы), например №444*</div>
      <input type="text" class="filter-pattern-input" autocomplete="off"
        placeholder="№444*" value="${esc(fl.pattern || '')}" />
      <div class="filter-values-list"></div>
    </div>
    <div class="filter-dropdown-bulk filter-dropdown-bulk--hidden" role="toolbar" aria-label="Массовый выбор по поиску">
      <button type="button" class="filter-bulk-btn filter-bulk-btn--select" data-filter-bulk="select">Выбрать все</button>
      <button type="button" class="filter-bulk-btn filter-bulk-btn--exclude" data-filter-bulk="exclude">Исключить все</button>
    </div>
  `;

  const patternInp = dropdown.querySelector('.filter-pattern-input');
  const listEl = dropdown.querySelector('.filter-values-list');
  const confirmTop = dropdown.querySelector('.filter-dropdown-top');
  const bulkBar = dropdown.querySelector('.filter-dropdown-bulk');
  const applyBtn = dropdown.querySelector('.filter-confirm-btn--apply');
  const cancelBtn = dropdown.querySelector('.filter-confirm-btn--cancel');
  const p0 = pendingPairFromRow(fl);
  let pendingInclude = p0.inc;
  let pendingExclude = p0.exc;
  let pendingPattern = String(fl.pattern || '');
  let lastSearchResultValues = [];

  const syncConfirmTopVisibility = () => {
    if (!confirmTop) return;
    const dirty = isPendingFilterDistinctFromCommitted(pendingInclude, pendingExclude, fl);
    confirmTop.classList.toggle('filter-dropdown-top--hidden', !dirty);
  };
  const syncBulkBarVisibility = (resultCount) => {
    if (!bulkBar) return;
    const show = String(pendingPattern || '').trim().length > 0 && resultCount > 0;
    bulkBar.classList.toggle('filter-dropdown-bulk--hidden', !show);
  };
  let fetchGen = 0;
  let debounceCtxReload = null;

  const scheduleContextReload = () => {
    if (debounceCtxReload) clearTimeout(debounceCtxReload);
    debounceCtxReload = setTimeout(() => {
      debounceCtxReload = null;
      void loadDistinctList();
    }, 280);
  };

  const unsubFilters = eventBus.on('dashboard:filters-changed', scheduleContextReload);
  const unsubActiveSync = eventBus.on('active-filters:sync', scheduleContextReload);

  const loadDistinctList = async () => {
    const gen = ++fetchGen;
    if (!listEl) return;
    listEl.innerHTML = '<div class="filter-dropdown-loading">Загрузка…</div>';
    lastSearchResultValues = [];
    syncPosition();
    syncConfirmTopVisibility();
    syncBulkBarVisibility(0);
    try {
      const { rows, truncated, totalDistinct, hintMeta } = await loadDistinctPartition({
        fl: {
          ...fl,
          pattern: pendingPattern,
        },
        engine,
        signal: engine?.requestSignal,
        postColumnDistinct,
      });
      if (gen !== fetchGen || !listEl.isConnected) return;
      const inc = pendingInclude;
      const exc = pendingExclude;
      if (!rows.length) {
        listEl.innerHTML = '<div class="filter-dropdown-empty">Нет значений</div>';
        lastSearchResultValues = [];
        syncPosition();
        syncConfirmTopVisibility();
        syncBulkBarVisibility(0);
        return;
      }
      const truncHint = formatDistinctTruncationHint(
        Boolean(truncated),
        totalDistinct,
        hintMeta || {},
      );
      const actionable = [];
      listEl.innerHTML =
        rows
        .map(({ value, stale }) => {
          const s = String(value);
          let state;
          if (stale) state = 'unavailable';
          else if (exc.has(s)) state = 'excluded';
          else if (inc.has(s)) state = 'selected';
          else state = 'available';
          if (!stale) actionable.push(s);
          const rowCls = `filter-value-row filter-value-row--state-${state}`;
          const label =
            s.length > 80 ? `${esc(s.slice(0, 80))}…` : esc(s);
          const pressed = state === 'selected' || state === 'excluded';
          return `
            <button type="button" class="${rowCls}" data-enc-val="${encAttr(s)}" data-value-state="${state}"
              title="${esc(s)}" aria-pressed="${pressed ? 'true' : 'false'}">
              <span class="filter-value-text">${label}</span>
            </button>`;
        })
        .join('');
      lastSearchResultValues = actionable;
      syncPosition();
      syncConfirmTopVisibility();
      syncBulkBarVisibility(actionable.length);
    } catch (err) {
      if (gen !== fetchGen || !listEl.isConnected) return;
      if (err?.name === 'AbortError') return;
      const msg = err?.response?.data?.detail || err?.message || 'Ошибка загрузки';
      listEl.innerHTML = `<div class="filter-dropdown-error">${esc(msg)}</div>`;
      lastSearchResultValues = [];
      syncPosition();
      syncConfirmTopVisibility();
      syncBulkBarVisibility(0);
    }
  };

  const syncPosition = () => {
    if (!dropdown.isConnected || !anchorEl.isConnected) {
      closeActiveFilterChipDropdown();
      return;
    }
    const r = anchorEl.getBoundingClientRect();
    const margin = 4;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxPanelW = Math.min(340, vw - 16);
    const left = Math.min(Math.max(8, r.left), Math.max(8, vw - maxPanelW - 8));
    dropdown.style.position = 'fixed';
    dropdown.style.left = `${left}px`;
    dropdown.style.minWidth = `${Math.max(220, r.width)}px`;
    dropdown.style.maxWidth = `${maxPanelW}px`;
    dropdown.style.boxSizing = 'border-box';
    dropdown.style.zIndex = '40000';

    let top = r.bottom + margin;
    dropdown.style.top = `${top}px`;
    dropdown.style.maxHeight = '';
    const dh = dropdown.getBoundingClientRect().height;
    if (top + dh > vh - 8 && r.top - margin - dh > 8) {
      top = r.top - dh - margin;
    }
    top = Math.max(8, Math.min(top, vh - 8));
    dropdown.style.top = `${top}px`;
    dropdown.style.maxHeight = `${Math.max(120, vh - top - 8)}px`;
  };

  const onScroll = () => syncPosition();
  window.addEventListener('resize', syncPosition);
  document.addEventListener('scroll', onScroll, true);
  const unsubPan = eventBus.on('viewport:pan', syncPosition);
  const unsubZoom = eventBus.on('viewport:zoom', syncPosition);

  if (patternInp) {
    patternInp.addEventListener('input', () => {
      pendingPattern = patternInp.value;
      if (debounceFetch) clearTimeout(debounceFetch);
      debounceFetch = setTimeout(() => {
        debounceFetch = null;
        void loadDistinctList();
      }, 320);
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fl.selectedValues = Array.from(pendingInclude);
      fl.excludedValues = Array.from(pendingExclude);
      fl.pattern = pendingPattern;
      syncFilterRowsByField(engine, fl, rowSyncOpts);
      emitFiltersDebounced();
      if (!isVirtual && typeof widget.update === 'function') widget.update();
      void loadDistinctList();
    });
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const p2 = pendingPairFromRow(fl);
      pendingInclude = p2.inc;
      pendingExclude = p2.exc;
      pendingPattern = String(fl.pattern || '');
      if (patternInp) patternInp.value = pendingPattern;
      void loadDistinctList();
    });
  }

  if (bulkBar) {
    bulkBar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter-bulk]');
      if (!btn) return;
      e.stopPropagation();
      const mode = btn.getAttribute('data-filter-bulk');
      if (mode !== 'select' && mode !== 'exclude') return;
      if (!lastSearchResultValues.length) return;
      lastSearchResultValues.forEach((raw) => {
        const s = String(raw);
        if (mode === 'select') {
          pendingExclude.delete(s);
          pendingInclude.add(s);
        } else {
          pendingInclude.delete(s);
          pendingExclude.add(s);
        }
      });
      syncConfirmTopVisibility();
      void loadDistinctList();
    });
  }

  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button.filter-value-row[data-enc-val]');
      if (!btn) return;
      e.stopPropagation();
      const val = decodeURIComponent(btn.dataset.encVal);
      const state = btn.dataset.valueState;

      if (state === 'unavailable') {
        if (onlyActiveDashboardFilterIsSameField(engine, fl)) {
          const arr = Array.isArray(fl.selectedValues) ? [...fl.selectedValues] : [];
          if (!arr.some((x) => String(x) === val)) arr.push(val);
          fl.selectedValues = arr;
          const ex = new Set((fl.excludedValues || []).map((x) => String(x)));
          ex.delete(val);
          fl.excludedValues = Array.from(ex);
        } else {
          resetFiltersForStaleDistinctChoice(engine, fl, val);
        }
        const p3 = pendingPairFromRow(fl);
        pendingInclude = p3.inc;
        pendingExclude = p3.exc;
        pendingPattern = String(fl.pattern || '');
        syncFilterRowsByField(engine, fl, rowSyncOpts);
        emitFiltersDebounced();
        if (!isVirtual && typeof widget.update === 'function') widget.update();
        // Сразу показываем кнопки подтверждения, не дожидаясь перезагрузки списка
        syncConfirmTopVisibility();
        void loadDistinctList();
        return;
      }

      if (state === 'excluded') {
        pendingExclude.delete(val);
      } else if (state === 'selected') {
        pendingInclude.delete(val);
        pendingExclude.add(val);
      } else {
        pendingInclude.add(val);
      }
      // Сразу показываем кнопки подтверждения после изменения черновика
      syncConfirmTopVisibility();
      void loadDistinctList();
    });
  }

  const onOutside = (e) => {
    if (dropdown.contains(e.target) || anchorEl.contains(e.target)) return;
    closeActiveFilterChipDropdown();
  };

  document.body.appendChild(dropdown);
  requestAnimationFrame(() => {
    syncPosition();
    requestAnimationFrame(syncPosition);
  });
  void loadDistinctList();
  syncConfirmTopVisibility();

  let addOutsideTimer = setTimeout(() => {
    addOutsideTimer = null;
    document.addEventListener('mousedown', onOutside, true);
  }, 0);

  const teardown = () => {
    fetchGen += 1;
    if (debounceCtxReload) {
      clearTimeout(debounceCtxReload);
      debounceCtxReload = null;
    }
    if (typeof unsubFilters === 'function') unsubFilters();
    if (typeof unsubActiveSync === 'function') unsubActiveSync();
    if (addOutsideTimer) {
      clearTimeout(addOutsideTimer);
      addOutsideTimer = null;
    } else {
      document.removeEventListener('mousedown', onOutside, true);
    }
    window.removeEventListener('resize', syncPosition);
    document.removeEventListener('scroll', onScroll, true);
    if (typeof unsubPan === 'function') unsubPan();
    if (typeof unsubZoom === 'function') unsubZoom();
    if (dropdown.isConnected) dropdown.remove();
    cleanupOpen = null;
  };
  cleanupOpen = teardown;
}
