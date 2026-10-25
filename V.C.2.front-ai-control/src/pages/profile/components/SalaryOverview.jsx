import React, { useEffect, useState } from 'react';
import { accountingService, accountingErrorMessage, fmtMoney } from '../../../services/accountingService';
import styles from './ProfileTabs.module.css';

const CONTRACT_LABELS = { labor: 'Трудовой договор', gph: 'ГПХ', self_employed: 'Самозанятый', ip: 'ИП' };
const PAYMENT_LABELS = {
  salary: 'Зарплата',
  bonus: 'Премия',
  annual_bonus: 'Годовой бонус',
  vacation: 'Отпускные',
  other: 'Прочая выплата',
};

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2];

const Stat = ({ label, value, tone }) => (
  <div className={styles.statCard}>
    <span className={styles.statLabel}>{label}</span>
    <span className={`${styles.statValue} ${tone ? styles[tone] : ''}`}>{value}</span>
  </div>
);

/** Зарплата, премии и годовой бонус текущего сотрудника. */
const SalaryOverview = () => {
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    accountingService
      .getMySalary(year)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(accountingErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [year]);

  const totals = data?.totals || {};
  const payments = data?.payments || [];

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Зарплата и бонусы</h3>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      {error ? (
        <p className={styles.statNegative}>{error}</p>
      ) : (
        <>
          {data?.contract && (
            <p>
              {CONTRACT_LABELS[data.contract.contract_type] || data.contract.contract_type}
              {data.contract.position ? ` · ${data.contract.position}` : ''}
              {data.contract.base_salary ? ` · оклад ${fmtMoney(data.contract.base_salary)}` : ''}
            </p>
          )}
          <div className={styles.statGrid}>
            <Stat label="Зарплата" value={fmtMoney(totals.salary)} />
            <Stat label="Премии" value={fmtMoney(totals.bonus)} />
            <Stat label="Годовой бонус" value={fmtMoney(totals.annual_bonus)} />
            <Stat label="НДФЛ удержан" value={fmtMoney(totals.ndfl)} tone="statNegative" />
            <Stat label="Получено на руки" value={fmtMoney(totals.net)} tone="statPositive" />
          </div>
          {payments.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Период</th>
                    <th>Тип</th>
                    <th>Начислено</th>
                    <th>НДФЛ</th>
                    <th>К выплате</th>
                    <th>Выплачено</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.period}</td>
                      <td>{PAYMENT_LABELS[p.payment_type] || p.payment_type}</td>
                      <td>{fmtMoney(p.gross)}</td>
                      <td>{fmtMoney(p.ndfl)}</td>
                      <td className={styles.statPositive}>{fmtMoney(p.net)}</td>
                      <td>{p.paid_at ? String(p.paid_at).slice(0, 10) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default SalaryOverview;
