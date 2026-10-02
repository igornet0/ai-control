import React from 'react';
import CustomerTypeToggle from './CustomerTypeToggle';
import BillingToggle from './BillingToggle';
import styles from './PricingHero.module.css';

const PricingHero = ({
  title,
  subtitle,
  customerType,
  billingPeriod,
  savingsPercent,
  onCustomerTypeChange,
  onBillingPeriodChange,
}) => {
  return (
    <header className={styles.hero}>
      <div className={styles.glow} aria-hidden="true" />
      <p className={styles.eyebrow}>Тарифы BI-платформы</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{subtitle}</p>

      <div className={styles.controls}>
        <CustomerTypeToggle value={customerType} onChange={onCustomerTypeChange} />
        <BillingToggle
          value={billingPeriod}
          onChange={onBillingPeriodChange}
          savingsPercent={savingsPercent}
        />
      </div>
    </header>
  );
};

export default PricingHero;
