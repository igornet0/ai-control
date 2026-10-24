import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { billingService } from '../../services/billingService';
import PricingHero from './components/PricingHero';
import PricingGrid from './components/PricingGrid';
import FeatureComparison from './components/FeatureComparison';
import FAQ from './components/FAQ';
import PricingCTA from './components/PricingCTA';
import CustomPlanConfigurator from './components/CustomPlanConfigurator';
import styles from './Pricing.module.css';

/** Цены из БД (billing_plans) поверх статического конфига — по code тарифа. */
function applyDbPrices(plans, dbPlans) {
  if (!dbPlans?.length) return plans;
  const byCode = new Map(dbPlans.map((p) => [p.code, p]));
  return plans.map((plan) => {
    const db = byCode.get(plan.id);
    if (!db || plan.priceMonthly === null) return plan;
    const priceMonthly = Number(db.price) || 0;
    const priceYearly = db.price_year == null ? priceMonthly * 12 : Number(db.price_year) || 0;
    return { ...plan, priceMonthly, priceYearly };
  });
}

const Pricing = () => {
  const [customerType, setCustomerType] = useState('individual');
  const [billingPeriod, setBillingPeriod] = useState('monthly');

  const navigate = useNavigate();
  const { user } = useAuth();
  const { openModal } = useAuthModal();
  const isAuthenticated = Boolean(user);
  const [dbPlans, setDbPlans] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // /pricing?custom=1 — сразу открыть конфигуратор индивидуального бизнес-плана
  useEffect(() => {
    if (searchParams.get('custom') !== '1') return;
    setCustomerType('business');
    setCustomOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('custom');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    billingService
      .getPublicPlans()
      .then((data) => {
        if (cancelled) return;
        setDbPlans(data?.plans || []);
        setCatalog(data?.catalog || null);
      })
      .catch(() => {
        /* витрина работает и на статическом конфиге */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const actions = useMemo(
    () =>
      createPricingActions({
        openAuthModal: openModal,
        navigate,
        isAuthenticated,
        demoUrl: '/',
        openCustomPlan: () => setCustomOpen(true),
      }),
    [openModal, navigate, isAuthenticated],
  );

  const plans = useMemo(() => applyDbPrices(getPlans(customerType), dbPlans), [customerType, dbPlans]);
  const basePlan = dbPlans.find((p) => p.code === 'business');
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
          onContactSales={() => actions.customPlan({ customerType, billingPeriod })}
        />
      </div>

      <CustomPlanConfigurator
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        catalog={catalog}
        basePlan={basePlan}
        billingPeriod={billingPeriod}
        isAuthenticated={isAuthenticated}
        onRequireAuth={() => openModal('register')}
      />
    </main>
  );
};

export default Pricing;
