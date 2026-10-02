import React, { useEffect, useState } from 'react';
import styles from './DocumentsApp.module.css';

function buildPageItems(current, total) {
  if (total <= 1) return [1];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const items = [1];
  if (current > 3) items.push('…');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i += 1) {
    if (!items.includes(i)) items.push(i);
  }
  if (current < total - 2) items.push('…');
  if (!items.includes(total)) items.push(total);
  return items;
}

export default function SheetPreviewPager({ current, total, onChange }) {
  const [pageInput, setPageInput] = useState(String(current));

  useEffect(() => {
    setPageInput(String(current));
  }, [current]);

  if (total <= 0) return null;

  const goTo = (page) => {
    const next = Math.min(total, Math.max(1, page));
    onChange?.(next);
  };

  const commitInput = () => {
    const parsed = parseInt(pageInput, 10);
    if (!Number.isNaN(parsed)) goTo(parsed);
    else setPageInput(String(current));
  };

  const items = buildPageItems(current, total);

  return (
    <nav className={styles.sheetPreviewPager} aria-label="Навигация по страницам предпросмотра">
      <button
        type="button"
        className={styles.sheetPreviewPagerArrow}
        onClick={() => goTo(current - 1)}
        disabled={current <= 1}
        aria-label="Предыдущая страница"
      >
        ‹
      </button>
      {items.map((item, idx) => {
        if (item === '…') {
          return (
            <span key={`ellipsis-${idx}`} className={styles.sheetPreviewPagerEllipsis} aria-hidden>
              …
            </span>
          );
        }
        if (item === current) {
          return (
            <input
              key={`page-${item}`}
              type="number"
              min={1}
              max={total}
              className={styles.sheetPreviewPagerInput}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitInput();
                }
              }}
              aria-label={`Текущая страница, всего ${total}`}
              title={`Страница ${current} из ${total}`}
            />
          );
        }
        return (
          <button
            key={`page-${item}`}
            type="button"
            className={styles.sheetPreviewPagerPage}
            onClick={() => goTo(item)}
            aria-label={`Страница ${item}`}
          >
            {item}
          </button>
        );
      })}
      <button
        type="button"
        className={styles.sheetPreviewPagerArrow}
        onClick={() => goTo(current + 1)}
        disabled={current >= total}
        aria-label="Следующая страница"
      >
        ›
      </button>
    </nav>
  );
}
