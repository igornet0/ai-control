import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  cellKey,
  getCellState,
  CELL_TYPES,
  COLUMN_DATA_TYPES,
  excelColumnLabel,
  deleteRowAt,
  insertRowAt,
  fillColumnDownFromCell,
  findFillDownEndRow,
  mergeSpreadsheetSheetWithDataRows,
  mergedModelToDataRows,
  normalizeColumnDataType,
  validateCellValueForColumnType,
  cellInlineStyle,
  SPREADSHEET_BLOCK_TYPE,
  SPREADSHEET_MIN_DIM,
  SPREADSHEET_MAX_DIM,
  selectionBounds,
  spreadsheetColumnSelection,
  spreadsheetRowSelection,
  spreadsheetAllSelection,
  parseTsvToRows,
  applyParsedPasteToCells,
  normalizeSpreadsheetBlock,
  normalizeSpreadsheetSheets,
  normalizeSpreadsheetFieldValue,
  serializeSpreadsheetFieldValue,
  blockFragmentForSheet,
  getEffectiveCellValue,
} from './spreadsheetGridUtils';
import SpreadsheetColumnCellInput from './SpreadsheetColumnCellInput';
import SpreadsheetSheetTabs from './SpreadsheetSheetTabs';
import SpreadsheetFormulaBar from './SpreadsheetFormulaBar';
import { computeSummaryRow, normalizeSummaryConfig } from './spreadsheetSummary';
import {
  computeFormulaDisplayMap,
  evaluateCellFormula,
  formatFormulaNumber,
  formatSheetCellRef,
  formatSheetRangeRef,
  isCellFormula,
} from './spreadsheetCellFormula';
import { ALIGN_ICONS, IconWrapText } from './DocumentIcons';
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

const WRAP_TEXT_STORAGE_KEY = 'aicontrol.spreadsheet.wrapText';

function readWrapTextPreference() {
  try {
    return localStorage.getItem(WRAP_TEXT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function insertTextAtCaret(value, caretStart, caretEnd, insert) {
  const raw = String(value ?? '');
  const start = Math.max(0, Math.min(caretStart ?? raw.length, raw.length));
  const end = Math.max(start, Math.min(caretEnd ?? start, raw.length));
  let base = raw;
  let s = start;
  let e = end;
  if (!base.startsWith('=')) {
    base = `=${base}`;
    s += 1;
    e += 1;
  }
  return {
    value: `${base.slice(0, s)}${insert}${base.slice(e)}`,
    caret: s + String(insert).length,
  };
}

function blockIdentityKey(b, sheetId) {
  if (!b || b.type !== SPREADSHEET_BLOCK_TYPE) return '';
  const sheet = normalizeSpreadsheetSheets(b).find((s) => s.id === sheetId);
  if (!sheet) return '';
  return JSON.stringify({
    field: b.field_name,
    sheet: sheetId,
    r: sheet.rowCount,
    c: sheet.colCount,
    hdr: !!sheet.hasHeaderRow,
    tc: sheet.tableColumns,
  });
}

/**
 * Редактирование документа по блоку spreadsheet: сетка + синхронизация с field_data (много листов).
 */
const SpreadsheetDocumentGrid = ({ block, value, onChange, readOnly = false }) => {
  const normalizedBlock = useMemo(() => normalizeSpreadsheetBlock(block), [block]);
  const sheets = normalizedBlock.sheets || [];
  const [activeSheetId, setActiveSheetId] = useState(sheets[0]?.id);
  const [wrapText, setWrapText] = useState(readWrapTextPreference);

  useEffect(() => {
    if (!sheets.length) return;
    if (!sheets.some((s) => s.id === activeSheetId)) {
      setActiveSheetId(sheets[0].id);
    }
  }, [sheets, activeSheetId]);

  const activeSheet = sheets.find((s) => s.id === activeSheetId) || sheets[0];
  const sheetBlock = useMemo(
    () => blockFragmentForSheet(normalizedBlock, activeSheet),
    [normalizedBlock, activeSheet],
  );
  const sheetDataMap = useMemo(
    () => normalizeSpreadsheetFieldValue(value, sheets),
    [value, sheets],
  );
  const rows = sheetDataMap[activeSheet?.id] || [];
  const [selected, setSelected] = useState({ r: 0, c: 0 });
  const [range, setRange] = useState({ a: { r: 0, c: 0 }, f: { r: 0, c: 0 } });
  /** Диапазон в буфере копирования — подсвечивается до вставки (как в Excel). */
  const [copiedRange, setCopiedRange] = useState(null);
  const [cellErr, setCellErr] = useState(() => ({}));
  const [ctx, setCtx] = useState(null);
  const menuRef = useRef(null);
  const cellRefs = useRef({});
  const gridRef = useRef(null);
  const formulaInputRef = useRef(null);
  /** Сессия правки формулы: переживает смену листа для вставки Лист2!A1 */
  const [formulaSession, setFormulaSession] = useState(null);
  const formulaSessionRef = useRef(null);
  formulaSessionRef.current = formulaSession;
  const suppressFormulaBlurRef = useRef(false);
  /** Активный pick диапазона для формулы: { anchor:{r,c}, start, end } индексы в draft */
  const formulaPickRef = useRef(null);
  const formulaPickDraggingRef = useRef(false);
  const rangeRef = useRef(range);
  const hotkeyApiRef = useRef(null);
  const selectedRef = useRef(selected);
  const modelRef = useRef(null);
  const extendSelectionRef = useRef(false);
  const blockKeyRef = useRef(null);
  const sheetDataMapRef = useRef(sheetDataMap);
  sheetDataMapRef.current = sheetDataMap;
  const sheetsRef = useRef(sheets);
  sheetsRef.current = sheets;
  const activeSheetIdRef = useRef(activeSheetId);
  activeSheetIdRef.current = activeSheetId;
  /** field_data — только значения; совпадение с последним onChange = своё обновление, нельзя сбрасывать cells (B, I, выравнивание, type). */
  const lastEmittedDataJson = useRef(null);
  const [model, setModel] = useState(() => mergeSpreadsheetSheetWithDataRows(sheetBlock, rows));
  /** Ячейка, в поле которой сейчас фокус (правка значения или формулы). */
  const [editingCell, setEditingCell] = useState(null);
  const editingCellRef = useRef(null);
  editingCellRef.current = editingCell;
  const history = useGridHistory(value, readOnly ? null : onChange);

  const emitSheetRows = useCallback((nextRows) => {
    if (readOnly || !onChange) return;
    const sid = activeSheetIdRef.current;
    const nextMap = { ...sheetDataMapRef.current, [sid]: nextRows };
    const serialized = serializeSpreadsheetFieldValue(nextMap, sheetsRef.current);
    lastEmittedDataJson.current = JSON.stringify(serialized);
    onChange(serialized);
  }, [onChange, readOnly]);

  const emitSheetRowsForId = useCallback((sheetId, nextRows) => {
    if (readOnly || !onChange || !sheetId) return;
    const nextMap = { ...sheetDataMapRef.current, [sheetId]: nextRows };
    const serialized = serializeSpreadsheetFieldValue(nextMap, sheetsRef.current);
    lastEmittedDataJson.current = JSON.stringify(serialized);
    onChange(serialized);
  }, [onChange, readOnly]);

  const patchValueOnSheet = useCallback((sheetId, r, c, value) => {
    if (readOnly || !sheetId) return;
    const sheetList = sheetsRef.current || [];
    const sheet = sheetList.find((s) => s.id === sheetId);
    if (!sheet) return;
    const frag = blockFragmentForSheet(normalizedBlock, sheet);
    const dataRows = sheetDataMapRef.current[sheetId] || [];
    const merged = mergeSpreadsheetSheetWithDataRows(frag, dataRows);
    const prev = getCellState(merged.cells || {}, r, c);
    const nextCells = {
      ...(merged.cells || {}),
      [cellKey(r, c)]: { ...prev, value },
    };
    const nextRows = mergedModelToDataRows(frag, nextCells, {
      rowCount: merged.rowCount,
      colCount: merged.colCount,
    });
    emitSheetRowsForId(sheetId, nextRows);
    if (sheetId === activeSheetIdRef.current) {
      setModel({ ...merged, cells: nextCells });
    }
  }, [readOnly, normalizedBlock, emitSheetRowsForId]);

  useEffect(() => {
    setSelected({ r: sheetBlock.hasHeaderRow ? 1 : 0, c: 0 });
    setRange({ a: { r: sheetBlock.hasHeaderRow ? 1 : 0, c: 0 }, f: { r: sheetBlock.hasHeaderRow ? 1 : 0, c: 0 } });
    setCopiedRange(null);
    setCellErr({});
  }, [activeSheetId, sheetBlock.hasHeaderRow]);

  useEffect(() => {
    const valueRows = Array.isArray(rows) ? rows : [];
    const j = JSON.stringify(serializeSpreadsheetFieldValue(
      { ...sheetDataMap, [activeSheet?.id]: valueRows },
      sheets,
    ));
    const nextKey = blockIdentityKey(normalizedBlock, activeSheetId);
    if (nextKey !== blockKeyRef.current) {
      blockKeyRef.current = nextKey;
      setModel(mergeSpreadsheetSheetWithDataRows(sheetBlock, valueRows));
      lastEmittedDataJson.current = j;
      return;
    }
    if (lastEmittedDataJson.current !== null && j === lastEmittedDataJson.current) {
      return;
    }
    setModel(mergeSpreadsheetSheetWithDataRows(sheetBlock, valueRows));
    lastEmittedDataJson.current = j;
  }, [normalizedBlock, sheetBlock, rows, sheetDataMap, sheets, activeSheet?.id, activeSheetId]);

  const valueRowCount = Array.isArray(rows) ? rows.length : 0;
  useEffect(() => {
    setCellErr({});
    setCopiedRange(null);
  }, [valueRowCount, activeSheetId, sheetBlock]);

  const { rowCount, colCount, hasHeaderRow, cells = {}, tableColumns = [] } = model;
  const dataStart = hasHeaderRow ? 1 : 0;
  const bodyRowCount = hasHeaderRow ? rowCount - 1 : rowCount;
  rangeRef.current = range;
  selectedRef.current = selected;
  modelRef.current = model;

  useEffect(() => {
    if (hasHeaderRow && selected.r < dataStart) {
      const next = { r: dataStart, c: selected.c };
      setSelected(next);
      setRange({ a: next, f: next });
    }
  }, [hasHeaderRow, dataStart, selected.r, selected.c]);

  useEffect(() => {
    setRange((prev) => {
      const clamp = (pt) => ({
        r: Math.max(dataStart, Math.min(rowCount - 1, pt.r)),
        c: Math.max(0, Math.min(colCount - 1, pt.c)),
      });
      const a = clamp(prev.a);
      const f = clamp(prev.f);
      if (a.r === prev.a.r && a.c === prev.a.c && f.r === prev.f.r && f.c === prev.f.c) return prev;
      return { a, f };
    });
    setCopiedRange((prev) => {
      if (!prev) return prev;
      const clamp = (pt) => ({
        r: Math.max(dataStart, Math.min(rowCount - 1, pt.r)),
        c: Math.max(0, Math.min(colCount - 1, pt.c)),
      });
      const a = clamp(prev.a);
      const f = clamp(prev.f);
      if (a.r === prev.a.r && a.c === prev.a.c && f.r === prev.f.r && f.c === prev.f.c) return prev;
      return { a, f };
    });
  }, [dataStart, rowCount, colCount]);

  const moveSelection = useCallback((direction, { extend = false } = {}) => {
    const { r, c } = selected;
    let nr = r;
    let nc = c;
    if (direction === 'up') nr = Math.max(dataStart, r - 1);
    else if (direction === 'down') nr = Math.min(rowCount - 1, r + 1);
    else if (direction === 'left') nc = Math.max(0, c - 1);
    else if (direction === 'right') nc = Math.min(colCount - 1, c + 1);
    if (nr === r && nc === c) return;
    if (extend) {
      const anchor = rangeRef.current.a;
      const nextRange = { a: anchor, f: { r: nr, c: nc } };
      rangeRef.current = nextRange;
      setSelected({ r: nr, c: nc });
      setRange(nextRange);
      return;
    }
    setSelected({ r: nr, c: nc });
    setRange({ a: { r: nr, c: nc }, f: { r: nr, c: nc } });
    rangeRef.current = { a: { r: nr, c: nc }, f: { r: nr, c: nc } };
  }, [selected, dataStart, rowCount, colCount]);

  useEffect(() => {
    // Не перехватывать фокус у строки формулы (иначе сброс при смене листа)
    if (formulaSessionRef.current) return;
    const el = cellRefs.current[cellKey(selected.r, selected.c)];
    el?.focus({ preventScroll: true });
  }, [selected.r, selected.c]);

  useEffect(() => {
    if (!formulaSessionRef.current) return undefined;
    const id = window.requestAnimationFrame(() => {
      formulaInputRef.current?.focus?.();
    });
    return () => window.cancelAnimationFrame(id);
  }, [activeSheetId]);

  const setSingleSelection = useCallback((r, c) => {
    const next = { a: { r, c }, f: { r, c } };
    rangeRef.current = next;
    setSelected({ r, c });
    setRange(next);
  }, []);

  const extendSelectionTo = useCallback((r, c) => {
    extendSelectionRef.current = true;
    const anchor = rangeRef.current.a;
    const next = { a: anchor, f: { r, c } };
    rangeRef.current = next;
    setSelected({ r, c });
    setRange(next);
  }, []);

  const workbook = useMemo(
    () => ({ sheets, activeSheetId }),
    [sheets, activeSheetId],
  );

  const handleCellPointerDown = useCallback((r, c, e) => {
    if (e.button !== 0) return;
    if (e.shiftKey) {
      e.preventDefault();
      extendSelectionTo(r, c);
      return;
    }
    extendSelectionRef.current = false;
    setSingleSelection(r, c);
  }, [extendSelectionTo, setSingleSelection]);

  const setRangeSelection = useCallback((nextRange) => {
    rangeRef.current = nextRange;
    setRange(nextRange);
    setSelected({ r: nextRange.f.r, c: nextRange.f.c });
    extendSelectionRef.current = false;
  }, []);

  const selectColumn = useCallback((c) => {
    setRangeSelection(spreadsheetColumnSelection(c, { rowCount, dataStart }));
  }, [rowCount, dataStart, setRangeSelection]);

  const selectRow = useCallback((r) => {
    setRangeSelection(spreadsheetRowSelection(r, { colCount }));
  }, [colCount, setRangeSelection]);

  const selectAllCells = useCallback(() => {
    setRangeSelection(spreadsheetAllSelection({ rowCount, colCount, dataStart }));
  }, [rowCount, colCount, dataStart, setRangeSelection]);

  const focusCell = useCallback((r, c) => {
    if (extendSelectionRef.current) {
      extendSelectionRef.current = false;
      setSelected({ r, c });
      return;
    }
    setSelected({ r, c });
    setRange((prev) => {
      const bb = selectionBounds(prev.a, prev.f);
      const multi = (bb.r1 - bb.r0 + 1) * (bb.c1 - bb.c0 + 1) > 1;
      if (multi && r >= bb.r0 && r <= bb.r1 && c >= bb.c0 && c <= bb.c1) {
        return prev;
      }
      const next = { a: { r, c }, f: { r, c } };
      rangeRef.current = next;
      return next;
    });
  }, []);

  const summaryModel = useMemo(
    () => ({ ...model, summary: normalizeSummaryConfig(activeSheet.summary, tableColumns) }),
    [model, activeSheet.summary, tableColumns]
  );
  const summaryValues = useMemo(
    () => computeSummaryRow(summaryModel, workbook),
    [summaryModel, workbook]
  );
  const summaryEnabled = !!normalizeSummaryConfig(activeSheet.summary, tableColumns).enabled;

  const formulaDisplay = useMemo(
    () => computeFormulaDisplayMap(model, tableColumns, workbook),
    [model, tableColumns, workbook]
  );

  const applyModel = useCallback(
    (next) => {
      if (!next || readOnly) return;
      setModel(next);
      const dataRows = mergedModelToDataRows(sheetBlock, next.cells, { rowCount: next.rowCount, colCount: next.colCount });
      emitSheetRows(dataRows);
    },
    [sheetBlock, emitSheetRows, readOnly]
  );

  const emitRows = useCallback(
    (nextCells, dimPatch = {}) => {
      const next = { ...model, ...dimPatch, cells: nextCells };
      applyModel(next);
    },
    [model, applyModel]
  );

  const runCellValidation = useCallback(
    (r, c, valueStr) => {
      if (c < 0 || c >= colCount || r < dataStart) {
        return { ok: true };
      }
      const dt = normalizeColumnDataType(tableColumns[c]?.dataType);
      if (isCellFormula(valueStr)) {
        const n = evaluateCellFormula(valueStr, model, r, c, tableColumns, new Set(), workbook);
        if (n == null) return { ok: false, message: 'Неверная формула' };
        if (typeof n === 'string') return validateCellValueForColumnType(n, dt);
        return validateCellValueForColumnType(formatFormulaNumber(n), dt);
      }
      return validateCellValueForColumnType(valueStr, dt);
    },
    [tableColumns, colCount, dataStart, model, workbook]
  );

  const patchCell = useCallback(
    (r, c, patch) => {
      if (readOnly) return;
      const k = cellKey(r, c);
      const prev = cells[k] || {};
      const merged = { ...prev, ...patch };
      emitRows({ ...cells, [k]: merged });
      if (Object.prototype.hasOwnProperty.call(patch, 'value')) {
        const v = runCellValidation(r, c, merged.value);
        setCellErr((e) => {
          const nextE = { ...e };
          if (v.ok) delete nextE[k];
          else nextE[k] = v.message || 'Неверный формат';
          return nextE;
        });
      }
    },
    [cells, emitRows, runCellValidation, readOnly]
  );

  const endFormulaSession = useCallback(() => {
    formulaSessionRef.current = null;
    setFormulaSession(null);
    suppressFormulaBlurRef.current = false;
    formulaPickRef.current = null;
    formulaPickDraggingRef.current = false;
  }, []);

  useEffect(() => {
    if (!formulaSession) return undefined;
    const onPointerDown = (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('[data-formula-bar-dock="1"]')) return;
      if (t.closest('[role="tablist"]')) return;
      if (t.closest('[data-grid-r]')) return;
      if (t.closest(`.${styles.spreadsheetScroll}`)) return;
      endFormulaSession();
    };
    const onPointerUp = () => {
      formulaPickDraggingRef.current = false;
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('mouseup', onPointerUp, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('mouseup', onPointerUp, true);
    };
  }, [formulaSession, endFormulaSession]);

  const startFormulaSession = useCallback((r, c, sheetId, sheetName, value) => {
    const session = {
      sheetId,
      sheetName: sheetName || null,
      r,
      c,
      draft: value ?? '',
    };
    formulaSessionRef.current = session;
    formulaPickRef.current = null;
    formulaPickDraggingRef.current = false;
    setFormulaSession(session);
  }, []);

  const updateFormulaDraft = useCallback((nextValue, { caret } = {}) => {
    const session = formulaSessionRef.current;
    if (!session) return;
    const next = { ...session, draft: nextValue };
    formulaSessionRef.current = next;
    setFormulaSession(next);
    patchValueOnSheet(session.sheetId, session.r, session.c, nextValue);
    if (caret != null) {
      requestAnimationFrame(() => {
        const input = formulaInputRef.current;
        input?.focus?.();
        input?.setSelectionRange?.(caret, caret);
      });
    }
  }, [patchValueOnSheet]);

  const applyFormulaPickRef = useCallback((r, c, { extend = false } = {}) => {
    const session = formulaSessionRef.current;
    if (!session || readOnly) return false;
    const sameAnchorCell = session.r === r
      && session.c === c
      && session.sheetId === activeSheetIdRef.current;
    if (sameAnchorCell && !extend && !formulaPickDraggingRef.current) return false;

    suppressFormulaBlurRef.current = true;
    const draft = String(session.draft ?? '');
    const input = formulaInputRef.current;
    let nextDraft = draft;
    let caret = draft.length;
    let pick = formulaPickRef.current;

    if (extend && pick?.anchor) {
      const refText = formatSheetRangeRef(
        pick.anchor.r,
        pick.anchor.c,
        r,
        c,
        activeSheet?.name,
        session.sheetName,
      );
      nextDraft = `${draft.slice(0, pick.start)}${refText}${draft.slice(pick.end)}`;
      caret = pick.start + refText.length;
      pick = { ...pick, end: caret };
    } else {
      const start = input?.selectionStart ?? draft.length;
      const end = input?.selectionEnd ?? start;
      const refText = formatSheetCellRef(r, c, activeSheet?.name, session.sheetName);
      const inserted = insertTextAtCaret(draft, start, end, refText);
      nextDraft = inserted.value;
      caret = inserted.caret;
      const refStart = caret - refText.length;
      pick = { anchor: { r, c }, start: refStart, end: caret };
    }

    formulaPickRef.current = pick;
    updateFormulaDraft(nextDraft, { caret });
    setRange({ a: pick.anchor, f: { r, c } });
    rangeRef.current = { a: pick.anchor, f: { r, c } };
    setSelected({ r, c });
    requestAnimationFrame(() => {
      suppressFormulaBlurRef.current = false;
    });
    return true;
  }, [readOnly, activeSheet?.name, updateFormulaDraft]);

  const patchCellRef = useRef(patchCell);
  patchCellRef.current = patchCell;
  const picking = useFormulaCellPicking({
    readOnly,
    getEditor: () => {
      const ed = editingCellRef.current;
      if (!ed) return null;
      const input = cellRefs.current[cellKey(ed.r, ed.c)];
      return input ? { r: ed.r, c: ed.c, input } : null;
    },
    applyValue: (r, c, v) => patchCellRef.current(r, c, { value: v }),
  });

  const tryInsertFormulaRef = useCallback((r, c, opts = {}) => (
    applyFormulaPickRef(r, c, opts)
  ), [applyFormulaPickRef]);

  const handleCellPointerDownWithFormula = useCallback((r, c, e) => {
    if (e.button !== 0) {
      handleCellPointerDown(r, c, e);
      return;
    }
    // Правка формулы в самой ячейке: клик по другой ячейке вставляет ссылку (режим указания Excel).
    if (!formulaSessionRef.current && picking.handlePointerDown(r, c, e)) return;
    if (formulaSessionRef.current && !readOnly) {
      e.preventDefault();
      e.stopPropagation();
      const extend = !!e.shiftKey;
      formulaPickDraggingRef.current = true;
      tryInsertFormulaRef(r, c, { extend });
      return;
    }
    handleCellPointerDown(r, c, e);
  }, [tryInsertFormulaRef, handleCellPointerDown, readOnly, picking]);

  const handleCellPointerEnterWithFormula = useCallback((r, c) => {
    picking.handlePointerEnter(r, c);
    if (!formulaPickDraggingRef.current || !formulaSessionRef.current) return;
    tryInsertFormulaRef(r, c, { extend: true });
  }, [tryInsertFormulaRef, picking]);

  const selectSheetKeepingFormula = useCallback((sheetId) => {
    const keepFormula = !!formulaSessionRef.current;
    if (keepFormula) {
      suppressFormulaBlurRef.current = true;
    }
    setActiveSheetId(sheetId);
    if (keepFormula) {
      // После смены листа selection/model обновятся — вернём фокус в ƒx
      queueMicrotask(() => {
        formulaInputRef.current?.focus?.();
      });
      window.setTimeout(() => {
        formulaInputRef.current?.focus?.();
        suppressFormulaBlurRef.current = false;
      }, 0);
      window.setTimeout(() => {
        if (formulaSessionRef.current) {
          formulaInputRef.current?.focus?.();
        }
        suppressFormulaBlurRef.current = false;
      }, 50);
    }
  }, []);

  const patchCellsInSelection = useCallback(
    (patch) => {
      if (readOnly) return;
      const bb = selectionBounds(rangeRef.current.a, rangeRef.current.f);
      let next = { ...cells };
      for (let r = bb.r0; r <= bb.r1; r += 1) {
        for (let c = bb.c0; c <= bb.c1; c += 1) {
          const k = cellKey(r, c);
          const prev = getCellState(next, r, c);
          next = { ...next, [k]: { ...prev, ...patch } };
        }
      }
      emitRows(next);
    },
    [cells, emitRows, readOnly]
  );

  const applyCellFormat = useCallback(
    (patch) => {
      if (readOnly) return;
      const bb = selectionBounds(rangeRef.current.a, rangeRef.current.f);
      const isMulti = (bb.r1 - bb.r0 + 1) * (bb.c1 - bb.c0 + 1) > 1;
      if (isMulti) {
        patchCellsInSelection(patch);
        return;
      }
      const f = rangeRef.current.f;
      patchCell(f.r, f.c, patch);
    },
    [patchCell, patchCellsInSelection, readOnly]
  );

  const setDim = (nextRow, nextCol) => {
    if (readOnly) return;
    const next = {
      ...model,
      rowCount: Math.max(SPREADSHEET_MIN_DIM, Math.min(SPREADSHEET_MAX_DIM, nextRow)),
      colCount: Math.max(SPREADSHEET_MIN_DIM, Math.min(SPREADSHEET_MAX_DIM, nextCol)),
    };
    emitRows(next.cells, { rowCount: next.rowCount, colCount: next.colCount });
  };

  const handleFillDown = useCallback(() => {
    const endRow = findFillDownEndRow(model, selected.r, selected.c);
    if (endRow <= selected.r) return;
    const next = fillColumnDownFromCell(model, selected.r, selected.c);
    if (!next) return;
    applyModel(next);
    setCellErr((prev) => {
      const nextErr = { ...prev };
      for (let r = selected.r + 1; r <= endRow; r += 1) {
        const k = cellKey(r, selected.c);
        const v = getCellState(next.cells, r, selected.c).value;
        const dt = normalizeColumnDataType(tableColumns[selected.c]?.dataType);
        let check = { ok: true };
        if (isCellFormula(v)) {
          const n = evaluateCellFormula(v, next, r, selected.c, tableColumns, new Set(), workbook);
          check = n == null
            ? { ok: false, message: 'Неверная формула' }
            : typeof n === 'string'
              ? validateCellValueForColumnType(n, dt)
              : validateCellValueForColumnType(formatFormulaNumber(n), dt);
        } else {
          check = validateCellValueForColumnType(v, dt);
        }
        if (check.ok) delete nextErr[k];
        else nextErr[k] = check.message || 'Неверный формат';
      }
      return nextErr;
    });
  }, [model, selected.r, selected.c, applyModel, tableColumns, workbook]);

  const patchRangeValues = useCallback(
    (bb, updater) => {
      if (readOnly) return;
      const m = modelRef.current;
      const source = m.cells || {};
      let next = { ...source };
      for (let r = bb.r0; r <= bb.r1; r += 1) {
        for (let c = bb.c0; c <= bb.c1; c += 1) {
          const k = cellKey(r, c);
          const prev = getCellState(source, r, c);
          const nextVal = updater(prev, r, c);
          next = { ...next, [k]: { ...prev, value: nextVal } };
        }
      }
      emitRows(next);
    },
    [emitRows, readOnly]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (readOnly) return;
      const t = e.target;
      if (!t || !t.closest || !t.closest('[data-spreadsheet-grid]')) return;
      if (t.closest('[data-spreadsheet-ctx]')) return;

      const rr = rangeRef.current;
      if (!rr) return;
      const bb = selectionBounds(rr.a, rr.f);
      const isMulti = (bb.r1 - bb.r0 + 1) * (bb.c1 - bb.c0 + 1) > 1;

      if (e.key === 'Escape') {
        setCopiedRange(null);
        return;
      }

      if ((e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        selectAllCells();
        return;
      }

      // Ctrl+Z/Y, Ctrl+X, Ctrl+D/R, F2, Ctrl+стрелки, Enter/Tab — как в Excel.
      if (hotkeyApiRef.current && handleGridHotkey(e, hotkeyApiRef.current)) return;

      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (!isMulti) return;
        e.preventDefault();
        e.stopPropagation();
        setCopiedRange(null);
        patchRangeValues(bb, () => '');
        return;
      }

      if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        const cm = modelRef.current.cells || {};
        const lines = [];
        for (let r = bb.r0; r <= bb.r1; r += 1) {
          const row = [];
          for (let c = bb.c0; c <= bb.c1; c += 1) {
            const v = getCellState(cm, r, c).value ?? '';
            row.push(String(v).replace(/\r\n/g, '\n').replace(/\n/g, ' ').replace(/\t/g, ' '));
          }
          lines.push(row.join('\t'));
        }
        const payload = lines.join('\n');
        setCopiedRange({ a: { r: bb.r0, c: bb.c0 }, f: { r: bb.r1, c: bb.c1 } });
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(payload).catch(() => {});
        }
        return;
      }

      if ((e.key === 'v' || e.key === 'V') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return;
        navigator.clipboard.readText().then((text) => {
          const parsed = parseTsvToRows(text);
          if (!parsed.length) return;
          const m = modelRef.current;
          const baseRange = rangeRef.current;
          const targetBounds = selectionBounds(baseRange.a, baseRange.f);
          const next = applyParsedPasteToCells(m.cells || {}, parsed, targetBounds, {
            rowCount: m.rowCount,
            colCount: m.colCount,
            dataStart,
          });
          emitRows(next);
          setCopiedRange(null);
        }).catch(() => {});
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [emitRows, patchRangeValues, dataStart, readOnly, selectAllCells]);

  const resolveGridCellFromPoint = useCallback(
    (x, y) => {
      if (!gridRef.current) return null;
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const td = el.closest('td[data-grid-r][data-grid-c]');
      if (!td || !gridRef.current.contains(td)) return null;
      const r = Number(td.dataset.gridR);
      const c = Number(td.dataset.gridC);
      if (!Number.isFinite(r) || !Number.isFinite(c)) return null;
      return {
        r: Math.max(dataStart, Math.min(rowCount - 1, r)),
        c: Math.max(0, Math.min(colCount - 1, c)),
      };
    },
    [dataStart, rowCount, colCount]
  );

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

  const { startFillDrag, fillPreview } = useFillHandleDrag({
    resolveCell: resolveGridCellFromPoint,
    getSource: () => selectionBounds(rangeRef.current.a, rangeRef.current.f),
    onFill: (source, target) => {
      history.breakGroup();
      emitRows(fillCells(modelRef.current.cells || {}, source, target));
      setRangeSelection({ a: { r: target.r0, c: target.c0 }, f: { r: target.r1, c: target.c1 } });
      setCellErr({});
    },
  });

  hotkeyApiRef.current = {
    getBounds: () => selectionBounds(rangeRef.current.a, rangeRef.current.f),
    getFocus: () => selectedRef.current,
    select: (r, c, { extend } = {}) => (extend ? extendSelectionTo(r, c) : setSingleSelection(r, c)),
    focusEditor: (r, c) => {
      const el = cellRefs.current[cellKey(r, c)];
      if (!el) return;
      el.focus();
      const len = String(el.value ?? '').length;
      el.setSelectionRange?.(len, len);
    },
    getCells: () => modelRef.current.cells || {},
    applyCells: (next) => {
      history.breakGroup();
      emitRows(next);
    },
    undo: history.undo,
    redo: history.redo,
    copyTsv: (text, bb) => {
      setCopiedRange({ a: { r: bb.r0, c: bb.c0 }, f: { r: bb.r1, c: bb.c1 } });
      navigator.clipboard?.writeText?.(text).catch(() => {});
    },
    limits: { rowStart: dataStart, rowEnd: rowCount - 1, colEnd: colCount - 1 },
  };

  // Формула, которую сейчас правят: строка формулы или ячейка с «=».
  const editingValue = editingCell ? String(getCellState(cells, editingCell.r, editingCell.c).value ?? '') : '';
  const highlightText = formulaSession
    ? String(formulaSession.draft ?? '')
    : (editingCell && editingValue.trimStart().startsWith('=') ? editingValue : '');
  const highlightRow = formulaSession ? formulaSession.r : editingCell?.r ?? 0;
  const highlightSheet = formulaSession ? formulaSession.sheetName : activeSheet?.name;
  const formulaMarks = useMemo(
    () => (highlightText
      ? buildFormulaRangeMarks(highlightText, {
        row: highlightRow,
        formulaSheetName: highlightSheet,
        viewSheetName: activeSheet?.name,
        rowCount,
        colCount,
      })
      : null),
    [highlightText, highlightRow, highlightSheet, activeSheet?.name, rowCount, colCount],
  );

  const sel = getCellState(cells, selected.r, selected.c);
  const formulaBarSelected = formulaSession
    ? { r: formulaSession.r, c: formulaSession.c }
    : selected;
  const formulaBarValue = formulaSession ? formulaSession.draft : (sel.value ?? '');
  const formulaBarSheetName = formulaSession?.sheetName || activeSheet?.name;
  const formulaBarPreview = formulaSession
    ? null
    : formulaDisplay[cellKey(selected.r, selected.c)];
  const bounds = selectionBounds(range.a, range.f);
  const copyBounds = copiedRange ? selectionBounds(copiedRange.a, copiedRange.f) : null;
  const selectedRows = bounds.r1 - bounds.r0 + 1;
  const selectedCols = bounds.c1 - bounds.c0 + 1;
  const multiRange = selectedRows * selectedCols > 1;
  const focusColDt = normalizeColumnDataType(tableColumns[selected.c]?.dataType);
  const focusIsFormula = isCellFormula(formulaBarValue) || String(formulaBarValue ?? '').startsWith('=');

  const toggleWrapText = useCallback(() => {
    setWrapText((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(WRAP_TEXT_STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!wrapText || !gridRef.current) return undefined;
    const resizeAll = () => {
      gridRef.current?.querySelectorAll('textarea').forEach((el) => {
        el.style.height = 'auto';
        el.style.height = `${Math.max(el.scrollHeight, 32)}px`;
      });
    };
    const id = window.requestAnimationFrame(resizeAll);
    return () => window.cancelAnimationFrame(id);
  }, [wrapText, model, rowCount, colCount, activeSheetId]);

  return (
    <div>
      {sheets.length > 1 && (
        <SpreadsheetSheetTabs
          sheets={sheets}
          activeSheetId={activeSheetId}
          editable={false}
          onSelect={selectSheetKeepingFormula}
        />
      )}
      {!readOnly && (
      <>
      <div className={styles.spreadsheetToolbar}>
        <button type="button" className={styles.secondaryButton} onClick={() => setDim(rowCount + 1, colCount)}>
          + строка
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => setDim(rowCount - 1, colCount)}
          disabled={rowCount <= SPREADSHEET_MIN_DIM}
        >
          − строка
        </button>
        <span className={styles.spreadsheetToolbarHint} title="Строка формулы всегда сверху. Начните с = и кликайте ячейки, чтобы вставить ссылки. Переключайте листы, не выходя из формулы — ссылка будет вида Лист2!B3. A1 в строке заголовков — название столбца.">
          {formulaSession
            ? `ƒx правка ${formatSheetCellRef(formulaSession.r, formulaSession.c, formulaSession.sheetName, activeSheet?.name)} · тяните мышью или Shift+клик — диапазон A1:B3`
            : 'ƒx · клик/drag по ячейкам вставляет ссылку · листы: Лист2!B3'}
        </span>
      </div>
      <SpreadsheetFormulaBar
        key={formulaSession
          ? `fx-${formulaSession.sheetId}-${formulaSession.r}-${formulaSession.c}`
          : 'fx-idle'}
        ref={formulaInputRef}
        selected={formulaBarSelected}
        value={formulaBarValue}
        model={model}
        tableColumns={tableColumns}
        workbook={workbook}
        sheetName={formulaBarSheetName}
        viewSheetName={activeSheet?.name}
        readOnly={readOnly}
        resultPreview={formulaBarPreview}
        onChange={(v) => {
          formulaPickRef.current = null;
          if (formulaSessionRef.current) {
            updateFormulaDraft(v);
            return;
          }
          patchCell(selected.r, selected.c, { value: v });
        }}
        onFocus={() => {
          if (formulaSessionRef.current) return;
          const current = getCellState(
            modelRef.current?.cells || cells,
            selected.r,
            selected.c,
          ).value ?? '';
          startFormulaSession(
            selected.r,
            selected.c,
            activeSheetIdRef.current,
            activeSheet?.name || null,
            current,
          );
        }}
        onBlur={() => {
          // Сессию не завершаем по blur: смена листа / автофокус ячейки иначе сбрасывают формулу.
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.defaultPrevented) {
            e.preventDefault();
            endFormulaSession();
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            endFormulaSession();
            e.currentTarget.blur();
          }
        }}
      />
      <div className={styles.spreadsheetToolbar}>
        {multiRange && (
          <span className={styles.spreadsheetToolbarLabel} style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
            Выделено: {selectedRows}x{selectedCols}
          </span>
        )}
        {copyBounds && (
          <span className={styles.spreadsheetToolbarLabel} style={{ color: '#4ade80' }}>
            Скопировано: {copyBounds.r1 - copyBounds.r0 + 1}x{copyBounds.c1 - copyBounds.c0 + 1}
          </span>
        )}
        {focusColDt !== 'string' && !focusIsFormula ? (
          <span className={styles.spreadsheetToolbarLabel} style={{ color: 'var(--color-text-secondary, #94a3b8)' }} title="Задаётся в шаблоне">
            Тип колонки: {COLUMN_DATA_TYPES.find((t) => t.value === focusColDt)?.label || focusColDt}
          </span>
        ) : !focusIsFormula ? (
          <select
            className={styles.fieldSelect}
            value={sel.displayType || 'text'}
            onChange={(e) => applyCellFormat({ displayType: e.target.value })}
            aria-label="Тип ячейки"
          >
            {CELL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          className={`${styles.spreadsheetToolbarBtn} ${sel.bold ? styles.spreadsheetToolbarBtnActive : ''}`}
          onClick={() => applyCellFormat({ bold: !sel.bold })}
        >
          B
        </button>
        <button
          type="button"
          className={`${styles.spreadsheetToolbarBtn} ${sel.italic ? styles.spreadsheetToolbarBtnActive : ''}`}
          onClick={() => applyCellFormat({ italic: !sel.italic })}
        >
          I
        </button>
        <button
          type="button"
          className={`${styles.spreadsheetToolbarBtn} ${wrapText ? styles.spreadsheetToolbarBtnActive : ''}`}
          onClick={toggleWrapText}
          title="Перенос текста — показывать содержимое ячеек полностью, высота строк подстраивается"
          aria-label="Перенос текста"
          aria-pressed={wrapText}
        >
          <IconWrapText size={14} />
        </button>
        {['left', 'center', 'right'].map((al) => {
          const AlignIcon = ALIGN_ICONS[al];
          return (
          <button
            key={al}
            type="button"
            className={`${styles.spreadsheetToolbarBtn} ${sel.align === al ? styles.spreadsheetToolbarBtnActive : ''}`}
            onClick={() => applyCellFormat({ align: al })}
          >
            <AlignIcon size={14} />
          </button>
          );
        })}
      </div>
      </>
      )}
      <div className={styles.spreadsheetScroll} data-spreadsheet-grid ref={gridRef}>
        <table className={`${styles.spreadsheetTable} ${wrapText ? styles.spreadsheetTableWrapText : ''}`.trim()}>
          <thead>
            <tr>
              <th className={styles.spreadsheetCorner} aria-hidden />
              {Array.from({ length: colCount }, (_, c) => {
                const headMeta = hasHeaderRow ? getCellState(cells, 0, c) : null;
                const colSelected = c >= bounds.c0 && c <= bounds.c1
                  && bounds.r0 <= dataStart && bounds.r1 >= rowCount - 1;
                return (
                  <th
                    key={c}
                    className={`${styles.spreadsheetColHead} ${colSelected ? styles.spreadsheetCellInRange : ''}`.trim()}
                    style={{ cursor: readOnly ? 'default' : 'pointer', ...(headMeta ? cellInlineStyle(headMeta) : {}) }}
                    onDoubleClick={readOnly ? undefined : (e) => {
                      e.preventDefault();
                      selectColumn(c);
                    }}
                    title={readOnly ? undefined : 'Двойной клик — выделить столбец'}
                  >
                    {tableColumns[c]?.label ?? excelColumnLabel(c)}
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
                    className={`${styles.spreadsheetRowHead} ${r >= bounds.r0 && r <= bounds.r1 && bounds.c0 <= 0 && bounds.c1 >= colCount - 1 ? styles.spreadsheetCellInRange : ''}`.trim()}
                    onContextMenu={readOnly ? undefined : (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCtx({ x: e.clientX, y: e.clientY, kind: 'row', idx: r });
                    }}
                    onDoubleClick={readOnly ? undefined : (e) => {
                      e.preventDefault();
                      selectRow(r);
                    }}
                    title={readOnly ? undefined : 'Двойной клик — выделить строку'}
                  >
                    {/* Номер строки как в формулах (A2 = первая строка данных под заголовками). */}
                    {r + 1}
                  </th>
                  {Array.from({ length: colCount }, (_, c) => {
                    const meta = getCellState(cells, r, c);
                    const isSel = selected.r === r && selected.c === c;
                    const inCopied = copyBounds
                      && r >= copyBounds.r0 && r <= copyBounds.r1
                      && c >= copyBounds.c0 && c <= copyBounds.c1;
                    const k = cellKey(r, c);
                    const errMsg = cellErr[k];
                    const stored = meta.value ?? '';
                    const effective = getEffectiveCellValue(cells, r, c, tableColumns, hasHeaderRow);
                    const refMark = formulaMarks?.get(k);
                    const isFillCorner = r === bounds.r1 && c === bounds.c1;
                    const inFillPreview = isInFillPreview(fillPreview, bounds, r, c);
                    return (
                      <td
                        key={c}
                        data-grid-r={r}
                        data-grid-c={c}
                        className={`${styles.spreadsheetCell} ${fh.cellHost} ${r >= bounds.r0 && r <= bounds.r1 && c >= bounds.c0 && c <= bounds.c1 ? styles.spreadsheetCellInRange : ''} ${inCopied ? styles.spreadsheetCellCopied : ''} ${isSel ? styles.spreadsheetCellSelected : ''} ${inFillPreview ? fh.fillPreviewCell : ''}`}
                        onMouseDown={(e) => handleCellPointerDownWithFormula(r, c, e)}
                        onMouseEnter={() => handleCellPointerEnterWithFormula(r, c)}
                        role="gridcell"
                        tabIndex={-1}
                      >
                        <SpreadsheetColumnCellInput
                          ref={(el) => {
                            if (el) cellRefs.current[k] = el;
                            else delete cellRefs.current[k];
                          }}
                          colDataType={tableColumns[c]?.dataType}
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
                            focusCell(r, c);
                            setEditingCell({ r, c });
                          }}
                          onBlur={() => setEditingCell((prev) => (prev && prev.r === r && prev.c === c ? null : prev))}
                          highlightRefs
                          onMouseDown={(e) => handleCellPointerDownWithFormula(r, c, e)}
                          onNavigate={moveSelection}
                          className={styles.spreadsheetCellInput}
                          errorClassName={styles.spreadsheetCellInputError}
                          title={errMsg || undefined}
                          invalid={!!errMsg}
                          ariaLabel={`Ячейка ${r + 1} ${excelColumnLabel(c)}`}
                          readOnly={readOnly}
                          wrapText={wrapText}
                        />
                        {refMark && <span className={fh.refMark} style={refMark} aria-hidden />}
                        {!readOnly && isFillCorner && (
                          <span
                            className={styles.spreadsheetFillHandle}
                            role="presentation"
                            title="Тяните, чтобы заполнить ячейки (ряд чисел, даты, формулы); двойной клик — заполнить вниз"
                            onMouseDown={startFillDrag}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleFillDown();
                            }}
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
                <th className={s.summaryCorner} scope="row">ИТОГ</th>
                {Array.from({ length: colCount }, (_, c) => {
                  const colKey = tableColumns[c]?.key || `col_${c}`;
                  return (
                    <td key={c} className={s.summaryCell} aria-label={`Итог ${tableColumns[c]?.label || ''}`}>
                      {summaryValues[colKey] ?? ''}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {!readOnly && ctx && (
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
          {ctx.kind === 'row' && (
            <>
              <li>
                <button
                  type="button"
                  className={s.contextItem}
                  role="menuitem"
                  disabled={rowCount >= SPREADSHEET_MAX_DIM}
                  onClick={() => {
                    if (ctx.idx != null) applyModel(insertRowAt(model, ctx.idx));
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
                    if (ctx.idx != null) applyModel(insertRowAt(model, ctx.idx + 1));
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
                    if (ctx.idx != null) applyModel(deleteRowAt(model, ctx.idx));
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
    </div>
  );
};

export default SpreadsheetDocumentGrid;
