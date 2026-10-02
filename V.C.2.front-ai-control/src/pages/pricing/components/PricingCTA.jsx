import React from 'react';
import styles from './PricingCTA.module.css';

const PricingCTA = ({
  title,
  subtitle,
  secondaryNote,
  customerType,
  onStartFree,
  onViewDemo,
  onContactSales,
}) => {
  return (
    <section className={styles.section} aria-labelledby="pricing-cta-title">
      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.glowLeft} aria-hidden="true" />
          <div className={styles.glowRight} aria-hidden="true" />
          <div className={styles.grid} aria-hidden="true" />

          <div className={styles.content}>
            <p className={styles.eyebrow}>Следующий шаг</p>
            <h2 id="pricing-cta-title" className={styles.title}>
              {title}
            </h2>
            <p className={styles.subtitle}>{subtitle}</p>

            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={onStartFree}>
                Начать бесплатно
              </button>
              <button type="button" className={styles.secondary} onClick={onViewDemo}>
                Посмотреть демо
              </button>
            </div>

            {customerType === 'business' && secondaryNote && (
              <div className={styles.enterprise}>
                <p className={styles.enterpriseNote}>{secondaryNote}</p>
                <button type="button" className={styles.contact} onClick={onContactSales}>
                  Связаться с нами
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingCTA;
