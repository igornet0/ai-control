/**
 * Подсветка ссылок формулы как в Excel / Google Таблицах:
 * у каждой ссылки свой цвет — в тексте формулы и рамкой диапазона на сетке.
 */
import { useCallback, useEffect, useRef } from 'react';
import { cellKey } from './spreadsheetGridUtils';
import { extractFormulaReferences } from './spreadsheetFormulaTokens';
import { formatSheetRangeRef } from './spreadsheetCellFormula';

export const FORMULA_REF_COLORS = [
  '#4f8cff',
  '#ff6b6b',
  '#b07cff',
  '#2fbf71',
  '#ff9f40',
  '#22c3c3',
  '#ff6fb5',
  '#d4b106',
];

const refIdentity = (formula, ref) => formula
  .slice(ref.start, ref.end)
  .replace(/\$/g, '')
  .toUpperCase();

/**
 * Ссылки формулы с цветами (одинаковые ссылки — один цвет).
 * @returns {Array<object>} ref + { color, text }
 */
export function colorizeFormulaReferences(formula) {
  const text = String(formula ?? '');
  if (!text.trimStart().startsWith('=')) return [];
  const colorByKey = new Map();
  return extractFormulaReferences(text).map((ref) => {
    const key = refIdentity(text, ref);
    if (!colorByKey.has(key)) {
      colorByKey.set(key, FORMULA_REF_COLORS[colorByKey.size % FORMULA_REF_COLORS.length]);
    }
    return { ...ref, text: text.slice(ref.start, ref.end), color: colorByKey.get(key) };
  });
}

/** Куски текста формулы для цветного отображения: [{ text, color? }]. */
export function formulaTextSegments(formula) {
  const text = String(formula ?? '');
  const refs = colorizeFormulaReferences(text);
  if (!refs.length) return [{ text }];
  const out = [];
  let cursor = 0;
  refs.forEach((ref) => {
    if (ref.start > cursor) out.push({ text: text.slice(cursor, ref.start) });
    out.push({ text: ref.text, color: ref.color });
    cursor = ref.end;
  });
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
}

const sameSheet = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Рамки диапазонов для видимого листа.
 * @param {string|null} formula — текст формулы, которую сейчас правят
 * @param {object} opts
 * @param {number} opts.row — строка ячейки с формулой (для «голых» букв столбцов)
 * @param {string|null} opts.formulaSheetName — лист, где находится формула
 * @param {string|null} opts.viewSheetName — лист, который сейчас открыт
 * @returns {Map<string, { boxShadow: string, backgroundColor: string }>}
 */
export function buildFormulaRangeMarks(formula, {
  row = 0,
  formulaSheetName = null,
  viewSheetName = null,
  rowCount = 0,
  colCount = 0,
} = {}) {
  const marks = new Map();
  if (!formula || rowCount <= 0 || colCount <= 0) return marks;
  const refs = colorizeFormulaReferences(formula);
  const formulaOnView = !formulaSheetName || !viewSheetName || sameSheet(formulaSheetName, viewSheetName);

  refs.forEach((ref) => {
    const onView = ref.sheetName ? sameSheet(ref.sheetName, viewSheetName) : formulaOnView;
    if (!onView) return;
    let { r0, r1, c0, c1 } = ref;
    if (ref.kind === 'cols') {
      r0 = 0;
      r1 = rowCount - 1;
    } else if (ref.kind === 'rows') {
      c0 = 0;
      c1 = colCount - 1;
    } else if (ref.kind === 'barecol') {
      r0 = row;
      r1 = row;
    }
    r0 = Math.max(0, r0);
    c0 = Math.max(0, c0);
    r1 = Math.min(rowCount - 1, r1);
    c1 = Math.min(colCount - 1, c1);
    if (r0 > r1 || c0 > c1) return;

    const fill = hexToRgba(ref.color, 0.13);
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const shadows = [];
        if (r === r0) shadows.push(`inset 0 2px 0 ${ref.color}`);
        if (r === r1) shadows.push(`inset 0 -2px 0 ${ref.color}`);
        if (c === c0) shadows.push(`inset 2px 0 0 ${ref.color}`);
        if (c === c1) shadows.push(`inset -2px 0 0 ${ref.color}`);
        const key = cellKey(r, c);
        const prev = marks.get(key);
        marks.set(key, {
          boxShadow: [prev?.boxShadow, ...shadows].filter(Boolean).join(', ') || 'none',
          backgroundColor: fill,
        });
      }
    }
  });
  return marks;
}

const REF_INSERT_AFTER = new Set(['=', '(', ',', ';', '+', '-', '*', '/', '^', '&', '<', '>', ':', '%']);

/** Можно ли вставить ссылку в позицию курсора (после оператора, «(» или «;»), как в Excel. */
export function isRefInsertionPoint(value, caret) {
  const text = String(value ?? '');
  if (!text.trimStart().startsWith('=')) return false;
  let i = Math.min(caret ?? text.length, text.length) - 1;
  while (i >= 0 && /\s/.test(text[i])) i -= 1;
  return i >= 0 && REF_INSERT_AFTER.has(text[i]);
}

/**
 * «Режим указания» как в Excel: пока в ячейке правится формула и курсор стоит после оператора,
 * клик по другой ячейке вставляет ссылку, протягивание или Shift+клик — диапазон.
 *
 * @param {object} opts
 * @param {() => ({ r: number, c: number, input: HTMLInputElement|HTMLTextAreaElement } | null)} opts.getEditor
 * @param {(r: number, c: number, value: string) => void} opts.applyValue
 * @param {boolean} [opts.readOnly]
 */
export function useFormulaCellPicking({ getEditor, applyValue, readOnly = false }) {
  const pickRef = useRef(null);
  const draggingRef = useRef(false);
  const getEditorRef = useRef(getEditor);
  getEditorRef.current = getEditor;
  const applyValueRef = useRef(applyValue);
  applyValueRef.current = applyValue;

  useEffect(() => {
    const stop = () => {
      draggingRef.current = false;
    };
    document.addEventListener('mouseup', stop, true);
    return () => document.removeEventListener('mouseup', stop, true);
  }, []);

  const writeRef = useCallback((editor, anchor, r, c) => {
    const { input } = editor;
    const value = String(input.value ?? '');
    const pick = pickRef.current;
    const continuing = pick && pick.r === editor.r && pick.c === editor.c;
    const start = continuing ? pick.start : (input.selectionStart ?? value.length);
    const end = continuing ? pick.end : (input.selectionEnd ?? start);
    const refText = formatSheetRangeRef(anchor.r, anchor.c, r, c);
    const next = `${value.slice(0, start)}${refText}${value.slice(end)}`;
    const caret = start + refText.length;
    pickRef.current = { r: editor.r, c: editor.c, anchor, start, end: caret };
    applyValueRef.current(editor.r, editor.c, next);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange?.(caret, caret);
    });
  }, []);

  /** @returns {boolean} true — клик ушёл в формулу, обычный выбор ячейки не нужен */
  const handlePointerDown = useCallback((r, c, e) => {
    if (readOnly || e.button !== 0) return false;
    const editor = getEditorRef.current?.();
    if (!editor?.input || (editor.r === r && editor.c === c)) return false;
    if (document.activeElement !== editor.input) return false;
    const value = String(editor.input.value ?? '');
    if (!value.trimStart().startsWith('=')) return false;
    const caret = editor.input.selectionStart ?? value.length;
    const pick = pickRef.current;
    const continuing = pick && pick.r === editor.r && pick.c === editor.c && caret === pick.end;
    if (!continuing) pickRef.current = null;
    if (!continuing && !isRefInsertionPoint(value, caret)) return false;
    e.preventDefault();
    e.stopPropagation();
    const anchor = e.shiftKey && continuing ? pick.anchor : { r, c };
    writeRef(editor, anchor, r, c);
    draggingRef.current = true;
    return true;
  }, [readOnly, writeRef]);

  const handlePointerEnter = useCallback((r, c) => {
    if (!draggingRef.current || !pickRef.current) return;
    const editor = getEditorRef.current?.();
    if (!editor?.input) return;
    writeRef(editor, pickRef.current.anchor, r, c);
  }, [writeRef]);

  /** Сбросить текущий выбор (пользователь печатает сам). */
  const resetPick = useCallback(() => {
    pickRef.current = null;
  }, []);

  return { handlePointerDown, handlePointerEnter, resetPick };
}
