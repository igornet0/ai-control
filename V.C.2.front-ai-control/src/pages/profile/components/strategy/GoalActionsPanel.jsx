import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FolderIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import styles from './Strategy.module.css';
import { strategyApiService } from '../../../../services/strategyApiService';
import { taskService } from '../../../../services/taskService';
import { projectService } from '../../../../services/projectService';

const TASK_DONE = new Set(['done', 'completed']);

function taskStatusLabel(status) {
  if (TASK_DONE.has(status)) return 'Выполнено';
  if (status === 'in_progress') return 'В работе';
  if (status === 'review') return 'На проверке';
  return 'К выполнению';
}

function taskMeta(task) {
  const parts = [`#${task.id}`];
  if (task.board_name || task.board?.name) parts.push(task.board_name || task.board?.name);
  else if (task.is_personal) parts.push('Личное');
  return parts.join(' · ');
}

/**
 * Searchable picker for linking tasks / projects to a goal.
 */
function LinkSearchPicker({
  items,
  placeholder,
  emptyLabel,
  getKey,
  getTitle,
  getSubtitle,
  icon: Icon,
  disabled,
  onPick,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [menuPos, setMenuPos] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    const list = Array.isArray(items) ? items : [];
    if (!q) return list.slice(0, 12);
    return list
      .filter((item) => {
        const hay = `${getTitle(item)} ${getSubtitle?.(item) || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [items, query, getTitle, getSubtitle]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return undefined;
    }
    const updatePos = () => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const maxH = 240;
      const spaceBelow = window.innerHeight - r.bottom - 8;
      const openUp = spaceBelow < 160 && r.top > spaceBelow;
      const height = Math.min(maxH, Math.max(120, openUp ? r.top - 8 : spaceBelow));
      setMenuPos({
        left: Math.round(r.left),
        width: Math.round(r.width),
        maxHeight: height,
        ...(openUp
          ? { bottom: Math.round(window.innerHeight - r.top + 4), top: 'auto' }
          : { top: Math.round(r.bottom + 4), bottom: 'auto' }),
      });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open, filtered.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      const t = e.target;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (item) => {
    if (!item || disabled) return;
    onPick?.(item);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const dropdown = open && menuPos && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        className={styles.linkDropdown}
        role="listbox"
        style={{
          position: 'fixed',
          left: menuPos.left,
          width: menuPos.width,
          top: menuPos.top,
          bottom: menuPos.bottom,
          maxHeight: menuPos.maxHeight,
          zIndex: 120,
        }}
      >
        {filtered.length === 0 ? (
          <div className={styles.linkDropdownEmpty}>{emptyLabel}</div>
        ) : (
          filtered.map((item, idx) => (
            <button
              key={getKey(item)}
              type="button"
              role="option"
              aria-selected={idx === highlight}
              className={`${styles.linkOption} ${idx === highlight ? styles.linkOptionActive : ''}`}
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => pick(item)}
            >
              <span className={styles.linkOptionIcon} aria-hidden>
                <Icon />
              </span>
              <span className={styles.linkOptionText}>
                <strong>{getTitle(item)}</strong>
                {getSubtitle?.(item) && <span>{getSubtitle(item)}</span>}
              </span>
              <LinkIcon className={styles.linkOptionAction} aria-hidden />
            </button>
          ))
        )}
      </div>,
      document.body,
    )
    : null;

  return (
    <div className={`${styles.linkPicker} ${open ? styles.linkPickerOpen : ''}`} ref={rootRef}>
      <div className={`${styles.linkSearch} ${open ? styles.linkSearchOpen : ''}`}>
        <MagnifyingGlassIcon className={styles.linkSearchIcon} aria-hidden />
        <input
          ref={inputRef}
          className={styles.linkSearchInput}
          type="search"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          aria-expanded={open}
          aria-autocomplete="list"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((h) => Math.max(0, h - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (filtered[highlight]) pick(filtered[highlight]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        {query && (
          <button
            type="button"
            className={styles.linkSearchClear}
            aria-label="Очистить"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
          >
            <XMarkIcon />
          </button>
        )}
      </div>
      {dropdown}
    </div>
  );
}

function LinkedItem({ title, meta, onUnlink, canEdit }) {
  return (
    <li className={styles.linkedItem}>
      <div className={styles.linkedItemBody}>
        <span className={styles.linkedItemTitle}>{title}</span>
        {meta && <span className={styles.linkedItemMeta}>{meta}</span>}
      </div>
      {canEdit && (
        <button type="button" className={styles.linkedUnlink} onClick={onUnlink} title="Отвязать">
          <XMarkIcon />
          <span>Отвязать</span>
        </button>
      )}
    </li>
  );
}

/**
 * Actions (milestones) + linked tasks/projects under a company/department goal.
 */
export default function GoalActionsPanel({ goal, canEdit, onChanged }) {
  const goalId = goal?.id;
  const [milestones, setMilestones] = useState(goal?.milestones || []);
  const [links, setLinks] = useState({ tasks: [], projects: [] });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', due_date: '', createAsTask: true });
  const [saving, setSaving] = useState(false);
  const [taskOptions, setTaskOptions] = useState([]);
  const [projectOptions, setProjectOptions] = useState([]);

  const reload = useCallback(async () => {
    if (!goalId) return;
    try {
      const [ms, lk] = await Promise.all([
        strategyApiService.getMilestones(goalId),
        strategyApiService.getGoalLinks(goalId),
      ]);
      setMilestones(ms || []);
      setLinks(lk || { tasks: [], projects: [] });
      onChanged?.();
    } catch {
      // keep local
    }
  }, [goalId, onChanged]);

  useEffect(() => {
    setMilestones(goal?.milestones || []);
    reload();
  }, [goalId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!canEdit) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [tasks, projects] = await Promise.all([
          taskService.getTasks().catch(() => []),
          projectService.getProjects().catch(() => []),
        ]);
        if (cancelled) return;
        const taskList = Array.isArray(tasks) ? tasks : tasks?.items || tasks?.tasks || [];
        const projectList = Array.isArray(projects) ? projects : projects?.items || [];
        setTaskOptions(taskList);
        setProjectOptions(projectList);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canEdit, goalId]);

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
      alert('Не удалось обновить действие');
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const title = String(form.title || '').trim();
    if (!title || !goalId) return;
    setSaving(true);
    try {
      await strategyApiService.createMilestone(goalId, {
        title,
        due_date: form.due_date || null,
        done: false,
        create_as_task: Boolean(form.createAsTask),
      });
      setForm({ title: '', due_date: '', createAsTask: true });
      setAdding(false);
      await reload();
    } catch {
      alert('Не удалось добавить действие');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить действие?')) return;
    try {
      await strategyApiService.deleteMilestone(id);
      await reload();
    } catch {
      alert('Ошибка удаления');
    }
  };

  const linkTask = async (task) => {
    if (!task?.id) return;
    setSaving(true);
    try {
      await strategyApiService.linkWorkToGoal(goalId, { task_id: Number(task.id) });
      await reload();
    } catch {
      alert('Не удалось привязать задачу');
    } finally {
      setSaving(false);
    }
  };

  const linkProject = async (project) => {
    if (!project?.id) return;
    setSaving(true);
    try {
      await strategyApiService.linkWorkToGoal(goalId, { project_id: Number(project.id) });
      await reload();
    } catch {
      alert('Не удалось привязать проект');
    } finally {
      setSaving(false);
    }
  };

  const unlinkTask = async (taskId) => {
    try {
      await strategyApiService.linkWorkToGoal(goalId, { task_id: taskId, unlink: true });
      await reload();
    } catch {
      alert('Не удалось отвязать задачу');
    }
  };

  const unlinkProject = async (projectId) => {
    try {
      await strategyApiService.linkWorkToGoal(goalId, { project_id: projectId, unlink: true });
      await reload();
    } catch {
      alert('Не удалось отвязать проект');
    }
  };

  const linkedTaskIds = new Set((links.tasks || []).map((t) => t.id));
  const linkedProjectIds = new Set((links.projects || []).map((p) => p.id));
  const availableTasks = taskOptions.filter((t) => !linkedTaskIds.has(t.id));
  const availableProjects = projectOptions.filter((p) => !linkedProjectIds.has(p.id));

  return (
    <div className={styles.goalActionsPanel}>
      <p className={styles.missionLabel}>Действия</p>
      <ul className={styles.actionList}>
        {milestones.map((m) => {
          const linked = (links.tasks || []).find((t) => t.milestone_id === m.id);
          return (
            <li key={m.id} className={styles.actionRow}>
              <label className={styles.actionCheck}>
                <input
                  type="checkbox"
                  checked={Boolean(m.done)}
                  disabled={!canEdit}
                  onChange={() => toggleDone(m)}
                />
                <span className={m.done ? styles.actionDone : undefined}>{m.title}</span>
              </label>
              <div className={styles.actionMetaRow}>
                {m.due_date && <span className={styles.muted}>до {m.due_date}</span>}
                {linked && (
                  <span className={styles.linkChip}>
                    Задача #{linked.id} · {taskStatusLabel(linked.status)}
                  </span>
                )}
                {canEdit && (
                  <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => handleDelete(m.id)}>
                    Удалить
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {!milestones.length && (
          <li className={styles.muted}>Действий пока нет — добавьте шаг, который станет задачей.</li>
        )}
      </ul>

      {canEdit && !adding && (
        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => setAdding(true)}>
          + Действие
        </button>
      )}

      {adding && (
        <form className={styles.formStack} style={{ marginTop: '0.55rem' }} onSubmit={handleAdd}>
          <input
            className={styles.input}
            required
            autoFocus
            placeholder="Название действия"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <input
            className={styles.input}
            type="date"
            value={form.due_date}
            onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            style={{ maxWidth: 180 }}
          />
          <label className={styles.actionCheck}>
            <input
              type="checkbox"
              checked={form.createAsTask}
              onChange={(e) => setForm((f) => ({ ...f, createAsTask: e.target.checked }))}
            />
            <span>Создать задачу в менеджере задач</span>
          </label>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="submit" className={styles.btnAi} disabled={saving}>
              {saving ? '...' : 'Добавить'}
            </button>
            <button type="button" className={styles.btn} onClick={() => setAdding(false)}>
              Отмена
            </button>
          </div>
        </form>
      )}

      <div className={styles.linkSection}>
        <div className={styles.linkSectionHead}>
          <p className={styles.missionLabel}>Связанные задачи</p>
          <span className={styles.linkCount}>{(links.tasks || []).length}</span>
        </div>

        <ul className={styles.linkedList}>
          {(links.tasks || []).map((t) => (
            <LinkedItem
              key={t.id}
              title={t.title}
              meta={`${taskMeta(t)} · ${taskStatusLabel(t.status)}`}
              canEdit={canEdit}
              onUnlink={() => unlinkTask(t.id)}
            />
          ))}
          {!(links.tasks || []).length && (
            <li className={styles.linkedEmpty}>Нет привязанных задач</li>
          )}
        </ul>

        {canEdit && (
          <LinkSearchPicker
            items={availableTasks}
            placeholder="Найти задачу по названию или номеру…"
            emptyLabel="Задачи не найдены"
            disabled={saving}
            getKey={(t) => t.id}
            getTitle={(t) => t.title || `Задача #${t.id}`}
            getSubtitle={(t) => `${taskMeta(t)} · ${taskStatusLabel(t.status)}`}
            icon={LinkIcon}
            onPick={linkTask}
          />
        )}
      </div>

      <div className={styles.linkSection}>
        <div className={styles.linkSectionHead}>
          <p className={styles.missionLabel}>Связанные проекты</p>
          <span className={styles.linkCount}>{(links.projects || []).length}</span>
        </div>

        <ul className={styles.linkedList}>
          {(links.projects || []).map((p) => (
            <LinkedItem
              key={p.id}
              title={p.name}
              meta={`Прогресс ${Math.round(p.progress || 0)}%`}
              canEdit={canEdit}
              onUnlink={() => unlinkProject(p.id)}
            />
          ))}
          {!(links.projects || []).length && (
            <li className={styles.linkedEmpty}>Нет привязанных проектов</li>
          )}
        </ul>

        {canEdit && (
          <LinkSearchPicker
            items={availableProjects}
            placeholder="Найти проект по названию…"
            emptyLabel="Проекты не найдены"
            disabled={saving}
            getKey={(p) => p.id}
            getTitle={(p) => p.name || `Проект #${p.id}`}
            getSubtitle={(p) => (p.progress != null ? `Прогресс ${Math.round(p.progress || 0)}%` : null)}
            icon={FolderIcon}
            onPick={linkProject}
          />
        )}
      </div>
    </div>
  );
}
