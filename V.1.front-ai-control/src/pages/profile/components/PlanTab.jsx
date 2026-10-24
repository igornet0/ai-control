import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { billingService, billingErrorMessage } from '../../../services/billingService';
import styles from './AdminBillingPanel.module.css';

const PERIOD_LABEL = { month: 'мес', year: 'год' };
const AUDIENCES = [
  ['individual', 'Для себя'],
  ['business', 'Для бизнеса'],
];
const PERIODS = [
  ['month', 'Месяц'],
  ['year', 'Год'],
];
const REQUEST_STATUS = {
  new: { label: 'На рассмотрении', className: 'statusMuted' },
  done: { label: 'Выполнена', className: 'statusOk' },
  rejected: { label: 'Отклонена', className: 'statusMuted' },
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

function formatMoney(amount, currency = 'RUB') {
  const num = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(num);
  } catch {
    return `${num} ${currency}`;
  }
}

function isUnlimited(value) {
  return value == null || Number(value) < 0;
}

function hasYearPrice(plan) {
  return plan.price_year != null && Number(plan.price_year) > 0;
}

/** Цена плана за выбранный период; null — период недоступен. */
function priceFor(plan, period) {
  if (period === 'year') return hasYearPrice(plan) ? Number(plan.price_year) : null;
  return Number(plan.price) || 0;
}

function SegmentSwitch({ items, value, onChange, label }) {
  return (
    <div className={styles.views} role="radiogroup" aria-label={label}>
      {items.map(([key, text]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          className={`${styles.viewBtn} ${value === key ? styles.viewBtnActive : ''}`}
          onClick={() => onChange(key)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function UsageRow({ spec, usage }) {
  const limit = usage?.limit;
  const used = usage?.used ?? 0;
  const unlimited = isUnlimited(limit);
  const percent = unlimited || !limit ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <li>
      <span>
        {spec.label}
        {spec.kind === 'monthly' ? <span className={styles.off}> · за месяц</span> : null}
      </span>
      <b className={!unlimited && used >= limit ? styles.statusMuted : undefined} title={unlimited ? '' : `${percent}%`}>
        {used} / {unlimited ? '∞' : limit}
      </b>
    </li>
  );
}

/** Вкладка «Тариф» в профиле: текущий план, использование лимитов, смена тарифа. */
export default function PlanTab({ activeTab, highlightCode, initialPeriod }) {
  const [me, setMe] = useState(null);
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [audience, setAudience] = useState(null);
  const [period, setPeriod] = useState(initialPeriod === 'year' ? 'year' : 'month');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meData, plansData, paymentsData, requestsData] = await Promise.all([
        billingService.getMe(),
        billingService.getPlans(),
        billingService.getMyPayments(),
        billingService.getMyCustomRequests().catch(() => []),
      ]);
      setMe(meData);
      setPlans(plansData?.plans || []);
      setPayments(paymentsData);
      setRequests(requestsData);
    } catch (err) {
      setError(billingErrorMessage(err, 'Не удалось загрузить тариф'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'plan') load();
  }, [activeTab, load]);

  useEffect(() => {
    if (initialPeriod === 'month' || initialPeriod === 'year') setPeriod(initialPeriod);
  }, [initialPeriod]);

  // Аудитория по умолчанию: выделенный план из /pricing → текущий план → «Для себя».
  useEffect(() => {
    if (audience || !plans.length) return;
    const highlighted = highlightCode && plans.find((p) => p.code === highlightCode);
    const currentPlan = plans.find((p) => p.id === me?.plan?.id);
    setAudience((highlighted || currentPlan)?.audience === 'business' ? 'business' : 'individual');
  }, [plans, me, highlightCode, audience]);

  if (activeTab !== 'plan') return null;

  const current = me?.plan;
  const catalog = me?.catalog;
  const customPlans = plans.filter((p) => p.is_custom);
  const visiblePlans = plans.filter((p) => !p.is_custom && (p.audience || 'individual') === (audience || 'individual'));
  const planById = Object.fromEntries(plans.map((p) => [p.id, p]));

  const purchase = async (plan, planPeriod = period) => {
    setBusyId(plan.id);
    setToast(null);
    try {
      const result = await billingService.purchase(plan.id, planPeriod);
      setToast(
        result.pending
          ? { text: 'Платёж создан. Тариф подключится после подтверждения оплаты.' }
          : { text: `Тариф «${plan.name}» подключён` },
      );
      await load();
    } catch (err) {
      setToast({ text: billingErrorMessage(err, 'Не удалось оформить тариф'), error: true });
    } finally {
      setBusyId(null);
    }
  };

  const renderPlan = (plan, isCustom) => {
    const isCurrent = current?.id === plan.id;
    const highlighted = !isCurrent && highlightCode && plan.code === highlightCode;
    const free = Number(plan.price) <= 0 && !hasYearPrice(plan);
    // Без годовой цены план оплачивается только помесячно.
    const yearUnavailable = period === 'year' && !hasYearPrice(plan) && !free;
    const cardPeriod = yearUnavailable ? 'month' : period;
    const price = priceFor(plan, cardPeriod);
    const monthly = Number(plan.price) || 0;
    const saving = cardPeriod === 'year' && price != null && monthly > 0 ? monthly * 12 - price : 0;
    return (
      <div
        key={plan.id}
        className={styles.card}
        style={highlighted || isCustom ? { borderColor: 'rgba(6, 182, 212, 0.7)' } : undefined}
      >
        <div className={styles.cardHead}>
          <div>
            <h4 className={styles.cardTitle}>{plan.name}</h4>
            <span className={styles.code}>{plan.code}</span>
          </div>
          <div className={styles.badges}>
            {isCurrent ? <span className={styles.badge}>Текущий</span> : null}
            {isCustom ? <span className={styles.badge}>Индивидуальный</span> : null}
          </div>
        </div>
        <p className={styles.price}>
          {free ? 'Бесплатно' : formatMoney(price, plan.currency)}
          {free ? null : <span> / {PERIOD_LABEL[cardPeriod]}</span>}
        </p>
        {yearUnavailable ? <p className={styles.muted}>Годовая оплата недоступна — только помесячно</p> : null}
        {saving > 0 ? (
          <p className={styles.statusOk} style={{ margin: 0, fontSize: '0.78rem' }}>
            Экономия {formatMoney(saving, plan.currency)} в год · {formatMoney(price / 12, plan.currency)} / мес
          </p>
        ) : null}
        {plan.description ? <p className={styles.muted}>{plan.description}</p> : null}
        <ul className={styles.limits}>
          {(catalog?.limits || []).map((spec) => (
            <li key={spec.key}>
              <span>{spec.label}</span>
              <b>{isUnlimited(plan.limits?.[spec.key]) ? '∞' : plan.limits[spec.key]}</b>
            </li>
          ))}
        </ul>
        <ul className={styles.features}>
          {(catalog?.features || []).map((spec) => (
            <li key={spec.key} className={plan.features?.[spec.key] ? styles.on : styles.off}>
              {plan.features?.[spec.key] ? '✓' : '—'} {spec.label}
            </li>
          ))}
        </ul>
        <div className={styles.cardActions}>
          {free || price == null || price <= 0 ? null : (
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={busyId != null}
              onClick={() => purchase(plan, cardPeriod)}
            >
              {busyId === plan.id
                ? 'Оформление…'
                : isCurrent
                  ? `Продлить на ${cardPeriod === 'year' ? 'год' : 'месяц'}`
                  : `Подключить на ${cardPeriod === 'year' ? 'год' : 'месяц'}`}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.stack}>
      <h2 className={styles.cardTitle} style={{ fontSize: '1.25rem' }}>Тариф</h2>

      {error ? (
        <div className={styles.toastError}>
          {error}{' '}
          <button type="button" className={styles.btnGhost} onClick={load}>Повторить</button>
        </div>
      ) : null}
      {toast ? <div className={toast.error ? styles.toastError : styles.toast}>{toast.text}</div> : null}
      {loading && !me ? <p className={styles.muted}>Загрузка…</p> : null}

      {current ? (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h3 className={styles.cardTitle}>{current.name}</h3>
              <span className={styles.code}>{current.code}</span>
            </div>
            <div className={styles.badges}>
              <span className={styles.badge}>Текущий</span>
            </div>
          </div>
          <p className={styles.muted}>
            {me.subscription?.expires_at
              ? `Действует до ${formatDate(me.subscription.expires_at)}`
              : 'Бессрочно'}
            {me.subscription?.started_at ? ` · подключён ${formatDate(me.subscription.started_at)}` : ''}
          </p>
          <ul className={styles.limits}>
            {(catalog?.limits || []).map((spec) => (
              <UsageRow key={spec.key} spec={spec} usage={me.usage?.[spec.key]} />
            ))}
          </ul>
          <ul className={styles.features}>
            {(catalog?.features || []).map((spec) => (
              <li key={spec.key} className={current.features?.[spec.key] ? styles.on : styles.off}>
                {current.features?.[spec.key] ? '✓' : '—'} {spec.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {customPlans.length ? (
        <>
          <h3 className={styles.editorTitle}>Ваш индивидуальный план</h3>
          <div className={styles.cards}>{customPlans.map((plan) => renderPlan(plan, true))}</div>
        </>
      ) : null}

      {plans.length ? (
        <>
          <div className={styles.toolbar}>
            <h3 className={styles.editorTitle}>Доступные тарифы</h3>
            <div className={styles.flags}>
              <SegmentSwitch items={AUDIENCES} value={audience || 'individual'} onChange={setAudience} label="Аудитория" />
              <SegmentSwitch items={PERIODS} value={period} onChange={setPeriod} label="Период оплаты" />
            </div>
          </div>
          {visiblePlans.length ? (
            <div className={styles.cards}>{visiblePlans.map((plan) => renderPlan(plan, false))}</div>
          ) : (
            <p className={styles.muted}>Для этой категории пока нет тарифов.</p>
          )}
          {audience === 'business' ? (
            <p className={styles.muted}>
              Нужны свои лимиты и условия?{' '}
              <Link to="/pricing?custom=1" style={{ color: '#67e8f9' }}>Настройте индивидуальный план</Link> — заявка
              появится ниже.
            </p>
          ) : null}
        </>
      ) : null}

      {requests.length ? (
        <>
          <h3 className={styles.editorTitle}>Мои заявки на индивидуальный план</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Компания</th>
                  <th>Период</th>
                  <th>Статус</th>
                  <th>Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const status = REQUEST_STATUS[r.status] || { label: r.status, className: 'statusMuted' };
                  const linked = r.plan_id ? planById[r.plan_id] : null;
                  return (
                    <tr key={r.id}>
                      <td>{formatDate(r.created)}</td>
                      <td>{r.company}</td>
                      <td>{r.period === 'year' ? 'Год' : 'Месяц'}</td>
                      <td className={styles[status.className]}>
                        {status.label}
                        {linked ? <span className={styles.badgeMuted}>{linked.name}</span> : null}
                      </td>
                      <td>{r.admin_note || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {payments.length ? (
        <>
          <h3 className={styles.editorTitle}>Платежи</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Тариф</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.paid_at || p.created)}</td>
                    <td>{p.plan_name || p.plan_code}</td>
                    <td>{formatMoney(p.amount, p.currency)}</td>
                    <td className={p.status === 'paid' ? styles.statusOk : styles.statusMuted}>
                      {p.status === 'paid' ? 'Оплачен' : p.status === 'pending' ? 'Ожидает оплаты' : p.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
