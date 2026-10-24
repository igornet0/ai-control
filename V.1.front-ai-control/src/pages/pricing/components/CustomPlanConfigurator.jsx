import React, { useEffect, useState } from 'react';
import { billingService, billingErrorMessage } from '../../../services/billingService';
import styles from './CustomPlanConfigurator.module.css';

// Запасной каталог, если API тарифов недоступен (совпадает с py-worm/app/billing/catalog.py).
const FALLBACK_CATALOG = {
  limits: [
    { key: 'projects', label: 'Проекты', kind: 'count' },
    { key: 'dashboards', label: 'Дашборды', kind: 'count' },
    { key: 'data_models', label: 'Модели данных', kind: 'count' },
    { key: 'documents', label: 'Документы', kind: 'count' },
    { key: 'api_keys', label: 'API-ключи', kind: 'count' },
    { key: 'ai_requests_month', label: 'AI-запросы в месяц', kind: 'monthly' },
  ],
  features: [
    { key: 'ai_assistant', label: 'AI-ассистент' },
    { key: 'api_access', label: 'Доступ к API моделей данных' },
    { key: 'share_links', label: 'Публичные ссылки на документы и дашборды' },
  ],
};

const FALLBACK_LIMITS = {
  projects: 100,
  dashboards: 1000,
  data_models: 200,
  documents: 20000,
  api_keys: 50,
  ai_requests_month: 20000,
};

function initialForm(basePlan, catalog, billingPeriod) {
  const limits = {};
  catalog.limits.forEach(({ key }) => {
    const value = basePlan?.limits?.[key] ?? FALLBACK_LIMITS[key] ?? 0;
    limits[key] = Number(value);
  });
  const features = {};
  catalog.features.forEach(({ key }) => {
    features[key] = true;
  });
  return {
    company: '',
    contact: '',
    comment: '',
    period: billingPeriod === 'yearly' ? 'year' : 'month',
    limits,
    features,
  };
}

/**
 * Конфигуратор индивидуального бизнес-плана: лимиты, функции, период → заявка администратору.
 */
const CustomPlanConfigurator = ({
  open,
  onClose,
  catalog: catalogProp,
  basePlan,
  billingPeriod,
  isAuthenticated,
  onRequireAuth,
}) => {
  const catalog = catalogProp?.limits?.length ? catalogProp : FALLBACK_CATALOG;
  const [form, setForm] = useState(() => initialForm(basePlan, catalog, billingPeriod));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initialForm(basePlan, catalog, billingPeriod));
    setError('');
    setSent(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setLimit = (key, value) =>
    setForm((prev) => ({ ...prev, limits: { ...prev.limits, [key]: value } }));
  const setFeature = (key, value) =>
    setForm((prev) => ({ ...prev, features: { ...prev.features, [key]: value } }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.company.trim()) {
      setError('Укажите название компании');
      return;
    }
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const limits = {};
      Object.entries(form.limits).forEach(([key, value]) => {
        const num = Number(value);
        limits[key] = Number.isFinite(num) ? Math.max(-1, Math.round(num)) : 0;
      });
      await billingService.createCustomRequest({ ...form, limits });
      setSent(true);
    } catch (err) {
      setError(billingErrorMessage(err, 'Не удалось отправить заявку'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="custom-plan-title">
        <div className={styles.head}>
          <div>
            <p className={styles.eyebrow}>Для бизнеса</p>
            <h2 id="custom-plan-title" className={styles.title}>Индивидуальный план</h2>
            <p className={styles.subtitle}>
              Задайте лимиты и функции под вашу команду — мы рассчитаем стоимость и подключим план к аккаунту.
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        {sent ? (
          <div className={styles.success}>
            <p>Заявка отправлена. Статус и подключённый план — в профиле, вкладка «Тариф».</p>
            <button type="button" className={styles.primary} onClick={onClose}>
              Готово
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={submit}>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>Компания *</span>
                <input
                  className={styles.input}
                  value={form.company}
                  maxLength={200}
                  onChange={(e) => setField('company', e.target.value)}
                  placeholder="ООО «Компания»"
                />
              </label>
              <label className={styles.field}>
                <span>Контакт</span>
                <input
                  className={styles.input}
                  value={form.contact}
                  maxLength={200}
                  onChange={(e) => setField('contact', e.target.value)}
                  placeholder="Телефон или e-mail"
                />
              </label>
            </div>

            <div className={styles.periods} role="radiogroup" aria-label="Период оплаты">
              {[
                ['month', 'Помесячно'],
                ['year', 'Годовая оплата'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={form.period === value}
                  className={`${styles.period} ${form.period === value ? styles.periodActive : ''}`}
                  onClick={() => setField('period', value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <fieldset className={styles.group}>
              <legend>Лимиты</legend>
              {catalog.limits.map((spec) => {
                const value = form.limits[spec.key];
                const unlimited = Number(value) < 0;
                return (
                  <div key={spec.key} className={styles.limitRow}>
                    <span className={styles.limitLabel}>
                      {spec.label}
                      {spec.kind === 'monthly' ? <em> · в месяц</em> : null}
                    </span>
                    <input
                      type="number"
                      min={0}
                      className={styles.input}
                      value={unlimited ? '' : value}
                      disabled={unlimited}
                      placeholder="∞"
                      onChange={(e) => setLimit(spec.key, e.target.value)}
                    />
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        checked={unlimited}
                        onChange={(e) =>
                          setLimit(spec.key, e.target.checked ? -1 : basePlan?.limits?.[spec.key] ?? FALLBACK_LIMITS[spec.key] ?? 0)
                        }
                      />
                      Без лимита
                    </label>
                  </div>
                );
              })}
            </fieldset>

            <fieldset className={styles.group}>
              <legend>Функции</legend>
              {catalog.features.map((spec) => (
                <label key={spec.key} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.features[spec.key])}
                    onChange={(e) => setFeature(spec.key, e.target.checked)}
                  />
                  {spec.label}
                </label>
              ))}
            </fieldset>

            <label className={styles.field}>
              <span>Комментарий</span>
              <textarea
                className={styles.input}
                rows={3}
                maxLength={4000}
                value={form.comment}
                onChange={(e) => setField('comment', e.target.value)}
                placeholder="Число сотрудников, SSO, on-premise, интеграции…"
              />
            </label>

            {error ? <p className={styles.error}>{error}</p> : null}

            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={onClose}>
                Отмена
              </button>
              <button type="submit" className={styles.primary} disabled={busy}>
                {busy ? 'Отправка…' : isAuthenticated ? 'Отправить заявку' : 'Войти и отправить'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CustomPlanConfigurator;
