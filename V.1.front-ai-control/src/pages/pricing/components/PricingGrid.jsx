import React from 'react';
import PricingCard from './PricingCard';
import styles from './PricingGrid.module.css';

const PricingGrid = ({ plans, billingPeriod, customerType, onSelectPlan }) => {
  return (
    <section
      className={styles.section}
      aria-label="Тарифные планы"
      key={customerType}
    >
      <div className={styles.grid} data-count={plans.length}>
        {plans.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            billingPeriod={billingPeriod}
            onSelect={onSelectPlan}
          />
        ))}
      </div>
    </section>
  );
};

export default PricingGrid;
