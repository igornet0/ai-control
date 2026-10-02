/** Company onboarding questionnaire schema + helpers. */

export const TOTAL_STEPS = 7;

export function emptyCompanyProfile() {
  return {
    general: {
      name: '',
      legalName: '',
      description: '',
      orgType: '',
      stage: '',
      foundedYear: '',
      employees: '',
      geography: '',
      industry: '',
    },
    products: {
      offering: '',
      offeringType: '',
      mainProduct: '',
      mainProductDescription: '',
      items: [],
      problemSolved: '',
      customerValue: '',
      // adaptive extras keyed by offeringType
      extras: {},
    },
    market: {
      customerType: '',
      audience: '',
      segments: [],
      market: '',
      regions: '',
      marketSize: '',
      competitors: [],
      advantage: '',
    },
    business: {
      model: '',
      modelDescription: '',
      revenueStreams: [],
      currentRevenue: '',
      targetRevenue: '',
      currency: 'USD',
      hideFinancials: false,
      extras: {},
    },
    organization: {
      departments: [],
    },
    strategy: {
      hasStrategy: '',
      mainGoal: '',
      yearlyGoals: [],
      problems: '',
      opportunities: '',
      vision3to5: '',
      companyShouldBecome: '',
      successMeans: '',
      result12m: '',
    },
    priorities: {
      selected: [],
      mainPriority: '',
      constraints: [],
      constraintsNote: '',
      risks: '',
    },
  };
}

export const ORG_TYPES = [
  'Стартап',
  'Малый бизнес',
  'Средний бизнес',
  'Крупная компания',
  'Корпорация',
  'Некоммерческая организация',
  'Другое',
];

export const STAGES = ['Идея', 'Pre-seed', 'Seed', 'Growth', 'Established', 'Enterprise'];

export const OFFERING_TYPES = [
  'Физический продукт',
  'Программное обеспечение',
  'SaaS',
  'Услуга',
  'Marketplace',
  'Платформа',
  'Консалтинг',
  'Производство',
  'Другое',
];

export const CUSTOMER_TYPES = ['B2B', 'B2C', 'B2G', 'B2B2C', 'Другое'];

export const BUSINESS_MODELS = [
  'Subscription',
  'One-time purchase',
  'Marketplace commission',
  'Advertising',
  'Freemium',
  'Licensing',
  'Service',
  'Enterprise contracts',
  'Другое',
];

export const PRIORITY_OPTIONS = [
  'Рост выручки',
  'Прибыльность',
  'Привлечение клиентов',
  'Удержание клиентов',
  'Выход на новый рынок',
  'Развитие продукта',
  'Разработка новых продуктов',
  'Автоматизация',
  'Снижение расходов',
  'Найм сотрудников',
  'Улучшение качества',
  'Увеличение производительности',
  'Масштабирование',
  'Инвестиции',
  'Другое',
];

export const CONSTRAINT_OPTIONS = [
  'Ограниченный бюджет',
  'Недостаток сотрудников',
  'Недостаток экспертизы',
  'Ограниченные технологии',
  'Ограниченные сроки',
  'Регуляторные ограничения',
  'Нет ограничений',
  'Другое',
];

export const PRODUCT_STATUSES = ['Идея', 'Разработка', 'Запущен', 'Масштабирование', 'Legacy'];

export const DEPT_PRESETS = [
  'Development',
  'Marketing',
  'Sales',
  'HR',
  'Finance',
  'Support',
  'Operations',
  'Legal',
  'Product',
  'Management',
];

/** Adaptive follow-up fields by offering type. */
export function adaptiveProductFields(offeringType) {
  const t = String(offeringType || '').toLowerCase();
  if (t.includes('saas') || t.includes('программ')) {
    return [
      { key: 'mrr', label: 'MRR / ARR', priority: 'recommended' },
      { key: 'customers', label: 'Количество клиентов', priority: 'recommended' },
      { key: 'arpu', label: 'ARPU', priority: 'optional' },
      { key: 'churn', label: 'Churn', priority: 'recommended' },
      { key: 'retention', label: 'Retention', priority: 'optional' },
      { key: 'cac', label: 'CAC', priority: 'optional' },
      { key: 'ltv', label: 'LTV', priority: 'optional' },
    ];
  }
  if (t.includes('marketplace')) {
    return [
      { key: 'sellers', label: 'Количество продавцов', priority: 'recommended' },
      { key: 'buyers', label: 'Количество покупателей', priority: 'recommended' },
      { key: 'gmv', label: 'GMV', priority: 'recommended' },
      { key: 'takeRate', label: 'Take rate', priority: 'optional' },
    ];
  }
  if (t.includes('производ') || t.includes('физическ')) {
    return [
      { key: 'whatProduce', label: 'Что производите?', priority: 'required' },
      { key: 'plants', label: 'Где расположены производства?', priority: 'recommended' },
      { key: 'capacity', label: 'Производственная мощность', priority: 'optional' },
      { key: 'suppliers', label: 'Основные поставщики', priority: 'optional' },
    ];
  }
  if (t.includes('услуг') || t.includes('консалт')) {
    return [
      { key: 'clientCount', label: 'Количество клиентов', priority: 'recommended' },
      { key: 'avgContract', label: 'Средний контракт', priority: 'optional' },
      { key: 'utilization', label: 'Utilization / загрузка', priority: 'optional' },
    ];
  }
  return [];
}

export function validateStep(step, data) {
  const errors = {};
  if (step === 1) {
    if (!data.general?.name?.trim()) errors.name = 'Обязательное поле';
    if (!data.general?.description?.trim()) errors.description = 'Обязательное поле';
  }
  if (step === 2) {
    if (!data.products?.offering?.trim()) errors.offering = 'Обязательное поле';
  }
  return errors;
}

/** Build human-readable Company Context for confirmation & AI. */
export function buildCompanyContextSummary(data) {
  const g = data.general || {};
  const p = data.products || {};
  const m = data.market || {};
  const b = data.business || {};
  const s = data.strategy || {};
  const pr = data.priorities || {};
  const goals = (s.yearlyGoals || []).map((x) => x.title || x).filter(Boolean);

  return {
    company: g.name || '—',
    industry: g.industry || p.offeringType || '—',
    product: p.mainProduct || p.offering || '—',
    productDescription: p.mainProductDescription || p.offering || '',
    businessModel: [m.customerType, b.model].filter(Boolean).join(' · ') || '—',
    targetCustomers: m.audience || m.customerType || '—',
    market: m.market || '—',
    stage: g.stage || '—',
    employees: g.employees || '—',
    mainPriority: pr.mainPriority || (pr.selected || [])[0] || '—',
    mainGoals: goals.length
      ? goals
      : [s.mainGoal, s.result12m].filter(Boolean),
    constraints: (pr.constraints || []).join(', ') || pr.constraintsNote || '—',
    risks: pr.risks || '—',
    vision: s.vision3to5 || s.companyShouldBecome || '—',
    geography: g.geography || m.regions || '—',
    departments: (data.organization?.departments || []).map((d) => d.name).filter(Boolean),
  };
}

export function formatContextPlainText(summary) {
  const goals = (summary.mainGoals || []).map((g, i) => `${i + 1}. ${g}`).join('\n') || '—';
  return [
    `COMPANY\n${summary.company}`,
    `INDUSTRY\n${summary.industry}`,
    `PRODUCT\n${summary.product}`,
    `BUSINESS MODEL\n${summary.businessModel}`,
    `TARGET CUSTOMERS\n${summary.targetCustomers}`,
    `MARKET\n${summary.market}`,
    `COMPANY STAGE\n${summary.stage}`,
    `EMPLOYEES\n${summary.employees}`,
    `MAIN PRIORITY\n${summary.mainPriority}`,
    `MAIN GOALS\n${goals}`,
    `CONSTRAINTS\n${summary.constraints}`,
    `RISKS\n${summary.risks}`,
    `VISION\n${summary.vision}`,
  ].join('\n\n');
}

/** Propose company strategy + goals from confirmed profile (no inventing beyond answers). */
export function buildStrategyProposalFromProfile(data) {
  const summary = buildCompanyContextSummary(data);
  const s = data.strategy || {};
  const pr = data.priorities || {};
  const priorities = (pr.selected || []).slice(0, 5);
  const descriptionLines = [
    summary.productDescription || summary.product,
    ...priorities.map((p) => `• ${p}`),
    summary.vision !== '—' ? `Vision: ${summary.vision}` : null,
    summary.constraints !== '—' ? `Constraints: ${summary.constraints}` : null,
  ].filter(Boolean);

  const goals = [];
  if (s.mainGoal?.trim()) {
    goals.push({ title: s.mainGoal.trim(), status: 'planned' });
  }
  (s.yearlyGoals || []).forEach((g) => {
    const title = typeof g === 'string' ? g : g.title;
    if (title?.trim()) {
      goals.push({
        title: title.trim(),
        description: g.description || null,
        due_date: g.deadline || null,
        status: 'planned',
      });
    }
  });
  if (s.result12m?.trim() && !goals.some((g) => g.title === s.result12m.trim())) {
    goals.push({ title: s.result12m.trim(), status: 'planned' });
  }
  if (!goals.length && priorities.length) {
    priorities.slice(0, 4).forEach((p) => goals.push({ title: p, status: 'planned' }));
  }

  return {
    type: 'company_strategy',
    title: summary.company !== '—'
      ? `Стратегия ${summary.company}: ${summary.mainPriority !== '—' ? summary.mainPriority : 'рост и устойчивость'}`
      : 'Стратегия компании',
    description: descriptionLines.join('\n'),
    goals,
    source: 'onboarding',
  };
}

export function followUpQuestions(data) {
  const questions = [];
  const s = data.strategy || {};
  const b = data.business || {};
  const p = data.products || {};

  if (/выручк|revenue|arr|mrr/i.test(s.mainGoal || '') || (data.priorities?.selected || []).includes('Рост выручки')) {
    if (!b.hideFinancials && !b.currentRevenue) {
      questions.push({ id: 'currentRevenue', label: 'Текущая выручка?', section: 'business' });
    }
    if (!b.hideFinancials && !b.targetRevenue) {
      questions.push({ id: 'targetRevenue', label: 'Целевая выручка?', section: 'business' });
    }
    if (!b.modelDescription) {
      questions.push({ id: 'growthSource', label: 'Основной источник роста?', section: 'business' });
    }
  }

  if (String(p.offeringType || '').toLowerCase().includes('saas')) {
    questions.push({
      id: 'saasMotion',
      label: 'Как продаёте SaaS?',
      type: 'multi',
      options: ['Free trial', 'Freemium', 'Enterprise sales', 'Self-service'],
      section: 'products',
    });
  }

  return questions.slice(0, 4);
}
