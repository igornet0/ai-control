import React from 'react';
import {
  DEFAULT_PAGE_LAYOUT,
  PAGE_FORMAT_OPTIONS,
  getPageDimensions,
  normalizePageLayout,
} from './documentPageLayout';
import styles from './DocumentsApp.module.css';

function SegmentButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      className={`${styles.pageNumberSegmentBtn}${active ? ` ${styles.pageNumberSegmentBtnActive}` : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

export default function PageLayoutSettingsForm({ value, onChange }) {
  const cfg = normalizePageLayout(value);
  const patch = (partial) => onChange?.({ ...cfg, ...partial });
  const portrait = getPageDimensions(cfg, 'portrait');
  const landscape = getPageDimensions(cfg, 'landscape');

  return (
    <div className={styles.pageLayoutSettingsCard}>
      <div className={styles.pageLayoutSettingsIntro}>
        <span className={styles.pageLayoutSettingsTitle}>Размер и ориентация листа</span>
        <span className={styles.pageLayoutSettingsSubtitle}>
          По умолчанию A4 (210 × 297 мм, 72 dpi). Таблицы и длинный текст переносятся на следующие страницы.
        </span>
      </div>

      <div className={styles.pageLayoutSettingsGrid}>
        <label className={styles.pageNumberField}>
          <span className={styles.pageNumberFieldLabel}>Формат</span>
          <select
            className={styles.pageNumberFieldSelect}
            value={cfg.format}
            onChange={(e) => patch({ format: e.target.value })}
          >
            {PAGE_FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label className={styles.pageNumberField}>
          <span className={styles.pageNumberFieldLabel}>Ориентация листов</span>
          <div className={styles.pageNumberSegmentGroup}>
            <SegmentButton active={cfg.orientation === 'portrait'} onClick={() => patch({ orientation: 'portrait' })}>
              Книжная
            </SegmentButton>
            <SegmentButton active={cfg.orientation === 'landscape'} onClick={() => patch({ orientation: 'landscape' })}>
              Альбомная
            </SegmentButton>
          </div>
        </label>

        <label className={styles.pageNumberField}>
          <span className={styles.pageNumberFieldLabel}>Страницы с таблицами</span>
          <select
            className={styles.pageNumberFieldSelect}
            value={cfg.tablePagesOrientation}
            onChange={(e) => patch({ tablePagesOrientation: e.target.value })}
          >
            <option value="auto">Авто — альбомная, если есть таблица</option>
            <option value="landscape">Всегда альбомная</option>
            <option value="portrait">Как у остальных листов</option>
          </select>
        </label>
      </div>

      {cfg.format === 'custom' && (
        <div className={styles.pageLayoutCustomRow}>
          <label className={styles.pageNumberField}>
            <span className={styles.pageNumberFieldLabel}>Ширина, мм</span>
            <input
              type="number"
              min={50}
              max={2000}
              className={styles.pageNumberFieldInputNum}
              value={cfg.customWidthMm}
              onChange={(e) => patch({ customWidthMm: parseInt(e.target.value, 10) || DEFAULT_PAGE_LAYOUT.customWidthMm })}
            />
          </label>
          <label className={styles.pageNumberField}>
            <span className={styles.pageNumberFieldLabel}>Высота, мм</span>
            <input
              type="number"
              min={50}
              max={2000}
              className={styles.pageNumberFieldInputNum}
              value={cfg.customHeightMm}
              onChange={(e) => patch({ customHeightMm: parseInt(e.target.value, 10) || DEFAULT_PAGE_LAYOUT.customHeightMm })}
            />
          </label>
        </div>
      )}

      <p className={styles.pageLayoutPreviewSizes}>
        Портрет: {portrait.widthMm} × {portrait.heightMm} мм ({portrait.widthPx} × {portrait.heightPx} px)
        {' · '}
        Альбом: {landscape.widthMm} × {landscape.heightMm} мм
      </p>
    </div>
  );
}
