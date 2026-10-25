import React, { useState, useEffect } from 'react';
import { employeeService } from '../../../../services/employeeService';
import { formatApiError } from '../../../../utils/formatApiError';
import EmployeeHoverTrigger from './EmployeeHoverTrigger';
import InviteToolbar from './InviteToolbar';
import { hasPermission } from './employeePermissions';
import tabStyles from '../ProfileTabs.module.css';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

export default function ExecutiveOrgEmployeesSection({ context }) {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState('');

  const canEditOrg = hasPermission(context, 'edit_employees_org');

  const loadEmployees = async () => {
    setLoading(true);
    setError('');
    try {
      const [data, depts] = await Promise.all([
        employeeService.getEmployees({ search: search || undefined }),
        employeeService.getDepartments(),
      ]);
      setEmployees(data);
      setDepartments(depts);
    } catch {
      setError('Ошибка загрузки сотрудников');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadEmployees();
  };

  const handleDepartmentChange = async (employeeId, newDeptId) => {
    if (!canEditOrg) return;
    const deptId = newDeptId ? Number(newDeptId) : null;
    setActionLoading(employeeId);
    try {
      await employeeService.updateEmployee(employeeId, { department_id: deptId });
      await loadEmployees();
    } catch (err) {
      alert(formatApiError(err, 'Ошибка назначения отдела'));
      await loadEmployees();
    } finally {
      setActionLoading(null);
    }
  };

  const handleManagerChange = async (employeeId, newManagerId) => {
    if (!canEditOrg) return;
    if (Number(newManagerId) === employeeId) {
      alert('Сотрудник не может быть своим руководителем');
      await loadEmployees();
      return;
    }
    const managerId = newManagerId ? Number(newManagerId) : null;
    setActionLoading(employeeId);
    try {
      await employeeService.updateEmployee(employeeId, { manager_id: managerId });
      await loadEmployees();
    } catch (err) {
      alert(formatApiError(err, 'Ошибка назначения руководителя'));
      await loadEmployees();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold text-white">Сотрудники ({employees.length})</h3>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-slate-500 text-xs">TeamRole изменяется только администратором</p>
          <InviteToolbar context={context} />
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Поиск по имени, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
        />
        <button type="submit" className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600">
          Найти
        </button>
      </form>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      {loading ? (
        <div className={tabStyles.loader}><span className={tabStyles.spinner} />Загрузка...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border-muted)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-400" style={{ borderColor: 'var(--color-border-muted)' }}>
                <th className="p-3">Имя</th>
                <th className="p-3">Email</th>
                <th className="p-3">TeamRole</th>
                <th className="p-3">Отдел</th>
                <th className="p-3">Руководитель</th>
                <th className="p-3">Последний вход</th>
                <th className="p-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                  <td className="p-3 text-white">
                    <EmployeeHoverTrigger employee={emp} className="inline-block">
                      <span className="flex items-center gap-2">
                        {emp.is_online && <span className="w-2 h-2 rounded-full bg-emerald-400" title="онлайн" />}
                        <span className="hover:text-indigo-300 transition-colors">{emp.name}</span>
                      </span>
                    </EmployeeHoverTrigger>
                  </td>
                  <td className="p-3 text-slate-300">{emp.email}</td>
                  <td className="p-3 text-slate-300">{emp.team_role}</td>
                  <td className="p-3">
                    {canEditOrg ? (
                      <select
                        value={emp.department_id || ''}
                        disabled={actionLoading === emp.id}
                        onChange={(e) => handleDepartmentChange(emp.id, e.target.value)}
                        className="rounded-lg bg-slate-800/80 border border-slate-600 px-2 py-1 text-slate-200 text-xs min-w-[110px] disabled:opacity-50"
                      >
                        <option value="">—</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-400">{emp.department_name || '—'}</span>
                    )}
                  </td>
                  <td className="p-3">
                    {canEditOrg ? (
                      <select
                        value={emp.manager_id || ''}
                        disabled={actionLoading === emp.id}
                        onChange={(e) => handleManagerChange(emp.id, e.target.value)}
                        className="rounded-lg bg-slate-800/80 border border-slate-600 px-2 py-1 text-slate-200 text-xs min-w-[110px] disabled:opacity-50"
                      >
                        <option value="">—</option>
                        {employees.filter((e) => e.id !== emp.id).map((e) => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-400">{formatDate(emp.last_login_at)}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${emp.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                      {emp.is_active ? 'Активен' : 'Заблокирован'}
                    </span>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">Сотрудники не найдены</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
