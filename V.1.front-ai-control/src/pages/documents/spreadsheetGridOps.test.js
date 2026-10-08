import { describe, expect, it } from 'vitest';
import { cellKey } from './spreadsheetGridUtils';
import {
  ctrlArrowTarget,
  fillCells,
  fillDownCells,
  fillRightCells,
  fillTargetForPointer,
  clearCellValues,
  rangeToTsv,
} from './spreadsheetGridOps';

const cellsOf = (map) => Object.fromEntries(
  Object.entries(map).map(([k, value]) => [k, { value }]),
);
const v = (cells, r, c) => cells[cellKey(r, c)]?.value ?? '';

describe('fillCells (маркер автозаполнения)', () => {
  it('продолжает арифметическую прогрессию', () => {
    const cells = cellsOf({ [cellKey(0, 0)]: '1', [cellKey(1, 0)]: '3' });
    const next = fillCells(cells, { r0: 0, r1: 1, c0: 0, c1: 0 }, { r0: 0, r1: 4, c0: 0, c1: 0 });
    expect([2, 3, 4].map((r) => v(next, r, 0))).toEqual(['5', '7', '9']);
  });

  it('сохраняет десятичную запятую и знаки', () => {
    const cells = cellsOf({ [cellKey(0, 0)]: '1,5', [cellKey(1, 0)]: '2,0' });
    const next = fillCells(cells, { r0: 0, r1: 1, c0: 0, c1: 0 }, { r0: 0, r1: 3, c0: 0, c1: 0 });
    expect([v(next, 2, 0), v(next, 3, 0)]).toEqual(['2,5', '3,0']);
  });

  it('одно число копирует, текст с номером — увеличивает', () => {
    const cells = cellsOf({ [cellKey(0, 0)]: '7', [cellKey(0, 1)]: 'Позиция 9' });
    const next = fillCells(cells, { r0: 0, r1: 0, c0: 0, c1: 1 }, { r0: 0, r1: 2, c0: 0, c1: 1 });
    expect([v(next, 1, 0), v(next, 2, 0)]).toEqual(['7', '7']);
    expect([v(next, 1, 1), v(next, 2, 1)]).toEqual(['Позиция 10', 'Позиция 11']);
  });

  it('даты увеличиваются по дню', () => {
    const cells = cellsOf({ [cellKey(0, 0)]: '2026-01-31', [cellKey(0, 1)]: '28.02.2026' });
    const next = fillCells(cells, { r0: 0, r1: 0, c0: 0, c1: 1 }, { r0: 0, r1: 1, c0: 0, c1: 1 });
    expect(v(next, 1, 0)).toBe('2026-02-01');
    expect(v(next, 1, 1)).toBe('01.03.2026');
  });

  it('формулы сдвигаются с учётом $', () => {
    const cells = cellsOf({ [cellKey(0, 2)]: '=A1*$B$1' });
    const down = fillCells(cells, { r0: 0, r1: 0, c0: 2, c1: 2 }, { r0: 0, r1: 2, c0: 2, c1: 2 });
    expect([v(down, 1, 2), v(down, 2, 2)]).toEqual(['=A2*$B$1', '=A3*$B$1']);
    const right = fillCells(cells, { r0: 0, r1: 0, c0: 2, c1: 2 }, { r0: 0, r1: 0, c0: 2, c1: 3 });
    expect(v(right, 0, 3)).toBe('=B1*$B$1');
  });

  it('повторяет текстовый узор и заполняет вверх', () => {
    const cells = cellsOf({ [cellKey(2, 0)]: 'да', [cellKey(3, 0)]: 'нет' });
    const next = fillCells(cells, { r0: 2, r1: 3, c0: 0, c1: 0 }, { r0: 0, r1: 5, c0: 0, c1: 0 });
    expect([0, 1, 4, 5].map((r) => v(next, r, 0))).toEqual(['да', 'нет', 'да', 'нет']);
  });

  it('цель заполнения идёт по одной оси', () => {
    const src = { r0: 1, r1: 1, c0: 1, c1: 1 };
    expect(fillTargetForPointer(src, 5, 2)).toEqual({ r0: 1, r1: 5, c0: 1, c1: 1 });
    expect(fillTargetForPointer(src, 2, 6)).toEqual({ r0: 1, r1: 1, c0: 1, c1: 6 });
    expect(fillTargetForPointer(src, 0, 1)).toEqual({ r0: 0, r1: 1, c0: 1, c1: 1 });
  });
});

describe('Ctrl+D / Ctrl+R / вырезание', () => {
  it('Ctrl+D на одной ячейке копирует ячейку выше со сдвигом формулы', () => {
    const cells = cellsOf({ [cellKey(1, 0)]: '=B2+1' });
    const next = fillDownCells(cells, { r0: 2, r1: 2, c0: 0, c1: 0 });
    expect(v(next, 2, 0)).toBe('=B3+1');
  });

  it('Ctrl+D на диапазоне копирует верхнюю строку вниз', () => {
    const cells = cellsOf({ [cellKey(0, 0)]: 'x', [cellKey(0, 1)]: '5' });
    const next = fillDownCells(cells, { r0: 0, r1: 2, c0: 0, c1: 1 });
    expect([v(next, 2, 0), v(next, 2, 1)]).toEqual(['x', '5']);
  });

  it('Ctrl+D не трогает строку заголовков', () => {
    expect(fillDownCells({}, { r0: 1, r1: 1, c0: 0, c1: 0 }, 1)).toBeNull();
  });

  it('Ctrl+R копирует левый столбец вправо', () => {
    const cells = cellsOf({ [cellKey(0, 0)]: '=A2' });
    const next = fillRightCells(cells, { r0: 0, r1: 0, c0: 0, c1: 2 });
    expect([v(next, 0, 1), v(next, 0, 2)]).toEqual(['=B2', '=C2']);
  });

  it('вырезание = TSV + очистка', () => {
    const cells = cellsOf({ [cellKey(0, 0)]: 'a', [cellKey(0, 1)]: 'b', [cellKey(1, 0)]: 'c' });
    const bb = { r0: 0, r1: 1, c0: 0, c1: 1 };
    expect(rangeToTsv(cells, bb)).toBe('a\tb\nc\t');
    const cleared = clearCellValues(cells, bb);
    expect(v(cleared, 0, 0)).toBe('');
  });
});

describe('Ctrl+стрелка', () => {
  // Столбец: заполнено 0..3, пусто 4..6, заполнено 7, пусто до 9
  const filled = new Set([0, 1, 2, 3, 7]);
  const isFilled = (r) => filled.has(r);
  const limits = { rowStart: 0, rowEnd: 9, colEnd: 0 };

  it('внутри блока — к его краю', () => {
    expect(ctrlArrowTarget(isFilled, 0, 0, 'down', limits)).toEqual({ r: 3, c: 0 });
  });
  it('с края блока — к следующему заполненному', () => {
    expect(ctrlArrowTarget(isFilled, 3, 0, 'down', limits)).toEqual({ r: 7, c: 0 });
  });
  it('после последнего — к краю таблицы', () => {
    expect(ctrlArrowTarget(isFilled, 7, 0, 'down', limits)).toEqual({ r: 9, c: 0 });
  });
  it('вверх с учётом строки заголовков', () => {
    expect(ctrlArrowTarget(isFilled, 5, 0, 'up', { ...limits, rowStart: 1 })).toEqual({ r: 3, c: 0 });
    expect(ctrlArrowTarget(isFilled, 3, 0, 'up', { ...limits, rowStart: 1 })).toEqual({ r: 1, c: 0 });
  });
});
