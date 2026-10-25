import React, { useState, useEffect } from 'react';
import { employeeService, TEAM_ROLES as FALLBACK_TEAM_ROLES } from '../../../../services/employeeService';
import { formatApiError } from '../../../../utils/formatApiError';
import { teamRolesFromContext } from './employeePermissions';
import {
  EMPLOYEE_DOC_ACCEPT,
  EMPLOYEE_DOC_CATEGORIES,
  PlatformDocumentPicker,
} from './EmployeeDocumentsModal';

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
  const [attachments, setAttachments] = useState([]);
  const [linkedDocs, setLinkedDocs] = useState([]);
  const [docCategory, setDocCategory] = useState('contract');

  useEffect(() => {
    if (isOpen) {
      employeeService.getDepartments().then(setDepartments).catch(() => setDepartments([]));
      setForm(initialForm);
      setError('');
      setAttachments([]);
      setLinkedDocs([]);
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
      const created = await employeeService.createEmployee(payload);
      const employeeId = created?.id;
      if (employeeId && (attachments.length || linkedDocs.length)) {
        const failed = [];
        const groups = attachments.reduce((acc, a) => {
          (acc[a.category] ||= []).push(a.file);
          return acc;
        }, {});
        for (const [category, files] of Object.entries(groups)) {
          try {
            await employeeService.uploadEmployeeDocuments(employeeId, files, { category });
          } catch {
            failed.push(...files.map((f) => f.name));
          }
        }
        for (const d of linkedDocs) {
          try {
            await employeeService.linkEmployeeDocument(employeeId, { document_id: d.id, category: d.category });
          } catch {
            failed.push(d.title);
          }
        }
        if (failed.length) {
          onCreated?.();
          setError(`Сотрудник создан, но не удалось прикрепить: ${failed.join(', ')}`);
          return;
        }
      }
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
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-xl" style={{ background: 'var(--gradient-surface)', borderColor: 'var(--color-border-muted)' }}>
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
          <div className="rounded-xl border border-slate-700 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm text-slate-300">Документы сотрудника</label>
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
                className="rounded-lg bg-slate-800/80 border border-slate-600 px-2 py-1 text-white text-sm"
              >
                {EMPLOYEE_DOC_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <input
              type="file"
              multiple
              accept={EMPLOYEE_DOC_ACCEPT}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setAttachments((prev) => [...prev, ...files.map((file) => ({ file, category: docCategory }))]);
                e.target.value = '';
              }}
              className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-white"
            />
            <PlatformDocumentPicker
              disabled={submitting}
              onPick={(doc) =>
                setLinkedDocs((prev) =>
                  prev.some((d) => d.id === doc.id)
                    ? prev
                    : [...prev, { id: doc.id, title: doc.title || doc.number || `Документ #${doc.id}`, category: docCategory }],
                )
              }
            />
            {(attachments.length > 0 || linkedDocs.length > 0) && (
              <ul className="space-y-1 text-xs text-slate-300">
                {attachments.map((a, i) => (
                  <li key={`f${i}`} className="flex items-center justify-between gap-2">
                    <span className="truncate">📎 {a.file.name} · {EMPLOYEE_DOC_CATEGORIES.find((c) => c.value === a.category)?.label}</span>
                    <button type="button" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="text-red-400">×</button>
                  </li>
                ))}
                {linkedDocs.map((d) => (
                  <li key={`d${d.id}`} className="flex items-center justify-between gap-2">
                    <span className="truncate">🔗 {d.title} · {EMPLOYEE_DOC_CATEGORIES.find((c) => c.value === d.category)?.label}</span>
                    <button type="button" onClick={() => setLinkedDocs((p) => p.filter((x) => x.id !== d.id))} className="text-red-400">×</button>
                  </li>
                ))}
              </ul>
            )}
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
