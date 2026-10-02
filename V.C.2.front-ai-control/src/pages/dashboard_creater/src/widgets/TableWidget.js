import { WidgetBase } from '../core/WidgetBase.js';
import { eventBus } from '../core/EventBus.js';
import { getDashboardDataModelClient } from '../../../../services/dashboardDataModel/DashboardDataModelClient.js';
import {
  collectDashboardFilters,
  filtersForModel,
  setDashboardFilterIncludeOnlyValue,
  ensureDashboardFilterRowExists,
} from '../../../../services/dashboardFilterUtils.js';
import { commitDashboardFilterTransportChange } from '../../../../services/dashboardFilterTransport.js';
import { hasDataBinding, renderWidgetDataPlaceholder } from '../core/widgetDataBinding.js';
import {
  applyTableColumnFormulas,
  collectUnfilteredTableColumnRefs,
  parseSimpleTableFieldRef,
  resolveTableQueryPlan,
  fetchTableGroupedRows,
} from './common/tableColumnFormula.js';
import {
  normalizeTableExtendedSettings,
  DEFAULT_TABLE_COLUMN_HEADER_BG,
} from './common/widgetFormulaSchema.js';
import { pickTableRowConditionalStyle } from './common/tableConditionalStyle.js';
import { loadProfileTableSort, saveProfileTableSort } from '../../../../services/profileTableSortStorage.js';

/** Совпадает с MAX_ROWS в sqlite_dashboard_query.py */
const TABLE_MAX_ROWS_CAP = 5000;

function clampTableMaxRows(n) {
  const x = parseInt(n, 10);
  if (!Number.isFinite(x)) return 500;
  return Math.min(TABLE_MAX_ROWS_CAP, Math.max(1, x));
}

/**
 * @param {unknown} raw
 * @returns {{ column: string, dir: 'asc'|'desc' }|null}
 */
function normalizeTableSort(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const column = String(/** @type {any} */ (raw).column || '').trim();
  if (!column) return null;
  const dir = String(/** @type {any} */ (raw).dir || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
  return { column, dir };
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {string} columnKey
 * @param {'asc'|'desc'} dir
 */
function sortTableRowsByColumn(rows, columnKey, dir) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  const mul = dir === 'desc' ? -1 : 1;
  list.sort((a, b) => {
    const va = a?.[columnKey];
    const vb = b?.[columnKey];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const na = typeof va === 'number' ? va : Number(String(va).trim().replace(',', '.'));
    const nb = typeof vb === 'number' ? vb : Number(String(vb).trim().replace(',', '.'));
    if (Number.isFinite(na) && Number.isFinite(nb)) {
      if (na === nb) return 0;
      return na < nb ? -mul : mul;
    }
    const sa = String(va);
    const sb = String(vb);
    return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' }) * mul;
  });
  return list;
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clampPx(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

/** Минимальная / максимальная ширина колонки при ресайзе, px */
const MIN_COL_WIDTH = 48;
const MAX_COL_WIDTH = 800;

function clampColWidth(n) {
  return clampPx(n, MIN_COL_WIDTH, MAX_COL_WIDTH);
}

function columnWidthInlineStyle(columnWidths, colKey) {
  const raw = columnWidths?.[colKey];
  if (raw == null || !Number.isFinite(Number(raw))) return '';
  const px = clampColWidth(Number(raw));
  return `width: ${px}px; min-width: ${px}px; max-width: ${px}px;`;
}

/**
 * TableWidget — таблица по выбранным полям (bindingFields), JOIN по FK на бэкенде.
 */
export class TableWidget extends WidgetBase {
  constructor(config = {}) {
    super({
      ...config,
      type: 'table',
      width: config.width || 500,
      height: config.height || 300,
    });

    this.settings = {
      data: config.settings?.data || [],
      columns: config.settings?.columns || [],
      bindingFields: Array.isArray(config.settings?.bindingFields)
        ? [...config.settings.bindingFields]
        : [],
      columnLabels: Array.isArray(config.settings?.columnLabels)
        ? [...config.settings.columnLabels]
        : [],
      bindingError: config.settings?.bindingError || '',
      showHeader: config.settings?.showHeader !== false,
      maxRows: clampTableMaxRows(config.settings?.maxRows),
      computedColumns: Array.isArray(config.settings?.computedColumns)
        ? [...config.settings.computedColumns]
        : [],
      tableConditionalRules: Array.isArray(config.settings?.tableConditionalRules)
        ? [...config.settings.tableConditionalRules]
        : [],
      /** Горизонтальный padding ячеек (расстояние между колонками), px */
      cellPaddingX:
        config.settings?.cellPaddingX !== undefined
          ? Number(config.settings.cellPaddingX)
          : undefined,
      /** Ширина отдельных колонок по ключу (имя колонки / id вычисляемой), px */
      columnWidths:
        config.settings?.columnWidths && typeof config.settings.columnWidths === 'object'
          ? { ...config.settings.columnWidths }
          : {},
      ...config.settings,
      maxRows: clampTableMaxRows(config.settings?.maxRows),
    };

    this.settings.showTitle = this.settings.showTitle === true;
    if (this.settings.title == null || String(this.settings.title).trim() === '') {
      this.settings.title = 'Таблица';
    }
    {
      const ts = parseInt(this.settings.titleSize, 10);
      this.settings.titleSize = Number.isFinite(ts) ? Math.min(48, Math.max(8, ts)) : 14;
    }

    normalizeTableExtendedSettings(this.settings);
    this.settings.tableSort = normalizeTableSort(this.settings.tableSort);
    this._restoreProfileTableSort();
  }

  _profileSortScope() {
    const engine = this._engine || (typeof window !== 'undefined' ? window.engine : null);
    if (!engine?.__profileEmbed) return null;
    return { widgetId: this.id, flowId: engine.__profileFlowId || null };
  }

  _restoreProfileTableSort() {
    const scope = this._profileSortScope();
    if (!scope || this.settings.tableSort) return;
    const stored = loadProfileTableSort(scope.widgetId, scope.flowId);
    if (stored) this.settings.tableSort = stored;
  }

  _persistProfileTableSort() {
    const scope = this._profileSortScope();
    if (!scope) return;
    saveProfileTableSort(scope.widgetId, scope.flowId, this.settings.tableSort);
  }

  getWidgetColorFormulaMap() {
    const s = this.settings || {};
    return {
      titleColor: { hex: s.titleColor, formula: s.titleColorFormula },
      columnHeaderBackgroundColor: {
        hex: s.columnHeaderBackgroundColor,
        formula: s.columnHeaderBackgroundColorFormula,
      },
    };
  }

  /** @returns {{ column: string, dir: 'asc'|'desc' }|null} */
  _getTableSort() {
    return normalizeTableSort(this.settings.tableSort);
  }

  /**
   * Лимит строк в таблице всегда из настроек (maxRows).
   * Если сортировка по колонке без server order_by (JOIN / computed) —
   * тянем CAP, сортируем на клиенте и берём первые maxRows.
   * @param {boolean} [hasServerOrderBy]
   */
  _getTableFetchLimit(hasServerOrderBy = false) {
    const maxRows = clampTableMaxRows(this.settings.maxRows);
    if (this._getTableSort() && !hasServerOrderBy) return TABLE_MAX_ROWS_CAP;
    return maxRows;
  }

  /**
   * order_by только для колонок base_table (ограничение SQLite API).
   * ASC|DESC + LIMIT maxRows даёт окно из полного отсортированного набора.
   * @param {{ table?: string }} ds
   * @param {object[]} bf
   * @param {string[]} labels
   */
  _getTableOrderBy(ds, bf, labels) {
    const sort = this._getTableSort();
    if (!sort || !ds?.table) return undefined;
    const idx = labels.indexOf(sort.column);
    if (idx < 0) return undefined;
    const b = bf[idx];
    if (!b?.field || String(b.table) !== String(ds.table)) return undefined;
    return [{ column: String(b.field), dir: sort.dir }];
  }

  /**
   * @param {string} columnKey
   */
  _cycleTableSort(columnKey) {
    const key = String(columnKey || '').trim();
    if (!key) return;
    const cur = this._getTableSort();
    if (!cur || cur.column !== key) {
      this.settings.tableSort = { column: key, dir: 'asc' };
    } else if (cur.dir === 'asc') {
      this.settings.tableSort = { column: key, dir: 'desc' };
    } else {
      this.settings.tableSort = null;
    }
    this._persistProfileTableSort();
    const engine =
      this._engine || (typeof window !== 'undefined' ? window.engine : null);
    if (engine && typeof this.reloadFromDataModel === 'function') {
      void this.reloadFromDataModel(engine);
    } else {
      this.update();
    }
    eventBus.emit('widget:settings-changed', { widget: this });
  }

  render() {
    const content = this.element.querySelector('.widget-content');
    if (!content) return;

    const typography = this.styles?.typography || {};
    const fontFamily = typography.fontFamily || 'Inter';
    const emptyMsgColor = typography.color || '#E4E6EB';

    if (!hasDataBinding(this)) {
      content.innerHTML = renderWidgetDataPlaceholder(this, typography);
      return;
    }

    const { data, columns, showHeader, bindingError } = this.settings;
    const maxRows = clampTableMaxRows(this.settings.maxRows);
    const tableSort = this._getTableSort();

    const nTitlePx = (() => {
      const n = parseInt(this.settings.titleSize, 10);
      return Number.isFinite(n) ? Math.min(48, Math.max(8, n)) : 14;
    })();
    const titleColorRaw = String(
      this.resolvedColor('titleColor', this.settings.titleColor) || '',
    ).trim();
    const titleColorStyle = /^#[0-9a-fA-F]{6}$/i.test(titleColorRaw)
      ? `;color:${titleColorRaw}`
      : '';
    const titleRowHtml =
      this.settings.showTitle === true
        ? `<div class="dash-widget-heading" style="font-size:${nTitlePx}px${titleColorStyle}">${escHtml(this.settings.title ?? 'Таблица')}</div>`
        : '';

    if (!data || data.length === 0) {
      const errBlock = bindingError
        ? `<div class="table-widget-error" style="padding:0.5rem;font-size:0.72rem;color:#ff8a8a;margin-bottom:0.35rem;">${escHtml(bindingError)}</div>`
        : '';
      content.innerHTML = `
        <div class="dash-widget-shell dash-widget-shell--column" style="font-family:'${fontFamily}',sans-serif;color:${emptyMsgColor};">
          ${errBlock}
          ${titleRowHtml}
          <div class="dash-widget-shell--centered-msg" style="flex:1;min-height:0;">
            <div class="dash-widget-state-message">Нет данных</div>
          </div>
        </div>
      `;
      return;
    }

    const baseCols =
      columns.length > 0 ? columns : Object.keys(data[0] || {});
    const tableColumns = [...baseCols];
    const labels = this.settings.columnLabels || [];
    const extraBfs = this._forGroupBindings || [];
    const bfs = extraBfs.length
      ? [...extraBfs, ...(this.settings.bindingFields || [])]
      : this.settings.bindingFields || [];
    const columnWidths = this.settings.columnWidths || {};

    const adaptiveFontSize =
      typography.fontSize || Math.max(8, Math.min(this.width, this.height) / 30);
    const textColor = typography.color || '#E4E6EB';
    const headerBgColor =
      this.resolvedColor(
        'columnHeaderBackgroundColor',
        this.settings.columnHeaderBackgroundColor || DEFAULT_TABLE_COLUMN_HEADER_BG,
      ) || DEFAULT_TABLE_COLUMN_HEADER_BG;
    const fontWeight = typography.fontWeight || '400';
    const letterSpacing =
      typography.letterSpacing !== undefined
        ? `${typography.letterSpacing}px`
        : 'normal';
    const lineHeight = typography.lineHeight || 1.5;
    const textShadow = typography.textShadow || '';
    const paddingY = Math.max(4, adaptiveFontSize * 0.5);
    const paddingX =
      this.settings.cellPaddingX !== undefined &&
      Number.isFinite(Number(this.settings.cellPaddingX))
        ? clampPx(Number(this.settings.cellPaddingX), 2, 80)
        : paddingY;

    const errTop = bindingError
      ? `<div class="table-widget-error" style="padding:0.45rem;font-size:0.7rem;color:#ff8a8a;border-bottom:1px solid rgba(255,138,138,0.25);">${escHtml(bindingError)}</div>`
      : '';

    let html = `<div class="dash-widget-shell dash-widget-shell--column" style="font-family:'${fontFamily}',sans-serif;color:${textColor};">
      ${errTop}
      ${titleRowHtml}
      <div class="dash-widget-body--table" style="--tw-pad-x:${paddingX}px;--tw-pad-y:${paddingY}px;">
      <table style="width: 100%; border-collapse: collapse; table-layout: fixed; font-size: ${adaptiveFontSize}px; min-width: 100%;">`;

    if (showHeader) {
      /* sticky на <th>, непрозрачный фон — иначе при скролле текст tbody проступает и «накладывается» */
      html += `<thead><tr style="border-bottom: 2px solid rgba(0, 224, 255, 0.35);">`;
      tableColumns.forEach((col, i) => {
        const hdr =
          labels.length === baseCols.length
            ? labels[i] || col
            : col;
        const bf = bfs[i] ?? null;
        const title = bf ? `${bf.table}.${bf.field}` : String(col);
        const colWidthStyle = columnWidthInlineStyle(columnWidths, col);
        const isSorted = tableSort?.column === col;
        const sortMark = isSorted ? (tableSort.dir === 'desc' ? ' ▼' : ' ▲') : '';
        const handle =
          i === tableColumns.length - 1
            ? ''
            : `<span data-tw-col-resize="1" data-tw-col-idx="${i}" data-tw-col-key="${escHtml(col)}" style="position:absolute;top:0;right:-3px;width:6px;height:100%;cursor:col-resize;z-index:4;"></span>`;
        html += `<th data-tw-sort-col="${escHtml(col)}" style="
                    position: sticky;
                    top: 0;
                    z-index: 2;
                    vertical-align: middle;
                    padding: var(--tw-pad-y) var(--tw-pad-x);
                    text-align: left;
                    border-right: 1px solid rgba(0, 224, 255, 0.25);
                    white-space: nowrap;
                    color: ${textColor};
                    font-weight: ${fontWeight};
                    text-transform: uppercase;
                    letter-spacing: ${letterSpacing};
                    font-size: ${adaptiveFontSize * 0.9}px;
                    text-shadow: ${textShadow};
                    background-color: ${headerBgColor};
                    background-image: none;
                    background-clip: padding-box;
                    box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.15);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    cursor: pointer;
                    user-select: none;
                    ${isSorted ? 'color: #7dd3fc;' : ''}
                    ${colWidthStyle}
                " title="${escHtml(title)} — сортировка">${escHtml(hdr)}${sortMark}${handle}</th>`;
      });
      html += '</tr></thead>';
    }

    const condRules = this.settings.tableConditionalRules || [];
    html += '<tbody>';
    // Всегда maxRows из настроек; при сортировке это уже окно из полного ORDER BY (или client top-N).
    const displayRows = data.slice(0, maxRows);
    displayRows.forEach((row, idx) => {
      const zebra =
        idx % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 224, 255, 0.03)';
      const rowStyle = pickTableRowConditionalStyle(row, condRules);
      const bgColor = rowStyle.backgroundColor || zebra;
      const rowTextColor = rowStyle.color || textColor;
      html += `<tr style="background: ${bgColor}; color: ${rowTextColor}; transition: background 0.2s ease;">`;
      tableColumns.forEach((col, colIdx) => {
        const bf = bfs[colIdx] ?? null;
        const value = row[col] !== undefined ? row[col] : '';
        const colWidthStyle = columnWidthInlineStyle(columnWidths, col);
        const filterAttrs =
          bf?.modelId != null && bf?.table && bf?.field
            ? ` data-tw-filter="1"
                data-tw-mid="${escHtml(bf.modelId)}"
                data-tw-table="${escHtml(bf.table)}"
                data-tw-field="${escHtml(bf.field)}"
                data-tw-type="${escHtml(bf.type || '')}"
                data-tw-val="${escHtml(value)}"`
            : '';
        html += `<td style="
                    padding: var(--tw-pad-y) var(--tw-pad-x);
                    border-right: 1px solid rgba(0, 224, 255, 0.1);
                    border-bottom: 1px solid rgba(0, 224, 255, 0.1);
                    word-break: break-word;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    color: ${rowTextColor};
                    font-weight: ${fontWeight};
                    letter-spacing: ${letterSpacing};
                    line-height: ${lineHeight};
                    text-shadow: ${textShadow};
                    ${colWidthStyle}
                " ${filterAttrs}>${escHtml(value)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';

    content.innerHTML = html;
    this._attachColumnResizeHandlers();
    this._attachHeaderSortHandlers();
    this._attachCellFilterHandlers();
  }

  _applyColumnWidthInTable(wrap, colIdx, widthPx) {
    const table = wrap?.querySelector?.('table');
    if (!table || !Number.isFinite(colIdx)) return;
    const w = clampColWidth(widthPx);
    table.querySelectorAll(`tr > *:nth-child(${colIdx + 1})`).forEach((cell) => {
      cell.style.width = `${w}px`;
      cell.style.minWidth = `${w}px`;
      cell.style.maxWidth = `${w}px`;
    });
  }

  _attachColumnResizeHandlers() {
    const content = this.element?.querySelector?.('.widget-content');
    if (!content) return;
    const wrap = content.querySelector('.dash-widget-body--table');
    if (!wrap) return;

    const handles = Array.from(
      wrap.querySelectorAll('[data-tw-col-resize="1"]'),
    );
    if (!handles.length) return;

    const onPointerDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const handle = e.currentTarget;
      const colIdx = parseInt(handle.dataset.twColIdx, 10);
      const colKey = handle.dataset.twColKey;
      if (!Number.isFinite(colIdx) || !colKey) return;

      const th = handle.closest('th');
      if (!th) return;

      const startClientX = e.clientX || 0;
      const startWidth = th.offsetWidth;

      if (!this.settings.columnWidths || typeof this.settings.columnWidths !== 'object') {
        this.settings.columnWidths = {};
      }

      if (handle?.setPointerCapture && e.pointerId != null) {
        try {
          handle.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }

      const onMove = (ev) => {
        const dx = (ev.clientX || 0) - startClientX;
        const next = clampColWidth(startWidth + dx);
        this.settings.columnWidths[colKey] = next;
        this._applyColumnWidthInTable(wrap, colIdx, next);
      };

      const onUp = (ev) => {
        document.removeEventListener('pointermove', onMove, true);
        document.removeEventListener('pointerup', onUp, true);
        try {
          if (handle?.releasePointerCapture && ev.pointerId != null) {
            handle.releasePointerCapture(ev.pointerId);
          }
          ev.preventDefault();
          ev.stopPropagation();
        } catch {
          /* ignore */
        }
        this.settings.columnWidths[colKey] = clampColWidth(th.offsetWidth);
        eventBus.emit('widget:settings-changed', { widget: this });
      };

      document.addEventListener('pointermove', onMove, true);
      document.addEventListener('pointerup', onUp, true);
    };

    handles.forEach((h) => {
      if (h.__twResizeBound) return;
      h.__twResizeBound = true;
      h.addEventListener('pointerdown', onPointerDown, true);
    });
  }

  _attachHeaderSortHandlers() {
    const content = this.element?.querySelector?.('.widget-content');
    if (!content) return;
    const wrap = content.querySelector('.dash-widget-body--table');
    if (!wrap) return;
    if (wrap.__twHeaderSortBound) return;
    wrap.__twHeaderSortBound = true;

    wrap.addEventListener(
      'click',
      (e) => {
        if (e.target?.closest?.('[data-tw-col-resize="1"]')) return;
        const th = e.target?.closest?.('th[data-tw-sort-col]');
        if (!th || !wrap.contains(th)) return;
        const col = th.getAttribute('data-tw-sort-col');
        if (!col) return;
        e.preventDefault();
        e.stopPropagation();
        this._cycleTableSort(col);
      },
      true,
    );
  }

  _attachCellFilterHandlers() {
    const content = this.element?.querySelector?.('.widget-content');
    if (!content) return;
    const wrap = content.querySelector('.dash-widget-body--table');
    if (!wrap) return;
    if (wrap.__twCellFilterBound) return;
    wrap.__twCellFilterBound = true;

    wrap.addEventListener(
      'click',
      (e) => {
        const td = e.target?.closest?.('td[data-tw-filter="1"]');
        if (!td || !wrap.contains(td)) return;
        if (e.target?.closest?.('[data-tw-col-resize="1"]')) return;

        const mid = td.dataset.twMid;
        const table = td.dataset.twTable;
        const field = td.dataset.twField;
        const val = td.dataset.twVal;
        if (mid == null || !table || !field) return;
        if (val == null || String(val) === '') return;

        const engine =
          this._engine ||
          (typeof window !== 'undefined' ? window.engine : null);
        if (!engine?.widgetManager) return;

        const ensured = ensureDashboardFilterRowExists(engine, {
          modelId: mid,
          table,
          field,
          type: td.dataset.twType || 'string',
        });
        if (!ensured.ok) return;

        const res = setDashboardFilterIncludeOnlyValue(
          engine,
          { modelId: mid, table, field },
          val,
          { toggle: true },
        );
        if (!res?.ok) return;

        commitDashboardFilterTransportChange(engine);
        eventBus.emit('dashboard:filters-changed', { source: 'table-widget-cell' });
      },
      true,
    );
  }

  async reloadFromDataModel(engine) {
    if (!engine) return;
    this._engine = engine;
    this._forGroupBindings = [];
    const ds = this.dataSource;
    const bf = this.settings.bindingFields || [];

    if (!ds?.modelId || !ds?.table) {
      this.settings.data = [];
      this.settings.columns = [];
      this.settings.columnLabels = [];
      this.settings.bindingError = '';
      this.update();
      return;
    }

    if (!bf.length) {
      this.settings.data = [];
      this.settings.columns = [];
      this.settings.columnLabels = [];
      this.settings.bindingError = '';
      this.update();
      return;
    }

    const counts = {};
    bf.forEach((b) => {
      counts[b.field] = (counts[b.field] || 0) + 1;
    });
    const labels = bf.map((b) =>
      counts[b.field] === 1 ? b.field : `${b.table}.${b.field}`,
    );
    const plan = resolveTableQueryPlan(bf, ds);
    if (plan.mode === 'aggregate' && plan.error) {
      this.settings.bindingError = plan.error;
      this.settings.data = [];
      this.settings.columns = labels;
      this.settings.columnLabels = bf.map((b) => b.field);
      this.update();
      return;
    }
    const extraDims = plan.mode === 'aggregate' ? plan.extraDims || [] : [];
    const extraKeys = extraDims.map((d) => d.key);
    this.settings.columns = extraKeys.length ? [...extraKeys, ...labels] : labels;
    this.settings.columnLabels = extraKeys.length
      ? [...extraKeys, ...bf.map((b) => b.field)]
      : bf.map((b) => b.field);
    if (extraDims.length) {
      this._forGroupBindings = extraDims.map((d) => ({
        modelId: ds.modelId,
        table: d.table || ds.table,
        field: d.column,
        type: 'string',
      }));
    }

    const column_refs = [];
    const colRefKeys = new Set();
    const pushColRef = (table, column) => {
      const t = String(table ?? '').trim();
      const c = String(column ?? '').trim();
      if (!t || !c) return;
      const key = `${t}.${c}`;
      if (colRefKeys.has(key)) return;
      colRefKeys.add(key);
      column_refs.push({ table: t, column: c });
    };
    bf.forEach((b) => {
      pushColRef(b.table, b.field);
      const simpleRef = parseSimpleTableFieldRef(b.formula);
      if (simpleRef) pushColRef(simpleRef.table, simpleRef.field);
    });

    try {
      const maxRows = clampTableMaxRows(this.settings.maxRows);
      const order_by = this._getTableOrderBy(ds, bf, labels);
      const hasServerOrderBy = Array.isArray(order_by) && order_by.length > 0;
      // Server ORDER BY + LIMIT maxRows → правильное окно из полного набора.
      // Без order_by (JOIN/computed) — CAP, client sort, затем slice(0, maxRows).
      const limit = this._getTableFetchLimit(hasServerOrderBy);
      const filters = filtersForModel(
        collectDashboardFilters(engine),
        ds.modelId,
      );
      const client = getDashboardDataModelClient(engine);
      if (plan.mode === 'aggregate') {
        const aggLimit = this._getTableFetchLimit(false);
        let nextRows = await fetchTableGroupedRows(
          client,
          ds,
          plan,
          bf,
          labels,
          filters,
          aggLimit,
        );
        this.settings.bindingError = '';
        normalizeTableExtendedSettings(this.settings);
        this.settings.tableSort = normalizeTableSort(this.settings.tableSort);
        const sort = this._getTableSort();
        if (sort) {
          nextRows = sortTableRowsByColumn(nextRows, sort.column, sort.dir);
        }
        nextRows = nextRows.slice(0, maxRows);
        this.settings.data = nextRows;
        this.update();
        return;
      }
      const { rows } = await client.fetchSelect({
        modelId: ds.modelId,
        base_table: ds.table,
        column_refs,
        filters,
        limit,
        order_by,
      });
      let nextRows = rows || [];
      this.settings.bindingError = '';

      const unfilteredColumnRefs = collectUnfilteredTableColumnRefs(bf);
      let unfilteredRows = null;
      if (unfilteredColumnRefs.length) {
        const { rows: urows } = await client.fetchSelect({
          modelId: ds.modelId,
          base_table: ds.table,
          column_refs: unfilteredColumnRefs,
          filters: [],
          limit,
          order_by,
        });
        unfilteredRows = urows || [];
      }

      normalizeTableExtendedSettings(this.settings);
      this.settings.tableSort = normalizeTableSort(this.settings.tableSort);
      await applyTableColumnFormulas(
        engine,
        ds,
        nextRows,
        this.settings.bindingFields,
        labels,
        unfilteredRows,
      );

      // Клиентская сортировка после формул (JOIN / computed / стабильность порядка).
      const sort = this._getTableSort();
      if (sort) {
        nextRows = sortTableRowsByColumn(nextRows, sort.column, sort.dir);
      }
      // В UI всегда только maxRows (топ окна после полного ORDER BY / client sort).
      nextRows = nextRows.slice(0, maxRows);

      this.settings.data = nextRows;
      this.update();
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.error('TableWidget reloadFromDataModel', e);
      const msg = e?.response?.data?.detail || e?.message || 'Ошибка запроса';
      this.settings.bindingError =
        typeof msg === 'string' ? msg : JSON.stringify(msg);
      this.settings.data = [];
      this.settings.columns = [];
      this.settings.columnLabels = [];
      this.update();
    }
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
    if (!Array.isArray(this.settings.bindingFields)) {
      this.settings.bindingFields = [];
    }
    this.settings.maxRows = clampTableMaxRows(this.settings.maxRows);
    this.settings.tableSort = normalizeTableSort(this.settings.tableSort);
    this.settings.showTitle = this.settings.showTitle === true;
    if (this.settings.title == null || String(this.settings.title).trim() === '') {
      this.settings.title = 'Таблица';
    }
    {
      const ts = parseInt(this.settings.titleSize, 10);
      this.settings.titleSize = Number.isFinite(ts) ? Math.min(48, Math.max(8, ts)) : 14;
    }
    normalizeTableExtendedSettings(this.settings);
    if (
      this.settings.bindingFields.length === 0 &&
      this.dataSource?.field &&
      this.dataSource?.table
    ) {
      this.settings.bindingFields.push({
        modelId: this.dataSource.modelId,
        table: this.dataSource.table,
        field: this.dataSource.field,
        type: this.dataSource.fieldType || 'string',
        formula: `[${this.dataSource.table}.${this.dataSource.field}]`,
      });
    }
    this.render();
  }
}
