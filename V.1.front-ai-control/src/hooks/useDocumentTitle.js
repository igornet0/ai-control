import { useLayoutEffect, useRef } from 'react';

export const APP_TITLE = '2A Данные';
const PART_SEPARATOR = ' · ';
const APP_SEPARATOR = ' — ';

/**
 * Нормализует части заголовка: строка или массив (от частного к общему),
 * пустые значения отбрасываются, подряд идущие дубли схлопываются.
 */
export function normalizeTitleParts(parts) {
  const list = Array.isArray(parts) ? parts : [parts];
  const out = [];
  for (const raw of list) {
    const part = raw == null ? '' : String(raw).replace(/\s+/g, ' ').trim();
    if (!part) continue;
    if (out.length && out[out.length - 1].toLowerCase() === part.toLowerCase()) continue;
    out.push(part);
  }
  return out;
}

function formatBadge(count) {
  const n = Math.floor(Number(count) || 0);
  if (n <= 0) return '';
  return `(${n > 99 ? '99+' : n}) `;
}

/**
 * «Документ · Раздел — 2A Данные»; без частей — просто «2A Данные».
 * badge > 0 добавляет счётчик непрочитанных: «(3) Документ · Раздел — 2A Данные».
 */
export function formatDocumentTitle(parts, badge = 0) {
  const list = normalizeTitleParts(parts);
  const title = list.length ? `${list.join(PART_SEPARATOR)}${APP_SEPARATOR}${APP_TITLE}` : APP_TITLE;
  return `${formatBadge(badge)}${title}`;
}

/*
 * Несколько компонентов могут одновременно претендовать на заголовок вкладки
 * (маршрут в App → страница → открытая задача/чат). Побеждает источник,
 * отрендеренный позже всех: React рендерит родителя раньше детей, поэтому
 * более вложенный / позже открытый компонент уточняет заголовок родителя.
 * Источник с пустыми частями не участвует.
 */
const sources = new Map();
let renderSeq = 0;
let titleBadge = 0;

function applyDocumentTitle() {
  if (typeof document === 'undefined') return;
  let best = null;
  for (const entry of sources.values()) {
    if (!entry.parts.length) continue;
    if (!best || entry.order > best.order) best = entry;
  }
  const next = formatDocumentTitle(best?.parts, titleBadge);
  if (document.title !== next) document.title = next;
}

/**
 * Задаёт заголовок вкладки браузера, пока компонент смонтирован.
 * @param {string | Array<string | null | undefined> | null | undefined} parts
 *   части от частного к общему, напр. ['Отчёт Q3', 'Панель управления'];
 *   null/пусто — не влиять на заголовок.
 */
export function useDocumentTitle(parts) {
  const orderRef = useRef(null);
  if (orderRef.current == null) {
    renderSeq += 1;
    orderRef.current = renderSeq;
  }
  const normalized = normalizeTitleParts(parts);
  const key = normalized.join('\u0000');

  useLayoutEffect(() => {
    const token = orderRef;
    sources.set(token, { order: orderRef.current, parts: key ? key.split('\u0000') : [] });
    applyDocumentTitle();
    return () => {
      sources.delete(token);
      applyDocumentTitle();
    };
  }, [key]);
}

/** Счётчик перед заголовком вкладки (непрочитанные сообщения); 0 — без счётчика. */
export function useDocumentTitleBadge(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  useLayoutEffect(() => {
    titleBadge = n;
    applyDocumentTitle();
    return () => {
      titleBadge = 0;
      applyDocumentTitle();
    };
  }, [n]);
}

export default useDocumentTitle;
