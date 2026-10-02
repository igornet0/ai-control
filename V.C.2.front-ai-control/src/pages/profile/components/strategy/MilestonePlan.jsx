import React, { useState } from 'react';
import {
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { strategyApiService } from '../../../../services/strategyApiService';

const STATUS_COLOR = {
  planned: 'bg-slate-500/20 text-slate-300',
  in_progress: 'bg-blue-500/20 text-blue-300',
  done: 'bg-green-500/20 text-green-300',
};

/**
 * Milestone list under a single goal.
 * canEdit – whether current user can add/edit milestones.
 */
export default function MilestonePlan({ goalId, initialMilestones = [], canEdit, onChanged }) {
  const [milestones, setMilestones] = useState(initialMilestones);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', due_date: '', done: false });
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    const data = await strategyApiService.getMilestones(goalId);
    setMilestones(data);
    onChanged && onChanged();
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ title: '', due_date: '', done: false });
    setAdding(true);
  };

  const openEdit = (m) => {
    setEditingId(m.id);
    setForm({ title: m.title, due_date: m.due_date || '', done: m.done });
    setAdding(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { title: form.title, due_date: form.due_date || null, done: form.done };
      if (editingId) {
        await strategyApiService.updateMilestone(editingId, payload);
      } else {
        await strategyApiService.createMilestone(goalId, payload);
      }
      setAdding(false);
      await reload();
    } catch (err) {
      alert('Ошибка сохранения этапа');
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (m) => {
    if (!canEdit) return;
    try {
      await strategyApiService.updateMilestone(m.id, {
        title: m.title,
        due_date: m.due_date || null,
        done: !m.done,
      });
      await reload();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить этап?')) return;
    try {
      await strategyApiService.deleteMilestone(id);
      await reload();
    } catch {
      alert('Ошибка удаления');
    }
  };

  return (
    <div className="mt-3 pl-4 border-l-2 border-slate-600">
      <ul className="space-y-2">
        {milestones.map((m) => (
          <li key={m.id} className="flex items-start gap-3 group">
            <input
              type="checkbox"
              checked={m.done}
              onChange={() => toggleDone(m)}
              disabled={!canEdit}
              className="mt-1 cursor-pointer accent-indigo-500"
            />
            <div className="flex-1 min-w-0">
              <span
                className={`text-sm ${m.done ? 'line-through opacity-50' : ''}`}
                style={{ color: 'var(--color-text-primary)' }}
              >
                {m.title}
              </span>
              {m.due_date && (
                <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  до {m.due_date}
                </span>
              )}
            </div>
            {canEdit && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(m)}
                  className="text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <PencilSquareIcon className="w-3.5 h-3.5" aria-hidden />
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="text-xs px-2 py-0.5 rounded bg-red-900/40 hover:bg-red-800/60 text-red-300"
                  title="Удалить"
                >
                  <XMarkIcon className="w-3.5 h-3.5" aria-hidden />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {canEdit && !adding && (
        <button
          onClick={openAdd}
          className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          + Добавить этап
        </button>
      )}

      {adding && (
        <form onSubmit={handleSave} className="mt-3 space-y-2">
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Название этапа"
            required
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-600 bg-slate-800 focus:outline-none focus:border-indigo-500"
            style={{ color: 'var(--color-text-primary)' }}
          />
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-600 bg-slate-800 focus:outline-none focus:border-indigo-500"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <label className="flex items-center gap-1 text-sm cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
              <input
                type="checkbox"
                checked={form.done}
                onChange={(e) => setForm((f) => ({ ...f, done: e.target.checked }))}
                className="accent-indigo-500"
              />
              Выполнено
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-3 py-1 text-sm rounded-lg bg-slate-700 hover:bg-slate-600"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
