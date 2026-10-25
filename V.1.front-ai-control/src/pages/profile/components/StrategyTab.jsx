import React, { useEffect, useState } from 'react';
import { employeeService } from '../../../services/employeeService';
import StrategyWorkspace from './strategy/StrategyWorkspace';
import styles from './strategy/Strategy.module.css';
import tabStyles from './ProfileTabs.module.css';

/**
 * Strategy tab router — Goal-centric workspace with AI Strategy Agent.
 */
export default function StrategyTab({ activeTab }) {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeTab !== 'strategys') return;
    setLoading(true);
    setError('');
    employeeService
      .getContext()
      .then(setContext)
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false));
  }, [activeTab]);

  if (activeTab !== 'strategys') return null;

  if (loading) {
    return (
      <div className={tabStyles.loader}>
        <span className={tabStyles.spinner} />
        Загрузка...
      </div>
    );
  }

  if (error) {
    return <div className={tabStyles.errorBox}>{error}</div>;
  }

  const tier = context?.tier;

  if (tier === 'guest') {
    return (
      <div className={`${styles.glass} ${styles.cardPad}`}>
        <p className={styles.muted}>У вас нет доступа к стратегии компании.</p>
      </div>
    );
  }

  if (tier === 'platform_admin' || tier === 'executive') {
    return <StrategyWorkspace mode="executive" context={context} />;
  }

  if (tier === 'management') {
    return <StrategyWorkspace mode="manager" context={context} />;
  }

  return <StrategyWorkspace mode="employee" context={context} />;
}
