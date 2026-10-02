import React, { useEffect, useState } from 'react';
import {
  BuildingLibraryIcon,
  BuildingOffice2Icon,
  ChevronDownIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import styles from './Strategy.module.css';
import { ProgressBar, StatusBadge, AIInsight } from './StrategyPrimitives';
import { goalsAggregate, goalProgress, statusLabel, splitStrategyDescription, deptStatus } from './strategyUtils';
import GoalActionsPanel from './GoalActionsPanel';

function usePersistedOpen(storageKey, defaultOpen = true) {
  const [open, setOpen] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === '0') return false;
      if (raw === '1') return true;
    } catch {
      /* ignore */
    }
    return defaultOpen;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [storageKey, open]);

  return [open, setOpen];
}
export function StrategyHeader({ active, canEdit, onAskAi, onAddGoal }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <h1 className={styles.title}>Стратегия</h1>
        <p className={styles.subtitle}>
          Управляйте целями компании, направлениями работы и действиями отделов с помощью AI.
        </p>
        <div className={styles.statusRow}>
          <StatusBadge tone={active ? 'ok' : 'warn'}>
            {active ? 'Стратегия активна' : 'Стратегия не настроена'}
          </StatusBadge>
        </div>
      </div>
      <div className={styles.headerActions}>
        <button
          type="button"
          className={styles.btnAi}
          onClick={onAskAi}
          title="AI-ассистент стратегии"
        >
          <SparklesIcon className={styles.ico} aria-hidden />
          Спросить AI
        </button>
        {canEdit && (
          <button type="button" className={styles.btn} onClick={onAddGoal}>
            + Добавить цель
          </button>
        )}
      </div>
    </header>
  );
}

export function StrategyOverview({ companyAgg, deptCount, insight, onAskAi }) {
  return (
    <section className={`${styles.glass} ${styles.cardPad}`}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Обзор стратегии компании</h2>
      </div>
      <div className={styles.overviewGrid}>
        <div>
          <ProgressBar
            value={companyAgg.progress}
            label="Общий прогресс"
            right={`${companyAgg.progress}%`}
          />
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{companyAgg.total}</span>
              <span className={styles.statLabel}>Цели</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{companyAgg.actions}</span>
              <span className={styles.statLabel}>Действия</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{deptCount}</span>
              <span className={styles.statLabel}>Отделы</span>
            </div>
          </div>
        </div>
        <AIInsight insight={insight} onAskAi={onAskAi} />
      </div>
    </section>
  );
}

export function GoalCard({
  goal,
  index,
  canEdit,
  onEdit,
  onExpand,
  expanded = false,
  onChanged,
  showActionsPanel = false,
}) {
  const pct = goalProgress(goal);
  const actions = goal.milestones || [];
  return (
    <div className={styles.goalCard}>
      <div className={styles.goalTop}>
        <div>
          <div className={styles.goalIndex}>{String(index + 1).padStart(2, '0')}</div>
          <h4 className={styles.goalTitle}>{goal.title}</h4>
          <div className={styles.goalMeta}>
            <StatusBadge tone={goal.status === 'done' ? 'ok' : goal.status === 'in_progress' ? 'warn' : 'muted'}>
              {statusLabel(goal.status)}
            </StatusBadge>
            {goal.due_date && <span className={styles.muted}>до {goal.due_date}</span>}
            <span className={styles.muted}>{actions.length} действий</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {onExpand && (
            <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onExpand}>
              {expanded ? 'Скрыть' : 'Действия'}
            </button>
          )}
          {canEdit && onEdit && (
            <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onEdit}>
              Изменить
            </button>
          )}
        </div>
      </div>
      <ProgressBar value={pct} label="Прогресс" right={`${pct}%`} />
      {showActionsPanel && expanded && (
        <GoalActionsPanel goal={goal} canEdit={canEdit} onChanged={onChanged} />
      )}
    </div>
  );
}

export function CompanyStrategyBlock({
  strategy,
  canEdit,
  editing,
  form,
  setForm,
  saving,
  onEdit,
  onCancel,
  onSave,
  onImproveAi,
  onAddGoal,
  onEditGoal,
  onChanged,
}) {
  const goals = strategy?.goals || [];
  const agg = goalsAggregate(goals);
  const { mission, priorities } = splitStrategyDescription(strategy?.description);
  const [expandedGoalId, setExpandedGoalId] = useState(null);
  const [open, setOpen] = usePersistedOpen('strategy_company_block_open', true);

  if (editing) {
    return (
      <section className={`${styles.glass} ${styles.cardPad}`}>
        <h3 className={styles.companyTitle}>
          <BuildingOffice2Icon className={styles.ico} aria-hidden />
          Стратегия компании
        </h3>
        <form className={styles.formStack} style={{ marginTop: '0.85rem' }} onSubmit={onSave}>
          <div>
            <label className={styles.fieldLabel}>Цель компании</label>
            <input
              className={styles.input}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              placeholder="Создать ведущую BI-платформу..."
            />
          </div>
          <div>
            <label className={styles.fieldLabel}>Миссия / приоритеты (по строкам)</label>
            <textarea
              className={styles.textarea}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={'Описание миссии\n• Рост выручки\n• Развитие продукта'}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className={styles.btnAi} disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button type="button" className={styles.btn} onClick={onCancel}>
              Отмена
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className={`${styles.glass} ${styles.cardPad} ${open ? '' : styles.panelCollapsed}`}>
      <div className={styles.companyHead}>
        <button
          type="button"
          className={styles.collapseHeadBtn}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <h3 className={styles.companyTitle}>
            <BuildingOffice2Icon className={styles.ico} aria-hidden />
            Стратегия компании
            {!open && (
              <span className={styles.collapseMeta}>
                {agg.progress}% · {agg.total} цел.
              </span>
            )}
          </h3>
          <span className={`${styles.collapseChevron} ${open ? styles.collapseChevronOpen : ''}`}>
            <ChevronDownIcon className={styles.ico} aria-hidden />
          </span>
        </button>
        {open && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {canEdit && (
              <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onEdit}>
                Изменить
              </button>
            )}
            <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnAi}`} onClick={onImproveAi}>
              <SparklesIcon className={styles.icoSm} aria-hidden />
              Улучшить с AI
            </button>
          </div>
        )}
      </div>

      {open && (
        <>
      <p className={styles.missionLabel}>Цель компании</p>
      <p className={styles.missionText}>{strategy?.title}</p>
      {mission && (
        <>
          <p className={styles.missionLabel}>Миссия</p>
          <p className={styles.muted} style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>
            {mission}
          </p>
        </>
      )}
      {!mission && strategy?.description && !priorities.length && (
        <p className={styles.muted} style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
          {strategy.description}
        </p>
      )}

      <ProgressBar
        value={agg.progress}
        label="Стратегия выполнена"
        right={`${agg.progress}%`}
      />

      <div className={styles.divider} />

      {priorities.length > 0 && (
        <>
          <p className={styles.missionLabel}>Стратегические приоритеты</p>
          <ul className={styles.priorityList}>
            {priorities.map((p) => (
              <li key={p} className={styles.priorityItem}>
                <span className={styles.priorityBullet} aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className={styles.divider} />
        </>
      )}

      <p className={styles.missionLabel}>Показатели</p>
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiName}>Цели выполнены</div>
          <div className={styles.kpiValue}>{agg.done}/{agg.total}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiName}>Действия</div>
          <div className={styles.kpiValue}>{agg.actionsDone}/{agg.actions}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiName}>Просрочено</div>
          <div className={styles.kpiValue}>{agg.overdue}</div>
        </div>
      </div>

      <div className={styles.divider} />
      <div className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>Стратегические цели</h3>
        {canEdit && (
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onAddGoal}>
            + Цель
          </button>
        )}
      </div>
      <div className={styles.goalsStack}>
        {goals.length === 0 && (
          <p className={styles.muted}>Целей пока нет — добавьте вручную или через AI.</p>
        )}
        {goals.map((g, i) => (
          <GoalCard
            key={g.id}
            goal={g}
            index={i}
            canEdit={canEdit}
            onEdit={() => onEditGoal?.(g)}
            expanded={expandedGoalId === g.id}
            showActionsPanel
            onChanged={onChanged}
            onExpand={() =>
              setExpandedGoalId((id) => (id === g.id ? null : g.id))
            }
          />
        ))}
      </div>
        </>
      )}
    </section>
  );
}

export function StrategyMap({ company, departments, deptStrategies }) {
  const topGoal = (company?.goals || [])[0];
  const branches = departments.slice(0, 4).map((d) => {
    const ds = deptStrategies[d.id];
    const g = (ds?.goals || [])[0];
    return {
      id: d.id,
      name: d.name,
      goal: g?.title || ds?.scope || ds?.role_description || 'Стратегия не задана',
    };
  });

  return (
    <section className={`${styles.glass} ${styles.cardPad}`}>
      <div className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>Как отделы влияют на стратегию</h3>
      </div>
      <div className={styles.mapChain}>
        <div className={styles.mapNode}>
          <div className={styles.mapNodeTitle}>Цель компании</div>
          <div className={styles.mapNodeBody}>
            {topGoal?.title || company?.title || 'Задайте главную цель компании'}
          </div>
        </div>
        <div className={styles.mapArrow}>↓</div>
        <div className={styles.mapBranches}>
          {branches.map((b) => (
            <div key={b.id} className={styles.mapNode}>
              <div className={styles.mapNodeTitle}>{b.name}</div>
              <div className={styles.mapNodeBody}>{b.goal}</div>
            </div>
          ))}
          {!branches.length && (
            <p className={styles.muted}>Отделы появятся после настройки оргструктуры.</p>
          )}
        </div>
        <div className={styles.mapArrow}>↓</div>
        <div className={styles.mapNode}>
          <div className={styles.mapNodeTitle}>Действия → Задачи → KPI</div>
          <div className={styles.mapNodeBody}>
            Инициативы отделов связывают цели с задачами сотрудников и измеримым результатом.
          </div>
        </div>
      </div>
    </section>
  );
}

export function DepartmentStrategyCardCompact({
  department,
  strategy,
  onOpen,
  onAskAi,
}) {
  const goals = strategy?.goals || [];
  const agg = goalsAggregate(goals);
  const status = deptStatus(strategy, goals);

  return (
    <article
      className={styles.deptCard}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className={styles.deptCardHead}>
        <div>
          <h3 className={styles.deptName}>
            <BuildingLibraryIcon className={styles.ico} aria-hidden />
            {department.name}
          </h3>
          {department.manager_name && (
            <p className={styles.deptManager}>{department.manager_name}</p>
          )}
        </div>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>

      <ProgressBar
        value={agg.progress}
        label={`Цели ${agg.done} / ${agg.total}`}
        right={`${agg.progress}%`}
      />

      <p className={styles.missionLabel}>Основная область</p>
      <p className={styles.deptScope}>
        {strategy?.scope || strategy?.role_description || strategy?.motivation || 'Область ещё не описана'}
      </p>

      <div className={styles.kpiRow} style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiName}>Действия</div>
          <div className={styles.kpiValue} style={{ fontSize: '0.95rem' }}>
            {agg.actionsDone}/{agg.actions}
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiName}>Просрочено</div>
          <div className={styles.kpiValue} style={{ fontSize: '0.95rem' }}>{agg.overdue}</div>
        </div>
      </div>

      <div className={styles.deptActions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSm}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.();
          }}
        >
          Открыть стратегию
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSm} ${styles.btnAi}`}
          onClick={(e) => {
            e.stopPropagation();
            onAskAi?.();
          }}
        >
          <SparklesIcon className={styles.icoSm} aria-hidden />
          AI
        </button>
      </div>
    </article>
  );
}
