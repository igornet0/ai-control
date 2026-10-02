import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BoltIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import styles from './Strategy.module.css';
import { ProgressBar, StatusBadge, GoalEditorModal } from './StrategyPrimitives';
import { GoalCard } from './StrategyBlocks';
import GoalActionsPanel from './GoalActionsPanel';
import {
  goalsAggregate,
  deptStatus,
  DEPT_STATUS_OPTIONS,
} from './strategyUtils';
import { strategyApiService } from '../../../../services/strategyApiService';

function toDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function resolveDeptStatusValue(strategy, goals) {
  const stored = String(strategy?.status || '').toLowerCase();
  if (stored === 'attention' || stored === 'at_risk') return 'attention';
  if (stored === 'draft' || stored === 'active') return stored;
  const computed = deptStatus(strategy, goals);
  if (computed.key === 'at_risk') return 'attention';
  if (computed.key === 'draft') return 'draft';
  return 'active';
}
function ActionCard({ action, goalTitle }) {
  const pct = action.done ? 100 : action.due_date ? 45 : 20;
  return (
    <div className={styles.actionCard}>
      <h4 className={styles.actionTitle}>
        <BoltIcon className={styles.ico} aria-hidden />
        {action.title}
      </h4>
      <p className={styles.actionMeta}>
        Цель: {goalTitle || '—'}
        {action.due_date ? ` · Срок: ${action.due_date}` : ''}
      </p>
      <ProgressBar value={pct} label="Прогресс" right={`${pct}%`} />
    </div>
  );
}

/**
 * Side panel: department strategy detail (Goal → Action).
 */
export default function DepartmentStrategyPanel({
  department,
  strategy,
  canEdit,
  onClose,
  onChanged,
  onAskAi,
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    motivation: strategy?.motivation || '',
    role_description: strategy?.role_description || '',
    scope: strategy?.scope || '',
    status: resolveDeptStatusValue(strategy, strategy?.goals || []),
  });
  const [goalForm, setGoalForm] = useState(null);
  const [expandedGoalId, setExpandedGoalId] = useState(null);

  React.useEffect(() => {
    setForm({
      motivation: strategy?.motivation || '',
      role_description: strategy?.role_description || '',
      scope: strategy?.scope || '',
      status: resolveDeptStatusValue(strategy, strategy?.goals || []),
    });
    setEditing(false);
  }, [strategy?.id, strategy?.updated, strategy?.status, department?.id]);

  const goals = strategy?.goals || [];
  const agg = goalsAggregate(goals);
  const status = deptStatus(strategy, goals);
  const actions = useMemo(
    () =>
      goals.flatMap((g) =>
        (g.milestones || []).map((m) => ({ ...m, goalTitle: g.title, goalId: g.id }))
      ),
    [goals]
  );

  const saveStrategy = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await strategyApiService.updateDeptStrategy(department.id, {
        motivation: form.motivation || null,
        role_description: form.role_description || null,
        scope: form.scope || null,
        status: form.status || 'active',
      });
      setEditing(false);
      onChanged?.();
    } catch {
      alert('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const saveGoal = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let strategyId = strategy?.id;
      if (!strategyId) {
        const ds = await strategyApiService.updateDeptStrategy(department.id, {
          motivation: form.motivation || null,
          role_description: form.role_description || null,
          scope: form.scope || null,
          status: form.status || 'active',
        });
        strategyId = ds?.id;
      }
      if (!strategyId) throw new Error('Стратегия отдела не найдена');

      const payload = {
        title: String(goalForm.title || '').trim(),
        description: goalForm.description || null,
        due_date: goalForm.due_date || null,
        status: goalForm.status || 'planned',
      };
      if (!payload.title) throw new Error('Укажите название цели');

      if (goalForm.id) {
        await strategyApiService.updateGoal(goalForm.id, payload);
      } else {
        await strategyApiService.createGoal('department', strategyId, payload);
      }
      setGoalForm(null);
      onChanged?.();
    } catch (err) {
      alert(err?.response?.data?.detail || err?.message || 'Ошибка сохранения цели');
    } finally {
      setSaving(false);
    }
  };

  const deleteGoal = async () => {
    if (!goalForm?.id) return;
    if (!window.confirm('Удалить эту цель и связанные действия?')) return;
    setSaving(true);
    try {
      await strategyApiService.deleteGoal(goalForm.id);
      setGoalForm(null);
      onChanged?.();
    } catch (err) {
      alert(err?.response?.data?.detail || err?.message || 'Ошибка удаления цели');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button type="button" className={styles.overlay} aria-label="Закрыть" onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-label={`Стратегия отдела ${department.name}`}>
        <div className={styles.drawerHead}>
          <div>
            <h2 className={styles.deptName}>Стратегия отдела {department.name}</h2>
            <p className={styles.deptManager}>
              {strategy?.role_description || strategy?.scope || 'Backend / Frontend / Operations'}
            </p>
            <div style={{ marginTop: '0.45rem' }}>
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnAi}`} onClick={onAskAi}>
              <SparklesIcon className={styles.icoSm} aria-hidden />
              AI-анализ
            </button>
            {canEdit && !editing && (
              <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => setEditing(true)}>
                Изменить
              </button>
            )}
            <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onClose} aria-label="Закрыть">
              <XMarkIcon className={styles.ico} aria-hidden />
            </button>
          </div>
        </div>

        <div className={styles.drawerBody}>
          {editing ? (
            <form className={styles.formStack} onSubmit={saveStrategy}>
              <div>
                <label className={styles.fieldLabel}>Статус</label>
                <select
                  className={styles.select}
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {DEPT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {[
                ['motivation', 'Мотивация'],
                ['role_description', 'Роль в компании'],
                ['scope', 'Область ответственности'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className={styles.fieldLabel}>{label}</label>
                  <textarea
                    className={styles.textarea}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button type="submit" className={styles.btnAi} disabled={saving}>
                  {saving ? '...' : 'Сохранить'}
                </button>
                <button type="button" className={styles.btn} onClick={() => setEditing(false)}>
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <>
              <div>
                <p className={styles.missionLabel}>Область ответственности</p>
                <p className={styles.missionText} style={{ fontSize: '0.875rem' }}>
                  {strategy?.scope || strategy?.role_description || 'Ещё не описана'}
                </p>
                {strategy?.motivation && (
                  <>
                    <p className={styles.missionLabel}>Мотивация</p>
                    <p className={styles.muted} style={{ whiteSpace: 'pre-wrap' }}>{strategy.motivation}</p>
                  </>
                )}
                <ProgressBar value={agg.progress} label="Прогресс целей" right={`${agg.progress}%`} />
              </div>

              <div>
                <div className={styles.sectionHead}>
                  <h3 className={styles.sectionTitle}>Цели</h3>
                  {canEdit && (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSm}`}
                      onClick={() =>
                        setGoalForm({ title: '', description: '', due_date: '', status: 'planned' })
                      }
                    >
                      + Цель
                    </button>
                  )}
                </div>
                <div className={styles.goalsStack}>
                  {goals.map((g, i) => (
                    <div key={g.id}>
                      <GoalCard
                        goal={g}
                        index={i}
                        canEdit={canEdit}
                        expanded={expandedGoalId === g.id}
                        showActionsPanel
                        onChanged={onChanged}
                        onEdit={() =>
                          setGoalForm({
                            id: g.id,
                            title: g.title || '',
                            description: g.description || '',
                            due_date: toDateInput(g.due_date),
                            status: g.status || 'planned',
                          })
                        }
                        onExpand={() =>
                          setExpandedGoalId((id) => (id === g.id ? null : g.id))
                        }
                      />
                    </div>
                  ))}
                  {!goals.length && <p className={styles.muted}>Целей пока нет.</p>}
                </div>
              </div>

              <div>
                <div className={styles.sectionHead}>
                  <h3 className={styles.sectionTitle}>Стратегические действия</h3>
                </div>
                <div className={styles.goalsStack}>
                  {actions.map((a) => (
                    <ActionCard key={a.id} action={a} goalTitle={a.goalTitle} />
                  ))}
                  {!actions.length && (
                    <p className={styles.muted}>
                      Действий нет. Цель → Действие → Задачи — добавьте инициативы к целям.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      {goalForm && typeof document !== 'undefined' && createPortal(
        <GoalEditorModal
          goal={goalForm}
          saving={saving}
          title={goalForm.id ? 'Изменить цель отдела' : 'Новая цель отдела'}
          onChange={setGoalForm}
          onSave={saveGoal}
          onCancel={() => setGoalForm(null)}
          onDelete={goalForm.id ? deleteGoal : undefined}
        />,
        document.body
      )}
    </>
  );
}
