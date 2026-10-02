import React, { useRef } from 'react';
import styles from './CustomerTypeToggle.module.css';

const OPTIONS = [
  { value: 'individual', label: 'Для себя', hint: 'Физическое лицо' },
  { value: 'business', label: 'Для бизнеса', hint: 'Юридическое лицо' },
];

const CustomerTypeToggle = ({ value, onChange }) => {
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
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      selectIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      selectIndex(OPTIONS.length - 1);
    }
  };

  return (
    <div className={styles.toggle} role="tablist" aria-label="Тип клиента">
      <div className={styles.track} aria-hidden="true">
        <span
          className={styles.thumb}
          data-position={value === 'business' ? 'right' : 'left'}
        />
      </div>
      {OPTIONS.map((option, index) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttonsRef.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={`${option.label} (${option.hint})`}
            tabIndex={selected ? 0 : -1}
            className={`${styles.option} ${selected ? styles.optionActive : ''}`}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span className={styles.label}>{option.label}</span>
            <span className={styles.hint}>{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
};

export default CustomerTypeToggle;
