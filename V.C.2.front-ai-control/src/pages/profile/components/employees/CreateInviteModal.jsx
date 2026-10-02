import React, { useEffect, useMemo, useState } from 'react';
import { employeeService } from '../../../../services/employeeService';
import { inviteService, buildInviteUrl } from '../../../../services/inviteService';
import { formatApiError } from '../../../../utils/formatApiError';
import { inviteRolesFromContext } from './employeePermissions';
import InvitesList from './InvitesList';

function defaultExpiryLocal() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CreateInviteModal({ isOpen, onClose, context }) {
  const roles = inviteRolesFromContext(context);
  const [form, setForm] = useState({
    name: '',
    email: '',
    team_role: '',
    department_id: '',
    manager_id: '',
    expires_at: defaultExpiryLocal(),
  });
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdUrl, setCreatedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [listKey, setListKey] = useState(0);

  const visibleDepartments = useMemo(() => {
    const allowed = context?.invite_allowed_department_ids;
    if (allowed == null) return departments;
    const allowedSet = new Set(allowed);
    return departments.filter((d) => allowedSet.has(d.id));
  }, [departments, context?.invite_allowed_department_ids]);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setCreatedUrl('');
    setCopied(false);
    setForm({
      name: '',
      email: '',
      team_role: roles[0] || '',
      department_id: '',
      manager_id: '',
      expires_at: defaultExpiryLocal(),
    });
    employeeService.getDepartments().then(setDepartments).catch(() => setDepartments([]));
    employeeService.getEmployees().then(setEmployees).catch(() => setEmployees([]));
    setListKey((key) => key + 1);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt('Скопируйте ссылку', url);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setCopied(false);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        team_role: form.team_role,
        department_id: form.department_id ? Number(form.department_id) : null,
        manager_id: form.manager_id ? Number(form.manager_id) : null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };
      const created = await inviteService.createInvite(payload);
      const url = buildInviteUrl(created.token) || created.invite_url;
      setCreatedUrl(url);
      setListKey((key) => key + 1);
    } catch (err) {
      setError(formatApiError(err, 'Не удалось создать инвайт'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-xl"
        style={{ background: 'var(--gradient-surface)', borderColor: 'var(--color-border-muted)' }}
      >
        <h3 className="text-xl font-bold text-white mb-4">Создать инвайт-ссылку</h3>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        {createdUrl ? (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-emerald-300 text-sm mb-2">Ссылка создана. Отправьте её сотруднику:</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={createdUrl}
                className="flex-1 rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white text-sm"
              />
              <button
                type="button"
                onClick={() => handleCopy(createdUrl)}
                className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
              >
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Имя</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Почта</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Роль</label>
            <select
              required
              value={form.team_role}
              onChange={(e) => setForm({ ...form, team_role: e.target.value })}
              className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
            >
              {roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Отдел</label>
            <select
              required={form.team_role === 'Manager' && context?.invite_allowed_department_ids != null}
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
            >
              <option value="">— не выбран —</option>
              {visibleDepartments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Руководитель</label>
            <select
              value={form.manager_id}
              onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
              className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
            >
              <option value="">— не выбран —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Действует до</label>
            <input
              type="datetime-local"
              required
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting || !roles.length}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
            >
              {submitting ? 'Создание...' : 'Создать ссылку'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/50"
            >
              Закрыть
            </button>
          </div>
        </form>

        <div className="mt-6">
          <h4 className="text-sm font-semibold text-slate-200 mb-2">Созданные ссылки</h4>
          <InvitesList refreshKey={listKey} />
        </div>
      </div>
    </div>
  );
}
