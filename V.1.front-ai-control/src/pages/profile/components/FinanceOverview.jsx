import React, { useEffect, useState } from 'react';
import { billingService } from '../../../services/billingService';
import { fmtMoney } from '../../../services/accountingService';
import styles from './ProfileTabs.module.css';

const STATUS_LABELS = { paid: 'Оплачен', pending: 'Ожидает', failed: 'Ошибка', canceled: 'Отменён' };

/** Баланс, расходы на платформу, статистика использования и история платежей. */
export default function FinanceOverview({ onOpenPlan }) {
  const [me, setMe] = useState(null);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    billingService.getMe().then(setMe).catch(() => setMe(null));
    billingService
      .getMyPayments()
      .then((d) => setPayments(d?.payments || []))
      .catch(() => setPayments([]));
  }, []);

  const paid = payments.filter((p) => p.status === 'paid');
  const totalSpent = paid.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthSpent = paid
    .filter((p) => p.paid_at && new Date(p.paid_at) >= monthStart)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const limits = me?.catalog?.limits || [];
  const unlimited = me?.catalog?.unlimited ?? -1;
  const expires = me?.subscription?.expires_at;

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Баланс и подписка</h3>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onOpenPlan}>
            Пополнить / сменить тариф
          </button>
        </div>
        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Тариф</div>
            <div className={styles.statValue}>{me?.plan?.name || '—'}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Действует до</div>
            <div className={styles.statValue}>
              {expires ? new Date(expires).toLocaleDateString('ru-RU') : 'Бессрочно'}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Расходы за месяц</div>
            <div className={styles.statValue}>{fmtMoney(monthSpent)}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Всего оплачено</div>
            <div className={styles.statValue}>{fmtMoney(totalSpent)}</div>
          </div>
        </div>
      </section>

      {limits.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Использование платформы</h3>
          </div>
          <div className={styles.statGrid}>
            {limits.map(({ key, label }) => {
              const u = me?.usage?.[key] || { used: 0, limit: unlimited };
              const isUnlimited = u.limit === unlimited || u.limit == null;
              const pct = isUnlimited || !u.limit ? 0 : Math.min(100, (u.used / u.limit) * 100);
              return (
                <div key={key} className={styles.statCard}>
                  <div className={styles.statLabel}>{label}</div>
                  <div className={styles.statValue}>
                    {u.used} / {isUnlimited ? '∞' : u.limit}
                  </div>
                  {!isUnlimited && (
                    <div className={styles.usageBar}>
                      <div className={styles.usageBarFill} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>История расходов</h3>
        </div>
        {payments.length === 0 ? (
          <p className={styles.muted}>Платежей пока нет.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Тариф</th>
                  <th>Период</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.paid_at || p.created).toLocaleDateString('ru-RU')}</td>
                    <td>{p.plan_name || '—'}</td>
                    <td>{p.period === 'year' ? 'Год' : 'Месяц'}</td>
                    <td>{fmtMoney(p.amount)}</td>
                    <td>{STATUS_LABELS[p.status] || p.status}</td>
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
