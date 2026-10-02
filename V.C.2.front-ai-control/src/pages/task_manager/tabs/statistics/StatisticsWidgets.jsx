import React from 'react';

export function StatMetric({ label, value, tone = 'emerald', icon }) {
  return (
    <div className={`stat-metric stat-metric--${tone}`}>
      <div className="stat-metric__top">
        <span className="stat-metric__label">{label}</span>
        {icon && (
          <span className={`stat-metric__icon stat-metric__icon--${tone}`} aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <span className="stat-metric__value">{value ?? 0}</span>
    </div>
  );
}

export function StatHero({ value, label, tone = 'default', compact = false }) {
  const valueClass =
    tone === 'danger'
      ? 'stat-hero__value stat-hero__value--danger'
      : tone === 'success'
        ? 'stat-hero__value stat-hero__value--success'
        : 'stat-hero__value';

  return (
    <div className={`stat-hero ${compact ? 'stat-hero--compact' : ''}`}>
      <span className={valueClass}>{value ?? 0}</span>
      {label && <p className="stat-hero__label">{label}</p>}
    </div>
  );
}

export const StatIcons = {
  today: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  ),
  week: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  ),
  month: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h10M4 17h14" strokeLinecap="round" />
    </svg>
  ),
  allTime: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v18M3 12h18" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  teams: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3z" />
      <path d="M16 13c2.21 0 4 1.12 4 2.5V18H8v-2.5C8 14.12 9.79 13 12 13s4 1.12 4 2.5" />
      <path d="M8 13c-2.21 0-4 1.12-4 2.5V18h4" />
    </svg>
  ),
  projects: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h7l2 2h9v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" strokeLinejoin="round" />
    </svg>
  ),
  overdue: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
    </svg>
  ),
  complaint: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  praise: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.3L12 14.8 7.2 16.8l.9-5.3L4.2 7.7l5.4-.8L12 2z" />
    </svg>
  ),
  completed: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
};
