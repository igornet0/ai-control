import React, { useMemo, useState } from 'react';
import {
  BuildingOffice2Icon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import styles from './Strategy.module.css';
import {
  TOTAL_STEPS,
  emptyCompanyProfile,
  ORG_TYPES,
  STAGES,
  OFFERING_TYPES,
  CUSTOMER_TYPES,
  BUSINESS_MODELS,
  PRIORITY_OPTIONS,
  CONSTRAINT_OPTIONS,
  PRODUCT_STATUSES,
  DEPT_PRESETS,
  adaptiveProductFields,
  validateStep,
  buildCompanyContextSummary,
  formatContextPlainText,
  buildStrategyProposalFromProfile,
  followUpQuestions,
} from './companyProfileSchema';
import { strategyApiService } from '../../../../services/strategyApiService';

function Field({ label, required, hint, children, error }) {
  const hintRu = {
    optional: 'необязательно',
    recommended: 'рекомендуется',
    required: 'обязательно',
    confidential: 'конфиденциально',
  }[hint] || hint;
  return (
    <div className={styles.obField}>
      <label className={styles.fieldLabel}>
        {label}
        {required ? ' *' : ''}
        {hintRu ? <span className={styles.obHint}> · {hintRu}</span> : null}
      </label>
      {children}
      {error && <p className={styles.obError}>{error}</p>}
    </div>
  );
}

function RadioGroup({ options, value, onChange, name }) {
  return (
    <div className={styles.obRadioGrid}>
      {options.map((opt) => (
        <label key={opt} className={`${styles.obRadio} ${value === opt ? styles.obRadioActive : ''}`}>
          <input
            type="radio"
            name={name}
            checked={value === opt}
            onChange={() => onChange(opt)}
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

function CheckboxGroup({ options, values = [], onChange, max }) {
  const toggle = (opt) => {
    const has = values.includes(opt);
    if (has) onChange(values.filter((v) => v !== opt));
    else if (!max || values.length < max) onChange([...values, opt]);
  };
  return (
    <div className={styles.obCheckGrid}>
      {options.map((opt) => (
        <label key={opt} className={`${styles.obCheck} ${values.includes(opt) ? styles.obCheckActive : ''}`}>
          <input
            type="checkbox"
            checked={values.includes(opt)}
            onChange={() => toggle(opt)}
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * Strategy onboarding questionnaire → Company Context → confirm → AI strategy proposal.
 */
export default function StrategyOnboarding({
  initialData = null,
  canEdit,
  onSkip,
  onCompleted,
  onGenerateStrategy,
}) {
  const [phase, setPhase] = useState('intro'); // intro | wizard | followup | summary
  const [step, setStep] = useState(1);
  const [data, setData] = useState(() => initialData || emptyCompanyProfile());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [followAnswers, setFollowAnswers] = useState({});
  const [showRecalc, setShowRecalc] = useState(false);

  const summary = useMemo(() => buildCompanyContextSummary(data), [data]);
  const extras = adaptiveProductFields(data.products?.offeringType);
  const followups = useMemo(() => followUpQuestions(data), [data]);

  const patch = (section, patchObj) => {
    setData((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...patchObj },
    }));
  };

  const persist = async (opts = {}) => {
    setSaving(true);
    try {
      await strategyApiService.updateCompanyProfile({
        data,
        onboarding_completed: Boolean(opts.completed),
        onboarding_step: opts.step ?? step,
      });
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    const errs = validateStep(step, data);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    await persist({ step });
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }
    // after step 7 → follow-up or summary
    if (followups.length) {
      setPhase('followup');
    } else {
      setPhase('summary');
    }
  };

  const back = () => {
    if (phase === 'followup') {
      setPhase('wizard');
      setStep(TOTAL_STEPS);
      return;
    }
    if (phase === 'summary') {
      setPhase(followups.length ? 'followup' : 'wizard');
      return;
    }
    if (step > 1) setStep((s) => s - 1);
    else setPhase('intro');
  };

  const confirmContext = async () => {
    await persist({ completed: true, step: TOTAL_STEPS });
    onCompleted?.(data, summary);
  };

  const generate = async () => {
    await confirmContext();
    const proposal = buildStrategyProposalFromProfile(data);
    onGenerateStrategy?.(proposal, data, summary);
  };

  if (!canEdit && phase === 'intro') {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon} aria-hidden>
          <SparklesIcon />
        </div>
        <h2 className={styles.emptyTitle}>Стратегия ещё не настроена</h2>
        <p className={styles.emptyText}>
          CEO должен сначала заполнить контекст компании. После этого появится стратегия.
        </p>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className={styles.empty} style={{ maxWidth: 560 }}>
        <div className={styles.emptyIcon} aria-hidden>
          <SparklesIcon />
        </div>
        <h2 className={styles.emptyTitle}>Настройка стратегии компании</h2>
        <p className={styles.emptyText}>
          Чтобы AI смог разработать полезную стратегию, сначала расскажите немного о компании.
          Это займёт примерно 5–10 минут.
        </p>
        <p className={styles.muted} style={{ marginBottom: '1rem', textAlign: 'left' }}>
          AI будет использовать ваши ответы для:
        </p>
        <ul className={styles.priorityList} style={{ textAlign: 'left', marginBottom: '1.25rem' }}>
          {[
            'формирования стратегии',
            'постановки целей',
            'создания KPI',
            'определения приоритетов',
            'анализа отделов',
            'создания действий',
          ].map((t) => (
            <li key={t} className={styles.priorityItem}>
              <span className={styles.priorityBullet} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <div className={styles.emptyActions}>
          <button type="button" className={styles.btnAi} onClick={() => setPhase('wizard')}>
            Начать настройку
          </button>
          <button type="button" className={styles.btnGhost} onClick={onSkip}>
            Можно пропустить и заполнить позже
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'summary') {
    return (
      <div className={`${styles.glass} ${styles.cardPad} ${styles.obWrap}`}>
        <div className={styles.aiHead}>
          <SparklesIcon className={styles.icoLg} aria-hidden />
          <h2 className={styles.aiTitle}>AI сформировал контекст компании</h2>
        </div>
        <p className={styles.muted}>Проверьте информацию перед созданием стратегии. AI не придумывает данные — только структурирует ваши ответы.</p>

        <div className={styles.obSummaryGrid}>
          {[
            ['Компания', summary.company],
            ['Продукт', summary.product],
            ['Рынок', summary.businessModel],
            ['Основная цель', (summary.mainGoals || [])[0] || '—'],
            ['Основной приоритет', summary.mainPriority],
            ['Ограничения', summary.constraints],
            ['Видение', summary.vision],
          ].map(([k, v]) => (
            <div key={k} className={styles.kpiCard}>
              <div className={styles.kpiName}>{k}</div>
              <div className={styles.kpiValue} style={{ fontSize: '0.9rem', fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>

        <pre className={styles.obContextPre}>{formatContextPlainText(summary)}</pre>

        <div className={styles.obNav}>
          <button type="button" className={styles.btn} onClick={back}>Изменить</button>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className={styles.btn} disabled={saving} onClick={confirmContext}>
              Подтвердить контекст
            </button>
            <button type="button" className={styles.btnAi} disabled={saving} onClick={generate}>
              <SparklesIcon className={styles.ico} aria-hidden />
              Создать стратегию с AI
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'followup') {
    return (
      <div className={`${styles.glass} ${styles.cardPad} ${styles.obWrap}`}>
        <h2 className={styles.companyTitle}>
          <SparklesIcon className={styles.ico} aria-hidden />
          Уточняющие вопросы
        </h2>
        <p className={styles.muted}>
          Чтобы улучшить качество стратегии, не хватает нескольких параметров. Можно пропустить.
        </p>
        <div className={styles.formStack} style={{ marginTop: '1rem' }}>
          {followups.map((q) => (
            <Field key={q.id} label={q.label} hint="recommended">
              {q.type === 'multi' ? (
                <CheckboxGroup
                  options={q.options || []}
                  values={followAnswers[q.id] || []}
                  onChange={(vals) => setFollowAnswers((a) => ({ ...a, [q.id]: vals }))}
                />
              ) : (
                <input
                  className={styles.input}
                  value={followAnswers[q.id] || ''}
                  onChange={(e) => setFollowAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                />
              )}
            </Field>
          ))}
        </div>
        <div className={styles.obNav}>
          <button type="button" className={styles.btn} onClick={back}>Назад</button>
          <button
            type="button"
            className={styles.btnAi}
            onClick={() => {
              // merge follow-up answers lightly into profile
              const nextData = { ...data };
              if (followAnswers.currentRevenue) {
                nextData.business = { ...nextData.business, currentRevenue: followAnswers.currentRevenue };
              }
              if (followAnswers.targetRevenue) {
                nextData.business = { ...nextData.business, targetRevenue: followAnswers.targetRevenue };
              }
              if (followAnswers.growthSource) {
                nextData.business = {
                  ...nextData.business,
                  modelDescription: [
                    nextData.business.modelDescription,
                    `Источник роста: ${followAnswers.growthSource}`,
                  ].filter(Boolean).join('\n'),
                };
              }
              if (followAnswers.saasMotion?.length) {
                nextData.products = {
                  ...nextData.products,
                  extras: { ...nextData.products.extras, saasMotion: followAnswers.saasMotion },
                };
              }
              setData(nextData);
              setPhase('summary');
            }}
          >
            Продолжить
          </button>
        </div>
      </div>
    );
  }

  // ── Wizard steps ──
  return (
    <div className={`${styles.glass} ${styles.cardPad} ${styles.obWrap}`}>
      <div className={styles.obProgressHead}>
        <span className={styles.sectionTitle}>Шаг {step} из {TOTAL_STEPS}</span>
        <span className={styles.muted}>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
      </div>
      <div className={styles.progressTrack} style={{ marginBottom: '1.1rem' }}>
        <div className={styles.progressFill} style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
      </div>

      {step === 1 && (
        <div className={styles.formStack}>
          <h3 className={styles.companyTitle}>Компания</h3>
          <Field label="Название компании" required error={errors.name}>
            <input className={styles.input} value={data.general.name} onChange={(e) => patch('general', { name: e.target.value })} />
          </Field>
          <Field label="Юридическое название" hint="optional">
            <input className={styles.input} value={data.general.legalName} onChange={(e) => patch('general', { legalName: e.target.value })} />
          </Field>
          <Field label="Краткое описание компании" required error={errors.description} hint="required">
            <textarea
              className={styles.textarea}
              placeholder="Мы создаём BI-платформу для управления компаниями."
              value={data.general.description}
              onChange={(e) => patch('general', { description: e.target.value })}
            />
          </Field>
          <Field label="Тип организации" hint="recommended">
            <RadioGroup name="orgType" options={ORG_TYPES} value={data.general.orgType} onChange={(v) => patch('general', { orgType: v })} />
          </Field>
          <Field label="Стадия компании" hint="recommended">
            <RadioGroup name="stage" options={STAGES} value={data.general.stage} onChange={(v) => patch('general', { stage: v })} />
          </Field>
          <div className={styles.obRow}>
            <Field label="Год основания" hint="optional">
              <input className={styles.input} value={data.general.foundedYear} onChange={(e) => patch('general', { foundedYear: e.target.value })} />
            </Field>
            <Field label="Сотрудников" hint="recommended">
              <input className={styles.input} value={data.general.employees} onChange={(e) => patch('general', { employees: e.target.value })} />
            </Field>
          </div>
          <Field label="Страны / регионы присутствия" hint="recommended">
            <input className={styles.input} value={data.general.geography} onChange={(e) => patch('general', { geography: e.target.value })} />
          </Field>
          <Field label="Индустрия" hint="recommended">
            <input className={styles.input} placeholder="Business Intelligence / Enterprise Software" value={data.general.industry} onChange={(e) => patch('general', { industry: e.target.value })} />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className={styles.formStack}>
          <h3 className={styles.companyTitle}>Продукт / услуга</h3>
          <Field label="Что производит или предоставляет компания?" required error={errors.offering}>
            <textarea className={styles.textarea} value={data.products.offering} onChange={(e) => patch('products', { offering: e.target.value })} />
          </Field>
          <Field label="Тип" hint="recommended">
            <RadioGroup name="offeringType" options={OFFERING_TYPES} value={data.products.offeringType} onChange={(v) => patch('products', { offeringType: v })} />
          </Field>
          <Field label="Основной продукт" hint="recommended">
            <input className={styles.input} value={data.products.mainProduct} onChange={(e) => patch('products', { mainProduct: e.target.value })} />
          </Field>
          <Field label="Описание основного продукта" hint="recommended">
            <textarea className={styles.textarea} value={data.products.mainProductDescription} onChange={(e) => patch('products', { mainProductDescription: e.target.value })} />
          </Field>
          <Field label="Какую проблему решает продукт?" hint="recommended">
            <textarea className={styles.textarea} value={data.products.problemSolved} onChange={(e) => patch('products', { problemSolved: e.target.value })} />
          </Field>
          <Field label="Какую ценность получает клиент?" hint="recommended">
            <textarea className={styles.textarea} value={data.products.customerValue} onChange={(e) => patch('products', { customerValue: e.target.value })} />
          </Field>

          <div className={styles.sectionHead}>
            <h4 className={styles.sectionTitle}>Продукты / услуги</h4>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm}`}
              onClick={() =>
                patch('products', {
                  items: [...(data.products.items || []), { name: '', description: '', status: 'Идея' }],
                })
              }
            >
              + Добавить продукт
            </button>
          </div>
          {(data.products.items || []).map((item, idx) => (
            <div key={idx} className={styles.actionCard}>
              <input className={styles.input} placeholder="Название" value={item.name} onChange={(e) => {
                const items = [...data.products.items];
                items[idx] = { ...items[idx], name: e.target.value };
                patch('products', { items });
              }} />
              <textarea className={styles.textarea} style={{ marginTop: 8 }} placeholder="Описание" value={item.description} onChange={(e) => {
                const items = [...data.products.items];
                items[idx] = { ...items[idx], description: e.target.value };
                patch('products', { items });
              }} />
              <RadioGroup
                name={`pstatus-${idx}`}
                options={PRODUCT_STATUSES}
                value={item.status}
                onChange={(v) => {
                  const items = [...data.products.items];
                  items[idx] = { ...items[idx], status: v };
                  patch('products', { items });
                }}
              />
            </div>
          ))}

          {extras.length > 0 && (
            <>
              <p className={styles.missionLabel}>Дополнительно для {data.products.offeringType}</p>
              {extras.map((f) => (
                <Field key={f.key} label={f.label} hint={f.priority}>
                  <input
                    className={styles.input}
                    value={data.products.extras?.[f.key] || ''}
                    onChange={(e) =>
                      patch('products', {
                        extras: { ...data.products.extras, [f.key]: e.target.value },
                      })
                    }
                  />
                </Field>
              ))}
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className={styles.formStack}>
          <h3 className={styles.companyTitle}>Клиенты и рынок</h3>
          <Field label="Кто ваши основные клиенты?" hint="recommended">
            <RadioGroup name="customerType" options={CUSTOMER_TYPES} value={data.market.customerType} onChange={(v) => patch('market', { customerType: v })} />
          </Field>
          <Field label="Целевая аудитория" hint="recommended">
            <textarea className={styles.textarea} value={data.market.audience} onChange={(e) => patch('market', { audience: e.target.value })} />
          </Field>
          <Field label="Основной рынок" hint="recommended">
            <input className={styles.input} value={data.market.market} onChange={(e) => patch('market', { market: e.target.value })} />
          </Field>
          <Field label="Основные страны / регионы" hint="optional">
            <input className={styles.input} value={data.market.regions} onChange={(e) => patch('market', { regions: e.target.value })} />
          </Field>
          <Field label="Размер рынка" hint="optional">
            <input className={styles.input} value={data.market.marketSize} onChange={(e) => patch('market', { marketSize: e.target.value })} />
          </Field>
          <Field label="Главное конкурентное преимущество" hint="recommended">
            <textarea className={styles.textarea} value={data.market.advantage} onChange={(e) => patch('market', { advantage: e.target.value })} />
          </Field>

          <div className={styles.sectionHead}>
            <h4 className={styles.sectionTitle}>Сегменты</h4>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm}`}
              onClick={() => patch('market', { segments: [...(data.market.segments || []), ''] })}
            >
              + Добавить сегмент
            </button>
          </div>
          {(data.market.segments || []).map((seg, idx) => (
            <input
              key={idx}
              className={styles.input}
              placeholder="Enterprise / SMB / Startups..."
              value={seg}
              onChange={(e) => {
                const segments = [...data.market.segments];
                segments[idx] = e.target.value;
                patch('market', { segments });
              }}
            />
          ))}

          <div className={styles.sectionHead}>
            <h4 className={styles.sectionTitle}>Конкуренты</h4>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm}`}
              onClick={() =>
                patch('market', {
                  competitors: [...(data.market.competitors || []), { name: '', why: '' }],
                })
              }
            >
              + Добавить конкурента
            </button>
          </div>
          {(data.market.competitors || []).map((c, idx) => (
            <div key={idx} className={styles.actionCard}>
              <input className={styles.input} placeholder="Название" value={c.name} onChange={(e) => {
                const competitors = [...data.market.competitors];
                competitors[idx] = { ...competitors[idx], name: e.target.value };
                patch('market', { competitors });
              }} />
              <textarea className={styles.textarea} style={{ marginTop: 8 }} placeholder="Почему клиент может выбрать их?" value={c.why} onChange={(e) => {
                const competitors = [...data.market.competitors];
                competitors[idx] = { ...competitors[idx], why: e.target.value };
                patch('market', { competitors });
              }} />
            </div>
          ))}
        </div>
      )}

      {step === 4 && (
        <div className={styles.formStack}>
          <h3 className={styles.companyTitle}>Бизнес-модель</h3>
          <Field label="Как компания зарабатывает деньги?" hint="recommended">
            <RadioGroup name="bizModel" options={BUSINESS_MODELS} value={data.business.model} onChange={(v) => patch('business', { model: v })} />
          </Field>
          <Field label="Описание бизнес-модели" hint="recommended">
            <textarea className={styles.textarea} value={data.business.modelDescription} onChange={(e) => patch('business', { modelDescription: e.target.value })} />
          </Field>
          <label className={styles.obCheck}>
            <input
              type="checkbox"
              checked={Boolean(data.business.hideFinancials)}
              onChange={(e) => patch('business', { hideFinancials: e.target.checked })}
            />
            <span>Не указывать финансовые показатели (конфиденциально)</span>
          </label>
          {!data.business.hideFinancials && (
            <div className={styles.obRow}>
              <Field label="Текущая выручка" hint="confidential">
                <input className={styles.input} value={data.business.currentRevenue} onChange={(e) => patch('business', { currentRevenue: e.target.value })} />
              </Field>
              <Field label="Целевая выручка" hint="confidential">
                <input className={styles.input} value={data.business.targetRevenue} onChange={(e) => patch('business', { targetRevenue: e.target.value })} />
              </Field>
              <Field label="Валюта" hint="optional">
                <input className={styles.input} value={data.business.currency} onChange={(e) => patch('business', { currency: e.target.value })} />
              </Field>
            </div>
          )}
          <div className={styles.sectionHead}>
            <h4 className={styles.sectionTitle}>Источники дохода</h4>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm}`}
              onClick={() =>
                patch('business', {
                  revenueStreams: [...(data.business.revenueStreams || []), { name: '', share: '', description: '' }],
                })
              }
            >
              + Добавить
            </button>
          </div>
          {(data.business.revenueStreams || []).map((r, idx) => (
            <div key={idx} className={styles.actionCard}>
              <input className={styles.input} placeholder="Название" value={r.name} onChange={(e) => {
                const revenueStreams = [...data.business.revenueStreams];
                revenueStreams[idx] = { ...revenueStreams[idx], name: e.target.value };
                patch('business', { revenueStreams });
              }} />
              <div className={styles.obRow} style={{ marginTop: 8 }}>
                <input className={styles.input} placeholder="Доля выручки" value={r.share} onChange={(e) => {
                  const revenueStreams = [...data.business.revenueStreams];
                  revenueStreams[idx] = { ...revenueStreams[idx], share: e.target.value };
                  patch('business', { revenueStreams });
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 5 && (
        <div className={styles.formStack}>
          <h3 className={styles.companyTitle}>Организация</h3>
          <p className={styles.muted}>Добавьте подразделения. Можно выбрать из пресетов или создать свои.</p>
          <div className={styles.obCheckGrid}>
            {DEPT_PRESETS.map((name) => {
              const exists = (data.organization.departments || []).some((d) => d.name === name);
              return (
                <button
                  key={name}
                  type="button"
                  className={`${styles.obCheck} ${exists ? styles.obCheckActive : ''}`}
                  onClick={() => {
                    const departments = [...(data.organization.departments || [])];
                    if (exists) patch('organization', { departments: departments.filter((d) => d.name !== name) });
                    else patch('organization', { departments: [...departments, { name, description: '', manager: '', scope: '', headcount: '' }] });
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm}`}
            onClick={() =>
              patch('organization', {
                departments: [
                  ...(data.organization.departments || []),
                  { name: '', description: '', manager: '', scope: '', headcount: '' },
                ],
              })
            }
          >
            + Добавить отдел
          </button>
          {(data.organization.departments || []).map((d, idx) => (
            <div key={idx} className={styles.actionCard}>
              <input className={styles.input} placeholder="Название отдела" value={d.name} onChange={(e) => {
                const departments = [...data.organization.departments];
                departments[idx] = { ...departments[idx], name: e.target.value };
                patch('organization', { departments });
              }} />
              <textarea className={styles.textarea} style={{ marginTop: 8 }} placeholder="Зона ответственности" value={d.scope} onChange={(e) => {
                const departments = [...data.organization.departments];
                departments[idx] = { ...departments[idx], scope: e.target.value };
                patch('organization', { departments });
              }} />
              <div className={styles.obRow} style={{ marginTop: 8 }}>
                <input className={styles.input} placeholder="Руководитель" value={d.manager} onChange={(e) => {
                  const departments = [...data.organization.departments];
                  departments[idx] = { ...departments[idx], manager: e.target.value };
                  patch('organization', { departments });
                }} />
                <input className={styles.input} placeholder="Сотрудников" value={d.headcount} onChange={(e) => {
                  const departments = [...data.organization.departments];
                  departments[idx] = { ...departments[idx], headcount: e.target.value };
                  patch('organization', { departments });
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 6 && (
        <div className={styles.formStack}>
          <h3 className={styles.companyTitle}>Текущая стратегия и vision</h3>
          <Field label="Есть ли сейчас стратегия компании?" hint="recommended">
            <RadioGroup
              name="hasStrategy"
              options={['Да', 'Нет', 'Частично', 'Не знаю']}
              value={data.strategy.hasStrategy}
              onChange={(v) => patch('strategy', { hasStrategy: v })}
            />
          </Field>
          <Field label="Главная цель компании" hint="recommended">
            <textarea className={styles.textarea} value={data.strategy.mainGoal} onChange={(e) => patch('strategy', { mainGoal: e.target.value })} />
          </Field>
          <div className={styles.sectionHead}>
            <h4 className={styles.sectionTitle}>Цели на текущий год</h4>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm}`}
              onClick={() =>
                patch('strategy', {
                  yearlyGoals: [...(data.strategy.yearlyGoals || []), { title: '', description: '', deadline: '', kpi: '', current: '', target: '' }],
                })
              }
            >
              + Добавить цель
            </button>
          </div>
          {(data.strategy.yearlyGoals || []).map((g, idx) => (
            <div key={idx} className={styles.actionCard}>
              <input className={styles.input} placeholder="Цель" value={g.title} onChange={(e) => {
                const yearlyGoals = [...data.strategy.yearlyGoals];
                yearlyGoals[idx] = { ...yearlyGoals[idx], title: e.target.value };
                patch('strategy', { yearlyGoals });
              }} />
              <div className={styles.obRow} style={{ marginTop: 8 }}>
                <input className={styles.input} type="date" value={g.deadline || ''} onChange={(e) => {
                  const yearlyGoals = [...data.strategy.yearlyGoals];
                  yearlyGoals[idx] = { ...yearlyGoals[idx], deadline: e.target.value };
                  patch('strategy', { yearlyGoals });
                }} />
                <input className={styles.input} placeholder="KPI" value={g.kpi || ''} onChange={(e) => {
                  const yearlyGoals = [...data.strategy.yearlyGoals];
                  yearlyGoals[idx] = { ...yearlyGoals[idx], kpi: e.target.value };
                  patch('strategy', { yearlyGoals });
                }} />
              </div>
            </div>
          ))}
          <Field label="Проблемы, мешающие развитию" hint="recommended">
            <textarea className={styles.textarea} value={data.strategy.problems} onChange={(e) => patch('strategy', { problems: e.target.value })} />
          </Field>
          <Field label="Возможности" hint="recommended">
            <textarea className={styles.textarea} value={data.strategy.opportunities} onChange={(e) => patch('strategy', { opportunities: e.target.value })} />
          </Field>
          <Field label="Куда компания должна прийти через 3–5 лет?" hint="recommended">
            <textarea className={styles.textarea} value={data.strategy.vision3to5} onChange={(e) => patch('strategy', { vision3to5: e.target.value })} />
          </Field>
          <Field label="Что будет означать успех?" hint="optional">
            <textarea className={styles.textarea} value={data.strategy.successMeans} onChange={(e) => patch('strategy', { successMeans: e.target.value })} />
          </Field>
          <Field label="Результат через 12 месяцев" hint="recommended">
            <textarea className={styles.textarea} value={data.strategy.result12m} onChange={(e) => patch('strategy', { result12m: e.target.value })} />
          </Field>
        </div>
      )}

      {step === 7 && (
        <div className={styles.formStack}>
          <h3 className={styles.companyTitle}>Приоритеты и ограничения</h3>
          <Field label="Что сейчас наиболее важно? (до 5)" hint="recommended">
            <CheckboxGroup
              options={PRIORITY_OPTIONS}
              values={data.priorities.selected || []}
              max={5}
              onChange={(selected) => patch('priorities', { selected })}
            />
          </Field>
          <Field label="Главный приоритет" hint="recommended">
            <input className={styles.input} value={data.priorities.mainPriority} onChange={(e) => patch('priorities', { mainPriority: e.target.value })} />
          </Field>
          <Field label="Ограничения" hint="recommended">
            <CheckboxGroup
              options={CONSTRAINT_OPTIONS}
              values={data.priorities.constraints || []}
              onChange={(constraints) => patch('priorities', { constraints })}
            />
          </Field>
          <Field label="Опишите ограничения" hint="optional">
            <textarea className={styles.textarea} value={data.priorities.constraintsNote} onChange={(e) => patch('priorities', { constraintsNote: e.target.value })} />
          </Field>
          <Field label="Ключевые риски" hint="recommended">
            <textarea className={styles.textarea} value={data.priorities.risks} onChange={(e) => patch('priorities', { risks: e.target.value })} />
          </Field>
        </div>
      )}

      <div className={styles.obNav}>
        <button type="button" className={styles.btn} onClick={back}>Назад</button>
        <button type="button" className={styles.btnAi} disabled={saving} onClick={next}>
          {step === TOTAL_STEPS ? (saving ? 'Сохранение...' : 'Далее') : (saving ? '...' : 'Далее')}
        </button>
      </div>

      {showRecalc && (
        <div className={styles.proposal} style={{ marginTop: '1rem' }}>
          <p className={styles.proposalTitle}>Информация о компании изменилась</p>
          <p className={styles.analysisBody}>Пересчитать стратегические рекомендации AI?</p>
          <div className={styles.proposalActions}>
            <button type="button" className={styles.btnAi} onClick={() => { setShowRecalc(false); generate(); }}>Пересчитать</button>
            <button type="button" className={styles.btn} onClick={() => setShowRecalc(false)}>Оставить текущую стратегию</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact Company Context card for Strategy workspace. */
export function CompanyContextCard({ profileData, canEdit, onEdit, versions = [] }) {
  if (!profileData) return null;
  const summary = buildCompanyContextSummary(profileData);
  return (
    <section className={`${styles.glass} ${styles.cardPad}`}>
      <div className={styles.companyHead}>
        <h3 className={styles.companyTitle}>
          <BuildingOffice2Icon className={styles.ico} aria-hidden />
          Контекст компании
        </h3>
        {canEdit && (
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onEdit}>
            Изменить
          </button>
        )}
      </div>
      <div className={styles.obSummaryGrid}>
        {[
          ['Компания', summary.company],
          ['Продукт', summary.product],
          ['Модель', summary.businessModel],
          ['Приоритет', summary.mainPriority],
        ].map(([k, v]) => (
          <div key={k} className={styles.kpiCard}>
            <div className={styles.kpiName}>{k}</div>
            <div className={styles.kpiValue} style={{ fontSize: '0.85rem' }}>{v}</div>
          </div>
        ))}
      </div>
      {versions?.length > 0 && (
        <>
          <div className={styles.divider} />
          <p className={styles.missionLabel}>Версии стратегии</p>
          <ul className={styles.priorityList}>
            {versions.slice(0, 5).map((v) => (
              <li key={v.id} className={styles.priorityItem}>
                <span className={styles.priorityBullet} />
                <span>
                  {v.title}
                  <span className={styles.muted}>
                    {' '}· {v.source} · {v.created ? new Date(v.created).toLocaleDateString('ru-RU') : ''}
                    {v.note ? ` · ${v.note}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
