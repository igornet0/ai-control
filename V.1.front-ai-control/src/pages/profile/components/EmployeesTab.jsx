import React, { useState, useEffect } from 'react';
import { employeeService } from '../../../services/employeeService';
import AdminEmployeesPanel from './employees/AdminEmployeesPanel';
import ExecutiveEmployeesPanel from './employees/ExecutiveEmployeesPanel';
import ManagerEmployeesPanel from './employees/ManagerEmployeesPanel';
import ColleaguesView from './employees/ColleaguesView';
import GuestEmptyState from './employees/GuestEmptyState';
import styles from './ProfileTabs.module.css';

export default function EmployeesTab({ activeTab, user }) {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeTab !== 'employees') return;
    setLoading(true);
    setError('');
    employeeService.getContext()
      .then(setContext)
      .catch(() => setError('Не удалось загрузить контекст'))
      .finally(() => setLoading(false));
  }, [activeTab]);

  if (activeTab !== 'employees') return null;

  if (loading) {
    return (
      <div className={styles.loader}>
        <span className={styles.spinner} />
        Загрузка...
      </div>
    );
  }

  if (error) {
    return <div className={styles.errorBox}>{error}</div>;
  }

  if (context?.tier === 'guest') {
    return <GuestEmptyState />;
  }

  const isAdmin =
    user?.is_superuser ||
    user?.role === 'admin' ||
    context?.tier === 'platform_admin' ||
    Boolean(context?.is_hr_member);

  if (isAdmin) {
    return <AdminEmployeesPanel currentUser={user} context={context} />;
  }

  if (context?.tier === 'executive') {
    return <ExecutiveEmployeesPanel context={context} />;
  }

  if (context?.tier === 'management') {
    return <ManagerEmployeesPanel context={context} />;
  }

  return <ColleaguesView context={context} />;
}
