import React, { useRef } from 'react';
import styles from './BillingToggle.module.css';

const OPTIONS = [
  { value: 'monthly', label: 'Месяц' },
  { value: 'yearly', label: 'Год' },
];

const BillingToggle = ({ value, onChange, savingsPercent }) => {
  const buttonsRef = useRef([]);

  const selectIndex = (index) => {
    const option = OPTIONS[index];
    if (!option) return;
    onChange(option.value);
    buttonsRef.current[index]?.focus();
  };

  const handleKeyDown = (event, index) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      selectIndex((index + 1) % OPTIONS.length);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      selectIndex((index - 1 + OPTIONS.length) % OPTIONS.length);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toggle} role="group" aria-label="Период оплаты">
        {OPTIONS.map((option, index) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              ref={(node) => {
                buttonsRef.current[index] = node;
              }}
              type="button"
              aria-pressed={selected}
              className={`${styles.option} ${selected ? styles.optionActive : ''}`}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {value === 'yearly' && savingsPercent > 0 && (
        <p className={styles.savings} aria-live="polite">
          Экономия до {savingsPercent}%
        </p>
      )}
    </div>
  );
};

export default BillingToggle;
