import React, { useState, useEffect } from 'react';
import { employeeService } from '../../../services/employeeService';
import AdminEmployeesPanel from './employees/AdminEmployeesPanel';
import ExecutiveEmployeesPanel from './employees/ExecutiveEmployeesPanel';
import ManagerEmployeesPanel from './employees/ManagerEmployeesPanel';
import ColleaguesView from './employees/ColleaguesView';
import GuestEmptyState from './employees/GuestEmptyState';

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
    return <p className="text-slate-400">Загрузка...</p>;
  }

  if (error) {
    return <p className="text-red-400">{error}</p>;
  }

  if (context?.tier === 'guest') {
    return <GuestEmptyState />;
  }

  const isAdmin =
    user?.is_superuser ||
    user?.role === 'admin' ||
    context?.tier === 'platform_admin';

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
