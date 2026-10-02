import React, { useState, useEffect } from 'react';
import { employeeService, TEAM_ROLES as FALLBACK_TEAM_ROLES } from '../../../../services/employeeService';
import { formatApiError } from '../../../../utils/formatApiError';
import { teamRolesFromContext } from './employeePermissions';

const initialForm = {
  name: '',
  login: '',
  email: '',
  password: '',
  team_role: 'Guest',
  department_id: '',
  phone: '',
};

export default function AddEmployeeModal({ isOpen, onClose, onCreated, context }) {
  const teamRoles = teamRolesFromContext(context).length
    ? teamRolesFromContext(context)
    : FALLBACK_TEAM_ROLES;
  const [form, setForm] = useState(initialForm);
  const [departments, setDepartments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      employeeService.getDepartments().then(setDepartments).catch(() => setDepartments([]));
      setForm(initialForm);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...form,
        department_id: form.department_id ? Number(form.department_id) : null,
        phone: form.phone.trim() || null,
      };
      await employeeService.createEmployee(payload);
      onCreated?.();
      onClose();
    } catch (err) {
      setError(formatApiError(err, 'Ошибка при создании сотрудника'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border p-6 shadow-xl" style={{ background: 'var(--gradient-surface)', borderColor: 'var(--color-border-muted)' }}>
        <h3 className="text-xl font-bold text-white mb-4">Добавить сотрудника</h3>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { key: 'name', label: 'Имя', type: 'text', required: true },
            { key: 'login', label: 'Логин', type: 'text', required: true },
            { key: 'email', label: 'Email', type: 'email', required: true },
            { key: 'password', label: 'Пароль', type: 'password', required: true },
            { key: 'phone', label: 'Телефон', type: 'text', required: false },
          ].map(({ key, label, type, required }) => (
            <div key={key}>
              <label className="block text-sm text-slate-300 mb-1">{label}</label>
              <input
                type={type}
                required={required}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm text-slate-300 mb-1">Роль (TeamRole)</label>
            <select
              value={form.team_role}
              onChange={(e) => setForm({ ...form, team_role: e.target.value })}
              className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
            >
              {teamRoles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Отдел</label>
            <select
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
            >
              <option value="">— не выбран —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
            >
              {submitting ? 'Сохранение...' : 'Создать'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/50"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
