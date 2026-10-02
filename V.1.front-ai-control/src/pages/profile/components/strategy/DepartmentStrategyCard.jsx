import React, { useState } from 'react';
import {
  BuildingLibraryIcon,
  FlagIcon,
} from '@heroicons/react/24/outline';
import { strategyApiService } from '../../../../services/strategyApiService';
import GoalList from './GoalList';

/**
 * Displays (and optionally edits) a single department strategy.
 *
 * Props:
 *   departmentId   – number
 *   departmentName – string
 *   strategy       – DepartmentStrategyRead | null
 *   canEdit        – boolean (manager of this dept or executive)
 *   onChanged      – callback after mutation
 */
export default function DepartmentStrategyCard({
  departmentId,
  departmentName,
  strategy,
  canEdit,
  onChanged,
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    motivation: strategy?.motivation || '',
    role_description: strategy?.role_description || '',
    scope: strategy?.scope || '',
  });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setForm({
      motivation: strategy?.motivation || '',
      role_description: strategy?.role_description || '',
      scope: strategy?.scope || '',
    });
  }, [strategy?.id, strategy?.updated]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await strategyApiService.updateDeptStrategy(departmentId, {
        motivation: form.motivation || null,
        role_description: form.role_description || null,
        scope: form.scope || null,
      });
      setEditing(false);
      onChanged && onChanged();
    } catch {
      alert('Ошибка сохранения стратегии отдела');
    } finally {
      setSaving(false);
    }
  };

  const Section = ({ label, value }) =>
    value ? (
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </p>
        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-primary)' }}>
          {value}
        </p>
      </div>
    ) : null;

  return (
    <div className="card animate-slideInLeft">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <BuildingLibraryIcon className="w-5 h-5 shrink-0" aria-hidden />
          {departmentName || `Отдел #${departmentId}`}
        </h2>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            {strategy ? 'Редактировать' : 'Настроить'}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-3">
          {[
            { key: 'motivation', label: 'Мотивация отдела', placeholder: 'Ради чего работает отдел? Что движет командой?' },
            { key: 'role_description', label: 'Роль в компании', placeholder: 'Какую роль этот отдел выполняет в общей стратегии?' },
            { key: 'scope', label: 'Область действия', placeholder: 'Зоны ответственности, ключевые направления работы...' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                {label}
              </label>
              <textarea
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-900 focus:outline-none focus:border-indigo-500 resize-none"
                style={{ color: 'var(--color-text-primary)' }}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Отмена
            </button>
          </div>
        </form>
      ) : strategy ? (
        <div>
          <Section label="Мотивация" value={strategy.motivation} />
          <Section label="Роль в компании" value={strategy.role_description} />
          <Section label="Область действия" value={strategy.scope} />
        </div>
      ) : (
        <p className="text-sm py-2" style={{ color: 'var(--color-text-muted)' }}>
          Стратегия отдела ещё не настроена.
          {canEdit ? ' Нажмите «Настроить», чтобы заполнить.' : ''}
        </p>
      )}

      {strategy && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <FlagIcon className="w-4 h-4 shrink-0" aria-hidden />
            Цели отдела
          </h3>
          <GoalList
            strategyType="department"
            strategyId={strategy.id}
            initialGoals={strategy.goals || []}
            canEdit={canEdit}
            onChanged={onChanged}
          />
        </div>
      )}
    </div>
  );
}
