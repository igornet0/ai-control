import React, { useId } from 'react';
import styles from './FAQItem.module.css';

const FAQItem = ({ item, isOpen, onToggle }) => {
  const panelId = useId();
  const buttonId = useId();

  return (
    <div className={`${styles.item} ${isOpen ? styles.itemOpen : ''}`}>
      <h3 className={styles.heading}>
        <button
          id={buttonId}
          type="button"
          className={styles.trigger}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span>{item.question}</span>
          <span className={styles.icon} aria-hidden="true">
            {isOpen ? '−' : '+'}
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
      >
        <p className={styles.answer}>{item.answer}</p>
      </div>
    </div>
  );
};

export default FAQItem;
