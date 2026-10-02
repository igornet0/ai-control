import React, { useState } from 'react';
import {
  BuildingOffice2Icon,
  FlagIcon,
} from '@heroicons/react/24/outline';
import { strategyApiService } from '../../../../services/strategyApiService';
import GoalList from './GoalList';

/**
 * Displays (and optionally edits) the company-level strategy.
 *
 * Props:
 *   strategy   – CompanyStrategyRead | null
 *   canEdit    – boolean (executive/admin)
 *   onChanged  – callback after a mutation
 */
export default function CompanyStrategyCard({ strategy, canEdit, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: strategy?.title || '',
    description: strategy?.description || '',
  });
  const [saving, setSaving] = useState(false);

  // Sync form when strategy prop changes (parent re-fetched)
  React.useEffect(() => {
    setForm({
      title: strategy?.title || '',
      description: strategy?.description || '',
    });
  }, [strategy?.id, strategy?.updated]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await strategyApiService.updateCompanyStrategy({
        title: form.title,
        description: form.description || null,
      });
      setEditing(false);
      onChanged && onChanged();
    } catch {
      alert('Ошибка сохранения стратегии');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card animate-slideInLeft">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <BuildingOffice2Icon className="w-5 h-5 shrink-0" aria-hidden />
          Стратегия компании
        </h2>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            {strategy ? 'Редактировать' : 'Создать'}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Заголовок стратегии
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              placeholder="Например: Рост и устойчивое развитие 2026–2027"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-900 focus:outline-none focus:border-indigo-500"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Описание / Миссия
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={5}
              placeholder="Опишите ключевые цели и ценности компании..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-900 focus:outline-none focus:border-indigo-500 resize-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
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
          <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            {strategy.title}
          </h3>
          {strategy.description && (
            <p className="text-sm whitespace-pre-wrap mb-4" style={{ color: 'var(--color-text-muted)' }}>
              {strategy.description}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
          Стратегия компании ещё не настроена.
        </p>
      )}

      {strategy && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <FlagIcon className="w-4 h-4 shrink-0" aria-hidden />
            Цели компании
          </h3>
          <GoalList
            strategyType="company"
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
