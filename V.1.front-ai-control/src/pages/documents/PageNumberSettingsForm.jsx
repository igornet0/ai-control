import React from 'react';
import { FONT_OPTIONS } from './SheetEditor';
import {
  DEFAULT_PAGE_NUMBER_STYLE,
  PAGE_NUMBER_FORMAT_PRESETS,
  formatPageNumber,
  normalizePageNumberStyle,
  pageNumberTextStyle,
} from './documentPageNumber';
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

function FieldLabel({ children, htmlFor }) {
  return (
    <label className={styles.pageNumberFieldLabel} htmlFor={htmlFor}>
      {children}
    </label>
  );
}

export default function PageNumberSettingsForm({ value, onChange }) {
  const cfg = normalizePageNumberStyle(value);
  const patch = (partial) => onChange?.({ ...cfg, ...partial });
  const previewText = formatPageNumber(cfg.format, 2, 5);
  const previewStyle = pageNumberTextStyle(cfg);

  const previewDotStyle = {
    left: cfg.horizontal === 'left' ? `${Math.min(cfg.offsetX / 5.95, 18)}%` : cfg.horizontal === 'right' ? 'auto' : '50%',
    right: cfg.horizontal === 'right' ? `${Math.min(cfg.offsetX / 5.95, 18)}%` : 'auto',
    top: cfg.vertical === 'top' ? `${Math.min(cfg.offsetY / 8.42, 12)}%` : 'auto',
    bottom: cfg.vertical === 'bottom' ? `${Math.min(cfg.offsetY / 8.42, 12)}%` : 'auto',
    transform: cfg.horizontal === 'center' ? 'translateX(-50%)' : undefined,
    ...previewStyle,
  };

  return (
    <div className={styles.pageNumberSettingsCard}>
      <div className={styles.pageNumberSettingsCardHeader}>
        <div className={styles.pageNumberSettingsCardHeaderText}>
          <span className={styles.pageNumberSettingsCardTitle}>Отображение на листе</span>
          <span className={styles.pageNumberSettingsCardSubtitle}>
            Номер страницы в итоговом документе, печати и PDF
          </span>
        </div>
        <label className={styles.pageNumberSwitch}>
          <input
            type="checkbox"
            className={styles.pageNumberSwitchInput}
            checked={!!cfg.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          <span className={styles.pageNumberSwitchTrack} aria-hidden />
          <span className={styles.pageNumberSwitchText}>
            {cfg.enabled ? 'Включено' : 'Выключено'}
          </span>
        </label>
      </div>

      {cfg.enabled && (
        <div className={styles.pageNumberSettingsCardBody}>
          <section className={styles.pageNumberSection}>
            <h4 className={styles.pageNumberSectionTitle}>Формат номера</h4>
            <div className={styles.pageNumberChips} role="listbox" aria-label="Формат номера страницы">
              {PAGE_NUMBER_FORMAT_PRESETS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={cfg.format === opt.value}
                  className={`${styles.pageNumberChip}${cfg.format === opt.value ? ` ${styles.pageNumberChipActive}` : ''}`}
                  onClick={() => patch({ format: opt.value })}
                >
                  <span className={styles.pageNumberChipLabel}>{opt.label}</span>
                  <span className={styles.pageNumberChipCode}>{opt.value}</span>
                </button>
              ))}
            </div>
            <div className={styles.pageNumberField}>
              <FieldLabel htmlFor="page-number-custom-format">Свой шаблон</FieldLabel>
              <input
                id="page-number-custom-format"
                type="text"
                value={cfg.format}
                onChange={(e) => patch({ format: e.target.value })}
                className={styles.pageNumberFieldInput}
                placeholder="{page} / {total}"
                spellCheck={false}
              />
            </div>
          </section>

          <div className={styles.pageNumberSectionRow}>
            <section className={styles.pageNumberSection}>
              <h4 className={styles.pageNumberSectionTitle}>Положение</h4>
              <div className={styles.pageNumberField}>
                <span className={styles.pageNumberFieldLabel}>Вертикаль</span>
                <div className={styles.pageNumberSegmentGroup}>
                  <SegmentButton active={cfg.vertical === 'bottom'} onClick={() => patch({ vertical: 'bottom' })}>
                    Внизу
                  </SegmentButton>
                  <SegmentButton active={cfg.vertical === 'top'} onClick={() => patch({ vertical: 'top' })}>
                    Вверху
                  </SegmentButton>
                </div>
              </div>
              <div className={styles.pageNumberField}>
                <span className={styles.pageNumberFieldLabel}>Горизонталь</span>
                <div className={styles.pageNumberSegmentGroup}>
                  <SegmentButton active={cfg.horizontal === 'left'} onClick={() => patch({ horizontal: 'left' })}>
                    Слева
                  </SegmentButton>
                  <SegmentButton active={cfg.horizontal === 'center'} onClick={() => patch({ horizontal: 'center' })}>
                    Центр
                  </SegmentButton>
                  <SegmentButton active={cfg.horizontal === 'right'} onClick={() => patch({ horizontal: 'right' })}>
                    Справа
                  </SegmentButton>
                </div>
              </div>
              <div className={styles.pageNumberOffsetGrid}>
                <div className={styles.pageNumberField}>
                  <FieldLabel htmlFor="page-number-offset-x">Отступ X, px</FieldLabel>
                  <input
                    id="page-number-offset-x"
                    type="number"
                    min={0}
                    max={200}
                    value={cfg.offsetX}
                    onChange={(e) => patch({ offsetX: e.target.value ? parseInt(e.target.value, 10) : 0 })}
                    className={styles.pageNumberFieldInputNum}
                  />
                </div>
                <div className={styles.pageNumberField}>
                  <FieldLabel htmlFor="page-number-offset-y">Отступ Y, px</FieldLabel>
                  <input
                    id="page-number-offset-y"
                    type="number"
                    min={0}
                    max={200}
                    value={cfg.offsetY}
                    onChange={(e) => patch({ offsetY: e.target.value ? parseInt(e.target.value, 10) : 0 })}
                    className={styles.pageNumberFieldInputNum}
                  />
                </div>
              </div>
            </section>

            <section className={`${styles.pageNumberSection} ${styles.pageNumberPreviewSection}`}>
              <h4 className={styles.pageNumberSectionTitle}>Превью</h4>
              <div className={styles.pageNumberPreviewSheet} aria-hidden>
                <div className={styles.pageNumberPreviewSheetInner} />
                <span className={styles.pageNumberPreviewDot} style={previewDotStyle}>
                  {previewText}
                </span>
              </div>
              <p className={styles.pageNumberPreviewCaption}>Пример: страница 2 из 5</p>
            </section>
          </div>

          <section className={styles.pageNumberSection}>
            <h4 className={styles.pageNumberSectionTitle}>Оформление</h4>
            <div className={styles.pageNumberStyleGrid}>
              <div className={styles.pageNumberField}>
                <FieldLabel htmlFor="page-number-font">Шрифт</FieldLabel>
                <select
                  id="page-number-font"
                  value={cfg.fontFamily || ''}
                  onChange={(e) => patch({ fontFamily: e.target.value || undefined })}
                  className={styles.pageNumberFieldSelect}
                >
                  {FONT_OPTIONS.map((opt) => (
                    <option key={opt.value || 'default'} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.pageNumberField}>
                <FieldLabel htmlFor="page-number-size">Размер, px</FieldLabel>
                <input
                  id="page-number-size"
                  type="number"
                  min={8}
                  max={24}
                  value={cfg.fontSize ?? DEFAULT_PAGE_NUMBER_STYLE.fontSize}
                  onChange={(e) => patch({ fontSize: e.target.value ? parseInt(e.target.value, 10) : 10 })}
                  className={styles.pageNumberFieldInputNum}
                />
              </div>
              <div className={styles.pageNumberField}>
                <FieldLabel htmlFor="page-number-color-text">Цвет</FieldLabel>
                <div className={styles.pageNumberColorRow}>
                  <input
                    id="page-number-color"
                    type="color"
                    value={cfg.color || '#64748b'}
                    onChange={(e) => patch({ color: e.target.value })}
                    className={styles.pageNumberColorPicker}
                    title={cfg.color || '#64748b'}
                  />
                  <input
                    id="page-number-color-text"
                    type="text"
                    value={cfg.color || '#64748b'}
                    onChange={(e) => patch({ color: e.target.value || undefined })}
                    className={styles.pageNumberFieldInput}
                    placeholder="#64748b"
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
            <div className={styles.pageNumberStyleToggles}>
              <label className={styles.pageNumberStyleToggle}>
                <input
                  type="checkbox"
                  checked={!!cfg.bold}
                  onChange={(e) => patch({ bold: e.target.checked })}
                />
                <span>Жирный</span>
              </label>
              <label className={styles.pageNumberStyleToggle}>
                <input
                  type="checkbox"
                  checked={!!cfg.italic}
                  onChange={(e) => patch({ italic: e.target.checked })}
                />
                <span>Курсив</span>
              </label>
            </div>
          </section>

          <p className={styles.pageNumberSettingsHint}>
            <code>{'{page}'}</code> — номер страницы, <code>{'{total}'}</code> — всего страниц.
            Сохраняется вместе с шаблоном.
          </p>
        </div>
      )}
    </div>
  );
}
