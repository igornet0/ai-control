import React from 'react';
import styles from './FeatureComparison.module.css';

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={styles.checkSvg}>
    <path
      d="M13.2 4.4L6.4 11.2 2.8 7.6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const renderValue = (value) => {
  if (value === true) {
    return (
      <span className={styles.yes} aria-label="Доступно">
        <CheckIcon />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className={styles.no} aria-label="Недоступно">
        —
      </span>
    );
  }

  const text = String(value);
  const isUnlimited = /без ограничений|индивидуально/i.test(text);

  return (
    <span className={`${styles.valueChip} ${isUnlimited ? styles.valueHighlight : ''}`}>
      {text}
    </span>
  );
};

const getBuyLabel = (plan) => {
  if (plan.ctaAction === 'contact') return plan.cta || 'Связаться с нами';
  if (plan.ctaAction === 'free' || plan.priceMonthly === 0) return plan.cta || 'Начать бесплатно';
  return 'Купить';
};

const FeatureComparison = ({ title, plans, rows, customerType, onSelectPlan }) => {
  let lastCategory = null;

  return (
    <section className={styles.section} aria-labelledby="comparison-title" key={customerType}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Сравнение</p>
        <h2 id="comparison-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.subtitle}>
          Сравните лимиты и возможности по ключевым измерениям BI-платформы.
        </p>
      </div>

      <div className={styles.shell}>
        <div className={styles.tableWrap} tabIndex={0} aria-label="Таблица сравнения тарифов">
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={`${styles.featureCol} ${styles.headSticky}`}>
                  <span className={styles.featureColLabel}>Возможность</span>
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.id}
                    scope="col"
                    className={`${styles.planCol} ${styles.headSticky} ${plan.popular ? styles.planPopularHead : ''}`}
                  >
                    <div className={styles.planHead}>
                      <span className={styles.planName}>{plan.name}</span>
                      {plan.popular && plan.badge && (
                        <span className={styles.planBadge}>{plan.badge}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const showCategory = row.category !== lastCategory;
                lastCategory = row.category;
                return (
                  <React.Fragment key={row.id}>
                    {showCategory && (
                      <tr className={styles.categoryRow}>
                        <td colSpan={plans.length + 1}>
                          <span className={styles.categoryLabel}>{row.category}</span>
                        </td>
                      </tr>
                    )}
                    <tr className={styles.dataRow}>
                      <th scope="row" className={styles.rowLabel}>
                        {row.label}
                      </th>
                      {plans.map((plan) => (
                        <td
                          key={`${row.id}-${plan.id}`}
                          className={`${styles.cell} ${plan.popular ? styles.planPopularCell : ''}`}
                        >
                          {renderValue(row.values[plan.id])}
                        </td>
                      ))}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className={styles.ctaRow}>
                <th scope="row" className={`${styles.rowLabel} ${styles.ctaLabel}`}>
                  Выбрать тариф
                </th>
                {plans.map((plan) => (
                  <td
                    key={`cta-${plan.id}`}
                    className={`${styles.cell} ${styles.ctaCell} ${plan.popular ? styles.planPopularCell : ''}`}
                  >
                    <button
                      type="button"
                      className={`${styles.buyBtn} ${plan.popular ? styles.buyBtnPrimary : styles.buyBtnSecondary}`}
                      onClick={() => onSelectPlan?.(plan)}
                      aria-label={`${getBuyLabel(plan)}: тариф ${plan.name}`}
                    >
                      {getBuyLabel(plan)}
                    </button>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
};

export default FeatureComparison;
