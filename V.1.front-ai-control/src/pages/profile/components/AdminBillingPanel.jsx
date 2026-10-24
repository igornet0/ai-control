import React, { useCallback, useEffect, useState } from 'react';
import { billingService, billingErrorMessage } from '../../../services/billingService';
import { AdminIcon } from './AdminIcons';
import adminStyles from './AdminPanel.module.css';
import styles from './AdminBillingPanel.module.css';

const VIEWS = [
  { id: 'plans', label: 'Тарифы' },
  { id: 'subscriptions', label: 'Подписки' },
  { id: 'payments', label: 'Платежи' },
  { id: 'requests', label: 'Заявки' },
];

const AUDIENCES = [
  { value: 'individual', label: 'Для себя' },
  { value: 'business', label: 'Для бизнеса' },
];

const REQUEST_STATUS = {
  new: 'Новая',
  done: 'Выполнена',
  rejected: 'Отклонена',
};

const REQUEST_FILTERS = [
  { value: 'new', label: 'Новые' },
  { value: 'done', label: 'Выполненные' },
  { value: 'rejected', label: 'Отклонённые' },
  { value: '', label: 'Все' },
];

const PERIODS = [
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
];

const PAYMENT_STATUS = {
  pending: 'Ожидает',
  paid: 'Оплачен',
  failed: 'Ошибка',
  cancelled: 'Отменён',
};

const SUB_STATUS = {
  active: 'Активна',
  expired: 'Истекла',
  default: 'По умолчанию',
};

const EMPTY_PLAN = {
  code: '',
  name: '',
  description: '',
  price: 0,
  price_year: null,
  currency: 'RUB',
  period: 'month',
  features: {},
  limits: {},
  is_default: false,
  is_active: true,
  sort_order: 0,
  audience: 'individual',
  is_custom: false,
  owner_user_id: null,
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

function formatMoney(amount, currency = 'RUB') {
  const n = Number(amount) || 0;
  try {
    return n.toLocaleString('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 });
  } catch {
    return `${n} ${currency}`;
  }
}

function limitLabel(value) {
  return value == null || value < 0 ? '∞' : String(value);
}

/** Поля, отличающиеся от исходного тарифа (для PATCH). */
function diffPlan(original, draft) {
  const out = {};
  Object.keys(EMPTY_PLAN).forEach((key) => {
    const a = original?.[key];
    const b = draft[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) out[key] = b;
  });
  return out;
}

function PlanEditor({ plan, catalog, saving, onSave, onCancel, title }) {
  const [draft, setDraft] = useState(() => ({
    ...EMPTY_PLAN,
    ...(plan || {}),
    features: { ...(plan?.features || {}) },
    limits: { ...(plan?.limits || {}) },
  }));
  const isNew = !plan?.id;

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const setLimit = (key, raw) =>
    setDraft((d) => {
      const limits = { ...d.limits };
      if (raw === '') delete limits[key];
      else limits[key] = Math.max(-1, parseInt(raw, 10) || 0);
      return { ...d, limits };
    });
  const toggleUnlimited = (key, on) =>
    setDraft((d) => ({ ...d, limits: { ...d.limits, [key]: on ? -1 : 0 } }));
  const toggleFeature = (key, on) =>
    setDraft((d) => ({ ...d, features: { ...d.features, [key]: on } }));

  const submit = (e) => {
    e.preventDefault();
    const yearRaw = draft.price_year;
    const ownerRaw = draft.owner_user_id;
    const normalized = {
      ...draft,
      price: Number(draft.price) || 0,
      price_year: yearRaw === '' || yearRaw == null ? null : Math.max(0, Number(yearRaw) || 0),
      sort_order: Number(draft.sort_order) || 0,
      owner_user_id: draft.is_custom && ownerRaw !== '' && ownerRaw != null ? Number(ownerRaw) || null : null,
    };
    onSave(isNew ? normalized : diffPlan(plan, normalized));
  };

  return (
    <form className={styles.editor} onSubmit={submit}>
      <div className={styles.editorHead}>
        <h4 className={styles.editorTitle}>{isNew ? 'Новый тариф' : `Тариф «${plan.name}»`}</h4>
        {title ? <span className={styles.muted}>{title}</span> : null}
      </div>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span>Код</span>
          <input
            className={styles.input}
            value={draft.code}
            onChange={(e) => set('code', e.target.value)}
            placeholder="pro"
            required
            maxLength={50}
          />
        </label>
        <label className={styles.field}>
          <span>Название</span>
          <input
            className={styles.input}
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            required
            maxLength={100}
          />
        </label>
        <label className={styles.field}>
          <span>Цена</span>
          <input
            className={styles.input}
            type="number"
            min="0"
            step="1"
            value={draft.price}
            onChange={(e) => set('price', e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Цена за год</span>
          <input
            className={styles.input}
            type="number"
            min="0"
            step="1"
            value={draft.price_year ?? ''}
            placeholder="нет — только помесячно"
            title="Пусто — годовая оплата недоступна"
            onChange={(e) => set('price_year', e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Аудитория</span>
          <select className={styles.input} value={draft.audience} onChange={(e) => set('audience', e.target.value)}>
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Валюта</span>
          <input
            className={styles.input}
            value={draft.currency}
            onChange={(e) => set('currency', e.target.value.toUpperCase())}
            maxLength={8}
          />
        </label>
        <label className={styles.field}>
          <span>Период по умолчанию</span>
          <select className={styles.input} value={draft.period} onChange={(e) => set('period', e.target.value)}>
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Порядок</span>
          <input
            className={styles.input}
            type="number"
            value={draft.sort_order}
            onChange={(e) => set('sort_order', e.target.value)}
          />
        </label>
      </div>

      <label className={styles.field}>
        <span>Описание</span>
        <textarea
          className={styles.input}
          rows={2}
          value={draft.description || ''}
          onChange={(e) => set('description', e.target.value)}
        />
      </label>

      <div className={styles.flags}>
        <label className={styles.check}>
          <input type="checkbox" checked={!!draft.is_active} onChange={(e) => set('is_active', e.target.checked)} />
          Активен (виден пользователям)
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={!!draft.is_default}
            disabled={!!plan?.is_default || !!draft.is_custom}
            onChange={(e) => set('is_default', e.target.checked)}
          />
          Тариф при регистрации
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={!!draft.is_custom}
            disabled={!!draft.is_default}
            onChange={(e) => set('is_custom', e.target.checked)}
          />
          Индивидуальный (виден только владельцу)
        </label>
        {draft.is_custom ? (
          <label className={styles.check}>
            ID пользователя-владельца
            <input
              className={`${styles.input} ${styles.days}`}
              type="number"
              min="1"
              value={draft.owner_user_id ?? ''}
              onChange={(e) => set('owner_user_id', e.target.value)}
            />
          </label>
        ) : null}
      </div>

      <div className={styles.columns}>
        <fieldset className={styles.group}>
          <legend>Лимиты</legend>
          {(catalog?.limits || []).map((spec) => {
            const value = draft.limits[spec.key];
            const unlimited = value != null && value < 0;
            return (
              <div key={spec.key} className={styles.limitRow}>
                <span className={styles.limitLabel}>
                  {spec.label}
                  {spec.kind === 'monthly' ? <em> / мес.</em> : null}
                </span>
                <input
                  className={`${styles.input} ${styles.limitInput}`}
                  type="number"
                  min="0"
                  disabled={unlimited}
                  value={unlimited ? '' : value ?? ''}
                  placeholder="∞"
                  onChange={(e) => setLimit(spec.key, e.target.value)}
                />
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={unlimited || value == null}
                    onChange={(e) => toggleUnlimited(spec.key, e.target.checked)}
                  />
                  без лимита
                </label>
              </div>
            );
          })}
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Возможности</legend>
          {(catalog?.features || []).map((spec) => (
            <label key={spec.key} className={styles.check}>
              <input
                type="checkbox"
                checked={!!draft.features[spec.key]}
                onChange={(e) => toggleFeature(spec.key, e.target.checked)}
              />
              {spec.label}
            </label>
          ))}
        </fieldset>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.btnGhost} onClick={onCancel} disabled={saving}>
          Отмена
        </button>
        <button type="submit" className={styles.btnPrimary} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
}

function PlansView({ notify }) {
  const [plans, setPlans] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // plan | 'new' | null
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await billingService.adminGetPlans();
      setPlans(data.plans || []);
      setCatalog(data.catalog || null);
    } catch (err) {
      setError(billingErrorMessage(err, 'Не удалось загрузить тарифы'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (payload) => {
    setSaving(true);
    try {
      if (editing === 'new') await billingService.adminCreatePlan(payload);
      else if (Object.keys(payload).length) await billingService.adminUpdatePlan(editing.id, payload);
      setEditing(null);
      notify('Тариф сохранён');
      await load();
    } catch (err) {
      notify(billingErrorMessage(err, 'Не удалось сохранить тариф'), true);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (plan) => {
    setConfirmDelete(null);
    try {
      await billingService.adminDeletePlan(plan.id);
      notify(`Тариф «${plan.name}» удалён`);
      await load();
    } catch (err) {
      notify(billingErrorMessage(err, 'Не удалось удалить тариф'), true);
    }
  };

  if (loading) return <p className={styles.muted}>Загрузка тарифов…</p>;
  if (error) {
    return (
      <div className={adminStyles.errorBox}>
        <AdminIcon name="error" size="md" />
        <span>{error}</span>
        <button type="button" className={adminStyles.retryBtn} onClick={load}>
          Повторить
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <PlanEditor
        plan={editing === 'new' ? null : editing}
        catalog={catalog}
        saving={saving}
        onSave={save}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <p className={styles.muted}>
          Тариф «при регистрации» назначается новым пользователям. -1 / «без лимита» — ограничение снято.
        </p>
        <button type="button" className={styles.btnPrimary} onClick={() => setEditing('new')}>
          + Новый тариф
        </button>
      </div>

      <div className={styles.cards}>
        {plans.map((plan) => (
          <article key={plan.id} className={`${styles.card} ${!plan.is_active ? styles.cardInactive : ''}`}>
            <header className={styles.cardHead}>
              <div>
                <h4 className={styles.cardTitle}>{plan.name}</h4>
                <code className={styles.code}>{plan.code}</code>
              </div>
              <div className={styles.badges}>
                <span className={styles.badge}>{plan.audience === 'business' ? 'для бизнеса' : 'для себя'}</span>
                {plan.is_default ? <span className={styles.badge}>при регистрации</span> : null}
                {plan.is_custom ? (
                  <span className={styles.badge}>
                    индивидуальный{plan.owner_user_id ? ` · user #${plan.owner_user_id}` : ''}
                  </span>
                ) : null}
                {!plan.is_active ? <span className={styles.badgeMuted}>скрыт</span> : null}
              </div>
            </header>
            <p className={styles.price}>
              {plan.price > 0 ? formatMoney(plan.price, plan.currency) : 'Бесплатно'}
              {plan.price > 0 ? <span> / мес.</span> : null}
            </p>
            {plan.price > 0 ? (
              <p className={styles.muted}>
                {plan.price_year != null
                  ? `Год: ${formatMoney(plan.price_year, plan.currency)}`
                  : 'Годовая оплата недоступна'}
              </p>
            ) : null}
            {plan.description ? <p className={styles.muted}>{plan.description}</p> : null}
            <ul className={styles.limits}>
              {(catalog?.limits || []).map((spec) => (
                <li key={spec.key}>
                  <span>{spec.label}</span>
                  <b>{limitLabel(plan.limits?.[spec.key])}</b>
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
              <button type="button" className={styles.btnGhost} onClick={() => setEditing(plan)}>
                Изменить
              </button>
              {confirmDelete === plan.id ? (
                <>
                  <button type="button" className={styles.btnDanger} onClick={() => remove(plan)}>
                    Удалить?
                  </button>
                  <button type="button" className={styles.btnGhost} onClick={() => setConfirmDelete(null)}>
                    Нет
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.btnGhost}
                  disabled={plan.is_default}
                  title={plan.is_default ? 'Тариф по умолчанию удалить нельзя' : undefined}
                  onClick={() => setConfirmDelete(plan.id)}
                >
                  Удалить
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function SubscriptionsView({ notify }) {
  const [items, setItems] = useState([]);
  const [plans, setPlans] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [assign, setAssign] = useState({}); // user_id -> { planId, days }
  const [busy, setBusy] = useState(null);

  const load = useCallback(async (q) => {
    setLoading(true);
    try {
      const [subs, planData] = await Promise.all([
        billingService.adminGetSubscriptions(q),
        billingService.adminGetPlans(),
      ]);
      setItems(subs);
      setPlans(planData.plans || []);
    } catch (err) {
      notify(billingErrorMessage(err, 'Не удалось загрузить подписки'), true);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    const t = setTimeout(() => load(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const apply = async (row) => {
    const sel = assign[row.user_id] || {};
    const planId = Number(sel.planId || row.plan_id);
    setBusy(row.user_id);
    try {
      await billingService.adminAssignPlan(row.user_id, planId, Number(sel.days) || null);
      notify(`Тариф назначен пользователю ${row.login || row.email || row.user_id}`);
      setAssign((a) => ({ ...a, [row.user_id]: undefined }));
      await load(search.trim());
    } catch (err) {
      notify(billingErrorMessage(err, 'Не удалось назначить тариф'), true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <input
          className={`${styles.input} ${styles.search}`}
          placeholder="Поиск по логину, имени, email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {loading ? <p className={styles.muted}>Загрузка…</p> : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Тариф</th>
              <th>Статус</th>
              <th>До</th>
              <th>Назначить</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const sel = assign[row.user_id] || {};
              return (
                <tr key={row.user_id}>
                  <td>
                    <div>{row.name || row.login}</div>
                    <div className={styles.muted}>{row.email || row.login}</div>
                  </td>
                  <td>
                    {row.plan_name}
                    {row.is_superuser ? <span className={styles.badgeMuted}>админ, без ограничений</span> : null}
                  </td>
                  <td>{SUB_STATUS[row.status] || row.status}</td>
                  <td>{row.expires_at ? formatDate(row.expires_at) : 'бессрочно'}</td>
                  <td>
                    <div className={styles.assign}>
                      <select
                        className={styles.input}
                        value={sel.planId ?? row.plan_id ?? ''}
                        onChange={(e) =>
                          setAssign((a) => ({ ...a, [row.user_id]: { ...sel, planId: e.target.value } }))
                        }
                      >
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <input
                        className={`${styles.input} ${styles.days}`}
                        type="number"
                        min="1"
                        placeholder="дней"
                        title="Срок в днях (пусто — по периоду тарифа)"
                        value={sel.days ?? ''}
                        onChange={(e) =>
                          setAssign((a) => ({ ...a, [row.user_id]: { ...sel, days: e.target.value } }))
                        }
                      />
                      <button
                        type="button"
                        className={styles.btnGhost}
                        disabled={busy === row.user_id}
                        onClick={() => apply(row)}
                      >
                        OK
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && !items.length ? (
              <tr>
                <td colSpan={5} className={styles.muted}>
                  Никого не найдено
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentsView({ notify }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await billingService.adminGetPayments());
    } catch (err) {
      notify(billingErrorMessage(err, 'Не удалось загрузить платежи'), true);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const markPaid = async (p) => {
    setBusy(p.id);
    try {
      await billingService.adminMarkPaid(p.id);
      notify(`Платёж #${p.id} отмечен оплаченным, тариф подключён`);
      await load();
    } catch (err) {
      notify(billingErrorMessage(err, 'Не удалось обновить платёж'), true);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p className={styles.muted}>Загрузка платежей…</p>;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Пользователь</th>
            <th>Тариф</th>
            <th>Сумма</th>
            <th>Статус</th>
            <th>Создан</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.email || p.login || p.user_id}</td>
              <td>{p.plan_name || p.plan_id}</td>
              <td>{formatMoney(p.amount, p.currency)}</td>
              <td>
                <span className={p.status === 'paid' ? styles.statusOk : styles.statusMuted}>
                  {PAYMENT_STATUS[p.status] || p.status}
                </span>
              </td>
              <td>{formatDate(p.created)}</td>
              <td>
                {p.status === 'pending' ? (
                  <button
                    type="button"
                    className={styles.btnGhost}
                    disabled={busy === p.id}
                    onClick={() => markPaid(p)}
                  >
                    Отметить оплаченным
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {!items.length ? (
            <tr>
              <td colSpan={7} className={styles.muted}>
                Платежей пока нет
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function RequestsView({ notify }) {
  const [items, setItems] = useState([]);
  const [plans, setPlans] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [filter, setFilter] = useState('new');
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState({}); // request id -> admin_note draft
  const [busy, setBusy] = useState(null);
  const [planFor, setPlanFor] = useState(null); // заявка, по которой создаётся план
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs, planData] = await Promise.all([
        billingService.adminGetCustomRequests(filter),
        billingService.adminGetPlans(),
      ]);
      setItems(reqs);
      setPlans(planData.plans || []);
      setCatalog(planData.catalog || null);
    } catch (err) {
      notify(billingErrorMessage(err, 'Не удалось загрузить заявки'), true);
    } finally {
      setLoading(false);
    }
  }, [filter, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (req, data, message) => {
    setBusy(req.id);
    try {
      await billingService.adminUpdateCustomRequest(req.id, data);
      notify(message);
      setNotes((n) => ({ ...n, [req.id]: undefined }));
      await load();
    } catch (err) {
      notify(billingErrorMessage(err, 'Не удалось обновить заявку'), true);
    } finally {
      setBusy(null);
    }
  };

  const noteOf = (req) => notes[req.id] ?? req.admin_note ?? '';

  const createPlan = async (payload) => {
    const req = planFor;
    setSaving(true);
    try {
      const plan = await billingService.adminCreatePlan(payload);
      await billingService.adminUpdateCustomRequest(req.id, {
        plan_id: plan.id,
        status: 'done',
        admin_note: noteOf(req) || null,
      });
      setPlanFor(null);
      notify(`План «${plan.name}» создан и привязан к заявке #${req.id}`);
      await load();
    } catch (err) {
      notify(billingErrorMessage(err, 'Не удалось создать план'), true);
    } finally {
      setSaving(false);
    }
  };

  if (planFor) {
    const preset = {
      ...EMPTY_PLAN,
      code: `custom-${planFor.id}`,
      name: (planFor.company || `Индивидуальный #${planFor.id}`).slice(0, 100),
      description: planFor.comment || '',
      period: planFor.period === 'year' ? 'year' : 'month',
      audience: 'business',
      is_custom: true,
      owner_user_id: planFor.user_id,
      limits: { ...(planFor.limits || {}) },
      features: { ...(planFor.features || {}) },
      sort_order: 100,
    };
    return (
      <PlanEditor
        plan={preset}
        catalog={catalog}
        saving={saving}
        title={`По заявке #${planFor.id} · ${planFor.login || planFor.email || `user #${planFor.user_id}`}`}
        onSave={createPlan}
        onCancel={() => setPlanFor(null)}
      />
    );
  }

  const planName = (id) => plans.find((p) => p.id === id)?.name || `#${id}`;

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div className={styles.views} role="group" aria-label="Статус заявок">
          {REQUEST_FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              type="button"
              className={`${styles.viewBtn} ${filter === f.value ? styles.viewBtnActive : ''}`}
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className={styles.muted}>Заявки на индивидуальный бизнес-план со страницы тарифов.</p>
      </div>

      {loading ? <p className={styles.muted}>Загрузка…</p> : null}
      {!loading && !items.length ? <p className={styles.muted}>Заявок нет</p> : null}

      <div className={styles.requests}>
        {items.map((req) => (
          <article key={req.id} className={styles.card}>
            <header className={styles.cardHead}>
              <div>
                <h4 className={styles.cardTitle}>{req.company || '—'}</h4>
                <span className={styles.code}>
                  #{req.id} · {formatDate(req.created)} · {req.login || req.email || `user #${req.user_id}`}
                  {req.email && req.login ? ` · ${req.email}` : ''}
                </span>
              </div>
              <div className={styles.badges}>
                <span className={req.status === 'done' ? styles.badge : styles.badgeMuted}>
                  {REQUEST_STATUS[req.status] || req.status}
                </span>
                <span className={styles.badgeMuted}>{req.period === 'year' ? 'год' : 'месяц'}</span>
              </div>
            </header>

            {req.contact ? <p className={styles.muted}>Контакт: {req.contact}</p> : null}
            {req.comment ? <p className={styles.requestComment}>{req.comment}</p> : null}

            <div className={styles.columns}>
              <ul className={styles.limits}>
                {(catalog?.limits || []).map((spec) => (
                  <li key={spec.key}>
                    <span>{spec.label}</span>
                    <b>{limitLabel(req.limits?.[spec.key])}</b>
                  </li>
                ))}
              </ul>
              <ul className={styles.features}>
                {(catalog?.features || []).map((spec) => (
                  <li key={spec.key} className={req.features?.[spec.key] ? styles.on : styles.off}>
                    {req.features?.[spec.key] ? '✓' : '—'} {spec.label}
                  </li>
                ))}
              </ul>
            </div>

            {req.plan_id ? <p className={styles.muted}>План: {planName(req.plan_id)}</p> : null}

            <label className={styles.field}>
              <span>Комментарий администратора (виден пользователю)</span>
              <textarea
                className={styles.input}
                rows={2}
                maxLength={4000}
                value={noteOf(req)}
                onChange={(e) => setNotes((n) => ({ ...n, [req.id]: e.target.value }))}
              />
            </label>

            <div className={styles.cardActions}>
              {!req.plan_id ? (
                <button type="button" className={styles.btnPrimary} onClick={() => setPlanFor(req)}>
                  Создать план по заявке
                </button>
              ) : null}
              <button
                type="button"
                className={styles.btnGhost}
                disabled={busy === req.id}
                onClick={() => update(req, { admin_note: noteOf(req) || null }, 'Комментарий сохранён')}
              >
                Сохранить комментарий
              </button>
              {req.status !== 'done' ? (
                <button
                  type="button"
                  className={styles.btnGhost}
                  disabled={busy === req.id}
                  onClick={() =>
                    update(req, { status: 'done', admin_note: noteOf(req) || null }, `Заявка #${req.id} выполнена`)
                  }
                >
                  Выполнена
                </button>
              ) : null}
              {req.status !== 'rejected' ? (
                <button
                  type="button"
                  className={styles.btnDanger}
                  disabled={busy === req.id}
                  onClick={() =>
                    update(req, { status: 'rejected', admin_note: noteOf(req) || null }, `Заявка #${req.id} отклонена`)
                  }
                >
                  Отклонить
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function AdminBillingPanel() {
  const [view, setView] = useState('plans');
  const [toast, setToast] = useState(null);

  const notify = useCallback((text, isError = false) => {
    setToast({ text, isError });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className={adminStyles.panelInner}>
      <div className={styles.views} role="group" aria-label="Раздел тарифов">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`${styles.viewBtn} ${view === v.id ? styles.viewBtnActive : ''}`}
            aria-pressed={view === v.id}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {toast ? (
        <div className={toast.isError ? styles.toastError : styles.toast} role="status">
          {toast.text}
        </div>
      ) : null}

      {view === 'plans' ? <PlansView notify={notify} /> : null}
      {view === 'subscriptions' ? <SubscriptionsView notify={notify} /> : null}
      {view === 'payments' ? <PaymentsView notify={notify} /> : null}
      {view === 'requests' ? <RequestsView notify={notify} /> : null}
    </div>
  );
}
