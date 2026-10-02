/**
 * Pricing action abstraction.
 * Does not charge payment providers directly — ready to plug in checkout later.
 */

/**
 * @typedef {'free' | 'checkout' | 'contact' | 'demo'} PricingCtaAction
 */

/**
 * @typedef {Object} PricingActionContext
 * @property {(tab?: string) => void} [openAuthModal]
 * @property {(path: string) => void} [navigate]
 * @property {boolean} [isAuthenticated]
 * @property {string} [contactEmail]
 * @property {string} [demoUrl]
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

      // Future: open checkout / create subscription / upgrade flow
      // e.g. billingApi.createCheckoutSession({ planId, billingPeriod })

      if (ctaAction === 'contact') {
        this.contactSales({ planId, planName, customerType, billingPeriod });
        return;
      }

      if (ctaAction === 'demo') {
        this.viewDemo();
        return;
      }

      if (ctaAction === 'free' || ctaAction === 'checkout') {
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
