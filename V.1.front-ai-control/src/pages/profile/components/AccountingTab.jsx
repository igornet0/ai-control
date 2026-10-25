import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { accountingService, accountingErrorMessage, fmtMoney } from '../../../services/accountingService';
import styles from './ProfileTabs.module.css';
import ui from './AccountingTab.module.css';

const CONTRACT_LABELS = { labor: 'Трудовой договор', gph: 'ГПХ', self_employed: 'Самозанятый', ip: 'ИП' };
const PAYMENT_LABELS = {
  salary: 'Зарплата',
  bonus: 'Премия',
  annual_bonus: 'Годовой бонус',
  vacation: 'Отпускные',
  other: 'Прочая выплата',
};
const today = () => new Date().toISOString().slice(0, 10);
const currentPeriod = () => new Date().toISOString().slice(0, 7);
const emptyEntry = () => ({
  kind: 'expense',
  entry_date: today(),
  amount: '',
  category: '',
  counterparty: '',
  description: '',
});

function Stat({ label, value, tone }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={`${styles.statValue} ${tone ? styles[tone] : ''}`}>{value}</div>
    </div>
  );
}

function CategoryList({ title, items, tone }) {
  const max = Math.max(0, ...(items || []).map((c) => Number(c.amount) || 0));
  return (
    <section className={`${styles.card} ${ui[tone]}`}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{title}</h3>
      </div>
      {items?.length ? (
        <ul className={ui.catList}>
          {items.map((c) => (
            <li key={c.category || '—'}>
              <div className={ui.catRow}>
                <span>{c.category || 'Без категории'}</span>
                <span className={ui.catAmount}>{fmtMoney(c.amount)}</span>
              </div>
              <div className={ui.catTrack}>
                <div className={ui.catFill} style={{ width: `${max ? ((Number(c.amount) || 0) / max) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>Нет данных за период</p>
      )}
    </section>
  );
}

function LedgerSection({ filters, onChanged, setError }) {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    accountingService
      .getEntries(params)
      .then(setEntries)
      .catch((e) => setError(accountingErrorMessage(e, 'Не удалось загрузить операции')));
  }, [filters, setError]);

  useEffect(load, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount), counterparty: form.counterparty || null };
      if (editId) await accountingService.updateEntry(editId, payload);
      else await accountingService.createEntry(payload);
      setForm(null);
      setEditId(null);
      load();
      onChanged();
    } catch (err) {
      setError(accountingErrorMessage(err, 'Не удалось сохранить операцию'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry) => {
    if (!(window.confirm('Удалить операцию?'))) return;
    try {
      await accountingService.deleteEntry(entry.id);
      load();
      onChanged();
    } catch (err) {
      setError(accountingErrorMessage(err, 'Не удалось удалить операцию'));
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Книга доходов и расходов</h3>
        {!form && (
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => setForm(emptyEntry())}>
            Добавить операцию
          </button>
        )}
      </div>

      {form && (
        <form onSubmit={submit} className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.label}>Тип</span>
            <select className={styles.input} value={form.kind} onChange={set('kind')}>
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Дата</span>
            <input type="date" className={styles.input} value={form.entry_date} onChange={set('entry_date')} required />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Сумма, ₽</span>
            <input type="number" min="0.01" step="0.01" className={styles.input} value={form.amount} onChange={set('amount')} required />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Категория</span>
            <input className={styles.input} value={form.category} onChange={set('category')} placeholder="Аренда, реклама…" />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Контрагент</span>
            <input className={styles.input} value={form.counterparty || ''} onChange={set('counterparty')} />
          </label>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span className={styles.label}>Комментарий</span>
            <input className={styles.input} value={form.description || ''} onChange={set('description')} />
          </label>
          <div className={styles.formActions}>
            <button type="submit" className={styles.btn} disabled={saving}>
              {editId ? 'Сохранить' : 'Добавить'}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() => {
                setForm(null);
                setEditId(null);
              }}
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {entries.length === 0 ? (
        <p className={styles.muted}>Операций за период нет.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тип</th>
                <th>Категория</th>
                <th>Контрагент</th>
                <th>Сумма</th>
                <th>Комментарий</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.entry_date).toLocaleDateString('ru-RU')}</td>
                  <td>
                    <span className={`${styles.badge} ${e.kind === 'income' ? styles.badgeSuccess : styles.badgeInfo}`}>
                      {e.kind === 'income' ? 'Доход' : 'Расход'}
                    </span>
                  </td>
                  <td>{e.category || '—'}</td>
                  <td>{e.counterparty || '—'}</td>
                  <td className={e.kind === 'income' ? styles.statPositive : styles.statNegative}>{fmtMoney(e.amount)}</td>
                  <td>{e.description || ''}</td>
                  <td>
                    {e.source !== 'payroll' && (
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
                          onClick={() => {
                            setEditId(e.id);
                            setForm({ ...emptyEntry(), ...e });
                          }}
                        >
                          Изменить
                        </button>
                        <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => remove(e)}>
                          Удалить
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EmployeeRow({ emp, onSaved, setError }) {
  const c = emp.contract || {};
  const [draft, setDraft] = useState({
    contract_type: c.contract_type || 'labor',
    is_resident: c.is_resident ?? true,
    position: c.position || '',
    base_salary: c.base_salary || 0,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await accountingService.saveContract(emp.id, { ...draft, base_salary: Number(draft.base_salary) || 0 });
      onSaved();
    } catch (err) {
      setError(accountingErrorMessage(err, 'Не удалось сохранить договор'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <tr>
      <td>
        {emp.name}
        <div className={styles.muted}>{emp.email}</div>
      </td>
      <td>
        <select className={styles.input} value={draft.contract_type} onChange={(e) => setDraft({ ...draft, contract_type: e.target.value })}>
          {Object.entries(CONTRACT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input className={styles.input} value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} />
      </td>
      <td>
        <input
          type="number"
          min="0"
          className={styles.input}
          value={draft.base_salary}
          onChange={(e) => setDraft({ ...draft, base_salary: e.target.value })}
        />
      </td>
      <td>
        <input type="checkbox" checked={draft.is_resident} onChange={(e) => setDraft({ ...draft, is_resident: e.target.checked })} />
      </td>
      <td>
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={save} disabled={saving}>
          Сохранить
        </button>
      </td>
    </tr>
  );
}

function PayrollSection({ onChanged, setError }) {
  const [employees, setEmployees] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [form, setForm] = useState({ user_id: '', period: currentPeriod(), payment_type: 'salary', gross: '', comment: '' });
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadEmployees = useCallback(() => {
    accountingService
      .getEmployees()
      .then(setEmployees)
      .catch((e) => setError(accountingErrorMessage(e, 'Не удалось загрузить сотрудников')));
  }, [setError]);
  const loadPayroll = useCallback(() => {
    accountingService
      .getPayroll()
      .then(setPayroll)
      .catch((e) => setError(accountingErrorMessage(e, 'Не удалось загрузить выплаты')));
  }, [setError]);

  useEffect(() => {
    loadEmployees();
    loadPayroll();
  }, [loadEmployees, loadPayroll]);

  useEffect(() => {
    if (!form.user_id || !Number(form.gross) || !/^\d{4}-\d{2}$/.test(form.period)) {
      setPreview(null);
      return undefined;
    }
    const t = setTimeout(() => {
      accountingService
        .calcPayroll({ user_id: Number(form.user_id), period: form.period, gross: Number(form.gross) })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 300);
    return () => clearTimeout(t);
  }, [form.user_id, form.period, form.gross]);

  const pickEmployee = (id) => {
    const emp = employees.find((e) => String(e.id) === id);
    setForm((f) => ({ ...f, user_id: id, gross: f.gross || emp?.contract?.base_salary || '' }));
  };

  const pay = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await accountingService.createPayroll({
        ...form,
        user_id: Number(form.user_id),
        gross: Number(form.gross),
        comment: form.comment || null,
      });
      setForm((f) => ({ ...f, gross: '', comment: '' }));
      loadPayroll();
      onChanged();
    } catch (err) {
      setError(accountingErrorMessage(err, 'Не удалось провести выплату'));
    } finally {
      setSaving(false);
    }
  };

  const removePayment = async (p) => {
    if (!(window.confirm('Отменить выплату? Связанная проводка будет удалена.'))) return;
    try {
      await accountingService.deletePayroll(p.id);
      loadPayroll();
      onChanged();
    } catch (err) {
      setError(accountingErrorMessage(err, 'Не удалось отменить выплату'));
    }
  };

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Сотрудники и договоры</h3>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Тип договора</th>
                <th>Должность</th>
                <th>Оклад, ₽</th>
                <th>Резидент РФ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <EmployeeRow key={emp.id} emp={emp} onSaved={loadEmployees} setError={setError} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Начисление и выплата</h3>
        </div>
        <form onSubmit={pay} className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.label}>Сотрудник</span>
            <select className={styles.input} value={form.user_id} onChange={(e) => pickEmployee(e.target.value)} required>
              <option value="">— выберите —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Период</span>
            <input type="month" className={styles.input} value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} required />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Вид выплаты</span>
            <select className={styles.input} value={form.payment_type} onChange={(e) => setForm({ ...form, payment_type: e.target.value })}>
              {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Начислено (до НДФЛ), ₽</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className={styles.input}
              value={form.gross}
              onChange={(e) => setForm({ ...form, gross: e.target.value })}
              required
            />
          </label>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span className={styles.label}>Комментарий</span>
            <input className={styles.input} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
          </label>
          {preview && (
            <div className={`${styles.statGrid} ${styles.fieldWide}`}>
              <Stat label="Начислено" value={fmtMoney(preview.gross)} />
              <Stat label="НДФЛ" value={fmtMoney(preview.ndfl)} tone="statNegative" />
              <Stat label="К выплате" value={fmtMoney(preview.net)} tone="statPositive" />
              <Stat label="Доход с начала года" value={fmtMoney(preview.ytd_gross)} />
              <p className={styles.muted}>
                {CONTRACT_LABELS[preview.contract_type]} · {preview.tax_note}
              </p>
            </div>
          )}
          <div className={styles.formActions}>
            <button type="submit" className={styles.btn} disabled={saving}>
              Провести выплату
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Ведомость выплат</h3>
        </div>
        {payroll.length === 0 ? (
          <p className={styles.muted}>Выплат пока нет.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Период</th>
                  <th>Сотрудник</th>
                  <th>Вид</th>
                  <th>Договор</th>
                  <th>Начислено</th>
                  <th>НДФЛ</th>
                  <th>К выплате</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payroll.map((p) => (
                  <tr key={p.id}>
                    <td>{p.period}</td>
                    <td>{p.user_name}</td>
                    <td>{PAYMENT_LABELS[p.payment_type] || p.payment_type}</td>
                    <td>{CONTRACT_LABELS[p.contract_type] || p.contract_type}</td>
                    <td>{fmtMoney(p.gross)}</td>
                    <td>{fmtMoney(p.ndfl)}</td>
                    <td>{fmtMoney(p.net)}</td>
                    <td>
                      <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => removePayment(p)}>
                        Отменить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const QUARTERS = ['I', 'II', 'III', 'IV'];
const MODES = [
  ['month', 'Месяц'],
  ['quarter', 'Квартал'],
  ['year', 'Год'],
  ['all', 'Всё время'],
  ['custom', 'Свой период'],
];
const STEP = { month: 1, quarter: 3, year: 12 };

const isoDate = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const nowAnchor = () => {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() };
};

/** Границы периода (ISO) и подпись для режима month/quarter/year. */
function periodRange(mode, { y, m }) {
  if (mode === 'month') {
    return { date_from: isoDate(y, m, 1), date_to: isoDate(y, m, new Date(y, m + 1, 0).getDate()), label: `${MONTHS[m]} ${y}` };
  }
  if (mode === 'quarter') {
    const q = Math.floor(m / 3);
    return { date_from: isoDate(y, q * 3, 1), date_to: isoDate(y, q * 3 + 2, new Date(y, q * 3 + 3, 0).getDate()), label: `${QUARTERS[q]} квартал ${y}` };
  }
  return { date_from: isoDate(y, 0, 1), date_to: isoDate(y, 11, 31), label: `${y} год` };
}

function Kpi({ label, value, tone, hint }) {
  return (
    <div className={`${ui.kpi} ${ui[tone] || ''}`}>
      <span className={ui.kpiLabel}>{label}</span>
      <span className={ui.kpiValue}>{value}</span>
      {hint && <span className={ui.kpiHint}>{hint}</span>}
    </div>
  );
}

/** Бухгалтерия: выручка, расходы, книга учёта, выгрузки; withPayroll — зарплатный модуль. */
export default function AccountingTab({ activeTab, withPayroll = false }) {
  const [mode, setMode] = useState('month');
  const [anchor, setAnchor] = useState(nowAnchor);
  const [custom, setCustom] = useState({ date_from: '', date_to: '' });
  const [kind, setKind] = useState('');
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [section, setSection] = useState('ledger');
  const isActive = activeTab === 'accounting';

  const range = useMemo(() => {
    if (mode === 'all') return { date_from: '', date_to: '', label: 'За всё время' };
    if (mode === 'custom') return { ...custom, label: '' };
    return periodRange(mode, anchor);
  }, [mode, anchor, custom]);

  const dates = useMemo(() => {
    const p = {};
    if (range.date_from) p.date_from = range.date_from;
    if (range.date_to) p.date_to = range.date_to;
    return p;
  }, [range.date_from, range.date_to]);
  const filters = useMemo(() => ({ ...dates, kind }), [dates, kind]);

  const loadSummary = useCallback(() => {
    accountingService
      .getSummary(dates)
      .then(setSummary)
      .catch((e) => setError(accountingErrorMessage(e, 'Не удалось загрузить сводку')));
  }, [dates]);

  useEffect(() => {
    if (isActive) loadSummary();
  }, [isActive, loadSummary]);

  if (!isActive) return null;

  const exportCsv = (type) => {
    accountingService.exportCsv(type, dates).catch((e) => setError(accountingErrorMessage(e, 'Не удалось выгрузить файл')));
  };
  const shift = (dir) =>
    setAnchor(({ y, m }) => {
      const total = y * 12 + m + dir * STEP[mode];
      return { y: Math.floor(total / 12), m: total % 12 };
    });
  const now = nowAnchor();
  const atCurrent = STEP[mode] && periodRange(mode, anchor).date_from === periodRange(mode, now).date_from;
  const income = summary?.income || 0;
  const margin = income ? Math.round(((summary?.profit || 0) / income) * 100) : null;

  return (
    <div className={styles.page}>
      <header className={`${styles.header} ${ui.hero}`}>
        <div>
          <p className={styles.eyebrow}>Учёт</p>
          <h2 className={styles.title}>Бухгалтерия</h2>
          <p className={styles.subtitle}>
            {withPayroll ? 'Доходы, расходы, зарплаты и НДФЛ.' : 'Выручка платформы, расходы и полный учёт.'}
          </p>
        </div>
        <div className={ui.exportGroup}>
          <button type="button" className={ui.exportBtn} onClick={() => exportCsv('ledger')}>
            ↓ Книга учёта
          </button>
          <button type="button" className={ui.exportBtn} onClick={() => exportCsv('payroll')}>
            ↓ Зарплаты
          </button>
        </div>
      </header>

      {error && (
        <div className={styles.errorBox} onClick={() => setError('')} role="alert">
          {error}
        </div>
      )}

      <div className={ui.toolbar}>
        <div className={ui.segmented} role="tablist" aria-label="Период">
          {MODES.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              className={`${ui.segBtn} ${mode === key ? ui.segActive : ''}`}
              onClick={() => setMode(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {STEP[mode] ? (
          <div className={ui.stepper}>
            <button type="button" className={ui.stepBtn} onClick={() => shift(-1)} aria-label="Предыдущий период">
              ‹
            </button>
            <span className={ui.periodLabel}>{range.label}</span>
            <button type="button" className={ui.stepBtn} onClick={() => shift(1)} disabled={atCurrent} aria-label="Следующий период">
              ›
            </button>
            {!atCurrent && (
              <button type="button" className={ui.linkBtn} onClick={() => setAnchor(now)}>
                Сегодня
              </button>
            )}
          </div>
        ) : mode === 'custom' ? (
          <div className={ui.customRange}>
            <input
              type="date"
              className={styles.input}
              value={custom.date_from}
              max={custom.date_to || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, date_from: e.target.value }))}
            />
            —
            <input
              type="date"
              className={styles.input}
              value={custom.date_to}
              min={custom.date_from || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, date_to: e.target.value }))}
            />
          </div>
        ) : (
          <span className={ui.periodLabel}>{range.label}</span>
        )}
      </div>

      {summary && (
        <>
          <div className={ui.kpiGrid}>
            <Kpi label="Доходы" value={fmtMoney(summary.income)} tone="income" />
            <Kpi label="Расходы" value={fmtMoney(summary.expense)} tone="expense" />
            <Kpi
              label="Прибыль"
              value={fmtMoney(summary.profit)}
              tone={summary.profit >= 0 ? 'profit' : 'loss'}
              hint={margin !== null ? `Маржа ${margin}%` : null}
            />
            {withPayroll ? (
              <>
                <Kpi label="ФОТ (начислено)" value={fmtMoney(summary.payroll_gross)} tone="neutral" />
                <Kpi label="НДФЛ удержано" value={fmtMoney(summary.payroll_ndfl)} tone="tax" />
              </>
            ) : (
              <Kpi label="Выручка от подписок" value={fmtMoney(summary.billing_revenue)} tone="neutral" />
            )}
          </div>

          <div className={ui.split}>
            <CategoryList title="Доходы по категориям" items={summary.income_by_category} tone="income" />
            <CategoryList title="Расходы по категориям" items={summary.expense_by_category} tone="expense" />
          </div>

          {summary.by_month?.length > 1 && (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>По месяцам</h3>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Месяц</th>
                      <th className={ui.num}>Доходы</th>
                      <th className={ui.num}>Расходы</th>
                      <th className={ui.num}>Итог</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.by_month.map((m) => {
                      const net = (m.income || 0) - (m.expense || 0);
                      return (
                        <tr key={m.month}>
                          <td>{m.month}</td>
                          <td className={ui.num}>{fmtMoney(m.income)}</td>
                          <td className={ui.num}>{fmtMoney(m.expense)}</td>
                          <td className={`${ui.num} ${net >= 0 ? ui.pos : ui.neg}`}>{fmtMoney(net)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <div className={ui.toolbar}>
        {withPayroll ? (
          <div className={ui.segmented} role="tablist" aria-label="Раздел">
            {[
              ['ledger', 'Книга учёта'],
              ['payroll', 'Зарплаты и НДФЛ'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={section === key}
                className={`${ui.segBtn} ${section === key ? ui.segActive : ''}`}
                onClick={() => setSection(key)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <span className={ui.periodLabel}>Книга учёта</span>
        )}
        {section === 'ledger' && (
          <div className={ui.segmented} role="tablist" aria-label="Тип операций">
            {[
              ['', 'Все'],
              ['income', 'Доходы'],
              ['expense', 'Расходы'],
            ].map(([key, label]) => (
              <button
                key={key || 'all'}
                type="button"
                role="tab"
                aria-selected={kind === key}
                className={`${ui.segBtn} ${kind === key ? ui.segActive : ''}`}
                onClick={() => setKind(key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {withPayroll && section === 'payroll' ? (
        <PayrollSection onChanged={loadSummary} setError={setError} />
      ) : (
        <LedgerSection filters={filters} onChanged={loadSummary} setError={setError} />
      )}
    </div>
  );
}
