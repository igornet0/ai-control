import React from 'react';
import styles from '../ProfileTabs.module.css';

export default function GuestEmptyState() {
  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className={styles.emptyTitle}>Нет доступа</p>
          <p style={{ maxWidth: '28rem', margin: '0 auto' }}>
            У вашей роли (Guest) нет доступа к разделу сотрудников. Обратитесь к администратору для назначения роли.
          </p>
        </div>
      </section>
    </div>
  );
}
