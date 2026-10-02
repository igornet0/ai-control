import React from 'react';
import {
  IconPageBreak,
  IconSheetField,
  IconSheetImage,
  IconSheetText,
  IconStamp,
} from './DocumentIcons';
import styles from './DocumentsApp.module.css';

const BLOCK_META = {
  text: { label: 'Текст', Icon: IconSheetText },
  field: { label: 'Поле заполнения', Icon: IconSheetField },
  page_break: { label: 'Разрыв страницы', Icon: IconPageBreak },
  stamp: { label: 'Печать', Icon: IconStamp },
  image: { label: 'Изображение', Icon: IconSheetImage },
};

const SheetBlockAddButton = ({ blockType, onClick, disabled = false }) => {
  const meta = BLOCK_META[blockType];
  if (!meta) return null;
  const { label, Icon } = meta;

  return (
    <button
      type="button"
      className={`${styles.secondaryButton} ${styles.sheetToolbarBtn}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className={styles.sheetToolbarBtnPlus} aria-hidden>+</span>
      <Icon size={16} className={styles.sheetToolbarBtnIcon} />
      <span>{label}</span>
    </button>
  );
};

export default SheetBlockAddButton;
