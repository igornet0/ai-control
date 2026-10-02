import React, { useEffect, useState } from 'react';
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import styles from './Strategy.module.css';

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

export function ProgressBar({ value = 0, label, right }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={styles.progressWrap}>
      {(label || right != null) && (
        <div className={styles.progressMeta}>
          <span>{label}</span>
          <span>{right != null ? right : `${pct}%`}</span>
        </div>
      )}
      <div className={styles.progressTrack} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function StatusBadge({ tone = 'muted', children }) {
  const cls =
    tone === 'ok' ? styles.badgeOk : tone === 'warn' ? styles.badgeWarn : styles.badgeMuted;
  return (
    <span className={`${styles.badge} ${cls}`}>
      <span className={styles.dot} aria-hidden />
      {children}
    </span>
  );
}

export function StrategyEmptyState({ onCreateAi, onCreateManual, canEdit }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon} aria-hidden>
        <SparklesIcon />
      </div>
      <h2 className={styles.emptyTitle}>Создайте стратегию компании</h2>
      <p className={styles.emptyText}>
        Опишите, чего компания хочет достичь, а AI поможет превратить это в цели, KPI и действия отделов.
      </p>
      <div className={styles.emptyActions}>
        {canEdit && (
          <button type="button" className={styles.btnAi} onClick={onCreateAi}>
            <SparklesIcon className={styles.ico} aria-hidden />
            Создать стратегию с AI
          </button>
        )}
        {canEdit && <span className={styles.emptyOr}>или</span>}
        {canEdit ? (
          <button type="button" className={styles.btn} onClick={onCreateManual}>
            Создать вручную
          </button>
        ) : (
          <p className={styles.muted}>Ожидаем настройку стратегии руководством.</p>
        )}
      </div>
    </div>
  );
}

export function AICommandBar({ value, onChange, onSubmit, placeholder, inputId }) {
  return (
    <form
      className={styles.commandBar}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <SparklesIcon className={styles.icoLg} aria-hidden />
      <input
        id={inputId || 'strategy-ai-command'}
        className={styles.commandInput}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder || 'Спросите AI о стратегии...'}
        aria-label="Спросить AI о стратегии"
      />
      <button
        type="submit"
        className={`${styles.btn} ${styles.btnSm}`}
        title="Отправить"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderColor: 'transparent', color: '#fff' }}
      >
        <ArrowRightIcon className={styles.icoSm} aria-hidden />
      </button>
    </form>
  );
}

export function AIInsight({ insight, onAskAi }) {
  if (!insight) return null;
  return (
    <div className={styles.insightBox}>
      <div className={styles.insightLabel}>
        <SparklesIcon className={styles.icoSm} aria-hidden />
        AI-инсайт
      </div>
      <p className={styles.insightText}>
        <strong>{insight.title}.</strong> {insight.body}
      </p>
      {onAskAi && (
        <div style={{ marginTop: '0.75rem' }}>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onAskAi}>
            Разобрать с AI
          </button>
        </div>
      )}
    </div>
  );
}

function AnalysisToneIcon({ severity }) {
  if (severity === 'warn') {
    return <ExclamationTriangleIcon className={styles.icoSm} aria-hidden />;
  }
  if (severity === 'ok') {
    return <CheckIcon className={styles.icoSm} aria-hidden />;
  }
  return <SparklesIcon className={styles.icoSm} aria-hidden />;
}

export function AIAnalysisPanel({ insights = [], onOpenDept, onOpenGoal }) {
  const [open, setOpen] = usePersistedOpen('strategy_ai_analysis_open', true);
  if (!insights.length) return null;

  const warnCount = insights.filter((i) => i.severity === 'warn').length;

  return (
    <div className={`${styles.glass} ${styles.cardPad} ${open ? '' : styles.panelCollapsed}`}>
      <button
        type="button"
        className={styles.collapseHead}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <h3 className={styles.sectionTitle}>
          <SparklesIcon className={styles.icoSm} aria-hidden />
          AI-анализ
          {warnCount > 0 && <span className={styles.collapseBadge}>{warnCount}</span>}
        </h3>
        <span className={`${styles.collapseChevron} ${open ? styles.collapseChevronOpen : ''}`}>
          <ChevronDownIcon className={styles.ico} aria-hidden />
        </span>
      </button>

      {open && (
      <div className={styles.analysisList}>
        {insights.map((item, idx) => (
          <div
            key={`${item.title}-${idx}`}
            className={`${styles.analysisItem} ${
              item.severity === 'warn'
                ? styles.analysisItemWarn
                : item.severity === 'ok'
                  ? styles.analysisItemOk
                  : ''
            }`}
          >
            <h4 className={styles.analysisTitle}>
              <AnalysisToneIcon severity={item.severity} />
              {item.title}
            </h4>
            <p className={styles.analysisBody}>{item.body}</p>

            {Array.isArray(item.goals) && item.goals.length > 0 && (
              <ul className={styles.analysisGoals}>
                {item.goals.map((g) => (
                  <li key={g.id || g.title} className={styles.analysisGoalRow}>
                    <div className={styles.analysisGoalText}>
                      <span className={styles.analysisGoalTitle}>{g.title}</span>
                      {g.due_date && (
                        <span className={styles.analysisGoalMeta}>до {g.due_date}</span>
                      )}
                    </div>
                    {item.action === 'review_overdue' && onOpenGoal && g.id && (
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSm}`}
                        onClick={() => onOpenGoal(g)}
                      >
                        Изменить
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {Array.isArray(item.departments) && item.departments.length > 0 && (
              <div className={styles.analysisDeptBtns}>
                {item.departments.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`${styles.btn} ${styles.btnSm}`}
                    onClick={() => onOpenDept?.(d.id)}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}

            {item.departmentId && onOpenDept && !(item.departments || []).length && (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSm}`}
                style={{ marginTop: '0.5rem' }}
                onClick={() => onOpenDept(item.departmentId)}
              >
                Открыть отдел
              </button>
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

export function ProposalCard({ proposal, applying, onApply, onCancel }) {
  if (!proposal) return null;
  const items =
    proposal.goals?.map((g) => (typeof g === 'string' ? g : g.title)) ||
    proposal.items?.map((item) => (typeof item === 'string' ? item : item.name || item.title)) ||
    (proposal.title && proposal.type !== 'add_goals' ? [proposal.title] : []);

  const heading =
    proposal.type === 'add_goals'
      ? proposal.strategyType === 'department' || proposal.departmentId
        ? 'Предложение AI — добавить цели отдела'
        : 'Предложение AI — добавить цели'
      : proposal.type === 'department_strategy'
        ? 'Предложение AI — стратегия отдела'
      : proposal.type === 'kpi_suggestions'
        ? 'Предложение AI — KPI (информационно)'
        : proposal.type === 'action_plan'
          ? 'Предложение AI — план действий'
          : 'Предложение AI — подтвердите перед записью';

  const canApply = ['company_strategy', 'department_strategy', 'add_goals'].includes(proposal.type);

  return (
    <div className={styles.proposal}>
      <p className={styles.proposalTitle}>{heading}</p>
      {proposal.description && proposal.type !== 'add_goals' && (
        <p className={styles.analysisBody} style={{ marginBottom: '0.5rem', whiteSpace: 'pre-wrap' }}>
          {proposal.description}
        </p>
      )}
      {items.length > 0 && (
        <ol className={styles.proposalList}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      )}
      <div className={styles.proposalActions}>
        {canApply && onApply && (
          <button type="button" className={styles.btnAi} disabled={applying} onClick={onApply}>
            {applying ? 'Применение...' : 'Применить'}
          </button>
        )}
        <button type="button" className={styles.btn} disabled={applying} onClick={onCancel}>
          {canApply ? 'Отмена' : 'Закрыть'}
        </button>
      </div>
    </div>
  );
}

/** Modal form to create / edit a company (or department) goal. */
export function GoalEditorModal({
  goal,
  saving = false,
  title,
  onChange,
  onSave,
  onCancel,
  onDelete,
}) {
  if (!goal) return null;

  return (
    <div
      className={styles.modalOverlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel?.();
      }}
    >
      <div
        className={styles.goalModal}
        role="dialog"
        aria-modal="true"
        aria-label={title || (goal.id ? 'Изменить цель' : 'Новая цель')}
      >
        <form className={styles.formStack} onSubmit={onSave}>
          <div className={styles.drawerHead} style={{ padding: 0, border: 'none' }}>
            <p className={styles.sectionTitle} style={{ margin: 0 }}>
              {title || (goal.id ? 'Изменить цель' : 'Новая цель')}
            </p>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm}`}
              onClick={onCancel}
              disabled={saving}
              aria-label="Закрыть"
            >
              <XMarkIcon className={styles.ico} aria-hidden />
            </button>
          </div>
          <div>
            <label className={styles.fieldLabel}>Название</label>
            <input
              className={styles.input}
              required
              autoFocus
              placeholder="Например: Увеличить активных клиентов на 20%"
              value={goal.title}
              onChange={(e) => onChange?.({ ...goal, title: e.target.value })}
            />
          </div>
          <div>
            <label className={styles.fieldLabel}>Описание</label>
            <textarea
              className={styles.textarea}
              placeholder="Кратко: зачем эта цель и как измерить успех"
              value={goal.description || ''}
              onChange={(e) => onChange?.({ ...goal, description: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px' }}>
              <label className={styles.fieldLabel}>Дедлайн</label>
              <input
                className={styles.input}
                type="date"
                value={goal.due_date || ''}
                onChange={(e) => onChange?.({ ...goal, due_date: e.target.value })}
              />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label className={styles.fieldLabel}>Статус</label>
              <select
                className={styles.select}
                value={goal.status || 'planned'}
                onChange={(e) => onChange?.({ ...goal, status: e.target.value })}
              >
                <option value="planned">Запланировано</option>
                <option value="in_progress">В работе</option>
                <option value="done">Выполнено</option>
              </select>
            </div>
          </div>
          <div className={styles.goalModalActions}>
            <button type="submit" className={styles.btnAi} disabled={saving || !String(goal.title || '').trim()}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button type="button" className={styles.btn} disabled={saving} onClick={onCancel}>
              Отмена
            </button>
            {goal.id && onDelete && (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                disabled={saving}
                onClick={onDelete}
              >
                Удалить
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
