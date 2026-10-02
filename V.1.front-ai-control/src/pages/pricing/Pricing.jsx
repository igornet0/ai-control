import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import {
  getComparison,
  getCopy,
  getFaq,
  getPlans,
  pricingConfig,
} from './pricing.config';
import { createPricingActions } from './pricingActions';
import PricingHero from './components/PricingHero';
import PricingGrid from './components/PricingGrid';
import FeatureComparison from './components/FeatureComparison';
import FAQ from './components/FAQ';
import PricingCTA from './components/PricingCTA';
import styles from './Pricing.module.css';

const Pricing = () => {
  const [customerType, setCustomerType] = useState('individual');
  const [billingPeriod, setBillingPeriod] = useState('monthly');

  const navigate = useNavigate();
  const { user } = useAuth();
  const { openModal } = useAuthModal();
  const isAuthenticated = Boolean(user);

  const actions = useMemo(
    () =>
      createPricingActions({
        openAuthModal: openModal,
        navigate,
        isAuthenticated,
        demoUrl: '/',
      }),
    [openModal, navigate, isAuthenticated],
  );

  const plans = getPlans(customerType);
  const comparisonRows = getComparison(customerType);
  const faqItems = getFaq(customerType);
  const copy = getCopy(customerType);

  const handleSelectPlan = (plan) => {
    actions.selectPlan({
      planId: plan.id,
      planName: plan.name,
      ctaAction: plan.ctaAction,
      customerType,
      billingPeriod,
    });
  };

  return (
    <main className={styles.page}>
      <div className={styles.bg} aria-hidden="true">
        <div className={styles.bgOrbLeft} />
        <div className={styles.bgOrbRight} />
        <div className={styles.bgGrid} />
      </div>

      <div className={styles.container}>
        <PricingHero
          title={copy.heroTitle}
          subtitle={copy.heroSubtitle}
          customerType={customerType}
          billingPeriod={billingPeriod}
          savingsPercent={pricingConfig.yearlySavingsPercent}
          onCustomerTypeChange={setCustomerType}
          onBillingPeriodChange={setBillingPeriod}
        />

        <PricingGrid
          plans={plans}
          billingPeriod={billingPeriod}
          customerType={customerType}
          onSelectPlan={handleSelectPlan}
        />

        <FeatureComparison
          title={copy.comparisonTitle}
          plans={plans}
          rows={comparisonRows}
          customerType={customerType}
          onSelectPlan={handleSelectPlan}
        />

        <FAQ title={copy.faqTitle} items={faqItems} customerType={customerType} />

        <PricingCTA
          title={copy.ctaTitle}
          subtitle={copy.ctaSubtitle}
          secondaryNote={copy.ctaSecondaryNote}
          customerType={customerType}
          onStartFree={() => actions.startFree()}
          onViewDemo={() => actions.viewDemo()}
          onContactSales={() => actions.contactSales({ customerType })}
        />
      </div>
    </main>
  );
};

export default Pricing;
