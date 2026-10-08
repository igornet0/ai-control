import React, { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  cellKey,
  getCellState,
  CELL_TYPES,
  COLUMN_DATA_TYPES,
  excelColumnLabel,
  gridModelToTableColumns,
  normalizeColumnDataType,
  padColumnNames,
  deleteRowAt,
  deleteColumnAt,
  insertRowAt,
  insertColumnAt,
  resizeSheetGrid,
  SPREADSHEET_MIN_DIM,
  SPREADSHEET_MAX_DIM,
  SPREADSHEET_MAX_SHEETS,
  selectionBounds,
  spreadsheetColumnSelection,
  spreadsheetRowSelection,
  spreadsheetAllSelection,
  parseTsvToRows,
  applyParsedPasteToCells,
  isSpreadsheetWorkbookModel,
  getWorkbookActiveSheet,
  patchWorkbookActiveSheet,
  setWorkbookActiveSheet,
  addSheetToWorkbook,
  deleteSheetFromWorkbook,
  renameSheetInWorkbook,
  createEmptySpreadsheetWorkbook,
  normalizeSheetModel,
  getEffectiveCellValue,
  applyColumnDefaultToColumn,
} from './spreadsheetGridUtils';
import SpreadsheetColumnCellInput from './SpreadsheetColumnCellInput';
import SpreadsheetColumnDefaultInput from './SpreadsheetColumnDefaultInput';
import SpreadsheetSummarySettings from './SpreadsheetSummarySettings';
import SpreadsheetSheetTabs from './SpreadsheetSheetTabs';
import {
  SUMMARY_TYPES,
  normalizeSummaryConfig,
  normalizeColumnSummaryConfig,
  setSummaryEnabled,
  patchSummaryColumn,
  computeSummaryRow,
  remapSummaryColumnsAfterColDelete,
} from './spreadsheetSummary';
import { computeFormulaDisplayMap } from './spreadsheetCellFormula';
import SpreadsheetFormulaBar from './SpreadsheetFormulaBar';
import { ALIGN_ICONS } from './DocumentIcons';
import { buildFormulaRangeMarks, useFormulaCellPicking } from './spreadsheetFormulaHighlight';
import {
  fillCells,
  handleGridHotkey,
  isInFillPreview,
  useFillHandleDrag,
  useGridHistory,
} from './spreadsheetGridOps';
import fh from './FormulaHighlight.module.css';
import styles from './DocumentsApp.module.css';
import s from './SpreadsheetTemplatePanel.module.css';

const refToString = (r, c) => `${excelColumnLabel(c)}${r + 1}`;

function toWorkbook(model) {
  if (isSpreadsheetWorkbookModel(model)) return model;
  if (!model) return createEmptySpreadsheetWorkbook(1);
  return {
    sheets: [normalizeSheetModel(model, 0)],
    activeSheetId: normalizeSheetModel(model, 0).id,
  };
}

const SpreadsheetTemplatePanel = ({ model: modelProp, onChange }) => {
  const workbookBase = useMemo(() => toWorkbook(modelProp), [modelProp]);
  const [activeSheetId, setActiveSheetId] = useState(() => workbookBase.activeSheetId);

  useEffect(() => {
    setActiveSheetId(workbookBase.activeSheetId);
  }, [modelProp, workbookBase.activeSheetId]);

  const workbook = useMemo(
    () => setWorkbookActiveSheet(workbookBase, activeSheetId),
    [workbookBase, activeSheetId],
  );
  const activeSheet = getWorkbookActiveSheet(workbook) || workbook.sheets[0];
  const { rowCount, colCount, hasHeaderRow, cells = {} } = activeSheet;

  const emitWorkbook = useCallback((nextWb) => {
    setActiveSheetId(nextWb.activeSheetId);
    onChange(nextWb);
  }, [onChange]);
  const patchSheet = useCallback(
    (patch) => emitWorkbook(patchWorkbookActiveSheet(workbook, patch)),
    [workbook, emitWorkbook],
  );
  const [range, setRange] = useState(() => ({ a: { r: 0, c: 0 }, f: { r: 0, c: 0 } }));
  const [ctx, setCtx] = useState(null);
  const [summarySettings, setSummarySettings] = useState(null);
  const menuRef = useRef(null);
  const scrollRef = useRef(null);
  const pendingScrollRef = useRef(null);
  const colInputRefs = useRef({});
  const modelRef = useRef(activeSheet);
  modelRef.current = activeSheet;
  const workbookRef = useRef(workbook);
  workbookRef.current = workbook;
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const columnNames = padColumnNames(activeSheet.columnNames, colCount);

  const patchCell = useCallback(
    (r, c, patch) => {
      const k = cellKey(r, c);
      const prev = cells[k] || {};
      patchSheet({
        cells: { ...cells, [k]: { ...prev, ...patch } },
      });
    },
    [cells, patchSheet]
  );

  const patchCellsInSelection = useCallback(
    (patch) => {
      const bb = selectionBounds(rangeRef.current.a, rangeRef.current.f);
      let nextCells = { ...cells };
      for (let r = bb.r0; r <= bb.r1; r += 1) {
        for (let col = bb.c0; col <= bb.c1; col += 1) {
          const k = cellKey(r, col);
          const prev = getCellState(nextCells, r, col);
          nextCells = { ...nextCells, [k]: { ...prev, ...patch } };
        }
      }
      patchSheet({ cells: nextCells });
    },
    [cells, patchSheet]
  );

  const applyCellFormat = useCallback(
    (patch) => {
      const bb = selectionBounds(rangeRef.current.a, rangeRef.current.f);
      const isMulti = (bb.r1 - bb.r0 + 1) * (bb.c1 - bb.c0 + 1) > 1;
      if (isMulti) {
        patchCellsInSelection(patch);
        return;
      }
      const f = rangeRef.current.f;
      patchCell(f.r, f.c, patch);
    },
    [patchCell, patchCellsInSelection]
  );

  const setDim = (nextRow, nextCol) => {
    const prevRows = rowCount;
    const prevCols = colCount;
    const resized = resizeSheetGrid(activeSheet, nextRow, nextCol);
    const cols = resized.tableColumns || gridModelToTableColumns(resized);
    patchSheet({
      rowCount: resized.rowCount,
      colCount: resized.colCount,
      cells: resized.cells,
      columnNames: resized.columnNames,
      tableColumns: cols,
      summary: normalizeSummaryConfig(activeSheet.summary, cols),
    });
    if (resized.rowCount !== prevRows) pendingScrollRef.current = 'row';
    if (resized.colCount !== prevCols) pendingScrollRef.current = 'col';
  };

  const queueScroll = (axis) => {
    pendingScrollRef.current = axis;
  };

  useLayoutEffect(() => {
    const axis = pendingScrollRef.current;
    if (!axis || !scrollRef.current) return;
    pendingScrollRef.current = null;
    const el = scrollRef.current;
    if (axis === 'row') el.scrollTop = el.scrollHeight;
    if (axis === 'col') el.scrollLeft = el.scrollWidth;
  }, [rowCount, colCount]);

  const tableColsMeta = gridModelToTableColumns(activeSheet);

  const patchColumnDefaultValue = (c, defaultValue) => {
    const next = tableColsMeta.map((col, i) =>
      i === c ? { ...col, defaultValue } : col,
    );
    let nextCells = applyColumnDefaultToColumn(cells, c, rowCount, next, hasHeaderRow);
    patchSheet({ tableColumns: next, cells: nextCells });
  };

  const summaryConfig = useMemo(
    () => normalizeSummaryConfig(activeSheet.summary, tableColsMeta),
    [activeSheet.summary, tableColsMeta]
  );
  const summaryEnabled = summaryConfig.enabled;
  const summaryValues = useMemo(
    () => computeSummaryRow(activeSheet, workbook),
    [activeSheet.cells, activeSheet.rowCount, activeSheet.colCount, activeSheet.hasHeaderRow, activeSheet.summary, tableColsMeta, workbook]
  );
  const formulaDisplay = useMemo(
    () => computeFormulaDisplayMap(activeSheet, tableColsMeta, workbook),
    [activeSheet, tableColsMeta, workbook]
  );

  const patchColumnDataType = (c, dataType) => {
    const next = tableColsMeta.map((col, i) =>
      i === c ? { ...col, dataType: normalizeColumnDataType(dataType) } : col,
    );
    patchSheet({ tableColumns: next });
  };

  const patchColumnsInSelection = (dataType) => {
    const bb = selectionBounds(rangeRef.current.a, rangeRef.current.f);
    const normalized = normalizeColumnDataType(dataType);
    const next = tableColsMeta.map((col, i) =>
      i >= bb.c0 && i <= bb.c1 ? { ...col, dataType: normalized } : col,
    );
    patchSheet({ tableColumns: next });
  };

  const applyColumnDataType = (dataType) => {
    const bb = selectionBounds(rangeRef.current.a, rangeRef.current.f);
    const spansMultipleCols = bb.c1 > bb.c0;
    if (spansMultipleCols) {
      patchColumnsInSelection(dataType);
      return;
    }
    patchColumnDataType(bb.c0, dataType);
  };

  useEffect(() => {
    setRange({ a: { r: hasHeaderRow ? 1 : 0, c: 0 }, f: { r: hasHeaderRow ? 1 : 0, c: 0 } });
    setCtx(null);
    setSummarySettings(null);
  }, [workbook.activeSheetId, hasHeaderRow]);

  useEffect(() => {
    setRange((prev) => {
      const clamp = (pt) => ({
        r: Math.max(0, Math.min(rowCount - 1, pt.r)),
        c: Math.max(0, Math.min(colCount - 1, pt.c)),
      });
      const a = clamp(prev.a);
      const f = clamp(prev.f);
      if (a.r === prev.a.r && a.c === prev.a.c && f.r === prev.f.r && f.c === prev.f.c) return prev;
      return { a, f };
    });
  }, [rowCount, colCount]);

  const openColMenu = (e, c) => {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, kind: 'col', idx: c });
  };

  const openRowMenu = (e, r) => {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, kind: 'row', idx: r });
  };

  const openSummarySettingsForColumn = (c, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setCtx(null);
    const el = e?.currentTarget;
    const rect = el?.getBoundingClientRect?.();
    const x = rect ? Math.min(rect.left, (typeof window !== 'undefined' ? window.innerWidth : 800) - 320) : (e?.clientX ?? 0);
    const y = rect ? rect.bottom + 6 : (e?.clientY ?? 0);
    setSummarySettings({
      colIndex: c,
      colKey: tableColsMeta[c]?.key || `col_${c}`,
      x,
      y,
    });
  };

  const summaryTypeLabel = (colKey) => {
    const cfg = normalizeColumnSummaryConfig(summaryConfig.columns[colKey]);
    if (!cfg || cfg.type === 'none') return 'Нет';
    return SUMMARY_TYPES.find((t) => t.value === cfg.type)?.label || cfg.type;
  };

  const focusColRename = (c) => {
    requestAnimationFrame(() => {
      const el = colInputRefs.current[c];
      if (el) {
        el.focus();
        el.select();
      }
    });
  };

  const mapAfterRowDelete = (pt, deleted, nextRowCount, nextColCount) => {
    let nr = pt.r;
    if (pt.r > deleted) nr = pt.r - 1;
    else if (pt.r === deleted) nr = Math.max(0, Math.min(deleted, nextRowCount - 1));
    return {
      r: Math.max(0, Math.min(nr, nextRowCount - 1)),
      c: Math.max(0, Math.min(pt.c, nextColCount - 1)),
    };
  };

  const mapAfterColDelete = (pt, deleted, nextRowCount, nextColCount) => {
    let nc = pt.c;
    if (pt.c > deleted) nc = pt.c - 1;
    else if (pt.c === deleted) nc = Math.max(0, Math.min(deleted, nextColCount - 1));
    return {
      r: Math.max(0, Math.min(pt.r, nextRowCount - 1)),
      c: Math.max(0, Math.min(nc, nextColCount - 1)),
    };
  };

  const handleDeleteRow = (r) => {
    const next = deleteRowAt(activeSheet, r);
    if (!next) return;
    patchSheet({ rowCount: next.rowCount, cells: next.cells });
    setRange((prev) => ({
      a: mapAfterRowDelete(prev.a, r, next.rowCount, next.colCount),
      f: mapAfterRowDelete(prev.f, r, next.rowCount, next.colCount),
    }));
    queueScroll('row');
  };

  const handleDeleteCol = (c) => {
    const next = deleteColumnAt(activeSheet, c);
    if (!next) return;
    const colsAfter = gridModelToTableColumns(next);
    const withSummary = {
      rowCount: next.rowCount,
      colCount: next.colCount,
      cells: next.cells,
      columnNames: next.columnNames,
      tableColumns: colsAfter,
      summary: remapSummaryColumnsAfterColDelete(
        normalizeSummaryConfig(next.summary, tableColsMeta),
        c,
        tableColsMeta
      ),
    };
    patchSheet(withSummary);
    setRange((prev) => ({
      a: mapAfterColDelete(prev.a, c, withSummary.rowCount, withSummary.colCount),
      f: mapAfterColDelete(prev.f, c, withSummary.rowCount, withSummary.colCount),
    }));
    queueScroll('col');
  };

  const handleInsertRowAfter = (r) => {
    const next = insertRowAt(activeSheet, r + 1);
    if (!next) return;
    patchSheet({ rowCount: next.rowCount, cells: next.cells, tableColumns: next.tableColumns });
    const c0 = rangeRef.current.f.c;
    setRange({ a: { r: r + 1, c: c0 }, f: { r: r + 1, c: c0 } });
    queueScroll('row');
  };

  const handleInsertRowBefore = (r) => {
    const next = insertRowAt(activeSheet, r);
    if (!next) return;
    patchSheet({ rowCount: next.rowCount, cells: next.cells, tableColumns: next.tableColumns });
    const c0 = rangeRef.current.f.c;
    setRange({ a: { r, c: c0 }, f: { r, c: c0 } });
    queueScroll('row');
  };

  const handleInsertColAfter = (c) => {
    const next = insertColumnAt(activeSheet, c + 1);
    if (!next) return;
    patchSheet({
      rowCount: next.rowCount,
      colCount: next.colCount,
      cells: next.cells,
      columnNames: next.columnNames,
      tableColumns: next.tableColumns,
    });
    const r0 = rangeRef.current.f.r;
    setRange({ a: { r: r0, c: c + 1 }, f: { r: r0, c: c + 1 } });
    queueScroll('col');
  };

  const handleInsertColBefore = (c) => {
    const next = insertColumnAt(activeSheet, c);
    if (!next) return;
    patchSheet({
      rowCount: next.rowCount,
      colCount: next.colCount,
      cells: next.cells,
      columnNames: next.columnNames,
      tableColumns: next.tableColumns,
    });
    const r0 = rangeRef.current.f.r;
    setRange({ a: { r: r0, c }, f: { r: r0, c } });
    queueScroll('col');
  };

  useEffect(() => {
    if (!ctx) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setCtx(null);
    };
    const close = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setCtx(null);
    };
    const t = setTimeout(() => {
      document.addEventListener('mousedown', close, true);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', close, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [ctx]);

  const b = selectionBounds(range.a, range.f);
  const countRows = b.r1 - b.r0 + 1;
  const countCols = b.c1 - b.c0 + 1;
  const multi = countRows * countCols > 1;
  const focus = range.f;
  const sel = getCellState(cells, focus.r, focus.c);
  const focusColDt = normalizeColumnDataType(tableColsMeta[focus.c]?.dataType);
  const focusIsHeader = hasHeaderRow && focus.r === 0;

  const isFocusCell = (r, c) => r === focus.r && c === focus.c;

  const setRangeSelection = useCallback((nextRange) => {
    rangeRef.current = nextRange;
    setRange(nextRange);
  }, []);

  /* ── Excel-поведение: навигация, история, подсветка формул, автозаполнение ── */
  const dataStartRow = hasHeaderRow ? 1 : 0;
  const cellInputRefs = useRef({});
  const [editingCell, setEditingCell] = useState(null);
  const editingCellRef = useRef(null);
  editingCellRef.current = editingCell;
  const [barFocused, setBarFocused] = useState(false);
  const history = useGridHistory(modelProp, onChange || null);
  const focusAfterSelectRef = useRef(false);
  const skipFocusResetRef = useRef(false);

  const selectCellKb = useCallback((r, c, { extend = false } = {}) => {
    const next = extend ? { a: rangeRef.current.a, f: { r, c } } : { a: { r, c }, f: { r, c } };
    focusAfterSelectRef.current = true;
    skipFocusResetRef.current = extend;
    setRangeSelection(next);
  }, [setRangeSelection]);

  useEffect(() => {
    if (!focusAfterSelectRef.current) return;
    focusAfterSelectRef.current = false;
    cellInputRefs.current[cellKey(focus.r, focus.c)]?.focus();
  }, [focus.r, focus.c]);

  const moveSelection = useCallback((dir, { extend = false } = {}) => {
    const f = rangeRef.current.f;
    let { r, c } = f;
    if (dir === 'up') r = Math.max(dataStartRow, r - 1);
    else if (dir === 'down') r = Math.min(rowCount - 1, r + 1);
    else if (dir === 'left') c = Math.max(0, c - 1);
    else c = Math.min(colCount - 1, c + 1);
    if (r === f.r && c === f.c) return;
    selectCellKb(r, c, { extend });
  }, [dataStartRow, rowCount, colCount, selectCellKb]);

  const applyCellsToSheet = useCallback((nextCells) => {
    if (!onChange) return;
    history.breakGroup();
    emitWorkbook(patchWorkbookActiveSheet(workbookRef.current, { cells: nextCells }));
  }, [onChange, history, emitWorkbook]);

  const patchCellRef = useRef(patchCell);
  patchCellRef.current = patchCell;
  const picking = useFormulaCellPicking({
    readOnly: !onChange,
    getEditor: () => {
      const ed = editingCellRef.current;
      if (!ed) return null;
      const input = cellInputRefs.current[cellKey(ed.r, ed.c)];
      return input ? { r: ed.r, c: ed.c, input } : null;
    },
    applyValue: (r, c, v) => patchCellRef.current(r, c, { value: v }),
  });

  const handleCellMouseDown = useCallback((r, c, e) => {
    if (e.button !== 0) return;
    if (picking.handlePointerDown(r, c, e)) return;
    if (e.shiftKey) {
      e.preventDefault();
      setRange((prev) => ({ ...prev, f: { r, c } }));
    }
  }, [picking]);

  const resolveCellFromPoint = useCallback((x, y) => {
    const td = document.elementFromPoint(x, y)?.closest?.('td[data-grid-r][data-grid-c]');
    if (!td || !scrollRef.current?.contains(td)) return null;
    return {
      r: Math.max(dataStartRow, Math.min(rowCount - 1, Number(td.dataset.gridR))),
      c: Math.max(0, Math.min(colCount - 1, Number(td.dataset.gridC))),
    };
  }, [dataStartRow, rowCount, colCount]);

  const { startFillDrag, fillPreview } = useFillHandleDrag({
    resolveCell: resolveCellFromPoint,
    getSource: () => selectionBounds(rangeRef.current.a, rangeRef.current.f),
    onFill: (source, target) => {
      applyCellsToSheet(fillCells(modelRef.current.cells || {}, source, target));
      setRangeSelection({ a: { r: target.r0, c: target.c0 }, f: { r: target.r1, c: target.c1 } });
    },
  });

  const hotkeyApiRef = useRef(null);
  hotkeyApiRef.current = {
    getBounds: () => selectionBounds(rangeRef.current.a, rangeRef.current.f),
    getFocus: () => rangeRef.current.f,
    select: (r, c, opts) => selectCellKb(r, c, opts),
    focusEditor: (r, c) => {
      const el = cellInputRefs.current[cellKey(r, c)];
      if (!el) return;
      el.focus();
      const len = String(el.value ?? '').length;
      el.setSelectionRange?.(len, len);
    },
    getCells: () => modelRef.current.cells || {},
    applyCells: applyCellsToSheet,
    undo: history.undo,
    redo: history.redo,
    copyTsv: (text) => navigator.clipboard?.writeText?.(text).catch(() => {}),
    limits: { rowStart: dataStartRow, rowEnd: rowCount - 1, colEnd: colCount - 1 },
  };

  // Подсветка диапазонов формулы, которую правят в ячейке или в строке формулы.
  const editingRaw = editingCell ? String(getCellState(cells, editingCell.r, editingCell.c).value ?? '') : '';
  const barRaw = String(getCellState(cells, focus.r, focus.c).value ?? '');
  const highlightText = barFocused && barRaw.trimStart().startsWith('=')
    ? barRaw
    : (editingCell && editingRaw.trimStart().startsWith('=') ? editingRaw : '');
  const highlightRow = barFocused ? focus.r : editingCell?.r ?? 0;
  const formulaMarks = useMemo(
    () => (highlightText
      ? buildFormulaRangeMarks(highlightText, { row: highlightRow, rowCount, colCount })
      : null),
    [highlightText, highlightRow, rowCount, colCount],
  );

  const selectColumn = useCallback((c) => {
    setRangeSelection(spreadsheetColumnSelection(c, { rowCount, dataStart: 0 }));
  }, [rowCount, setRangeSelection]);

  const selectRow = useCallback((r) => {
    setRangeSelection(spreadsheetRowSelection(r, { colCount }));
  }, [colCount, setRangeSelection]);

  const selectAllCells = useCallback(() => {
    setRangeSelection(spreadsheetAllSelection({ rowCount, colCount, dataStart: 0 }));
  }, [rowCount, colCount, setRangeSelection]);

  const handleColHeadDoubleClick = useCallback((c, e) => {
    const tag = e.target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'option' || tag === 'button') return;
    e.preventDefault();
    selectColumn(c);
  }, [selectColumn]);

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (!t || !t.closest || !t.closest('[data-spreadsheet-grid]')) return;
      if (t.closest('[data-spreadsheet-ctx]')) return;

      if ((e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        selectAllCells();
        return;
      }

      // Ctrl+Z/Y, Ctrl+X, Ctrl+D/R, F2, Ctrl+стрелки, Enter/Tab — как в Excel.
      if (hotkeyApiRef.current && handleGridHotkey(e, hotkeyApiRef.current)) return;

      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (!rangeRef.current) return;
        const r0 = rangeRef.current;
        const bb = selectionBounds(r0.a, r0.f);
        const w = bb.r1 - bb.r0 + 1;
        const h = bb.c1 - bb.c0 + 1;
        if (w * h <= 1) return;
        e.preventDefault();
        e.stopPropagation();
        const m = modelRef.current;
        const wb = workbookRef.current;
        const c = m.cells || {};
        let next = { ...c };
        for (let r = bb.r0; r <= bb.r1; r += 1) {
          for (let col = bb.c0; col <= bb.c1; col += 1) {
            const k = cellKey(r, col);
            const prev = getCellState(c, r, col);
            next = { ...next, [k]: { ...prev, value: '' } };
          }
        }
        emitWorkbook(patchWorkbookActiveSheet(wb, { cells: next }));
        return;
      }

      if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        const r0 = rangeRef.current;
        const bb = selectionBounds(r0.a, r0.f);
        const lines = [];
        const cm = modelRef.current.cells || {};
        for (let r = bb.r0; r <= bb.r1; r += 1) {
          const row = [];
          for (let col = bb.c0; col <= bb.c1; col += 1) {
            const v = getCellState(cm, r, col).value ?? '';
            const s0 = String(v).replace(/\r\n/g, '\n').replace(/\n/g, ' ').replace(/\t/g, ' ');
            row.push(s0);
          }
          lines.push(row.join('\t'));
        }
        const payload = lines.join('\n');
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(payload).catch(() => {});
        }
        return;
      }

      if ((e.key === 'v' || e.key === 'V') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard.readText().then((text) => {
            const m = modelRef.current;
            const wb = workbookRef.current;
            const c = m.cells || {};
            const r0 = rangeRef.current;
            const targetBounds = selectionBounds(r0.a, r0.f);
            const rows = parseTsvToRows(text);
            if (rows.length === 0) return;
            const next = applyParsedPasteToCells(c, rows, targetBounds, {
              rowCount: m.rowCount,
              colCount: m.colCount,
              dataStart: 0,
            });
            emitWorkbook(patchWorkbookActiveSheet(wb, { cells: next }));
          }).catch(() => {});
        }
        return;
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [emitWorkbook, setRangeSelection, selectAllCells]);

  const bodyRowCount = hasHeaderRow ? rowCount - 1 : rowCount;

  return (
    <div className={s.root}>
      <SpreadsheetSheetTabs
        sheets={workbook.sheets}
        activeSheetId={workbook.activeSheetId}
        maxSheets={SPREADSHEET_MAX_SHEETS}
        onSelect={setActiveSheetId}
        onAdd={() => emitWorkbook(addSheetToWorkbook(workbook, colCount, rowCount))}
        onRename={(id, name) => emitWorkbook(renameSheetInWorkbook(workbook, id, name))}
        onDelete={(id) => emitWorkbook(deleteSheetFromWorkbook(workbook, id))}
      />
      <div className={s.toolbar} data-spreadsheet-toolbar>
        <label className={s.toolbarLabelCheck}>
          <input
            type="checkbox"
            checked={!!hasHeaderRow}
            onChange={(e) => patchSheet({ hasHeaderRow: e.target.checked })}
          />
          Первая строка — заголовки столбцов
        </label>
        <span className={s.toolbarLabel}>Размер:</span>
        <button type="button" className={s.toolbarBtn} onClick={() => setDim(rowCount + 1, colCount)}>
          + строка
        </button>
        <button
          type="button"
          className={s.toolbarBtn}
          onClick={() => setDim(rowCount - 1, colCount)}
          disabled={rowCount <= SPREADSHEET_MIN_DIM}
        >
          − строка
        </button>
        <button type="button" className={s.toolbarBtn} onClick={() => setDim(rowCount, colCount + 1)}>
          + столбец
        </button>
        <button
          type="button"
          className={s.toolbarBtn}
          onClick={() => setDim(rowCount, colCount - 1)}
          disabled={colCount <= SPREADSHEET_MIN_DIM}
        >
          − столбец
        </button>
        <span className={s.toolbarLabel} style={{ marginLeft: '0.5rem' }} aria-hidden>|</span>
        <label className={s.toolbarLabelCheck}>
          <input
            type="checkbox"
            checked={summaryEnabled}
            onChange={(e) => {
              const next = setSummaryEnabled(activeSheet, e.target.checked, tableColsMeta);
              patchSheet({ summary: next.summary });
            }}
          />
          Включить итоговую строку
        </label>
      </div>
      <SpreadsheetFormulaBar
        selected={focus}
        value={getCellState(cells, focus.r, focus.c).value ?? ''}
        model={activeSheet}
        tableColumns={tableColsMeta}
        workbook={workbook}
        sheetName={activeSheet?.name}
        resultPreview={formulaDisplay[cellKey(focus.r, focus.c)]}
        onChange={(v) => patchCell(focus.r, focus.c, { value: v })}
        onFocus={() => setBarFocused(true)}
        onBlur={() => setBarFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.defaultPrevented) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
      <div className={s.toolbar2} data-spreadsheet-toolbar>
        <span className={s.toolbarLabel}>
          {multi
            ? `Выделение ${refToString(b.r0, b.c0)}:${refToString(b.r1, b.c1)} (${countRows}×${countCols}) · формат ячейки ${refToString(focus.r, focus.c)}:`
            : `Ячейка ${refToString(focus.r, focus.c)}:`}
        </span>
        {focusIsHeader ? (
          <span className={s.toolbarLabel}>Заголовок (текст)</span>
        ) : focusColDt !== 'string' && !multi ? (
          <span className={s.toolbarLabel}>
            Тип колонки:{' '}
            {COLUMN_DATA_TYPES.find((t) => t.value === focusColDt)?.label || focusColDt}
          </span>
        ) : focusColDt !== 'string' && multi ? (
          <label className={s.toolbarLabel}>
            Тип колонки:{' '}
            <select
              className={s.fieldSelect}
              value={focusColDt}
              onChange={(e) => applyColumnDataType(e.target.value)}
              aria-label="Тип данных выделенных столбцов"
            >
              {COLUMN_DATA_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <select
            className={s.fieldSelect}
            value={sel.displayType || 'text'}
            onChange={(e) => applyCellFormat({ displayType: e.target.value })}
            aria-label="Тип ячейки"
          >
            {CELL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className={`${s.toolbarBtn} ${sel.bold ? s.toolbarBtnActive : ''}`}
          onClick={() => applyCellFormat({ bold: !sel.bold })}
          title="Жирный"
        >
          B
        </button>
        <button
          type="button"
          className={`${s.toolbarBtn} ${sel.italic ? s.toolbarBtnActive : ''}`}
          onClick={() => applyCellFormat({ italic: !sel.italic })}
          title="Курсив"
        >
          I
        </button>
        <span className={s.toolbarLabel}>Выравнивание:</span>
        {['left', 'center', 'right'].map((al) => {
          const AlignIcon = ALIGN_ICONS[al];
          return (
          <button
            key={al}
            type="button"
            className={`${s.toolbarBtn} ${sel.align === al ? s.toolbarBtnActive : ''}`}
            onClick={() => applyCellFormat({ align: al })}
          >
            <AlignIcon size={14} />
          </button>
          );
        })}
      </div>
      <div className={s.scroll} data-spreadsheet-grid ref={scrollRef}>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.corner} aria-hidden />
              {Array.from({ length: colCount }, (_, c) => {
                const headVal = hasHeaderRow
                  ? getCellState(cells, 0, c).value ?? ''
                  : columnNames[c] ?? '';
                const headInRange = hasHeaderRow && b.r0 <= 0 && b.r1 >= 0 && c >= b.c0 && c <= b.c1;
                const colSelected = c >= b.c0 && c <= b.c1 && b.r0 <= 0 && b.r1 >= rowCount - 1;
                const headFocus = hasHeaderRow && isFocusCell(0, c);
                return (
                  <th
                    key={c}
                    className={`${s.colHead} ${headInRange || colSelected ? styles.spreadsheetCellInRange : ''} ${
                      headFocus ? styles.spreadsheetCellSelected : ''
                    }`.trim()}
                    onContextMenu={(e) => openColMenu(e, c)}
                    onDoubleClick={(e) => handleColHeadDoubleClick(c, e)}
                    title="Двойной клик — выделить столбец"
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      if (hasHeaderRow && e.shiftKey) {
                        e.preventDefault();
                        setRange((prev) => ({ ...prev, f: { r: 0, c } }));
                      }
                    }}
                  >
                    <div className={s.colHeadInner}>
                      <input
                        ref={(el) => {
                          colInputRefs.current[c] = el;
                        }}
                        className={s.colNameInput}
                        type="text"
                        value={headVal}
                        onChange={(e) => {
                          if (hasHeaderRow) patchCell(0, c, { value: e.target.value });
                          else {
                            const n = padColumnNames(activeSheet.columnNames, colCount);
                            n[c] = e.target.value;
                            patchSheet({ columnNames: n });
                          }
                        }}
                        onFocus={() => {
                          if (hasHeaderRow) setRange({ a: { r: 0, c }, f: { r: 0, c } });
                        }}
                        placeholder={hasHeaderRow ? `Заголовок – столбец ${excelColumnLabel(c)}` : `Имя столбца ${excelColumnLabel(c)}`}
                        aria-label={hasHeaderRow ? `Заголовок столбца ${excelColumnLabel(c)}` : `Название столбца ${excelColumnLabel(c)}`}
                      />
                      <div className={s.colLetter}>{excelColumnLabel(c)}</div>
                      <select
                        className={s.colTypeSelect}
                        value={normalizeColumnDataType(tableColsMeta[c]?.dataType)}
                        onChange={(e) => patchColumnDataType(c, e.target.value)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Тип данных столбца ${excelColumnLabel(c)}`}
                      >
                        {COLUMN_DATA_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <SpreadsheetColumnDefaultInput
                        dataType={tableColsMeta[c]?.dataType}
                        value={tableColsMeta[c]?.defaultValue ?? ''}
                        onChange={(v) => patchColumnDefaultValue(c, v)}
                        columnLabel={excelColumnLabel(c)}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: bodyRowCount }, (_, i) => {
              const r = hasHeaderRow ? i + 1 : i;
              return (
                <tr key={r}>
                  <th
                    className={`${styles.spreadsheetRowHead} ${s.rowHeadCtx} ${
                      r >= b.r0 && r <= b.r1 && b.c0 <= 0 && b.c1 >= colCount - 1 ? styles.spreadsheetCellInRange : ''
                    }`.trim()}
                    onContextMenu={(e) => openRowMenu(e, r)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      selectRow(r);
                    }}
                    title="Двойной клик — выделить строку"
                  >
                    {/* Номер строки как в формулах (A2 = первая строка данных под заголовками). */}
                    {r + 1}
                  </th>
                  {Array.from({ length: colCount }, (_, c) => {
                    const meta = getCellState(cells, r, c);
                    const k = cellKey(r, c);
                    const stored = meta.value ?? '';
                    const effective = getEffectiveCellValue(cells, r, c, tableColsMeta, hasHeaderRow);
                    const inR = r >= b.r0 && r <= b.r1 && c >= b.c0 && c <= b.c1;
                    const fcs = isFocusCell(r, c);
                    const refMark = formulaMarks?.get(k);
                    const inFillPreview = isInFillPreview(fillPreview, b, r, c);
                    const isFillCorner = !!onChange && r === b.r1 && c === b.c1 && r >= dataStartRow;
                    return (
                      <td
                        key={c}
                        data-grid-r={r}
                        data-grid-c={c}
                        className={`${styles.spreadsheetCell} ${fh.cellHost} ${inR ? styles.spreadsheetCellInRange : ''} ${
                          fcs ? styles.spreadsheetCellSelected : ''
                        } ${inFillPreview ? fh.fillPreviewCell : ''}`.trim()}
                        onMouseDown={(e) => handleCellMouseDown(r, c, e)}
                        onMouseEnter={() => picking.handlePointerEnter(r, c)}
                        role="gridcell"
                        tabIndex={-1}
                      >
                        <SpreadsheetColumnCellInput
                          ref={(el) => {
                            if (el) cellInputRefs.current[k] = el;
                            else delete cellInputRefs.current[k];
                          }}
                          colDataType={tableColsMeta[c]?.dataType}
                          displayType={meta.displayType}
                          inHeader={false}
                          value={stored.trim() !== '' ? stored : effective}
                          displayValue={formulaDisplay[k]}
                          align={meta.align}
                          bold={meta.bold}
                          italic={meta.italic}
                          onChange={(v) => {
                            picking.resetPick();
                            patchCell(r, c, { value: v });
                          }}
                          onFocus={() => {
                            setEditingCell({ r, c });
                            if (skipFocusResetRef.current) {
                              skipFocusResetRef.current = false;
                              return;
                            }
                            setRange({ a: { r, c }, f: { r, c } });
                          }}
                          onBlur={() => setEditingCell((prev) => (prev && prev.r === r && prev.c === c ? null : prev))}
                          onMouseDown={(e) => handleCellMouseDown(r, c, e)}
                          onNavigate={moveSelection}
                          highlightRefs
                          className={styles.spreadsheetCellInput}
                          ariaLabel={`Ячейка ${r + 1} ${excelColumnLabel(c)}`}
                        />
                        {refMark && <span className={fh.refMark} style={refMark} aria-hidden />}
                        {isFillCorner && (
                          <span
                            className={styles.spreadsheetFillHandle}
                            role="presentation"
                            title="Тяните, чтобы заполнить ячейки (ряд чисел, даты, формулы)"
                            onMouseDown={startFillDrag}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          {summaryEnabled && summaryValues && (
            <tfoot className={s.summaryFoot}>
              <tr className={s.summaryRow}>
                <th className={s.summaryCorner} scope="row" tabIndex={0}>
                  ИТОГ
                </th>
                {Array.from({ length: colCount }, (_, c) => {
                  const colKey = tableColsMeta[c]?.key || `col_${c}`;
                  const cfg = normalizeColumnSummaryConfig(summaryConfig.columns[colKey]);
                  const configured = cfg.type !== 'none';
                  const isActive = summarySettings?.colIndex === c;
                  const colLabel =
                    (hasHeaderRow
                      ? getCellState(cells, 0, c).value
                      : columnNames[c]) || tableColsMeta[c]?.label || excelColumnLabel(c);
                  return (
                    <td
                      key={c}
                      className={`${s.summaryCell} ${s.summaryCellInteractive} ${configured ? s.summaryCellConfigured : ''} ${isActive ? s.summaryCellActive : ''}`}
                      tabIndex={0}
                      role="button"
                      aria-label={`Итог столбца ${colLabel}, тип: ${summaryTypeLabel(colKey)}. Нажмите для настройки`}
                      title={`${colLabel}: ${summaryTypeLabel(colKey)} — нажмите для настройки`}
                      onClick={(e) => openSummarySettingsForColumn(c, e)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openSummarySettingsForColumn(c, e);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openSummarySettingsForColumn(c, e);
                        }
                      }}
                    >
                      <span className={s.summaryCellValue}>{summaryValues[colKey] ?? ''}</span>
                      {configured && <span className={s.summaryCellBadge} aria-hidden>⚙</span>}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className={s.hint}>
        Памятка: стрелки, Enter / Tab — переход; Ctrl+стрелка — к краю данных (с Shift — выделение);
        F2 — правка ячейки; Ctrl+Z / Ctrl+Y — отмена и повтор; Ctrl+C / Ctrl+X / Ctrl+V — копировать, вырезать, вставить;
        Ctrl+D / Ctrl+R — заполнить вниз / вправо; Delete — очистить выделение; Ctrl+A — вся таблица.
        Маркер в углу выделения — протяните, чтобы продолжить ряд чисел, дат или скопировать формулы.
        При вводе формулы клик по ячейке вставляет ссылку, протягивание — диапазон.
        ПКМ по заголовку столбца — вставка/удаление, переименование. «По умолчанию» в шапке столбца — значение или формула для новых строк.
        Клик по итоговой строке — тип итога (сумма, среднее, формула); в документ и CSV итоговая строка не попадает.
      </p>

      {ctx && (
        <ul
          ref={menuRef}
          data-spreadsheet-ctx
          className={s.contextMenu}
          style={{
            left: Math.min(ctx.x, (typeof window !== 'undefined' ? window.innerWidth : 800) - 200),
            top: Math.min(ctx.y, (typeof window !== 'undefined' ? window.innerHeight : 600) - 8),
          }}
          role="menu"
        >
          {ctx.kind === 'col' && (
            <>
              <li>
                <button
                  type="button"
                  className={s.contextItem}
                  role="menuitem"
                  disabled={colCount >= SPREADSHEET_MAX_DIM}
                  onClick={() => {
                    if (ctx.idx != null) handleInsertColBefore(ctx.idx);
                    setCtx(null);
                  }}
                >
                  Вставить столбец слева
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={s.contextItem}
                  role="menuitem"
                  disabled={colCount >= SPREADSHEET_MAX_DIM}
                  onClick={() => {
                    if (ctx.idx != null) handleInsertColAfter(ctx.idx);
                    setCtx(null);
                  }}
                >
                  Вставить столбец справа
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={s.contextItem}
                  role="menuitem"
                  onClick={() => {
                    focusColRename(ctx.idx);
                    setCtx(null);
                  }}
                >
                  Переименовать столбец
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={s.contextItem}
                  role="menuitem"
                  onClick={() => {
                    const idx = ctx.idx;
                    setCtx(null);
                    if (idx == null) return;
                    openSummarySettingsForColumn(idx, { clientX: ctx.x, clientY: ctx.y });
                  }}
                >
                  Настроить итог
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`${s.contextItem} ${s.contextItemDanger}`}
                  role="menuitem"
                  disabled={colCount <= SPREADSHEET_MIN_DIM}
                  onClick={() => {
                    if (ctx.idx != null) handleDeleteCol(ctx.idx);
                    setCtx(null);
                  }}
                >
                  Удалить столбец
                </button>
              </li>
            </>
          )}
          {ctx.kind === 'row' && (
            <>
              <li>
                <button
                  type="button"
                  className={s.contextItem}
                  role="menuitem"
                  disabled={rowCount >= SPREADSHEET_MAX_DIM}
                  onClick={() => {
                    if (ctx.idx != null) handleInsertRowBefore(ctx.idx);
                    setCtx(null);
                  }}
                >
                  Вставить строку выше
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={s.contextItem}
                  role="menuitem"
                  disabled={rowCount >= SPREADSHEET_MAX_DIM}
                  onClick={() => {
                    if (ctx.idx != null) handleInsertRowAfter(ctx.idx);
                    setCtx(null);
                  }}
                >
                  Вставить строку ниже
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`${s.contextItem} ${s.contextItemDanger}`}
                  role="menuitem"
                  disabled={rowCount <= SPREADSHEET_MIN_DIM}
                  onClick={() => {
                    if (ctx.idx != null) handleDeleteRow(ctx.idx);
                    setCtx(null);
                  }}
                >
                  Удалить строку
                </button>
              </li>
            </>
          )}
        </ul>
      )}

      <SpreadsheetSummarySettings
        open={!!summarySettings}
        colIndex={summarySettings?.colIndex}
        colKey={summarySettings?.colKey}
        colLabel={
          summarySettings?.colIndex != null
            ? (hasHeaderRow
              ? getCellState(cells, 0, summarySettings.colIndex).value
              : columnNames[summarySettings.colIndex]) || tableColsMeta[summarySettings.colIndex]?.label
            : ''
        }
        model={activeSheet}
        anchor={summarySettings ? { x: summarySettings.x, y: summarySettings.y } : null}
        onApply={(colKey, draft) => {
          const next = patchSummaryColumn(activeSheet, colKey, draft, tableColsMeta);
          patchSheet({ summary: next.summary });
        }}
        onClose={() => setSummarySettings(null)}
      />
    </div>
  );
};

export default SpreadsheetTemplatePanel;
