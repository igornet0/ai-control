import React, { useState, useEffect } from 'react';
import { employeeService } from '../../../../services/employeeService';
import { formatApiError } from '../../../../utils/formatApiError';

import {
  canAssignManagers,
  canEditDepartment,
  canManageDepartments,
} from './employeePermissions';
import InviteToolbar from './InviteToolbar';
import tabStyles from '../ProfileTabs.module.css';

const emptyForm = { name: '', description: '', parent_id: '', manager_id: '', is_support: false, is_accounting: false, is_hr: false };

export default function AdminDepartmentsSection({ context }) {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const allowCreate = context ? canManageDepartments(context) : true;
  const allowAssign = context ? canAssignManagers(context) : true;

  const load = async () => {
    setError('');
    try {
      const [depts, emps] = await Promise.all([
        employeeService.getDepartments(),
        employeeService.getEmployees(),
      ]);
      setDepartments(depts);
      setEmployees(emps);
    } catch (err) {
      setError(formatApiError(err, 'Ошибка загрузки отделов'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (dept) => {
    setEditingId(dept.id);
    setForm({
      name: dept.name,
      description: dept.description || '',
      parent_id: dept.parent_id ? String(dept.parent_id) : '',
      manager_id: dept.manager_id ? String(dept.manager_id) : '',
      is_support: Boolean(dept.is_support),
      is_accounting: Boolean(dept.is_accounting),
      is_hr: Boolean(dept.is_hr),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        manager_id: form.manager_id ? Number(form.manager_id) : null,
      };
      if (allowCreate) {
        payload.parent_id = form.parent_id ? Number(form.parent_id) : null;
        payload.is_support = Boolean(form.is_support);
        payload.is_accounting = Boolean(form.is_accounting);
        payload.is_hr = Boolean(form.is_hr);
      }
      if (editingId) {
        await employeeService.updateDepartment(editingId, payload);
      } else {
        await employeeService.createDepartment(payload);
      }
      setShowModal(false);
      await load();
    } catch (err) {
      alert(formatApiError(err, 'Ошибка сохранения отдела'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignManager = async (deptId, managerId) => {
    if (!managerId) return;
    try {
      await employeeService.assignDepartmentManager(deptId, Number(managerId));
      await load();
    } catch (err) {
      alert(formatApiError(err, 'Ошибка назначения руководителя'));
    }
  };

  if (loading) return <div className={tabStyles.loader}><span className={tabStyles.spinner} />Загрузка отделов...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4 gap-3">
        <h3 className="text-lg font-semibold text-white">Отделы ({departments.length})</h3>
        <div className="flex flex-wrap gap-2">
          <InviteToolbar context={context} />
          {allowCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
            >
              + Создать отдел
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border-muted)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-400" style={{ borderColor: 'var(--color-border-muted)' }}>
              <th className="p-3">Название</th>
              <th className="p-3">Описание</th>
              <th className="p-3">Роль</th>
              <th className="p-3">Руководитель</th>
              <th className="p-3">Сотрудники</th>
              <th className="p-3">Команды</th>
              <th className="p-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((dept) => {
              const canEdit = context ? canEditDepartment(context, dept.id) : true;
              const canAssignManager = allowAssign || canEdit;
              return (
              <tr key={dept.id} className="border-b border-slate-700/50">
                <td className="p-3 text-white font-medium">{dept.name}</td>
                <td className="p-3 text-slate-400 max-w-xs truncate">{dept.description || '—'}</td>
                <td className="p-3">
                  {dept.is_support || dept.is_accounting || dept.is_hr ? (
                    <div className="flex flex-wrap gap-1">
                      {dept.is_support && (
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
                          Поддержка
                        </span>
                      )}
                      {dept.is_accounting && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50">
                          Бухгалтерия
                        </span>
                      )}
                      {dept.is_hr && (
                        <span className="text-xs px-2 py-0.5 rounded bg-sky-900/60 text-sky-300 border border-sky-700/50">
                          Отдел кадров
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="p-3">
                  {canAssignManager ? (
                  <select
                    value={dept.manager_id || ''}
                    onChange={(e) => handleAssignManager(dept.id, e.target.value)}
                    className="rounded-lg bg-slate-800/80 border border-slate-600 px-2 py-1 text-slate-200 text-xs min-w-[140px]"
                  >
                    <option value="">— не назначен —</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                  ) : (
                    <span className="text-slate-400 text-xs">{dept.manager_name || '—'}</span>
                  )}
                </td>
                <td className="p-3 text-slate-300">{dept.employee_count}</td>
                <td className="p-3 text-slate-300">{dept.team_count}</td>
                <td className="p-3">
                  {canEdit && (
                  <button
                    type="button"
                    onClick={() => openEdit(dept)}
                    className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600"
                  >
                    Изменить
                  </button>
                  )}
                </td>
              </tr>
            );})}
            {departments.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">Отделы не созданы</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border p-6" style={{ background: 'var(--gradient-surface)', borderColor: 'var(--color-border-muted)' }}>
            <h4 className="text-lg font-bold text-white mb-4">
              {editingId ? 'Редактировать отдел' : 'Новый отдел'}
            </h4>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Название</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Описание</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
                  rows={2}
                />
              </div>
              {allowCreate && (
              <div>
                <label className="block text-sm text-slate-300 mb-1">Родительский отдел</label>
                <select
                  value={form.parent_id}
                  onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                  className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
                >
                  <option value="">— корневой —</option>
                  {departments.filter((d) => d.id !== editingId).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              )}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Руководитель</label>
                <select
                  value={form.manager_id}
                  onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
                  className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
                >
                  <option value="">— не назначен —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.team_role})</option>
                  ))}
                </select>
              </div>
              {allowCreate && (
                <>
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={Boolean(form.is_support)}
                      onChange={(e) => setForm({ ...form, is_support: e.target.checked })}
                      className="rounded border-slate-600 bg-slate-800"
                    />
                    Отдел поддержки
                  </label>
                  <p className="text-xs text-slate-500 -mt-1">
                    Вопросы со страницы «Поддержка» будут направляться в этот отдел. Одновременно может быть только один такой отдел.
                  </p>
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={Boolean(form.is_accounting)}
                      onChange={(e) => setForm({ ...form, is_accounting: e.target.checked })}
                      className="rounded border-slate-600 bg-slate-800"
                    />
                    Бухгалтерия
                  </label>
                  <p className="text-xs text-slate-500 -mt-1">
                    Сотрудники отдела получают доступ к вкладке «Бухгалтерия».
                  </p>
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={Boolean(form.is_hr)}
                      onChange={(e) => setForm({ ...form, is_hr: e.target.checked })}
                      className="rounded border-slate-600 bg-slate-800"
                    />
                    Отдел кадров
                  </label>
                  <p className="text-xs text-slate-500 -mt-1">
                    Сотрудники отдела получают полный доступ к вкладке «Сотрудники» и документам сотрудников. Одновременно может быть только один такой отдел.
                  </p>
                </>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={submitting} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50">
                  {submitting ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
