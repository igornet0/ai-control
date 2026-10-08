/**
 * Операции сетки как в Excel / Google Таблицах: автозаполнение маркером, Ctrl+D / Ctrl+R,
 * вырезание, переход Ctrl+стрелка, отмена/повтор. Общие для таблицы шаблона и документа.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { cellKey, getCellState } from './spreadsheetGridUtils';
import { shiftFormulaReferences, isFormulaText } from './spreadsheetFormulaTokens';

/* ───────────────────────────── значения ───────────────────────────── */

const NUMBER_RE = /^[-+]?\d+(?:[.,]\d+)?$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const RU_DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const TRAILING_NUMBER_RE = /^(.*?)(\d+)(\D*)$/;

const isFilledValue = (v) => v != null && String(v).trim() !== '';

function parsePlainNumber(raw) {
  const s = String(raw ?? '').trim();
  if (!NUMBER_RE.test(s)) return null;
  return { n: Number(s.replace(',', '.')), comma: s.includes(','), decimals: (s.split(/[.,]/)[1] || '').length };
}

function formatLike(n, sample) {
  const decimals = Math.max(0, Math.min(10, sample.decimals));
  let s = decimals > 0 ? n.toFixed(decimals) : String(Math.round(n * 1e10) / 1e10);
  if (sample.comma) s = s.replace('.', ',');
  return s;
}

function addDays(raw, days) {
  const s = String(raw).trim();
  let m = s.match(ISO_DATE_RE);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days));
    return d.toISOString().slice(0, 10);
  }
  m = s.match(RU_DATE_RE);
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1] + days));
    const p = (x) => String(x).padStart(2, '0');
    return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
  }
  return null;
}

/**
 * Значение k-й ячейки продолжения ряда (k = 1, 2, … от края источника).
 * @param {string[]} seq значения источника по направлению заполнения
 * @param {number} k
 * @param {number} sign +1 — вниз/вправо, -1 — вверх/влево
 * @param {(raw: string, offset: number) => string} shiftFormula
 */
export function seriesValue(seq, k, sign, shiftFormula) {
  const n = seq.length;
  if (n === 0) return '';
  const numbers = seq.map(parsePlainNumber);
  const allNumbers = numbers.every(Boolean);

  // Два и больше чисел — арифметическая прогрессия (линейный тренд, как в Excel).
  if (allNumbers && n >= 2) {
    const xs = numbers.map((x) => x.n);
    const step = (xs[n - 1] - xs[0]) / (n - 1);
    const sample = numbers.reduce((a, b) => (b.decimals > a.decimals ? b : a), numbers[0]);
    const base = sign > 0 ? xs[n - 1] : xs[0];
    return formatLike(base + sign * step * k, sample);
  }

  if (n === 1) {
    const raw = String(seq[0] ?? '');
    if (isFormulaText(raw)) return shiftFormula(raw, sign * k);
    const shiftedDate = addDays(raw, sign * k);
    if (shiftedDate) return shiftedDate;
    // «Позиция 1» → «Позиция 2»; одиночное число просто копируется (как в Excel).
    if (!numbers[0]) {
      const m = raw.match(TRAILING_NUMBER_RE);
      if (m && m[1] !== '') {
        const next = Number(m[2]) + sign * k;
        if (next >= 0) return `${m[1]}${String(next).padStart(m[2].length, '0')}${m[3]}`;
      }
    }
    return raw;
  }

  // Повтор узора источника; формулы сдвигаются на расстояние до копии.
  const srcIndex = sign > 0 ? (k - 1) % n : (n - (k % n)) % n;
  const raw = String(seq[srcIndex] ?? '');
  if (isFormulaText(raw)) {
    const targetPos = sign > 0 ? n - 1 + k : -k;
    return shiftFormula(raw, targetPos - srcIndex);
  }
  return raw;
}

const STYLE_FIELDS = ['displayType', 'bold', 'italic', 'align'];

function stylePatch(state) {
  const out = {};
  STYLE_FIELDS.forEach((f) => {
    if (state[f] !== undefined) out[f] = state[f];
  });
  return out;
}

/**
 * Автозаполнение: продлить источник до цели вдоль одной оси.
 * @param {Record<string, object>} cells
 * @param {{ r0, c0, r1, c1 }} source
 * @param {{ r0, c0, r1, c1 }} target — содержит source, расширен по строкам ИЛИ столбцам
 */
export function fillCells(cells, source, target) {
  const next = { ...cells };
  const vertical = target.r0 < source.r0 || target.r1 > source.r1;
  const write = (r, c, value, styleFrom) => {
    const prev = getCellState(next, r, c);
    next[cellKey(r, c)] = { ...prev, ...stylePatch(styleFrom), value };
  };

  if (vertical) {
    for (let c = source.c0; c <= source.c1; c += 1) {
      const seq = [];
      for (let r = source.r0; r <= source.r1; r += 1) seq.push(getCellState(cells, r, c).value ?? '');
      const shift = (raw, dr) => shiftFormulaReferences(raw, dr, 0);
      for (let r = source.r1 + 1, k = 1; r <= target.r1; r += 1, k += 1) {
        write(r, c, seriesValue(seq, k, 1, shift), getCellState(cells, source.r0 + ((k - 1) % seq.length), c));
      }
      for (let r = source.r0 - 1, k = 1; r >= target.r0; r -= 1, k += 1) {
        write(r, c, seriesValue(seq, k, -1, shift), getCellState(cells, source.r1 - ((k - 1) % seq.length), c));
      }
    }
  } else {
    for (let r = source.r0; r <= source.r1; r += 1) {
      const seq = [];
      for (let c = source.c0; c <= source.c1; c += 1) seq.push(getCellState(cells, r, c).value ?? '');
      const shift = (raw, dc) => shiftFormulaReferences(raw, 0, dc);
      for (let c = source.c1 + 1, k = 1; c <= target.c1; c += 1, k += 1) {
        write(r, c, seriesValue(seq, k, 1, shift), getCellState(cells, r, source.c0 + ((k - 1) % seq.length)));
      }
      for (let c = source.c0 - 1, k = 1; c >= target.c0; c -= 1, k += 1) {
        write(r, c, seriesValue(seq, k, -1, shift), getCellState(cells, r, source.c1 - ((k - 1) % seq.length)));
      }
    }
  }
  return next;
}

/** Цель автозаполнения при протягивании маркера к ячейке (r, c): только одна ось, как в Excel. */
export function fillTargetForPointer(source, r, c) {
  const down = r - source.r1;
  const up = source.r0 - r;
  const right = c - source.c1;
  const left = source.c0 - c;
  const vertical = Math.max(down, up, 0);
  const horizontal = Math.max(right, left, 0);
  if (vertical === 0 && horizontal === 0) return { ...source };
  if (vertical >= horizontal) {
    return down > 0
      ? { ...source, r1: r }
      : { ...source, r0: r };
  }
  return right > 0
    ? { ...source, c1: c }
    : { ...source, c0: c };
}

/** Ctrl+D: копировать верхнюю строку выделения вниз (одна ячейка — из ячейки выше). */
export function fillDownCells(cells, bounds, dataStart = 0) {
  const src = bounds.r0 === bounds.r1 ? bounds.r0 - 1 : bounds.r0;
  if (src < dataStart) return null;
  const next = { ...cells };
  for (let c = bounds.c0; c <= bounds.c1; c += 1) {
    const from = getCellState(cells, src, c);
    for (let r = Math.max(src + 1, bounds.r0); r <= bounds.r1; r += 1) {
      const value = isFormulaText(from.value) ? shiftFormulaReferences(from.value, r - src, 0) : (from.value ?? '');
      next[cellKey(r, c)] = { ...getCellState(next, r, c), ...stylePatch(from), value };
    }
  }
  return next;
}

/** Ctrl+R: копировать левый столбец выделения вправо (одна ячейка — из ячейки слева). */
export function fillRightCells(cells, bounds) {
  const src = bounds.c0 === bounds.c1 ? bounds.c0 - 1 : bounds.c0;
  if (src < 0) return null;
  const next = { ...cells };
  for (let r = bounds.r0; r <= bounds.r1; r += 1) {
    const from = getCellState(cells, r, src);
    for (let c = Math.max(src + 1, bounds.c0); c <= bounds.c1; c += 1) {
      const value = isFormulaText(from.value) ? shiftFormulaReferences(from.value, 0, c - src) : (from.value ?? '');
      next[cellKey(r, c)] = { ...getCellState(next, r, c), ...stylePatch(from), value };
    }
  }
  return next;
}

export function clearCellValues(cells, bounds) {
  const next = { ...cells };
  for (let r = bounds.r0; r <= bounds.r1; r += 1) {
    for (let c = bounds.c0; c <= bounds.c1; c += 1) {
      next[cellKey(r, c)] = { ...getCellState(next, r, c), value: '' };
    }
  }
  return next;
}

export function rangeToTsv(cells, bounds) {
  const lines = [];
  for (let r = bounds.r0; r <= bounds.r1; r += 1) {
    const row = [];
    for (let c = bounds.c0; c <= bounds.c1; c += 1) {
      const v = getCellState(cells, r, c).value ?? '';
      row.push(String(v).replace(/\r\n/g, '\n').replace(/\n/g, ' ').replace(/\t/g, ' '));
    }
    lines.push(row.join('\t'));
  }
  return lines.join('\n');
}

/**
 * Ctrl+стрелка: к краю блока данных (как в Excel).
 * @param {(r: number, c: number) => boolean} isFilled
 * @param {{ rowStart: number, rowEnd: number, colEnd: number }} limits
 */
export function ctrlArrowTarget(isFilled, r, c, dir, { rowStart = 0, rowEnd, colEnd }) {
  const dr = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
  const dc = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  const inside = (rr, cc) => rr >= rowStart && rr <= rowEnd && cc >= 0 && cc <= colEnd;
  let nr = r + dr;
  let nc = c + dc;
  if (!inside(nr, nc)) return { r, c };
  if (isFilled(r, c) && isFilled(nr, nc)) {
    // Внутри блока — до последней заполненной ячейки.
    while (inside(nr + dr, nc + dc) && isFilled(nr + dr, nc + dc)) {
      nr += dr;
      nc += dc;
    }
    return { r: nr, c: nc };
  }
  // На краю или в пустоте — до следующей заполненной ячейки или до края таблицы.
  while (inside(nr, nc) && !isFilled(nr, nc)) {
    if (!inside(nr + dr, nc + dc)) return { r: nr, c: nc };
    nr += dr;
    nc += dc;
  }
  return { r: nr, c: nc };
}

export function isCellValueFilled(cells, r, c) {
  return isFilledValue(getCellState(cells, r, c).value);
}

/* ───────────────────────────── история (Ctrl+Z / Ctrl+Y) ───────────────────────────── */

/**
 * Отмена и повтор для значения сетки. Быстрые подряд правки (набор текста) группируются в один шаг.
 * @param {*} value текущее значение (иммутабельное)
 * @param {(v: *) => void} onChange
 */
export function useGridHistory(value, onChange, { limit = 100, groupMs = 700 } = {}) {
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const currentRef = useRef(value);
  const fromHistoryRef = useRef(false);
  const lastPushRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const prev = currentRef.current;
    currentRef.current = value;
    if (prev === value) return;
    if (fromHistoryRef.current) {
      fromHistoryRef.current = false;
      return;
    }
    if (prev === undefined) return;
    const now = Date.now();
    if (now - lastPushRef.current > groupMs || pastRef.current.length === 0) {
      pastRef.current.push(prev);
      if (pastRef.current.length > limit) pastRef.current.shift();
    }
    lastPushRef.current = now;
    futureRef.current = [];
  }, [value, limit, groupMs]);

  const undo = useCallback(() => {
    if (!pastRef.current.length || !onChangeRef.current) return false;
    const prev = pastRef.current.pop();
    futureRef.current.push(currentRef.current);
    fromHistoryRef.current = true;
    lastPushRef.current = 0;
    onChangeRef.current(prev);
    return true;
  }, []);

  const redo = useCallback(() => {
    if (!futureRef.current.length || !onChangeRef.current) return false;
    const next = futureRef.current.pop();
    pastRef.current.push(currentRef.current);
    fromHistoryRef.current = true;
    lastPushRef.current = 0;
    onChangeRef.current(next);
    return true;
  }, []);

  /** Начать новый шаг истории (после вставки, заполнения и т.п.). */
  const breakGroup = useCallback(() => {
    lastPushRef.current = 0;
  }, []);

  return { undo, redo, breakGroup };
}

/* ───────────────────────────── горячие клавиши ───────────────────────────── */

function isEditableTextTarget(t) {
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
}

function caretAtStart(t) {
  return !isEditableTextTarget(t) || (t.selectionStart === 0 && t.selectionEnd === 0);
}

function caretAtEnd(t) {
  if (!isEditableTextTarget(t)) return true;
  const len = String(t.value ?? '').length;
  return t.selectionStart === len && t.selectionEnd === len;
}

const ARROWS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/**
 * Горячие клавиши сетки (вызывается из обработчика keydown документа, фаза capture).
 * @returns {boolean} true — клавиша обработана
 *
 * api: {
 *   getBounds(): { r0, c0, r1, c1 }, getFocus(): { r, c }, getAnchor(): { r, c },
 *   select(r, c, { extend }), focusEditor(r, c), getCells(), applyCells(nextCells),
 *   undo(), redo(), copyTsv(text), limits: { rowStart, rowEnd, colEnd }
 * }
 */
export function handleGridHotkey(e, api) {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key;
  const lower = key.length === 1 ? key.toLowerCase() : key;
  const t = e.target;

  // Подсказки формул открыты — Enter/стрелки принадлежат им.
  if (t?.getAttribute?.('aria-expanded') === 'true') return false;

  const done = () => {
    e.preventDefault();
    e.stopPropagation();
    return true;
  };

  if (mod && !e.altKey && (lower === 'z' || lower === 'я')) {
    if (e.shiftKey) api.redo();
    else api.undo();
    return done();
  }
  if (mod && !e.altKey && (lower === 'y' || lower === 'н')) {
    api.redo();
    return done();
  }

  // Остальные клавиши — только в ячейках тела таблицы (не в заголовках столбцов и настройках).
  if (!t?.closest?.('td[data-grid-r]')) return false;

  const bounds = api.getBounds();
  const multi = bounds.r0 !== bounds.r1 || bounds.c0 !== bounds.c1;

  if (mod && !e.altKey && (lower === 'x' || lower === 'ч')) {
    // Выделен текст внутри одной ячейки — обычное вырезание текста.
    if (!multi && isEditableTextTarget(t) && t.selectionStart !== t.selectionEnd) return false;
    const cells = api.getCells();
    api.copyTsv(rangeToTsv(cells, bounds), bounds);
    api.applyCells(clearCellValues(cells, bounds));
    return done();
  }

  if (mod && !e.altKey && (lower === 'd' || lower === 'в')) {
    const next = fillDownCells(api.getCells(), bounds, api.limits.rowStart);
    if (next) api.applyCells(next);
    return done();
  }
  if (mod && !e.altKey && (lower === 'r' || lower === 'к')) {
    const next = fillRightCells(api.getCells(), bounds);
    if (next) api.applyCells(next);
    return done();
  }

  if (key === 'F2') {
    const f = api.getFocus();
    api.focusEditor(f.r, f.c);
    return done();
  }

  if (mod && ARROWS[key]) {
    const dir = ARROWS[key];
    if (dir === 'left' && !caretAtStart(t) && !e.shiftKey) return false;
    if (dir === 'right' && !caretAtEnd(t) && !e.shiftKey) return false;
    const f = api.getFocus();
    const cells = api.getCells();
    const target = ctrlArrowTarget((r, c) => isCellValueFilled(cells, r, c), f.r, f.c, dir, api.limits);
    api.select(target.r, target.c, { extend: e.shiftKey });
    return done();
  }

  // Enter / Shift+Enter — вниз / вверх (Alt+Enter оставлен для переноса строки в ячейке).
  if (key === 'Enter' && !mod && !e.altKey) {
    const f = api.getFocus();
    const nr = e.shiftKey ? f.r - 1 : f.r + 1;
    if (nr >= api.limits.rowStart && nr <= api.limits.rowEnd) api.select(nr, f.c, { extend: false });
    return done();
  }

  if (key === 'Tab' && !mod && !e.altKey) {
    const f = api.getFocus();
    const nc = e.shiftKey ? f.c - 1 : f.c + 1;
    if (nc >= 0 && nc <= api.limits.colEnd) api.select(f.r, nc, { extend: false });
    return done();
  }

  return false;
}

/* ───────────────────────────── маркер автозаполнения ───────────────────────────── */

const sameBounds = (a, b) => a && b && a.r0 === b.r0 && a.r1 === b.r1 && a.c0 === b.c0 && a.c1 === b.c1;

/**
 * Протягивание маркера заполнения (квадрат в правом нижнем углу выделения).
 * Пока тянете — fillPreview с будущей областью; при отпускании вызывается onFill(source, target).
 * @param {object} opts
 * @param {(x: number, y: number) => ({ r: number, c: number } | null)} opts.resolveCell
 * @param {() => ({ r0, c0, r1, c1 })} opts.getSource
 * @param {(source: object, target: object) => void} opts.onFill
 */
export function useFillHandleDrag({ resolveCell, getSource, onFill }) {
  const dragRef = useRef(null);
  const [fillPreview, setFillPreview] = useState(null);
  const resolveRef = useRef(resolveCell);
  resolveRef.current = resolveCell;
  const sourceRef = useRef(getSource);
  sourceRef.current = getSource;
  const onFillRef = useRef(onFill);
  onFillRef.current = onFill;

  useEffect(() => {
    const onMove = (e) => {
      const drag = dragRef.current;
      if (!drag) return;
      const cell = resolveRef.current(e.clientX, e.clientY);
      if (!cell) return;
      const target = fillTargetForPointer(drag.source, cell.r, cell.c);
      if (!sameBounds(target, drag.target)) {
        drag.target = target;
        setFillPreview(target);
      }
    };
    const onUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setFillPreview(null);
      document.body.style.cursor = '';
      if (drag.target && !sameBounds(drag.target, drag.source)) onFillRef.current(drag.source, drag.target);
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
    };
  }, []);

  const startFillDrag = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const source = sourceRef.current();
    dragRef.current = { source, target: source };
    document.body.style.cursor = 'crosshair';
    setFillPreview(source);
  }, []);

  return { startFillDrag, fillPreview };
}

/** Ячейка в области будущего автозаполнения (но не в источнике). */
export function isInFillPreview(preview, source, r, c) {
  if (!preview) return false;
  const inPreview = r >= preview.r0 && r <= preview.r1 && c >= preview.c0 && c <= preview.c1;
  if (!inPreview) return false;
  return !(source && r >= source.r0 && r <= source.r1 && c >= source.c0 && c <= source.c1);
}
