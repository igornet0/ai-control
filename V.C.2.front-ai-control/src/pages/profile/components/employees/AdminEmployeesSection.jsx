import React, { useState, useEffect } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { employeeService, TEAM_ROLES as FALLBACK_TEAM_ROLES } from '../../../../services/employeeService';
import { formatApiError } from '../../../../utils/formatApiError';
import AddEmployeeModal from './AddEmployeeModal';
import EmployeeHoverTrigger from './EmployeeHoverTrigger';
import InviteToolbar from './InviteToolbar';
import { teamRolesFromContext } from './employeePermissions';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

export default function AdminEmployeesSection({ currentUser, context }) {
  const teamRoles = teamRolesFromContext(context).length
    ? teamRolesFromContext(context)
    : FALLBACK_TEAM_ROLES;
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');

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

  const handleBlock = async (id, isActive) => {
    const action = isActive ? 'заблокировать' : 'разблокировать';
    if (!window.confirm(`Вы уверены, что хотите ${action} этого пользователя?`)) return;
    setActionLoading(id);
    try {
      if (isActive) await employeeService.blockEmployee(id);
      else await employeeService.unblockEmployee(id);
      await loadEmployees();
    } catch {
      alert('Ошибка при изменении статуса');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить пользователя без возможности восстановления?')) return;
    setActionLoading(id);
    try {
      await employeeService.deleteEmployee(id);
      await loadEmployees();
    } catch {
      alert('Ошибка при удалении');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTeamRoleChange = async (employeeId, employeeName, currentRole, newRole) => {
    if (newRole === currentRole) return;
    if (currentUser?.id === employeeId) {
      alert('Вы не можете изменить свою собственную TeamRole');
      await loadEmployees();
      return;
    }
    if (!window.confirm(`Изменить TeamRole «${employeeName}» на «${newRole}»?`)) {
      await loadEmployees();
      return;
    }
    setActionLoading(employeeId);
    try {
      await employeeService.updateEmployee(employeeId, { team_role: newRole });
      await loadEmployees();
    } catch (err) {
      alert(formatApiError(err, 'Ошибка при изменении TeamRole'));
      await loadEmployees();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDepartmentChange = async (employeeId, employeeName, newDeptId) => {
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

  const handleManagerChange = async (employeeId, employeeName, newManagerId) => {
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
        <div className="flex flex-wrap gap-2">
          <InviteToolbar context={context} />
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
          >
            + Добавить сотрудника
          </button>
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
        <p className="text-slate-400">Загрузка...</p>
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
                <th className="p-3">Ср. время/день</th>
                <th className="p-3">Статус</th>
                <th className="p-3">Действия</th>
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
                  <td className="p-3">
                    <select
                      value={emp.team_role}
                      disabled={actionLoading === emp.id || currentUser?.id === emp.id}
                      onChange={(e) => handleTeamRoleChange(emp.id, emp.name, emp.team_role, e.target.value)}
                      className="rounded-lg bg-slate-800/80 border border-slate-600 px-2 py-1 text-slate-200 text-xs min-w-[110px] disabled:opacity-50"
                    >
                      {teamRoles.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <select
                      value={emp.department_id || ''}
                      disabled={actionLoading === emp.id}
                      onChange={(e) => handleDepartmentChange(emp.id, emp.name, e.target.value)}
                      className="rounded-lg bg-slate-800/80 border border-slate-600 px-2 py-1 text-slate-200 text-xs min-w-[110px] disabled:opacity-50"
                    >
                      <option value="">—</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <select
                      value={emp.manager_id || ''}
                      disabled={actionLoading === emp.id}
                      onChange={(e) => handleManagerChange(emp.id, emp.name, e.target.value)}
                      className="rounded-lg bg-slate-800/80 border border-slate-600 px-2 py-1 text-slate-200 text-xs min-w-[110px] disabled:opacity-50"
                    >
                      <option value="">—</option>
                      {employees.filter((e) => e.id !== emp.id).map((e) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-slate-400">{formatDate(emp.last_login_at)}</td>
                  <td className="p-3 text-slate-400">
                    {emp.avg_session_hours_30d != null ? `${emp.avg_session_hours_30d} ч` : '—'}
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${emp.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                      {emp.is_active ? 'Активен' : 'Заблокирован'}
                    </span>
                  </td>
                  <td className="p-3">
                    {currentUser?.id !== emp.id && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={actionLoading === emp.id}
                          onClick={() => handleBlock(emp.id, emp.is_active)}
                          className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
                        >
                          {emp.is_active ? 'Блок' : 'Разблок'}
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading === emp.id}
                          onClick={() => handleDelete(emp.id)}
                          className="p-1 rounded text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                          title="Удалить"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">Сотрудники не найдены</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={loadEmployees}
        context={context}
      />
    </div>
  );
}
