import { describe, expect, it } from 'vitest';
import { getRouteTitle } from './routeTitles.js';
import { formatDocumentTitle, APP_TITLE } from '../hooks/useDocumentTitle.js';

describe('getRouteTitle', () => {
  it('maps dashboard routes', () => {
    expect(getRouteTitle('/dashboard')).toBe('Панели управления');
    expect(getRouteTitle('/dashboard/flows')).toBe('Управление потоками');
    expect(getRouteTitle('/dashboard/42')).toBe('Панель управления');
    expect(getRouteTitle('/dashboard/42/sheet/7')).toBe('Лист панели управления');
    expect(getRouteTitle('/flows/3')).toBe('Потоки');
  });

  it('maps data model routes', () => {
    expect(getRouteTitle('/data-models')).toBe('Модели данных');
    expect(getRouteTitle('/data-models/create')).toBe('Новая модель данных');
    expect(getRouteTitle('/data-models/5')).toBe('Модель данных');
    expect(getRouteTitle('/data-models/5/edit')).toBe('Редактирование модели данных');
  });

  it('returns null for landing and unknown routes', () => {
    expect(getRouteTitle('/')).toBeNull();
    expect(getRouteTitle('/unknown')).toBeNull();
  });
});

describe('formatDocumentTitle', () => {
  it('joins parts from specific to general and appends app name', () => {
    expect(formatDocumentTitle(['Отчёт Q3', 'Панель управления'])).toBe(
      `Отчёт Q3 · Панель управления — ${APP_TITLE}`,
    );
  });

  it('drops empty parts and collapses adjacent duplicates', () => {
    expect(formatDocumentTitle([null, '  ', 'Задачи', 'задачи'])).toBe(`Задачи — ${APP_TITLE}`);
    expect(formatDocumentTitle(null)).toBe(APP_TITLE);
    expect(formatDocumentTitle([])).toBe(APP_TITLE);
  });

  it('prefixes unread badge and caps it at 99+', () => {
    expect(formatDocumentTitle(['Иван', 'Чаты'], 3)).toBe(`(3) Иван · Чаты — ${APP_TITLE}`);
    expect(formatDocumentTitle(null, 150)).toBe(`(99+) ${APP_TITLE}`);
    expect(formatDocumentTitle('Задачи', 0)).toBe(`Задачи — ${APP_TITLE}`);
  });
});
