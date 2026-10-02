import type { PricingConfig } from './pricing.types.ts';

/**
 * Draft / placeholder pricing configuration (not final commercial prices).
 * Update amounts here without touching UI components.
 * Replace with API client later when billing backend is ready.
 */
export const pricingConfig: PricingConfig = {
  currency: '₽',
  yearlySavingsPercent: 17,
  plans: {
    individual: [
      {
        id: 'free',
        name: 'Free',
        description: 'Для знакомства с платформой и первых экспериментов с данными.',
        priceMonthly: 0,
        priceYearly: 0,
        currency: '₽',
        features: [
          { id: 'sources', label: '2 источника данных', included: true },
          { id: 'dashboards', label: '3 дашборда', included: true },
          { id: 'projects', label: '1 проект', included: true },
          { id: 'widgets', label: 'Базовые виджеты', included: true },
          { id: 'export', label: 'Базовый экспорт CSV', included: true },
          { id: 'ai', label: 'AI-запросы: 20 / мес', included: true },
          { id: 'automation', label: 'Автоматизация', included: false },
          { id: 'support', label: 'Community support', included: true },
        ],
        cta: 'Начать бесплатно',
        ctaAction: 'free',
      },
      {
        id: 'pro',
        name: 'Pro',
        description: 'Для аналитиков, специалистов и индивидуальных проектов.',
        priceMonthly: 990,
        priceYearly: 9900,
        currency: '₽',
        popular: true,
        badge: 'Популярный',
        features: [
          { id: 'sources', label: '10 источников данных', included: true },
          { id: 'dashboards', label: '50 дашбордов', included: true },
          { id: 'projects', label: '10 проектов', included: true },
          { id: 'widgets', label: 'Расширенные виджеты', included: true },
          { id: 'import', label: 'Импорт данных', included: true },
          { id: 'export', label: 'Экспорт PDF / CSV / Excel', included: true },
          { id: 'refresh', label: 'Автообновление данных', included: true },
          { id: 'ai', label: 'AI-запросы: 500 / мес', included: true },
          { id: 'automation', label: '5 автоматизаций', included: true },
          { id: 'support', label: 'Приоритетная поддержка', included: true },
        ],
        cta: 'Выбрать Pro',
        ctaAction: 'checkout',
      },
      {
        id: 'premium',
        name: 'Premium',
        description: 'Для пользователей, которым нужны расширенные возможности BI.',
        priceMonthly: 2490,
        priceYearly: 24900,
        currency: '₽',
        features: [
          { id: 'sources', label: '50 источников данных', included: true },
          { id: 'dashboards', label: 'Неограниченные дашборды', included: true },
          { id: 'analytics', label: 'Расширенная аналитика', included: true },
          { id: 'ai', label: 'AI-запросы: 2 000 / мес', included: true },
          { id: 'automation', label: '50 автоматизаций', included: true },
          { id: 'integrations', label: 'Расширенные интеграции', included: true },
          { id: 'storage', label: '50 ГБ хранилища', included: true },
          { id: 'api', label: 'Ограниченный API', included: true },
          { id: 'support', label: 'Расширенная поддержка', included: true },
        ],
        cta: 'Выбрать Premium',
        ctaAction: 'checkout',
      },
    ],
    business: [
      {
        id: 'startup',
        name: 'Startup',
        description: 'Для небольших компаний и команд, которые начинают с BI.',
        priceMonthly: 4990,
        priceYearly: 49900,
        currency: '₽',
        features: [
          { id: 'users', label: 'До 5 пользователей', included: true },
          { id: 'collaboration', label: 'Командная работа', included: true },
          { id: 'dashboards', label: 'Общие дашборды', included: true },
          { id: 'sources', label: '20 источников данных', included: true },
          { id: 'roles', label: 'Базовые роли и права', included: true },
          { id: 'export', label: 'Экспорт PDF / CSV / Excel', included: true },
          { id: 'reports', label: 'Планировщик отчётов', included: true },
          { id: 'ai', label: 'AI-запросы: 1 000 / мес', included: true },
          { id: 'support', label: 'Базовая поддержка', included: true },
        ],
        cta: 'Начать',
        ctaAction: 'checkout',
      },
      {
        id: 'business',
        name: 'Business',
        description: 'Для отделов аналитики и растущего бизнеса.',
        priceMonthly: 14990,
        priceYearly: 149900,
        currency: '₽',
        popular: true,
        badge: 'Популярный',
        features: [
          { id: 'users', label: 'До 50 пользователей', included: true },
          { id: 'roles', label: 'Расширенные роли и RBAC', included: true },
          { id: 'sources', label: '100 источников данных', included: true },
          { id: 'dashboards', label: 'Неограниченные дашборды', included: true },
          { id: 'refresh', label: 'Автообновление данных', included: true },
          { id: 'ai', label: 'AI-аналитика: 10 000 / мес', included: true },
          { id: 'api', label: 'Полный API-доступ', included: true },
          { id: 'integrations', label: 'Корпоративные интеграции', included: true },
          { id: 'audit', label: 'Журнал аудита', included: true },
          { id: 'storage', label: '500 ГБ хранилища', included: true },
          { id: 'support', label: 'Приоритетная поддержка', included: true },
        ],
        cta: 'Выбрать Business',
        ctaAction: 'checkout',
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Для крупных организаций с требованиями к безопасности и SLA.',
        priceMonthly: null,
        priceYearly: null,
        currency: '₽',
        features: [
          { id: 'users', label: 'Неограниченные пользователи', included: true },
          { id: 'rbac', label: 'Enterprise RBAC', included: true },
          { id: 'sso', label: 'SSO / SAML', included: true },
          { id: 'audit', label: 'Расширенный аудит', included: true },
          { id: 'sla', label: 'Гарантированный SLA', included: true },
          { id: 'infra', label: 'Выделенная инфраструктура', included: true },
          { id: 'onprem', label: 'Private / on-premise deployment', included: true },
          { id: 'integrations', label: 'Индивидуальные интеграции', included: true },
          { id: 'limits', label: 'Повышенные лимиты', included: true },
          { id: 'manager', label: 'Персональный менеджер', included: true },
          { id: 'support', label: 'Корпоративная поддержка 24/7', included: true },
        ],
        cta: 'Связаться с нами',
        ctaAction: 'contact',
      },
    ],
  },
  comparison: {
    individual: [
      {
        id: 'sources',
        label: 'Источники данных',
        category: 'Данные',
        values: { free: 2, pro: 10, premium: 50 },
      },
      {
        id: 'dashboards',
        label: 'Дашборды',
        category: 'Аналитика',
        values: { free: 3, pro: 50, premium: 'Без ограничений' },
      },
      {
        id: 'storage',
        label: 'Хранилище',
        category: 'Данные',
        values: { free: '1 ГБ', pro: '10 ГБ', premium: '50 ГБ' },
      },
      {
        id: 'ai',
        label: 'AI-запросы / мес',
        category: 'AI',
        values: { free: 20, pro: 500, premium: 2000 },
      },
      {
        id: 'automation',
        label: 'Автоматизации',
        category: 'Автоматизация',
        values: { free: false, pro: 5, premium: 50 },
      },
      {
        id: 'users',
        label: 'Пользователи',
        category: 'Команда',
        values: { free: 1, pro: 1, premium: 1 },
      },
      {
        id: 'rbac',
        label: 'Роли / RBAC',
        category: 'Безопасность',
        values: { free: false, pro: false, premium: false },
      },
      {
        id: 'export',
        label: 'Экспорт',
        category: 'Экспорт',
        values: { free: 'CSV', pro: 'PDF / CSV / Excel', premium: 'PDF / CSV / Excel' },
      },
      {
        id: 'api',
        label: 'API',
        category: 'Интеграции',
        values: { free: false, pro: false, premium: 'Ограниченный' },
      },
      {
        id: 'reports',
        label: 'Планировщик отчётов',
        category: 'Автоматизация',
        values: { free: false, pro: false, premium: true },
      },
      {
        id: 'collaboration',
        label: 'Командная работа',
        category: 'Команда',
        values: { free: false, pro: false, premium: false },
      },
      {
        id: 'audit',
        label: 'Аудит',
        category: 'Безопасность',
        values: { free: false, pro: false, premium: false },
      },
      {
        id: 'sso',
        label: 'SSO',
        category: 'Безопасность',
        values: { free: false, pro: false, premium: false },
      },
      {
        id: 'support',
        label: 'Поддержка',
        category: 'Поддержка',
        values: { free: 'Community', pro: 'Приоритетная', premium: 'Расширенная' },
      },
      {
        id: 'sla',
        label: 'SLA',
        category: 'Поддержка',
        values: { free: false, pro: false, premium: false },
      },
    ],
    business: [
      {
        id: 'sources',
        label: 'Источники данных',
        category: 'Данные',
        values: { startup: 20, business: 100, enterprise: 'Без ограничений' },
      },
      {
        id: 'dashboards',
        label: 'Дашборды',
        category: 'Аналитика',
        values: { startup: 100, business: 'Без ограничений', enterprise: 'Без ограничений' },
      },
      {
        id: 'storage',
        label: 'Хранилище',
        category: 'Данные',
        values: { startup: '50 ГБ', business: '500 ГБ', enterprise: 'Индивидуально' },
      },
      {
        id: 'ai',
        label: 'AI-запросы / мес',
        category: 'AI',
        values: { startup: 1000, business: 10000, enterprise: 'Индивидуально' },
      },
      {
        id: 'automation',
        label: 'Автоматизации',
        category: 'Автоматизация',
        values: { startup: 20, business: 200, enterprise: 'Без ограничений' },
      },
      {
        id: 'users',
        label: 'Пользователи',
        category: 'Команда',
        values: { startup: 5, business: 50, enterprise: 'Без ограничений' },
      },
      {
        id: 'rbac',
        label: 'Роли / RBAC',
        category: 'Безопасность',
        values: { startup: 'Базовые', business: 'Расширенные', enterprise: 'Enterprise' },
      },
      {
        id: 'export',
        label: 'Экспорт',
        category: 'Экспорт',
        values: {
          startup: 'PDF / CSV / Excel',
          business: 'PDF / CSV / Excel',
          enterprise: 'PDF / CSV / Excel + API',
        },
      },
      {
        id: 'api',
        label: 'API',
        category: 'Интеграции',
        values: { startup: 'Ограниченный', business: true, enterprise: true },
      },
      {
        id: 'reports',
        label: 'Планировщик отчётов',
        category: 'Автоматизация',
        values: { startup: true, business: true, enterprise: true },
      },
      {
        id: 'collaboration',
        label: 'Командная работа',
        category: 'Команда',
        values: { startup: true, business: true, enterprise: true },
      },
      {
        id: 'audit',
        label: 'Аудит',
        category: 'Безопасность',
        values: { startup: false, business: true, enterprise: true },
      },
      {
        id: 'sso',
        label: 'SSO',
        category: 'Безопасность',
        values: { startup: false, business: false, enterprise: true },
      },
      {
        id: 'support',
        label: 'Поддержка',
        category: 'Поддержка',
        values: { startup: 'Базовая', business: 'Приоритетная', enterprise: '24/7 + менеджер' },
      },
      {
        id: 'sla',
        label: 'SLA',
        category: 'Поддержка',
        values: { startup: false, business: false, enterprise: true },
      },
    ],
  },
  faq: {
    individual: [
      {
        id: 'free-start',
        question: 'Можно ли начать бесплатно?',
        answer:
          'Да. Тариф Free позволяет подключить источники, создать базовые дашборды и оценить возможности платформы без оплаты.',
      },
      {
        id: 'change-plan',
        question: 'Можно ли изменить тариф?',
        answer:
          'Да. Вы можете повысить или понизить тариф в любое время. Изменения применяются к следующему расчётному периоду.',
      },
      {
        id: 'limits',
        question: 'Что происходит при превышении лимита?',
        answer:
          'Мы уведомим вас о приближении к лимиту. Вы сможете обновить тариф или временно ограничить создание новых ресурсов.',
      },
      {
        id: 'yearly',
        question: 'Можно ли оплачивать ежегодно?',
        answer:
          'Да. Годовая оплата даёт скидку относительно ежемесячной. Переключение доступно прямо на этой странице.',
      },
      {
        id: 'sources',
        question: 'Можно ли подключить собственные источники данных?',
        answer:
          'Да. Платформа поддерживает файлы, базы данных и внешние интеграции. Количество источников зависит от тарифа.',
      },
      {
        id: 'api',
        question: 'Есть ли API?',
        answer:
          'Ограниченный API доступен на Premium. Для полноценного командного API и корпоративных интеграций выберите бизнес-тарифы.',
      },
      {
        id: 'team',
        question: 'Поддерживается ли командная работа?',
        answer:
          'Тарифы для физических лиц рассчитаны на одного пользователя. Для совместной работы, ролей и RBAC переключитесь на «Юридическое лицо».',
      },
      {
        id: 'enterprise',
        question: 'Есть ли корпоративные тарифы?',
        answer:
          'Да. В разделе «Юридическое лицо» доступны Startup, Business и Enterprise с командными и security-возможностями.',
      },
    ],
    business: [
      {
        id: 'free-start',
        question: 'Можно ли начать бесплатно?',
        answer:
          'Для знакомства с продуктом можно начать с тарифа Free в разделе «Физическое лицо». Для команд обычно выбирают Startup или Business.',
      },
      {
        id: 'change-plan',
        question: 'Можно ли изменить тариф?',
        answer:
          'Да. Масштабируйте число пользователей и лимиты при росте команды. Переход на Enterprise оформляется через менеджера.',
      },
      {
        id: 'limits',
        question: 'Что происходит при превышении лимита?',
        answer:
          'Администратор организации получит уведомление. Можно расширить лимиты, добавить пользователей или перейти на следующий тариф.',
      },
      {
        id: 'yearly',
        question: 'Можно ли оплачивать ежегодно?',
        answer:
          'Да. Годовая оплата доступна для Startup и Business и снижает стоимость относительно помесячной схемы.',
      },
      {
        id: 'sources',
        question: 'Можно ли подключить собственные источники данных?',
        answer:
          'Да. Бизнес-тарифы поддерживают больше источников, корпоративные интеграции и автоматическое обновление данных.',
      },
      {
        id: 'api',
        question: 'Есть ли API?',
        answer:
          'На Business и Enterprise доступен полноценный API. На Startup — ограниченный доступ для базовых сценариев.',
      },
      {
        id: 'team',
        question: 'Поддерживается ли командная работа?',
        answer:
          'Да. Все бизнес-тарифы включают совместные дашборды, роли и права доступа. Business и Enterprise добавляют RBAC и аудит.',
      },
      {
        id: 'enterprise',
        question: 'Есть ли корпоративные тарифы?',
        answer:
          'Да. Enterprise включает SSO, SLA, private deployment, персонального менеджера и индивидуальные лимиты.',
      },
    ],
  },
  copy: {
    individual: {
      heroTitle: 'Выберите план для работы с данными',
      heroSubtitle:
        'Анализируйте данные, создавайте интерактивные дашборды и автоматизируйте отчётность с помощью BI-платформы.',
      comparisonTitle: 'Сравнение возможностей',
      faqTitle: 'Частые вопросы',
      ctaTitle: 'Готовы начать работать с данными?',
      ctaSubtitle: 'Создайте первый дашборд и оцените возможности платформы.',
    },
    business: {
      heroTitle: 'Тарифы для команд и компаний',
      heroSubtitle:
        'Совместная работа, роли и RBAC, API, автоматизация отчётности и корпоративная безопасность — подберите план под размер организации.',
      comparisonTitle: 'Сравнение возможностей',
      faqTitle: 'Частые вопросы',
      ctaTitle: 'Готовы подключить команду к данным?',
      ctaSubtitle: 'Запустите общие дашборды, настройте доступы и автоматизируйте отчёты для отдела.',
      ctaSecondaryNote: 'Нужна корпоративная конфигурация?',
    },
  },
};

export function getPlans(customerType: keyof PricingConfig['plans']) {
  return pricingConfig.plans[customerType];
}

export function getComparison(customerType: keyof PricingConfig['comparison']) {
  return pricingConfig.comparison[customerType];
}

export function getFaq(customerType: keyof PricingConfig['faq']) {
  return pricingConfig.faq[customerType];
}

export function getCopy(customerType: keyof PricingConfig['copy']) {
  return pricingConfig.copy[customerType];
}

export function formatPrice(
  amount: number | null,
  currency: string = pricingConfig.currency,
): string {
  if (amount === null) return 'Индивидуально';
  if (amount === 0) return `0 ${currency}`;
  return `${amount.toLocaleString('ru-RU')} ${currency}`;
}

export function getDisplayPrice(
  priceMonthly: number | null,
  priceYearly: number | null,
  billingPeriod: 'monthly' | 'yearly',
): { amount: number | null; suffix: string; note?: string } {
  if (priceMonthly === null || priceYearly === null) {
    return { amount: null, suffix: '', note: 'Индивидуальные условия' };
  }

  if (billingPeriod === 'yearly') {
    const perMonth = Math.round(priceYearly / 12);
    return {
      amount: perMonth,
      suffix: '/ мес',
      note: `При оплате ${formatPrice(priceYearly)} / год`,
    };
  }

  return {
    amount: priceMonthly,
    suffix: '/ мес',
    note: priceMonthly > 0 ? 'Ежемесячная оплата' : undefined,
  };
}
