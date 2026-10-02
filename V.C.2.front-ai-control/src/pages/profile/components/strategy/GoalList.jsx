import React, { useState } from 'react';
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { strategyApiService } from '../../../../services/strategyApiService';
import MilestonePlan from './MilestonePlan';

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Запланировано', color: 'bg-slate-500/20 text-slate-300' },
  { value: 'in_progress', label: 'В работе', color: 'bg-blue-500/20 text-blue-300' },
  { value: 'done', label: 'Выполнено', color: 'bg-green-500/20 text-green-300' },
];

function statusBadge(status) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${opt.color}`}>
      {opt.label}
    </span>
  );
}

const emptyForm = { title: '', description: '', due_date: '', status: 'planned' };

/**
 * Generic goal list for company or department strategy.
 *
 * Props:
 *  strategyType  – "company" | "department"
 *  strategyId    – numeric id of the strategy record
 *  initialGoals  – pre-loaded goal list
 *  canEdit       – boolean
 *  onChanged     – optional callback after mutation
 */
export default function GoalList({ strategyType, strategyId, initialGoals = [], canEdit, onChanged }) {
  const [goals, setGoals] = useState(initialGoals);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expandedGoalId, setExpandedGoalId] = useState(null);

  const reload = async () => {
    const data = await strategyApiService.getGoals(strategyType, strategyId);
    setGoals(data);
    onChanged && onChanged();
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (goal) => {
    setEditingId(goal.id);
    setForm({
      title: goal.title,
      description: goal.description || '',
      due_date: goal.due_date || '',
      status: goal.status,
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        due_date: form.due_date || null,
        status: form.status,
      };
      if (editingId) {
        await strategyApiService.updateGoal(editingId, payload);
      } else {
        await strategyApiService.createGoal(strategyType, strategyId, payload);
      }
      setShowForm(false);
      await reload();
    } catch {
      alert('Ошибка сохранения цели');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (goalId) => {
    if (!window.confirm('Удалить цель и все её этапы?')) return;
    try {
      await strategyApiService.deleteGoal(goalId);
      setGoals((g) => g.filter((x) => x.id !== goalId));
      onChanged && onChanged();
    } catch {
      alert('Ошибка удаления');
    }
  };

  return (
    <div className="space-y-3">
      {goals.length === 0 && (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
          Целей пока нет.{canEdit ? ' Добавьте первую!' : ''}
        </p>
      )}

      {goals.map((goal) => (
        <div key={goal.id} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {goal.title}
                </span>
                {statusBadge(goal.status)}
                {goal.due_date && (
                  <span className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                    <CalendarIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    {goal.due_date}
                  </span>
                )}
              </div>
              {goal.description && (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {goal.description}
                </p>
              )}
            </div>

            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => setExpandedGoalId((id) => (id === goal.id ? null : goal.id))}
                className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
                title="Этапы"
              >
                <span className="inline-flex items-center gap-1">
                  {expandedGoalId === goal.id ? (
                    <ChevronUpIcon className="w-3.5 h-3.5" aria-hidden />
                  ) : (
                    <ChevronDownIcon className="w-3.5 h-3.5" aria-hidden />
                  )}
                  Этапы ({(goal.milestones || []).length})
                </span>
              </button>
              {canEdit && (
                <>
                  <button
                    onClick={() => openEdit(goal)}
                    className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
                    style={{ color: 'var(--color-text-muted)' }}
                    title="Редактировать"
                  >
                    <PencilSquareIcon className="w-3.5 h-3.5" aria-hidden />
                  </button>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="text-xs px-2 py-1 rounded bg-red-900/40 hover:bg-red-800/60 text-red-300 transition-colors"
                    title="Удалить"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" aria-hidden />
                  </button>
                </>
              )}
            </div>
          </div>

          {expandedGoalId === goal.id && (
            <MilestonePlan
              goalId={goal.id}
              initialMilestones={goal.milestones || []}
              canEdit={canEdit}
              onChanged={reload}
            />
          )}
        </div>
      ))}

      {canEdit && !showForm && (
        <button
          onClick={openAdd}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-dashed border-indigo-500 text-indigo-400 hover:bg-indigo-900/20 transition-colors w-full justify-center"
        >
          + Добавить цель
        </button>
      )}

      {showForm && (
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-slate-600 bg-slate-800 p-4 space-y-3 animate-fadeIn"
        >
          <h4 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
            {editingId ? 'Редактировать цель' : 'Новая цель'}
          </h4>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Название цели"
            required
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-900 focus:outline-none focus:border-indigo-500"
            style={{ color: 'var(--color-text-primary)' }}
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Описание (опционально)"
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-900 focus:outline-none focus:border-indigo-500 resize-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
          <div className="flex gap-3 flex-wrap">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Дедлайн
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-600 bg-slate-900 focus:outline-none focus:border-indigo-500"
                style={{ color: 'var(--color-text-primary)' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Статус
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-600 bg-slate-900 focus:outline-none focus:border-indigo-500"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-sm rounded-lg bg-slate-700 hover:bg-slate-600"
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
