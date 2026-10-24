export type CustomerType = 'individual' | 'business';

export type BillingPeriod = 'monthly' | 'yearly';

export type PricingCtaAction = 'free' | 'checkout' | 'contact' | 'custom' | 'demo';

export type ComparisonValue = boolean | string | number;

export type PricingFeature = {
  id: string;
  label: string;
  included: boolean;
  hint?: string;
};

export type PricingPlan = {
  id: string;
  name: string;
  description: string;
  priceMonthly: number | null;
  priceYearly: number | null;
  currency: string;
  popular?: boolean;
  badge?: string;
  features: PricingFeature[];
  cta: string;
  ctaAction: PricingCtaAction;
};

export type ComparisonRow = {
  id: string;
  label: string;
  category: string;
  values: Record<string, ComparisonValue>;
};

export type FAQItemData = {
  id: string;
  question: string;
  answer: string;
};

export type PricingCopy = {
  heroTitle: string;
  heroSubtitle: string;
  comparisonTitle: string;
  faqTitle: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaSecondaryNote?: string;
};

export type PricingConfig = {
  currency: string;
  yearlySavingsPercent: number;
  plans: Record<CustomerType, PricingPlan[]>;
  comparison: Record<CustomerType, ComparisonRow[]>;
  faq: Record<CustomerType, FAQItemData[]>;
  copy: Record<CustomerType, PricingCopy>;
};
