import React from 'react';
import { formatPrice, getDisplayPrice } from '../pricing.config';
import styles from './PricingCard.module.css';

const CheckIcon = () => (
  <svg className={styles.checkIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M16.25 5.75L8 14 3.75 9.75"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CrossIcon = () => (
  <svg className={styles.crossIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

const PricingCard = ({ plan, billingPeriod, onSelect }) => {
  const display = getDisplayPrice(plan.priceMonthly, plan.priceYearly, billingPeriod);
  const isCustom = display.amount === null;
  const isPopular = Boolean(plan.popular);

  return (
    <article
      className={`${styles.card} ${isPopular ? styles.cardPopular : ''}`}
      aria-labelledby={`plan-${plan.id}-title`}
    >
      {plan.badge && <span className={styles.badge}>{plan.badge}</span>}

      <div className={styles.header}>
        <h3 id={`plan-${plan.id}-title`} className={styles.name}>
          {plan.name}
        </h3>
        <p className={styles.description}>{plan.description}</p>
      </div>

      <div className={styles.priceBlock} aria-live="polite">
        {isCustom ? (
          <p className={styles.priceCustom}>Индивидуально</p>
        ) : (
          <>
            <p className={styles.price} key={`${plan.id}-${billingPeriod}-${display.amount}`}>
              <span className={styles.amount}>{formatPrice(display.amount, plan.currency)}</span>
              <span className={styles.period}>{display.suffix}</span>
            </p>
            {display.note && <p className={styles.priceNote}>{display.note}</p>}
          </>
        )}
      </div>

      <ul className={styles.features}>
        {plan.features.map((feature) => (
          <li
            key={feature.id}
            className={`${styles.feature} ${feature.included ? '' : styles.featureMuted}`}
          >
            <span className={styles.featureIcon} aria-hidden="true">
              {feature.included ? <CheckIcon /> : <CrossIcon />}
            </span>
            <span>{feature.label}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={`${styles.cta} ${isPopular ? styles.ctaPrimary : styles.ctaSecondary}`}
        onClick={() => onSelect(plan)}
        aria-label={`${plan.cta}: тариф ${plan.name}`}
      >
        {plan.cta}
      </button>
    </article>
  );
};

export default PricingCard;
