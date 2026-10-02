import { WidgetBase } from '../core/WidgetBase.js';
import { eventBus } from '../core/EventBus.js';
import { postColumnDistinct } from '../../../../services/dashboardQueryService.js';
import {
  loadDistinctPartition,
  formatDistinctTruncationHint,
} from '../../../../services/dashboardCrossFilterEngine.js';
import {
  collectDashboardFilters,
  filtersForModel,
  syncFilterRowsByField,
  resetFiltersForStaleDistinctChoice,
  onlyActiveDashboardFilterIsSameField,
  isPendingFilterDistinctFromCommitted,
} from '../../../../services/dashboardFilterUtils.js';
import { getDashboardDataModelClient } from '../../../../services/dashboardDataModel/DashboardDataModelClient.js';
import { isDataBindingUnavailable, renderWidgetDataPlaceholder, renderWidgetEmptyInnerHtml } from '../core/widgetDataBinding.js';
import { svgCheck, svgCross } from '../../icons/dashboardCreaterIcons.js';
import {
  filterButtonStyleCssVars,
  normalizeFilterButtonStyle,
} from './filter/filterButtonStyle.js';
import {
  domainFromMinMax,
  filtersExcludingField,
  formatFilterSelectionSummary,
  isFullFilterRange,
  isNumericFilterType,
  numericDomainFromValues,
  normalizeFilterRowAppearance,
  resolveFilterAppearance,
  resolveFilterSelection,
} from './filter/filterAppearance.js';

export { DEFAULT_FILTER_BUTTON_STYLE, normalizeFilterButtonStyle } from './filter/filterButtonStyle.js';
export {
  FILTER_APPEARANCE_OPTIONS,
  FILTER_SELECTION_OPTIONS,
  normalizeFilterAppearance,
  normalizeFilterSelection,
  resolveFilterAppearance,
} from './filter/filterAppearance.js';

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

/** Черновик выбора: два множества до применения (см. isPendingFilterDistinctFromCommitted). */
function _pendingPairFromRow(fl) {
  return {
    inc: new Set((fl.selectedValues || []).map((x) => String(x))),
    exc: new Set((fl.excludedValues || []).map((x) => String(x))),
  };
}

function _normalizeFilterRow(f) {
  if (!Array.isArray(f.selectedValues)) {
    if (f.op === 'in' && (f.value != null || f.values != null)) {
      const vals = Array.isArray(f.values)
        ? f.values
        : String(f.value || '')
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);
      f.selectedValues = vals;
    } else {
      f.selectedValues = [];
    }
  }
  if (f.pattern == null) f.pattern = '';
  if (typeof f.pattern !== 'string') f.pattern = String(f.pattern);
  if (f.displayLabel != null && typeof f.displayLabel !== 'string') {
    f.displayLabel = String(f.displayLabel);
  }
  if (!Array.isArray(f.excludedValues)) {
    f.excludedValues = [];
  }
  normalizeFilterRowAppearance(f);
}

function _filterFieldCaption(f) {
  const c = String(f.displayLabel ?? '').trim();
  return c || String(f.field ?? '');
}

const DEFAULT_FILTER_TEXT_COLOR = '#000000';

/**
 * Глобальные фильтры: у каждого поля свой Appearance (Select / Segmented / Chips / Checkbox / Slider / Auto).
 */
export class FilterWidget extends WidgetBase {
  constructor(config = {}) {
    super({
      ...config,
      type: 'filter',
      width: config.width || 300,
      height: config.height || 260,
    });
    this.settings = {
      title: config.settings?.title || 'Фильтры',
      filters: Array.isArray(config.settings?.filters) ? [...config.settings.filters] : [],
      ...config.settings,
    };
    if (this.settings.showTitle === undefined) {
      this.settings.showTitle = true;
    }
    this.settings.buttonStyle = normalizeFilterButtonStyle(this.settings.buttonStyle);
    (this.settings.filters || []).forEach(_normalizeFilterRow);
    this._debounceEmit = null;
    this._debounceFetch = null;
    this._expandedFilterId = null;
    this._outsideCloseHandler = null;
    this._dropdownElevatedCleanup = null;
    this._syncDropdownFixed = null;
    this._elevatedDropdownEl = null;
    this._dropdownReturnParent = null;
    this._dropdownReturnNext = null;
    this._fetchGen = 0;
    /** @type {Map<string, number>} */
    this._inlineFetchGenById = new Map();
    /** @type {Map<string, Set<string>>} черновик multi-select до Apply */
    this._inlinePendingById = new Map();
    this._debounceContextReload = null;
    this._openFilterDistinctListEl = null;
    this._openFilterDistinctFl = null;
    /** @type {Set<string>|null} черновик IN */
    this._pendingIncludeSet = null;
    /** @type {Set<string>|null} черновик NOT IN */
    this._pendingExcludeSet = null;
    /** @type {string|null} черновик pattern до Apply */
    this._pendingPattern = null;
    this._modeUnsub = eventBus.on('mode:changed', () => {
      this.update();
    });
    this._crossFilterUnsub = eventBus.on('dashboard:filters-changed', () => {
      this._scheduleDistinctContextReload();
    });
    this._activeBarSyncUnsub = eventBus.on('active-filters:sync', () => {
      this._scheduleDistinctContextReload();
    });
  }

  getWidgetColorFormulaMap() {
    const s = this.settings || {};
    const bs = s.buttonStyle || {};
    return {
      titleColor: { hex: s.titleColor, formula: s.titleColorFormula },
      btnBackground: { hex: bs.background, formula: bs.backgroundFormula },
      btnHoverBackground: { hex: bs.hoverBackground, formula: bs.hoverBackgroundFormula },
      btnOpenBackground: { hex: bs.openBackground, formula: bs.openBackgroundFormula },
      btnBorderColor: { hex: bs.borderColor, formula: bs.borderColorFormula },
    };
  }

  _isViewerMode() {
    return typeof window !== 'undefined' && window.engine?.mode === 'viewer';
  }

  destroy() {
    this._teardownOpenDropdown();
    if (this._debounceContextReload) {
      clearTimeout(this._debounceContextReload);
      this._debounceContextReload = null;
    }
    if (typeof this._modeUnsub === 'function') {
      this._modeUnsub();
      this._modeUnsub = null;
    }
    if (typeof this._crossFilterUnsub === 'function') {
      this._crossFilterUnsub();
      this._crossFilterUnsub = null;
    }
    if (typeof this._activeBarSyncUnsub === 'function') {
      this._activeBarSyncUnsub();
      this._activeBarSyncUnsub = null;
    }
    super.destroy();
  }

  _emitFiltersChanged() {
    if (this._debounceEmit) clearTimeout(this._debounceEmit);
    this._debounceEmit = setTimeout(() => {
      this._debounceEmit = null;
      eventBus.emit('dashboard:filters-changed', { source: 'filter-widget' });
    }, 280);
  }

  _syncSameFieldFilters(sourceRow) {
    const eng = typeof window !== 'undefined' ? window.engine : null;
    if (eng && sourceRow) {
      syncFilterRowsByField(eng, sourceRow, { sourceWidgetId: this.id });
    }
  }

  _scheduleDistinctContextReload() {
    if (this._debounceContextReload) clearTimeout(this._debounceContextReload);
    this._debounceContextReload = setTimeout(() => {
      this._debounceContextReload = null;
      const listEl = this._openFilterDistinctListEl;
      const id = this._expandedFilterId;
      const fl = this.settings.filters?.find((x) => x.id === id);
      if (listEl && fl && listEl.isConnected) {
        void this._loadDistinctList(listEl, fl, this._pendingPattern ?? fl.pattern ?? '');
      }
      this._hydrateAllInlineFields({ silent: true });
    }, 280);
  }

  _layoutClass() {
    const w = this.width || 300;
    const h = this.height || 200;
    const wide = w >= Math.max(360, h * 1.15);
    return wide ? 'filter-widget--layout-row' : 'filter-widget--layout-col';
  }

  _teardownOutsideClose() {
    if (this._outsideCloseHandler) {
      document.removeEventListener('mousedown', this._outsideCloseHandler, true);
      this._outsideCloseHandler = null;
    }
  }

  _teardownDropdownElevated() {
    if (typeof this._dropdownElevatedCleanup === 'function') {
      this._dropdownElevatedCleanup();
      this._dropdownElevatedCleanup = null;
    }
    this._syncDropdownFixed = null;
    this._elevatedDropdownEl = null;
    this._dropdownReturnParent = null;
    this._dropdownReturnNext = null;
  }

  _teardownOpenDropdown() {
    this._openFilterDistinctListEl = null;
    this._openFilterDistinctFl = null;
    this._pendingIncludeSet = null;
    this._pendingExcludeSet = null;
    this._pendingPattern = null;
    this._teardownOutsideClose();
    this._teardownDropdownElevated();
  }

  /**
   * Панель в document.body + position:fixed — поверх всех виджетов, без обрезки overflow/backdrop-filter.
   */
  _installDropdownElevated(dropdown, filterId) {
    this._teardownDropdownElevated();
    if (!dropdown || !this.element) return;

    const resolveAnchor = () => {
      const wrap = Array.from(this.element.querySelectorAll('.filter-field-wrap')).find(
        (el) => el.dataset.filterId === filterId,
      );
      return wrap?.querySelector('.filter-select-trigger, .filter-field-btn');
    };

    const sync = () => {
      const anchorBtn = resolveAnchor();
      if (!dropdown.isConnected || !anchorBtn?.isConnected) return;

      const shell = this.element?.querySelector('.widget-content > .filter-widget');
      if (shell && dropdown) {
        dropdown.style.removeProperty('color');
        ['fontSize', 'fontFamily', 'fontWeight', 'letterSpacing', 'lineHeight', 'textShadow'].forEach((prop) => {
          const v = shell.style[prop];
          if (v) dropdown.style[prop] = v;
        });
      }

      const r = anchorBtn.getBoundingClientRect();
      const margin = 4;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxPanelW = Math.min(340, vw - 16);
      const left = Math.min(Math.max(8, r.left), Math.max(8, vw - maxPanelW - 8));
      dropdown.classList.add('filter-dropdown--elevated');
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

    const onScroll = () => sync();
    window.addEventListener('resize', sync);
    document.addEventListener('scroll', onScroll, true);
    const unsubPan = eventBus.on('viewport:pan', sync);
    const unsubZoom = eventBus.on('viewport:zoom', sync);

    this._syncDropdownFixed = sync;
    this._elevatedDropdownEl = dropdown;
    this._dropdownReturnParent = dropdown.parentElement;
    this._dropdownReturnNext = dropdown.nextSibling;
    document.body.appendChild(dropdown);

    this._dropdownElevatedCleanup = () => {
      window.removeEventListener('resize', sync);
      document.removeEventListener('scroll', onScroll, true);
      if (typeof unsubPan === 'function') unsubPan();
      if (typeof unsubZoom === 'function') unsubZoom();

      if (dropdown.isConnected) {
        dropdown.classList.remove('filter-dropdown--elevated');
        dropdown.style.position = '';
        dropdown.style.left = '';
        dropdown.style.top = '';
        dropdown.style.minWidth = '';
        dropdown.style.maxWidth = '';
        dropdown.style.maxHeight = '';
        dropdown.style.zIndex = '';
        dropdown.style.boxSizing = '';
        ['fontSize', 'fontFamily', 'fontWeight', 'letterSpacing', 'lineHeight', 'textShadow'].forEach((prop) => {
          dropdown.style.removeProperty(prop);
        });

        const parent = this._dropdownReturnParent;
        if (parent?.isConnected) {
          const next = this._dropdownReturnNext;
          if (next && next.parentNode === parent) {
            parent.insertBefore(dropdown, next);
          } else {
            parent.appendChild(dropdown);
          }
        } else {
          dropdown.remove();
        }
      }

      this._elevatedDropdownEl = null;
      this._dropdownReturnParent = null;
      this._dropdownReturnNext = null;
    };

    requestAnimationFrame(() => {
      sync();
      requestAnimationFrame(sync);
    });
  }

  _syncFilterConfirmBarVisibility(listEl, fl) {
    const dropdownEl = listEl?.closest?.('.filter-dropdown');
    if (!dropdownEl || !fl) return;
    const top = dropdownEl.querySelector('.filter-dropdown-top');
    if (!top) return;
    const dirty = isPendingFilterDistinctFromCommitted(
      this._pendingIncludeSet,
      this._pendingExcludeSet,
      fl,
    );
    top.classList.toggle('filter-dropdown-top--hidden', !dirty);
  }

  /**
   * Кнопки «Выбрать все / Исключить все» — только при непустом поиске и наличии результатов.
   * @param {HTMLElement|null} listEl
   * @param {string} pattern
   * @param {number} resultCount
   */
  _syncFilterBulkBarVisibility(listEl, pattern, resultCount) {
    const dropdownEl = listEl?.closest?.('.filter-dropdown');
    if (!dropdownEl) return;
    const bulk = dropdownEl.querySelector('.filter-dropdown-bulk');
    if (!bulk) return;
    const show = String(pattern || '').trim().length > 0 && resultCount > 0;
    bulk.classList.toggle('filter-dropdown-bulk--hidden', !show);
  }

  /**
   * @param {'select'|'exclude'} mode
   * @param {HTMLElement|null} listEl
   * @param {object} fl
   */
  _applyBulkToSearchResults(mode, listEl, fl) {
    const inc = this._pendingIncludeSet;
    const exc = this._pendingExcludeSet;
    if (!inc || !exc) return;
    const values = Array.isArray(this._lastSearchResultValues)
      ? this._lastSearchResultValues
      : [];
    if (!values.length) return;
    values.forEach((raw) => {
      const s = String(raw);
      if (mode === 'select') {
        exc.delete(s);
        inc.add(s);
      } else {
        inc.delete(s);
        exc.add(s);
      }
    });
    void this._loadDistinctList(listEl, fl, this._pendingPattern);
  }

  _scheduleOutsideClose(content) {
    this._teardownOutsideClose();
    const handler = (e) => {
      const drop = this._elevatedDropdownEl;
      const inside =
        (content && content.contains(e.target)) || (drop && drop.contains(e.target));
      if (!inside) {
        this._expandedFilterId = null;
        this._teardownOutsideClose();
        this.render();
      }
    };
    this._outsideCloseHandler = handler;
    setTimeout(() => {
      if (this._outsideCloseHandler === handler) {
        document.addEventListener('mousedown', handler, true);
      }
    }, 0);
  }

  async _loadDistinctList(listEl, fl, patternOverride = null) {
    const gen = ++this._fetchGen;
    if (!listEl) return;
    listEl.innerHTML = '<div class="filter-dropdown-loading">Загрузка…</div>';
    this._lastSearchResultValues = [];
    if (typeof this._syncDropdownFixed === 'function') this._syncDropdownFixed();
    this._syncFilterConfirmBarVisibility(listEl, fl);
    const patternForUi =
      patternOverride != null ? String(patternOverride) : String(fl.pattern || '');
    this._syncFilterBulkBarVisibility(listEl, patternForUi, 0);
    const engine = typeof window !== 'undefined' ? window.engine : null;
    if (!engine) {
      listEl.innerHTML = '<div class="filter-dropdown-error">Нет движка</div>';
      this._syncFilterConfirmBarVisibility(listEl, fl);
      this._syncFilterBulkBarVisibility(listEl, patternForUi, 0);
      return;
    }
    try {
      const { rows, truncated, totalDistinct, hintMeta } = await loadDistinctPartition({
        fl: {
          ...fl,
          pattern: patternOverride != null ? String(patternOverride) : fl.pattern,
        },
        engine,
        signal: engine?.requestSignal,
        postColumnDistinct,
      });
      if (gen !== this._fetchGen || !listEl.isConnected) return;
      const pair = _pendingPairFromRow(fl);
      const inc =
        this._pendingIncludeSet != null && this._pendingExcludeSet != null
          ? this._pendingIncludeSet
          : pair.inc;
      const exc =
        this._pendingIncludeSet != null && this._pendingExcludeSet != null
          ? this._pendingExcludeSet
          : pair.exc;
      if (!rows.length) {
        listEl.innerHTML = '<div class="filter-dropdown-empty">Нет значений</div>';
        this._lastSearchResultValues = [];
        if (typeof this._syncDropdownFixed === 'function') this._syncDropdownFixed();
        this._syncFilterConfirmBarVisibility(listEl, fl);
        this._syncFilterBulkBarVisibility(listEl, patternForUi, 0);
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
      this._lastSearchResultValues = actionable;
      if (typeof this._syncDropdownFixed === 'function') this._syncDropdownFixed();
      this._syncFilterConfirmBarVisibility(listEl, fl);
      this._syncFilterBulkBarVisibility(listEl, patternForUi, actionable.length);
    } catch (err) {
      if (gen !== this._fetchGen || !listEl.isConnected) return;
      if (err?.name === 'AbortError') return;
      const msg = err?.response?.data?.detail || err?.message || 'Ошибка загрузки';
      listEl.innerHTML = `<div class="filter-dropdown-error">${esc(msg)}</div>`;
      this._lastSearchResultValues = [];
      if (typeof this._syncDropdownFixed === 'function') this._syncDropdownFixed();
      this._syncFilterConfirmBarVisibility(listEl, fl);
      this._syncFilterBulkBarVisibility(listEl, patternForUi, 0);
    }
  }

  _bindDropdown(content, fl) {
    const wrap = Array.from(content.querySelectorAll('[data-dropdown-for]')).find(
      (el) => el.dataset.dropdownFor === fl.id,
    );
    if (!wrap) return;
    const p = _pendingPairFromRow(fl);
    this._pendingIncludeSet = p.inc;
    this._pendingExcludeSet = p.exc;
    this._pendingPattern = String(fl.pattern || '');
    const patternInp = wrap.querySelector('.filter-pattern-input');
    const listEl = wrap.querySelector('.filter-values-list');
    const applyBtn = wrap.querySelector('.filter-confirm-btn--apply');
    const cancelBtn = wrap.querySelector('.filter-confirm-btn--cancel');
    if (applyBtn) {
      applyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._pendingIncludeSet == null || this._pendingExcludeSet == null) return;
        fl.selectedValues = Array.from(this._pendingIncludeSet);
        fl.excludedValues = Array.from(this._pendingExcludeSet);
        fl.pattern = String(this._pendingPattern || '');
        this._syncSameFieldFilters(fl);
        this._emitFiltersChanged();
        void this._loadDistinctList(listEl, fl, this._pendingPattern);
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const p2 = _pendingPairFromRow(fl);
        this._pendingIncludeSet = p2.inc;
        this._pendingExcludeSet = p2.exc;
        this._pendingPattern = String(fl.pattern || '');
        if (patternInp) patternInp.value = this._pendingPattern;
        void this._loadDistinctList(listEl, fl, this._pendingPattern);
      });
    }
    const bulkBar = wrap.querySelector('.filter-dropdown-bulk');
    if (bulkBar) {
      bulkBar.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-filter-bulk]');
        if (!btn) return;
        e.stopPropagation();
        const mode = btn.getAttribute('data-filter-bulk');
        if (mode === 'select' || mode === 'exclude') {
          this._applyBulkToSearchResults(mode, listEl, fl);
        }
      });
    }
    if (patternInp) {
      patternInp.addEventListener('input', () => {
        this._pendingPattern = patternInp.value;
        if (this._debounceFetch) clearTimeout(this._debounceFetch);
        this._debounceFetch = setTimeout(() => {
          this._debounceFetch = null;
          this._loadDistinctList(listEl, fl, this._pendingPattern);
        }, 320);
      });
    }
    if (listEl) {
      this._openFilterDistinctListEl = listEl;
      this._openFilterDistinctFl = fl;
      listEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button.filter-value-row[data-enc-val]');
        if (!btn) return;
        e.stopPropagation();
        const val = decodeURIComponent(btn.dataset.encVal);
        const state = btn.dataset.valueState;
        const eng = typeof window !== 'undefined' ? window.engine : null;
        const inc = this._pendingIncludeSet;
        const exc = this._pendingExcludeSet;

        if (state === 'unavailable' && eng) {
          if (onlyActiveDashboardFilterIsSameField(eng, fl)) {
            const arr = Array.isArray(fl.selectedValues) ? [...fl.selectedValues] : [];
            if (!arr.some((x) => String(x) === val)) arr.push(val);
            fl.selectedValues = arr;
            const ex = new Set((fl.excludedValues || []).map((x) => String(x)));
            ex.delete(val);
            fl.excludedValues = Array.from(ex);
          } else {
            resetFiltersForStaleDistinctChoice(eng, fl, val);
          }
          const p3 = _pendingPairFromRow(fl);
          this._pendingIncludeSet = p3.inc;
          this._pendingExcludeSet = p3.exc;
          this._pendingPattern = String(fl.pattern || '');
          this._syncSameFieldFilters(fl);
          this._emitFiltersChanged();
          void this._loadDistinctList(listEl, fl, this._pendingPattern);
          return;
        }

        if (inc == null || exc == null) return;
        const selection = resolveFilterSelection(fl, 'select');
        if (selection === 'single') {
          if (inc.has(val) && inc.size === 1 && !exc.has(val)) {
            inc.clear();
          } else {
            inc.clear();
            inc.add(val);
          }
          exc.clear();
        } else if (inc.has(val)) {
          inc.delete(val);
        } else {
          inc.add(val);
          exc.delete(val);
        }
        void this._loadDistinctList(listEl, fl, this._pendingPattern);
      });
    }
    this._installDropdownElevated(wrap, fl.id);
    this._loadDistinctList(listEl, fl, this._pendingPattern);
  }

  _removeBtnHtml(f, viewerMode) {
    if (viewerMode) return '';
    return `<button type="button" class="filter-field-remove" data-action="remove" data-filter-id="${esc(f.id)}" title="Убрать поле" aria-label="Убрать поле">${svgCross}</button>`;
  }

  _dropdownHtml(f) {
    return `<div class="filter-dropdown" data-dropdown-for="${esc(f.id)}">
                <div class="filter-dropdown-top">
                  <div class="filter-values-confirm-bar" role="toolbar" aria-label="Подтверждение выбора">
                    <button type="button" class="filter-confirm-btn filter-confirm-btn--apply" title="Применить выбор" aria-label="Применить выбор">${svgCheck}</button>
                    <button type="button" class="filter-confirm-btn filter-confirm-btn--cancel" title="Отменить изменения" aria-label="Отменить изменения">${svgCross}</button>
                  </div>
                </div>
                <div class="filter-dropdown-body">
                  <div class="filter-dropdown-hint">Шаблон (* → любые символы), например №444*</div>
                  <input type="text" class="filter-pattern-input" autocomplete="off"
                    placeholder="№444*" value="${esc(f.pattern || '')}" />
                  <div class="filter-values-list"></div>
                </div>
                <div class="filter-dropdown-bulk filter-dropdown-bulk--hidden" role="toolbar" aria-label="Массовый выбор по поиску">
                  <button type="button" class="filter-bulk-btn filter-bulk-btn--select" data-filter-bulk="select">Выбрать все</button>
                  <button type="button" class="filter-bulk-btn filter-bulk-btn--exclude" data-filter-bulk="exclude">Исключить все</button>
                </div>
              </div>`;
  }

  _renderSelectFieldHtml(f, { open, removeBtn, cap }) {
    const btnClass = `filter-field-btn filter-select-trigger${open ? ' filter-field-btn--open' : ''}`;
    const summary = formatFilterSelectionSummary(f);
    return `
            <div class="filter-field-wrap filter-field-wrap--select" data-filter-id="${esc(f.id)}" data-appearance="select">
              <button type="button" class="${btnClass}" data-action="toggle" data-filter-id="${esc(f.id)}"
                title="${esc(f.table)}.${esc(f.field)}">
                <span class="filter-select-col">
                  <span class="filter-select-label">${esc(cap)}</span>
                  <span class="filter-select-value">${esc(summary)}</span>
                </span>
                <span class="filter-select-chevron" aria-hidden="true">${open ? '▴' : '▾'}</span>
              </button>
              ${removeBtn}
              ${open ? this._dropdownHtml(f) : ''}
            </div>`;
  }

  _renderInlineFieldHtml(f, appearance, { removeBtn, cap }) {
    return `
            <div class="filter-field-wrap filter-field-wrap--${esc(appearance)}" data-filter-id="${esc(f.id)}" data-appearance="${esc(appearance)}">
              <div class="filter-control filter-control--${esc(appearance)}">
                <div class="filter-control-head">
                  <div class="filter-control-label">${esc(cap)}</div>
                  <div class="filter-inline-confirm filter-inline-confirm--hidden" data-filter-confirm role="toolbar" aria-label="Подтверждение выбора">
                    <button type="button" class="filter-confirm-btn filter-confirm-btn--apply" data-filter-inline-apply title="Применить выбор" aria-label="Применить выбор">${svgCheck}</button>
                    <button type="button" class="filter-confirm-btn filter-confirm-btn--cancel" data-filter-inline-cancel title="Отменить изменения" aria-label="Отменить изменения">${svgCross}</button>
                  </div>
                  ${removeBtn}
                </div>
                <div class="filter-control-body" data-filter-body="${esc(f.id)}">
                  <div class="filter-control-loading">Загрузка…</div>
                </div>
              </div>
            </div>`;
  }

  _optionBtnHtml(value, selected, extraClass) {
    const s = String(value);
    const label = s.length > 80 ? `${esc(s.slice(0, 80))}…` : esc(s);
    const cls = `${extraClass}${selected ? ' is-selected' : ''}`;
    return `<button type="button" class="${cls}" data-enc-val="${encAttr(s)}" aria-pressed="${selected ? 'true' : 'false'}" title="${esc(s)}">${label}</button>`;
  }

  async _fetchDistinctValues(fl) {
    const engine = typeof window !== 'undefined' ? window.engine : null;
    if (!engine) return { values: [], totalDistinct: 0 };
    const { rows, totalDistinct } = await loadDistinctPartition({
      fl,
      engine,
      signal: engine?.requestSignal,
      postColumnDistinct,
    });
    const values = (rows || [])
      .filter((r) => !r.stale && r.value != null && String(r.value) !== '')
      .map((r) => String(r.value));
    const n =
      totalDistinct != null && Number.isFinite(Number(totalDistinct))
        ? Number(totalDistinct)
        : values.length;
    return { values, totalDistinct: n };
  }

  async _fetchSliderDomain(fl) {
    const engine = typeof window !== 'undefined' ? window.engine : null;
    if (!engine || fl?.modelId == null || !fl.table || !fl.field) return null;
    const ctxFilters = filtersExcludingField(
      filtersForModel(collectDashboardFilters(engine), fl.modelId),
      fl,
    );
    try {
      const client = getDashboardDataModelClient(engine);
      const res = await client.fetchAggregate({
        modelId: fl.modelId,
        base_table: fl.table,
        group_by: [],
        aggregations: [
          { fn: 'min', column: fl.field, as: 'dmin' },
          { fn: 'max', column: fl.field, as: 'dmax' },
        ],
        filters: ctxFilters,
        limit: 1,
      });
      const row = Array.isArray(res?.rows) && res.rows.length ? res.rows[0] : null;
      const domain = domainFromMinMax(row?.dmin, row?.dmax);
      if (domain) return domain;
    } catch (err) {
      console.warn('filter slider domain', err);
    }
    try {
      const { rows } = await loadDistinctPartition({
        fl,
        engine,
        signal: engine?.requestSignal,
        postColumnDistinct,
      });
      return numericDomainFromValues((rows || []).map((r) => r.value));
    } catch {
      return null;
    }
  }

  _selectedSetForUi(fl) {
    const pending = this._inlinePendingById?.get(fl.id);
    if (pending) return pending;
    return new Set((fl.selectedValues || []).map((x) => String(x)));
  }

  _isInlinePendingDirty(fl) {
    const pending = this._inlinePendingById?.get(fl.id);
    if (!pending) return false;
    const committed = new Set((fl.selectedValues || []).map((x) => String(x)));
    if (pending.size !== committed.size) return true;
    for (const v of pending) {
      if (!committed.has(v)) return true;
    }
    return false;
  }

  _syncInlineConfirmBar(fl) {
    const wrap = this.element?.querySelector(
      `.filter-field-wrap[data-filter-id="${CSS.escape(String(fl.id))}"]`,
    );
    const bar = wrap?.querySelector('[data-filter-confirm]');
    if (!bar) return;
    const appearance = resolveFilterAppearance(fl);
    const selection = resolveFilterSelection(fl, appearance);
    const show = selection === 'multiple' && this._isInlinePendingDirty(fl);
    bar.classList.toggle('filter-inline-confirm--hidden', !show);
  }

  _commitInlinePending(fl) {
    const pending = this._inlinePendingById?.get(fl.id);
    if (!pending) return;
    fl.selectedValues = Array.from(pending);
    fl.excludedValues = [];
    fl.rangeMin = null;
    fl.rangeMax = null;
    this._inlinePendingById.delete(fl.id);
    this._syncSameFieldFilters(fl);
    this._emitFiltersChanged();
    this._refreshInlineSelectedState(fl);
    this._syncInlineConfirmBar(fl);
  }

  _cancelInlinePending(fl) {
    this._inlinePendingById?.delete(fl.id);
    this._refreshInlineSelectedState(fl);
    this._syncInlineConfirmBar(fl);
  }

  _hydrateAllInlineFields(opts = {}) {
    const content = this.element?.querySelector('.widget-content');
    if (!content) return;
    content.querySelectorAll('.filter-field-wrap[data-appearance]').forEach((wrap) => {
      const appearance = wrap.dataset.appearance;
      if (!appearance || appearance === 'select') return;
      const fl = this.settings.filters?.find((x) => x.id === wrap.dataset.filterId);
      if (!fl) return;
      if (opts.silent && this._isInlinePendingDirty(fl)) {
        this._refreshInlineSelectedState(fl);
        this._syncInlineConfirmBar(fl);
        return;
      }
      void this._hydrateInlineField(wrap, fl, appearance, opts);
    });
  }

  async _hydrateInlineField(wrap, fl, appearance, opts = {}) {
    const body = wrap.querySelector('[data-filter-body]');
    if (!body) return;
    const gen = (this._inlineFetchGenById.get(fl.id) || 0) + 1;
    this._inlineFetchGenById.set(fl.id, gen);
    const hasContent = Boolean(body.querySelector('[data-enc-val], .filter-slider'));
    if (!opts.silent && !hasContent) {
      body.innerHTML = '<div class="filter-control-loading">Загрузка…</div>';
    }
    try {
      if (appearance === 'slider') {
        const domain = await this._fetchSliderDomain(fl);
        if (this._inlineFetchGenById.get(fl.id) !== gen || !body.isConnected) return;
        this._renderSliderBody(body, fl, domain);
        return;
      }
      const { values } = await this._fetchDistinctValues(fl);
      if (this._inlineFetchGenById.get(fl.id) !== gen || !body.isConnected) return;
      if (!values.length) {
        body.innerHTML = '<div class="filter-control-empty">Нет значений</div>';
        return;
      }
      const selection = resolveFilterSelection(fl, appearance);
      if (appearance === 'checkbox') {
        this._renderCheckboxBody(body, fl, values, selection, { searchable: values.length > 8 });
      } else if (appearance === 'chips') {
        this._renderOptionGroup(body, fl, values, selection, 'filter-chip');
        body.classList.add('filter-chips-body');
      } else {
        this._renderOptionGroup(body, fl, values, selection, 'filter-seg-btn');
        body.classList.add('filter-seg-body');
      }
      this._syncInlineConfirmBar(fl);
    } catch {
      if (body.isConnected) {
        body.innerHTML = '<div class="filter-control-empty">Не удалось загрузить</div>';
      }
    }
  }

  _bindOptionClicks(body, fl, selection) {
    body.querySelectorAll('[data-enc-val]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        let v = '';
        try {
          v = decodeURIComponent(btn.dataset.encVal || '');
        } catch {
          v = btn.dataset.encVal || '';
        }
        this._toggleInlineValue(fl, v, selection);
      });
    });
  }

  _renderOptionGroup(body, fl, values, selection, btnClass) {
    const sel = this._selectedSetForUi(fl);
    body.innerHTML = values.map((v) => this._optionBtnHtml(v, sel.has(String(v)), btnClass)).join('');
    this._bindOptionClicks(body, fl, selection);
  }

  _renderCheckboxBody(body, fl, values, selection, { searchable }) {
    const sel = this._selectedSetForUi(fl);
    const searchHtml = searchable
      ? `<input type="search" class="filter-inline-search" placeholder="Поиск…" autocomplete="off" />`
      : '';
    const rows = values
      .map((v) => {
        const on = sel.has(String(v));
        const s = String(v);
        const label = s.length > 80 ? `${esc(s.slice(0, 80))}…` : esc(s);
        return `<button type="button" class="filter-check-row${on ? ' is-selected' : ''}" data-enc-val="${encAttr(s)}" aria-pressed="${on ? 'true' : 'false'}" title="${esc(s)}">
          <span class="filter-check-mark" aria-hidden="true"></span>
          <span class="filter-check-text">${label}</span>
        </button>`;
      })
      .join('');
    body.innerHTML = `${searchHtml}<div class="filter-check-list">${rows}</div>`;
    this._bindOptionClicks(body, fl, selection);
    const search = body.querySelector('.filter-inline-search');
    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        body.querySelectorAll('.filter-check-row').forEach((row) => {
          const t = (row.querySelector('.filter-check-text')?.textContent || '').toLowerCase();
          row.hidden = q.length > 0 && !t.includes(q);
        });
      });
      search.addEventListener('click', (e) => e.stopPropagation());
    }
  }

  _sliderStep(fl, domain) {
    const integer =
      isNumericFilterType(fl.type) &&
      !/float|double|decimal|numeric|real/.test(String(fl.type || '').toLowerCase());
    if (integer) return 1;
    return domain.max - domain.min > 100 ? 1 : 0.01;
  }

  _sliderThumbs(fl, domain) {
    const lo0 = Number.isFinite(Number(fl.rangeMin)) ? Number(fl.rangeMin) : domain.min;
    const hi0 = Number.isFinite(Number(fl.rangeMax)) ? Number(fl.rangeMax) : domain.max;
    const lo = Math.min(Math.max(lo0, domain.min), domain.max);
    const hi = Math.min(Math.max(hi0, domain.min), domain.max);
    return { a: Math.min(lo, hi), b: Math.max(lo, hi) };
  }

  _bindSliderInputs(body, fl) {
    const minInp = body.querySelector('.filter-slider-min');
    const maxInp = body.querySelector('.filter-slider-max');
    const loEl = body.querySelector('[data-slider-lo]');
    const hiEl = body.querySelector('[data-slider-hi]');
    const root = body.querySelector('.filter-slider');
    if (!minInp || !maxInp || !root || root._sliderBound) return;
    root._sliderBound = true;
    const apply = () => {
      let x = Number(minInp.value);
      let y = Number(maxInp.value);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (x > y) {
        const t = x;
        x = y;
        y = t;
        minInp.value = String(x);
        maxInp.value = String(y);
      }
      if (loEl) loEl.textContent = String(x);
      if (hiEl) hiEl.textContent = String(y);
      const domain = domainFromMinMax(root.dataset.domainMin, root.dataset.domainMax);
      fl.rangeMin = x;
      fl.rangeMax = y;
      if (!domain || isFullFilterRange(fl, domain)) {
        fl.rangeMin = null;
        fl.rangeMax = null;
      } else {
        fl.selectedValues = [];
        fl.excludedValues = [];
      }
      this._syncSameFieldFilters(fl);
      this._emitFiltersChanged();
    };
    minInp.addEventListener('input', apply);
    maxInp.addEventListener('input', apply);
  }

  _renderSliderBody(body, fl, domain) {
    if (!domain) {
      body.innerHTML = '<div class="filter-control-empty">Нет числового диапазона</div>';
      return;
    }
    const existing = body.querySelector('.filter-slider');
    const dragging =
      existing &&
      document.activeElement &&
      existing.contains(document.activeElement) &&
      document.activeElement.classList.contains('filter-slider-input');
    if (dragging) return;

    const step = this._sliderStep(fl, domain);
    const { a, b } = this._sliderThumbs(fl, domain);
    if (existing) {
      existing.dataset.domainMin = String(domain.min);
      existing.dataset.domainMax = String(domain.max);
      const minInp = existing.querySelector('.filter-slider-min');
      const maxInp = existing.querySelector('.filter-slider-max');
      const loEl = existing.querySelector('[data-slider-lo]');
      const hiEl = existing.querySelector('[data-slider-hi]');
      [minInp, maxInp].forEach((inp) => {
        if (!inp) return;
        inp.min = String(domain.min);
        inp.max = String(domain.max);
        inp.step = String(step);
      });
      if (minInp) minInp.value = String(a);
      if (maxInp) maxInp.value = String(b);
      if (loEl) loEl.textContent = String(a);
      if (hiEl) hiEl.textContent = String(b);
      this._bindSliderInputs(body, fl);
      return;
    }

    body.innerHTML = `
      <div class="filter-slider" data-domain-min="${domain.min}" data-domain-max="${domain.max}">
        <div class="filter-slider-values"><span data-slider-lo>${esc(a)}</span> — <span data-slider-hi>${esc(b)}</span></div>
        <div class="filter-slider-track">
          <input type="range" class="filter-slider-input filter-slider-min" min="${domain.min}" max="${domain.max}" step="${step}" value="${a}" aria-label="От">
          <input type="range" class="filter-slider-input filter-slider-max" min="${domain.min}" max="${domain.max}" step="${step}" value="${b}" aria-label="До">
        </div>
      </div>`;
    this._bindSliderInputs(body, fl);
  }

  _toggleInlineValue(fl, value, selection) {
    const v = String(value ?? '');
    if (!v) return;
    if (selection === 'single') {
      const sel = new Set((fl.selectedValues || []).map((x) => String(x)));
      fl.selectedValues = sel.has(v) && sel.size === 1 ? [] : [v];
      fl.excludedValues = [];
      fl.rangeMin = null;
      fl.rangeMax = null;
      this._inlinePendingById?.delete(fl.id);
      this._syncSameFieldFilters(fl);
      this._emitFiltersChanged();
      this._refreshInlineSelectedState(fl);
      this._syncInlineConfirmBar(fl);
      return;
    }
    if (!this._inlinePendingById.has(fl.id)) {
      this._inlinePendingById.set(
        fl.id,
        new Set((fl.selectedValues || []).map((x) => String(x))),
      );
    }
    const pending = this._inlinePendingById.get(fl.id);
    if (pending.has(v)) pending.delete(v);
    else pending.add(v);
    this._refreshInlineSelectedState(fl);
    this._syncInlineConfirmBar(fl);
  }

  _refreshInlineSelectedState(fl) {
    const wrap = this.element?.querySelector(
      `.filter-field-wrap[data-filter-id="${CSS.escape(String(fl.id))}"]`,
    );
    if (!wrap) return;
    const sel = this._selectedSetForUi(fl);
    wrap.querySelectorAll('[data-enc-val]').forEach((btn) => {
      let v = '';
      try {
        v = decodeURIComponent(btn.dataset.encVal || '');
      } catch {
        v = btn.dataset.encVal || '';
      }
      const on = sel.has(v);
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  render() {
    const content = this.element.querySelector('.widget-content');
    if (!content) return;

    this._teardownOpenDropdown();

    const { title, filters } = this.settings;
    const typography = this.styles?.typography || {};
    const fontFamily = typography.fontFamily || 'Inter';
    const textColor = typography.color || DEFAULT_FILTER_TEXT_COLOR;
    const layoutClass = this._layoutClass();
    const viewerMode = this._isViewerMode();
    const showTitle = this.settings.showTitle !== false;
    const titleColorRaw = String(
      this.resolvedColor('titleColor', this.settings.titleColor || '#8B5CF6') || '#8B5CF6',
    ).trim();
    const titleColor = /^#[0-9a-fA-F]{6}$/i.test(titleColorRaw) ? titleColorRaw : '#8B5CF6';
    const titleHtml = showTitle
      ? `<div class="dash-widget-heading filter-widget-title" style="color:${esc(titleColor)}">${esc(title)}</div>`
      : '';

    const fieldsHtml =
      isDataBindingUnavailable(this)
        ? renderWidgetDataPlaceholder(this, { ...typography, color: textColor })
        : filters.length === 0
        ? renderWidgetEmptyInnerHtml({ ...typography, color: textColor }, 'data')
        : filters
            .map((f) => {
              const appearance = resolveFilterAppearance(f);
              const open = this._expandedFilterId === f.id && appearance === 'select';
              const removeBtn = this._removeBtnHtml(f, viewerMode);
              const cap = _filterFieldCaption(f);
              if (appearance === 'select') {
                return this._renderSelectFieldHtml(f, { open, removeBtn, cap });
              }
              return this._renderInlineFieldHtml(f, appearance, { removeBtn, cap });
            })
            .join('');

    const btnVars = filterButtonStyleCssVars(this.settings.buttonStyle, {
      background: this._resolvedWidgetColors?.btnBackground,
      hoverBackground: this._resolvedWidgetColors?.btnHoverBackground,
      openBackground: this._resolvedWidgetColors?.btnOpenBackground,
      borderColor: this._resolvedWidgetColors?.btnBorderColor,
    });
    const styledBtnsClass = btnVars ? ' filter-widget--styled-btns' : '';
    const shellStyle = [
      `font-family:'${esc(fontFamily)}',sans-serif`,
      `color:${esc(textColor)}`,
      btnVars,
    ]
      .filter(Boolean)
      .join(';');

    content.innerHTML = `
      <div class="dash-widget-shell filter-widget ${layoutClass}${styledBtnsClass}" style="${shellStyle}">
        ${titleHtml}
        <div class="filter-widget-fields">${fieldsHtml}</div>
      </div>
    `;

    content.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.filterId;
        this._expandedFilterId = this._expandedFilterId === id ? null : id;
        this.render();
      });
    });

    if (!viewerMode) {
      content.querySelectorAll('[data-action="remove"]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.filterId;
          if (this._expandedFilterId === id) this._expandedFilterId = null;
          this._inlinePendingById?.delete(id);
          this.settings.filters = this.settings.filters.filter((x) => x.id !== id);
          this.update();
          eventBus.emit('dashboard:filters-changed', { source: 'filter-remove' });
          eventBus.emit('widget:data-binding-updated', { widget: this });
        });
      });
    }

    content.querySelectorAll('[data-filter-inline-apply]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrap = btn.closest('.filter-field-wrap');
        const fl = this.settings.filters?.find((x) => x.id === wrap?.dataset.filterId);
        if (fl) this._commitInlinePending(fl);
      });
    });
    content.querySelectorAll('[data-filter-inline-cancel]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrap = btn.closest('.filter-field-wrap');
        const fl = this.settings.filters?.find((x) => x.id === wrap?.dataset.filterId);
        if (fl) this._cancelInlinePending(fl);
      });
    });

    if (this._expandedFilterId) {
      const fl = this.settings.filters.find((x) => x.id === this._expandedFilterId);
      const appearance = fl ? resolveFilterAppearance(fl) : null;
      if (fl && appearance === 'select') {
        this._bindDropdown(content, fl);
        this._scheduleOutsideClose(content);
      } else {
        this._expandedFilterId = null;
      }
    }

    this._hydrateAllInlineFields();
  }

  toJSON() {
    return {
      ...super.toJSON(),
      settings: this.settings,
    };
  }

  fromJSON(json) {
    super.fromJSON(json);
    if (json.settings) {
      this.settings = { ...this.settings, ...json.settings };
    }
    if (this.settings.showTitle === undefined) {
      this.settings.showTitle = true;
    }
    this.settings.buttonStyle = normalizeFilterButtonStyle(this.settings.buttonStyle);
    (this.settings.filters || []).forEach(_normalizeFilterRow);
    this._expandedFilterId = null;
    this._inlinePendingById = new Map();
    this.render();
  }
}
