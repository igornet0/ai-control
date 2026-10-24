/**
 * Pricing action abstraction.
 * Checkout ведёт во вкладку «Тариф» профиля (billingService).
 */

/**
 * @typedef {'free' | 'checkout' | 'contact' | 'custom' | 'demo'} PricingCtaAction
 */

/**
 * @typedef {Object} PricingActionContext
 * @property {(tab?: string) => void} [openAuthModal]
 * @property {(path: string) => void} [navigate]
 * @property {boolean} [isAuthenticated]
 * @property {string} [contactEmail]
 * @property {string} [demoUrl]
 * @property {(meta?: Object) => void} [openCustomPlan] конфигуратор индивидуального плана
 */

/**
 * @typedef {Object} PlanActionPayload
 * @property {string} planId
 * @property {string} planName
 * @property {PricingCtaAction} ctaAction
 * @property {'individual' | 'business'} customerType
 * @property {'monthly' | 'yearly'} billingPeriod
 */

/**
 * @param {PricingActionContext} context
 */
export function createPricingActions(context = {}) {
  const {
    openAuthModal,
    navigate,
    isAuthenticated = false,
    contactEmail = 'sales@ai-control.local',
    demoUrl = '/',
    openCustomPlan,
  } = context;

  const ensureAuthOrRegister = () => {
    if (!isAuthenticated && openAuthModal) {
      openAuthModal('register');
      return false;
    }
    return true;
  };

  return {
    /** @param {PlanActionPayload} payload */
    selectPlan(payload) {
      const { ctaAction, planId, planName, customerType, billingPeriod } = payload;

      if (ctaAction === 'contact') {
        this.contactSales({ planId, planName, customerType, billingPeriod });
        return;
      }

      if (ctaAction === 'custom') {
        this.customPlan({ planId, planName, customerType, billingPeriod });
        return;
      }

      if (ctaAction === 'demo') {
        this.viewDemo();
        return;
      }

      if (ctaAction === 'checkout') {
        if (!ensureAuthOrRegister()) return;
        // Оплата и подключение тарифа — во вкладке «Тариф» профиля.
        const period = billingPeriod === 'yearly' ? 'year' : 'month';
        if (navigate) navigate(`/profile?tab=plan&plan=${encodeURIComponent(planId)}&period=${period}`);
        return;
      }

      if (ctaAction === 'free') {
        if (!ensureAuthOrRegister()) return;
        if (navigate) {
          navigate(isAuthenticated ? '/dashboard' : '/signin');
        }
      }
    },

    startFree() {
      if (!ensureAuthOrRegister()) return;
      if (navigate) navigate(isAuthenticated ? '/dashboard' : '/signin');
    },

    viewDemo() {
      if (navigate) {
        navigate(demoUrl);
        return;
      }
      window.location.assign(demoUrl);
    },

    /** @param {Partial<PlanActionPayload>} [meta] */
    customPlan(meta = {}) {
      if (openCustomPlan) {
        openCustomPlan(meta);
        return;
      }
      this.contactSales(meta);
    },

    /** @param {Partial<PlanActionPayload>} [meta] */
    contactSales(meta = {}) {
      const subject = encodeURIComponent(
        meta.planName
          ? `Запрос по тарифу ${meta.planName}`
          : 'Запрос корпоративной конфигурации AI-Control',
      );
      const body = encodeURIComponent(
        [
          'Здравствуйте!',
          '',
          'Интересует корпоративная конфигурация AI-Control.',
          meta.planName ? `Тариф: ${meta.planName}` : '',
          meta.billingPeriod ? `Период: ${meta.billingPeriod}` : '',
          '',
          'Контактные данные:',
        ]
          .filter(Boolean)
          .join('\n'),
      );
      window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
    },
  };
}
