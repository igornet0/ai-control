import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useAuth from '../../../../../hooks/useAuth';
import { teamService } from '../../../../../services/teamService';
import { taskService } from '../../../../../services/taskService';
import TaskDetails from '../../../components/TaskDetails';
import EditTeamModal from '../../teams/components/EditTeamModal';
import { CloseIcon } from '../../../components/TaskManagerIcons';

export function mergeProjectTeamsForPicker(fetchedTeams = [], projectTeams = []) {
  const byId = new Map();

  (Array.isArray(fetchedTeams) ? fetchedTeams : []).forEach((team) => {
    if (team?.id != null) {
      byId.set(team.id, team);
    }
  });

  (Array.isArray(projectTeams) ? projectTeams : []).forEach((link) => {
    const teamId = link?.team_id ?? link?.id;
    if (teamId == null || byId.has(teamId)) return;

    byId.set(teamId, {
      id: teamId,
      name: link.team_name || link.name || `Команда #${teamId}`,
      description: link.role ? `Роль в проекте: ${link.role}` : link.description,
      linkedToProject: true,
    });
  });

  return Array.from(byId.values()).sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'ru')
  );
}

const TASK_STATUS_LABELS = {
  created: 'Создана',
  in_progress: 'В работе',
  review: 'На проверке',
  completed: 'Завершена',
  cancelled: 'Отменена',
  on_hold: 'На паузе',
  blocked: 'Заблокирована',
};

function formatTaskDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU');
}

function getTaskTimestamp(task, field) {
  const raw = field === 'completed' ? task?.completed_at : task?.created;
  if (!raw) return null;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? null : time;
}

export function mergeProjectTasksForPicker(catalogTasks = [], projectTasks = []) {
  const byId = new Map();

  (Array.isArray(catalogTasks) ? catalogTasks : []).forEach((task) => {
    if (task?.id != null) byId.set(task.id, task);
  });

  (Array.isArray(projectTasks) ? projectTasks : []).forEach((task) => {
    if (task?.id == null) return;
    if (!byId.has(task.id)) {
      byId.set(task.id, { ...task, linkedToProject: true });
      return;
    }
    byId.set(task.id, { ...byId.get(task.id), ...task });
  });

  return Array.from(byId.values());
}

function TaskStatusBadge({ status }) {
  if (!status) return null;
  const label = TASK_STATUS_LABELS[status] || status;
  return <span className={`task-meta task-meta--${status}`}>{label}</span>;
}

function TeamPickerDialog({ teams, value, onChange, onClose }) {
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(() => (Array.isArray(value) ? [...value] : []));

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [onClose]);

  const filteredTeams = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return teams;
    return teams.filter((team) => {
      const name = (team.name || '').toLowerCase();
      const description = (team.description || '').toLowerCase();
      return name.includes(query) || description.includes(query) || String(team.id).includes(query);
    });
  }, [teams, search]);

  const toggleTeam = (teamId) => {
    setDraft((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const handleApply = () => {
    onChange(draft);
    onClose();
  };

  return createPortal(
    <div className="team-picker-overlay" onClick={onClose} role="presentation">
      <div
        className="team-picker-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-picker-dialog-title"
      >
        <div className="team-picker-dialog__header">
          <h3 id="team-picker-dialog-title" className="team-picker-dialog__title">
            Добавить команду в проект
          </h3>
          <button
            type="button"
            className="team-picker-dialog__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <CloseIcon size="sm" />
          </button>
        </div>

        <div className="team-picker-dialog__search-wrap">
          <input
            type="search"
            className="team-picker-dialog__search"
            placeholder="Поиск по названию команды…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
        </div>

        <div className="team-picker-dialog__list">
          {!teams.length ? (
            <p className="picker-empty picker-empty--inline">Нет доступных команд</p>
          ) : filteredTeams.length === 0 ? (
            <p className="picker-empty picker-empty--inline">Ничего не найдено</p>
          ) : (
            filteredTeams.map((team) => {
              const checked = draft.includes(team.id);
              return (
                <label
                  key={team.id}
                  className={`team-checkbox ${checked ? 'team-checkbox--selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTeam(team.id)}
                  />
                  <span className="team-checkbox__content">
                    <span className="team-name">{team.name}</span>
                    {team.description && (
                      <span className="team-description">{team.description}</span>
                    )}
                  </span>
                </label>
              );
            })
          )}
        </div>

        <div className="team-picker-dialog__footer">
          <span className="picker-count">Выбрано: {draft.length}</span>
          <div className="team-picker-dialog__actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Отмена
            </button>
            <button type="button" className="submit-btn" onClick={handleApply}>
              Готово
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TaskPickerDialog({ tasks, value, onChange, onClose }) {
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(() => (Array.isArray(value) ? [...value] : []));

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [onClose]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tasks;
    return tasks.filter((task) => {
      const title = (task.title || '').toLowerCase();
      const id = String(task.id);
      return title.includes(query) || id.includes(query);
    });
  }, [tasks, search]);

  const toggleTask = (taskId) => {
    setDraft((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleApply = () => {
    onChange(draft);
    onClose();
  };

  return createPortal(
    <div className="team-picker-overlay" onClick={onClose} role="presentation">
      <div
        className="team-picker-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-picker-dialog-title"
      >
        <div className="team-picker-dialog__header">
          <h3 id="task-picker-dialog-title" className="team-picker-dialog__title">
            Добавить задачи в проект
          </h3>
          <button
            type="button"
            className="team-picker-dialog__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <CloseIcon size="sm" />
          </button>
        </div>

        <div className="team-picker-dialog__search-wrap">
          <input
            type="search"
            className="team-picker-dialog__search"
            placeholder="Поиск по названию или ID…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
        </div>

        <div className="team-picker-dialog__list">
          {!tasks.length ? (
            <p className="picker-empty picker-empty--inline">Нет доступных задач</p>
          ) : filteredTasks.length === 0 ? (
            <p className="picker-empty picker-empty--inline">Ничего не найдено</p>
          ) : (
            filteredTasks.map((task) => {
              const checked = draft.includes(task.id);
              return (
                <label
                  key={task.id}
                  className={`task-checkbox task-checkbox--dialog ${checked ? 'task-checkbox--selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTask(task.id)}
                  />
                  <span className="task-checkbox__content">
                    <span className="task-title" title={task.title || 'Без названия'}>
                      {task.title || 'Без названия'}
                    </span>
                    <span className="task-subtitle">
                      ID {task.id} · создана {formatTaskDate(task.created)}
                    </span>
                  </span>
                  <TaskStatusBadge status={task.status} />
                </label>
              );
            })
          )}
        </div>

        <div className="team-picker-dialog__footer">
          <span className="picker-count">Выбрано: {draft.length}</span>
          <div className="team-picker-dialog__actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Отмена
            </button>
            <button type="button" className="submit-btn" onClick={handleApply}>
              Готово
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const NESTED_DETAIL_Z_INDEX = 10002;

export function useProjectPickerDetails({ catalogTasks = [], onTeamsChanged }) {
  const { user } = useAuth();
  const [viewingTeam, setViewingTeam] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);

  const openTeam = useCallback(async (team) => {
    if (!team?.id) return;
    try {
      const fullTeam = await teamService.getTeam(team.id);
      setViewingTeam(fullTeam);
    } catch (error) {
      console.error('Error loading team:', error);
      setViewingTeam(team);
    }
  }, []);

  const openTask = useCallback(
    async (task) => {
      if (!task?.id) return;
      const cached = (Array.isArray(catalogTasks) ? catalogTasks : []).find(
        (item) => item.id === task.id
      );
      if (cached) {
        setViewingTask(cached);
        return;
      }
      try {
        const fullTask = await taskService.getTask(task.id);
        setViewingTask(fullTask);
      } catch (error) {
        console.error('Error loading task:', error);
        setViewingTask(task);
      }
    },
    [catalogTasks]
  );

  const closeNested = useCallback(() => {
    if (viewingTask) {
      setViewingTask(null);
      return true;
    }
    if (viewingTeam) {
      setViewingTeam(null);
      return true;
    }
    return false;
  }, [viewingTask, viewingTeam]);

  const handleTeamSubmit = useCallback(
    async (data) => {
      if (!viewingTeam?.id) return;
      await teamService.updateTeam(viewingTeam.id, data);
      if (onTeamsChanged) {
        await onTeamsChanged();
      }
    },
    [viewingTeam, onTeamsChanged]
  );

  const handleTeamMembersChanged = useCallback(
    async (updatedTeam) => {
      setViewingTeam(updatedTeam);
      if (onTeamsChanged) {
        await onTeamsChanged();
      }
    },
    [onTeamsChanged]
  );

  const detailLayers = (
    <>
      {viewingTask && (
        <TaskDetails
          task={viewingTask}
          onClose={() => setViewingTask(null)}
          onTaskUpdate={setViewingTask}
          currentUser={user}
          overlayZIndex={NESTED_DETAIL_Z_INDEX}
        />
      )}
      {viewingTeam && (
        <EditTeamModal
          team={viewingTeam}
          onClose={() => setViewingTeam(null)}
          onSubmit={handleTeamSubmit}
          onMembersChanged={handleTeamMembersChanged}
          overlayClassName="modal-overlay modal-overlay--nested"
        />
      )}
    </>
  );

  return { openTeam, openTask, closeNested, detailLayers };
}

export function TeamsPicker({
  teams = [],
  value = [],
  onChange,
  onTeamOpen,
  emptyMessage = 'Нет доступных команд',
}) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const selectedIds = Array.isArray(value) ? value : [];

  const teamsById = useMemo(() => {
    const map = new Map();
    teams.forEach((team) => {
      if (team?.id != null) map.set(team.id, team);
    });
    return map;
  }, [teams]);

  const selectedTeams = useMemo(
    () =>
      selectedIds
        .map((id) => teamsById.get(id) || { id, name: `Команда #${id}` })
        .filter((team) => team?.id != null),
    [selectedIds, teamsById]
  );

  const handleRemove = (teamId) => {
    onChange(selectedIds.filter((id) => id !== teamId));
  };

  return (
    <>
      <div className="teams-selection">
        <div className="picker-toolbar">
          <span className="picker-count">Выбрано: {selectedIds.length}</span>
          <button
            type="button"
            className="picker-add-btn"
            onClick={() => setShowAddDialog(true)}
            title="Добавить команду"
            aria-label="Добавить команду"
          >
            +
          </button>
        </div>

        {selectedTeams.length === 0 ? (
          <p className="picker-empty">
            {teams.length
              ? 'Команды не выбраны. Нажмите +, чтобы добавить.'
              : emptyMessage}
          </p>
        ) : (
          <div className="teams-selection__list">
            {selectedTeams.map((team) => {
              const canOpen = typeof onTeamOpen === 'function';
              return (
                <div
                  key={team.id}
                  className={`team-selected-item team-checkbox team-checkbox--selected${
                    canOpen ? ' team-selected-item--clickable' : ''
                  }`}
                  onClick={canOpen ? () => onTeamOpen(team) : undefined}
                  onKeyDown={
                    canOpen
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onTeamOpen(team);
                          }
                        }
                      : undefined
                  }
                  role={canOpen ? 'button' : undefined}
                  tabIndex={canOpen ? 0 : undefined}
                  title={canOpen ? 'Открыть команду' : undefined}
                >
                  <span className="team-checkbox__content">
                    <span className="team-name">{team.name}</span>
                    {team.description && (
                      <span className="team-description">{team.description}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="team-selected-item__remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRemove(team.id);
                    }}
                    aria-label={`Убрать команду ${team.name}`}
                  >
                    <CloseIcon size="xs" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddDialog && (
        <TeamPickerDialog
          teams={teams}
          value={selectedIds}
          onChange={onChange}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </>
  );
}

export function TasksPicker({
  catalogTasks = [],
  projectTasks = [],
  value = [],
  onChange,
  onTaskOpen,
  loading = false,
  emptyMessage = 'Нет задач в проекте',
}) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [sortField, setSortField] = useState('created');
  const [sortDir, setSortDir] = useState('desc');
  const selectedIds = Array.isArray(value) ? value : [];

  const tasksById = useMemo(() => {
    const map = new Map();
    mergeProjectTasksForPicker(catalogTasks, projectTasks).forEach((task) => {
      if (task?.id != null) map.set(task.id, task);
    });
    return map;
  }, [catalogTasks, projectTasks]);

  const catalogList = useMemo(
    () => (Array.isArray(catalogTasks) ? catalogTasks : []),
    [catalogTasks]
  );

  const selectedTasks = useMemo(
    () =>
      selectedIds
        .map((id) => tasksById.get(id) || { id, title: `Задача #${id}` })
        .filter((task) => task?.id != null),
    [selectedIds, tasksById]
  );

  const sortedSelectedTasks = useMemo(() => {
    const list = [...selectedTasks];
    list.sort((a, b) => {
      const timeA = getTaskTimestamp(a, sortField);
      const timeB = getTaskTimestamp(b, sortField);

      if (timeA == null && timeB == null) {
        return (a.title || '').localeCompare(b.title || '', 'ru');
      }
      if (timeA == null) return 1;
      if (timeB == null) return -1;
      if (timeA === timeB) {
        return (a.title || '').localeCompare(b.title || '', 'ru');
      }
      return sortDir === 'asc' ? timeA - timeB : timeB - timeA;
    });
    return list;
  }, [selectedTasks, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDir('desc');
  };

  const handleRemove = (taskId) => {
    onChange(selectedIds.filter((id) => id !== taskId));
  };

  if (loading) {
    return <p className="picker-empty">Загрузка задач…</p>;
  }

  const sortArrow = sortDir === 'asc' ? '↑' : '↓';

  return (
    <>
      <div className="tasks-selection">
        <div className="picker-toolbar picker-toolbar--tasks">
          <span className="picker-count">Задач: {selectedIds.length}</span>
          <div className="task-sort-controls">
            <button
              type="button"
              className={`task-sort-btn ${sortField === 'created' ? 'task-sort-btn--active' : ''}`}
              onClick={() => handleSort('created')}
            >
              Создание {sortField === 'created' ? sortArrow : ''}
            </button>
            <button
              type="button"
              className={`task-sort-btn ${sortField === 'completed' ? 'task-sort-btn--active' : ''}`}
              onClick={() => handleSort('completed')}
            >
              Завершение {sortField === 'completed' ? sortArrow : ''}
            </button>
          </div>
          <button
            type="button"
            className="picker-add-btn"
            onClick={() => setShowAddDialog(true)}
            title="Добавить задачу"
            aria-label="Добавить задачу"
          >
            +
          </button>
        </div>

        {sortedSelectedTasks.length === 0 ? (
          <p className="picker-empty">
            {catalogList.length
              ? 'В проекте нет задач. Нажмите +, чтобы добавить.'
              : emptyMessage}
          </p>
        ) : (
          <div className="project-tasks-table-wrap">
            <div className="project-tasks-table">
              <div className="project-tasks-table__head">
                <span>Задача</span>
                <span>Статус</span>
                <span>Создана</span>
                <span>Завершена</span>
                <span />
              </div>
              {sortedSelectedTasks.map((task) => {
                const canOpen = typeof onTaskOpen === 'function';
                return (
                  <div
                    key={task.id}
                    className={`project-tasks-table__row${
                      canOpen ? ' project-tasks-table__row--clickable' : ''
                    }`}
                    onClick={canOpen ? () => onTaskOpen(task) : undefined}
                    onKeyDown={
                      canOpen
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onTaskOpen(task);
                            }
                          }
                        : undefined
                    }
                    role={canOpen ? 'button' : undefined}
                    tabIndex={canOpen ? 0 : undefined}
                    title={canOpen ? 'Открыть задачу' : undefined}
                  >
                    <div className="project-tasks-table__title-cell">
                      <span className="task-title" title={task.title || 'Без названия'}>
                        {task.title || 'Без названия'}
                      </span>
                      <span className="task-subtitle">ID {task.id}</span>
                    </div>
                    <div className="project-tasks-table__status-cell">
                      <TaskStatusBadge status={task.status} />
                    </div>
                    <span className="project-tasks-table__date project-tasks-table__date--created">
                      {formatTaskDate(task.created)}
                    </span>
                    <span className="project-tasks-table__date project-tasks-table__date--completed">
                      {formatTaskDate(task.completed_at)}
                    </span>
                    <button
                      type="button"
                      className="team-selected-item__remove"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRemove(task.id);
                      }}
                      aria-label={`Убрать задачу ${task.title || task.id}`}
                    >
                      <CloseIcon size="xs" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showAddDialog && (
        <TaskPickerDialog
          tasks={catalogList}
          value={selectedIds}
          onChange={onChange}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </>
  );
}
