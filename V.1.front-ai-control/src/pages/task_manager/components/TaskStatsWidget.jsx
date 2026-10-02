import React from 'react';
import styles from './TaskStatsWidget.module.css';

export function TaskStatsWidget({ children, className = '' }) {
  return (
    <div className={`card animate-fadeIn ${styles.widget} ${className}`}>
      {children}
    </div>
  );
}

export function TaskStatsWidgetBody({ children }) {
  return <div className={`card-body ${styles.body}`}>{children}</div>;
}

export function TaskStatsWidgetHeader({ children }) {
  return <div className={styles.header}>{children}</div>;
}

export function TaskStatsWidgetScroll({ children, contained = false }) {
  return (
    <div className={`${styles.scroll} ${contained ? styles.scrollContained : ''}`}>
      {children}
    </div>
  );
}

export function TaskStatsWidgetListScroll({ children, className = '' }) {
  return <div className={`${styles.listScroll} ${className}`.trim()}>{children}</div>;
}
