import React from 'react';
import { DocIcon } from './DocumentIcons';
import styles from './DocumentsApp.module.css';

/**
 * Карточка шаблона или документа в сетке раздела «Документы».
 */
const ResourceCard = ({
  accent = 'violet',
  icon,
  title,
  subtitle,
  meta,
  metaDetail,
  badge,
  hint,
  selected = false,
  onOpen,
  primaryAction,
  primaryLabel = 'Создать',
  primaryLoading = false,
  primaryDisabled = false,
  ariaLabel,
}) => (
  <li
    className={`${styles.resourceCard} ${styles[`resourceCardAccent_${accent}`]} ${selected ? styles.resourceCardSelected : ''}`}
    onClick={onOpen}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen?.();
      }
    }}
    aria-label={ariaLabel}
  >
    <div className={styles.resourceCardGlow} aria-hidden />
    <div className={styles.resourceCardPreview} aria-hidden>
      <div className={styles.resourceCardPreviewLines}>
        <span /><span /><span />
      </div>
    </div>
    <div className={styles.resourceCardBody}>
      <div className={styles.resourceCardTop}>
        <span className={styles.resourceCardIcon} aria-hidden>
          <DocIcon name={icon} size={18} />
        </span>
        <div className={styles.resourceCardHeadings}>
          <div className={styles.resourceCardTitleRow}>
            <span className={styles.resourceCardTitle}>{title}</span>
            {badge && <span className={styles.resourceCardBadge}>{badge}</span>}
          </div>
          {subtitle && <span className={styles.resourceCardSubtitle}>{subtitle}</span>}
        </div>
      </div>
      {(meta || metaDetail) && (
        <div className={styles.resourceCardStats}>
          {meta && <span className={styles.resourceCardStat}>{meta}</span>}
          {metaDetail && <span className={styles.resourceCardStatMuted}>{metaDetail}</span>}
        </div>
      )}
      {hint && <span className={styles.resourceCardHint}>{hint}</span>}
      {primaryAction && (
        <div className={styles.resourceCardActions}>
          <button
            type="button"
            className={styles.resourceCardPrimaryBtn}
            onClick={(e) => {
              e.stopPropagation();
              primaryAction();
            }}
            disabled={primaryDisabled || primaryLoading}
          >
            {primaryLoading ? 'Создание…' : primaryLabel}
          </button>
        </div>
      )}
    </div>
  </li>
);

export default ResourceCard;
