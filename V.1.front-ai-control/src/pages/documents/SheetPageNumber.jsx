import React from 'react';
import {
  formatPageNumber,
  normalizePageNumberStyle,
  pageNumberPositionStyle,
  pageNumberTextStyle,
} from './documentPageNumber';
import styles from './DocumentsApp.module.css';

export default function SheetPageNumber({ page, total, pageNumberStyle }) {
  const cfg = normalizePageNumberStyle(pageNumberStyle);
  if (!cfg.enabled || !total || total < 1) return null;

  const text = formatPageNumber(cfg.format, page, total);

  return (
    <div
      className={styles.sheetPageNumber}
      style={{
        ...pageNumberTextStyle(cfg),
        ...pageNumberPositionStyle(cfg),
      }}
      aria-hidden
    >
      {text}
    </div>
  );
}
