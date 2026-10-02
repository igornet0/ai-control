import React from 'react';
import { getPageDimensions } from './documentPageLayout';
import styles from './DocumentsApp.module.css';

const THUMB_WIDTH = 120;

export default function SheetPreviewThumbRail({
  pages = [],
  currentIndex = 0,
  pageLayout,
  defaultOrientation = 'portrait',
  onSelect,
  renderPage,
}) {
  if (!pages.length) return null;

  return (
    <aside className={styles.sharePreviewThumbRail} aria-label="Миниатюры страниц">
      {pages.map((page, index) => {
        const orientation = page.orientation || defaultOrientation;
        const dims = getPageDimensions(pageLayout, orientation);
        const scale = THUMB_WIDTH / dims.widthPx;
        const isActive = index === currentIndex;

        return (
          <button
            key={index}
            type="button"
            className={`${styles.sharePreviewThumb} ${isActive ? styles.sharePreviewThumbActive : ''}`}
            onClick={() => onSelect?.(index)}
            aria-label={`Страница ${index + 1}`}
            aria-current={isActive ? 'page' : undefined}
            style={{ height: Math.round(dims.heightPx * scale) }}
          >
            <div
              className={styles.sharePreviewThumbScaler}
              style={{
                width: dims.widthPx,
                height: dims.heightPx,
                transform: `scale(${scale})`,
              }}
            >
              {renderPage(page, index)}
            </div>
            <span className={styles.sharePreviewThumbBadge}>{index + 1}</span>
          </button>
        );
      })}
    </aside>
  );
}
