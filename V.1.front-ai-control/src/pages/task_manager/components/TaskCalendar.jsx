import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { projectService } from '../../../services/projectService';
import { taskService } from '../../../services/taskService';
import TaskDetails from './TaskDetails';
import ProjectTasksCalendar from '../tabs/projects/components/ProjectTasksCalendar';
import {
  IconWithText,
  MyTasksIcon,
  RefreshIcon,
  SearchInput,
  TaskPriorityIcon,
  TasksIcon,
  TaskStatusIcon,
} from './TaskManagerIcons';
import './TaskCalendar.css';

const STATUS_FILTER_LABELS = {
  created: 'Создана',
  in_progress: 'В работе',
  review: 'На проверке',
  completed: 'Завершена',
  cancelled: 'Отменена',
  on_hold: 'На паузе',
  blocked: 'Заблокирована',
};

const PRIORITY_FILTER_LABELS = {
  urgent: 'Срочно',
  critical: 'Критично',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

const DEFAULT_STATUS_FILTERS = {
  created: true,
  in_progress: true,
  review: true,
  completed: true,
  cancelled: true,
  on_hold: true,
  blocked: true,
};

const DEFAULT_PRIORITY_FILTERS = {
  urgent: true,
  critical: true,
  high: true,
  medium: true,
  low: true,
};

function mapTaskStatus(status) {
  const statusMap = { todo: 'created', done: 'completed' };
  return statusMap[status] || status;
}

export default function TaskCalendar({
  tasks = [],
  loading = false,
  currentUser,
  onTaskUpdate,
  onDeleteTask,
  resetFiltersKey = 0,
  excludeTasksWithoutProject = false,
  onFilteredTasksChange,
  onFilterActivityChange,
}) {
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState(DEFAULT_STATUS_FILTERS);
  const [priorityFilters, setPriorityFilters] = useState(DEFAULT_PRIORITY_FILTERS);
  const [myTasksFilter, setMyTasksFilter] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectFilters, setProjectFilters] = useState({ none: true });
  const [projectFilterSearch, setProjectFilterSearch] = useState('');
  const [contextMenu, setContextMenu] = useState({ type: null, x: 0, y: 0 });
  const [selectedTask, setSelectedTask] = useState(null);
  const [openingTaskId, setOpeningTaskId] = useState(null);

  const menuRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const data = await projectService.getProjects();
        setProjects(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error loading projects for task calendar:', error);
        setProjects([]);
      }
    };
    loadProjects();
  }, []);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru')),
    [projects],
  );

  const taskProjectMap = useMemo(() => {
    const map = new Map();
    sortedProjects.forEach((project) => {
      (project.tasks || []).forEach((linkedTask) => {
        if (linkedTask?.id != null && !map.has(linkedTask.id)) {
          map.set(linkedTask.id, {
            id: project.id,
            name: project.name || `Проект #${project.id}`,
          });
        }
      });
    });
    tasks.forEach((task) => {
      if (task.project_id && !map.has(task.id)) {
        const project = sortedProjects.find((item) => item.id === task.project_id);
        map.set(task.id, {
          id: task.project_id,
          name: project?.name || task.project_name || `Проект #${task.project_id}`,
        });
      }
    });
    return map;
  }, [sortedProjects, tasks]);

  const buildDefaultProjectFilters = (excludeNone = excludeTasksWithoutProject) =>
    Object.fromEntries(
      ['none', ...sortedProjects.map((project) => String(project.id))].map((key) => [
        key,
        key === 'none' ? !excludeNone : true,
      ]),
    );

  useEffect(() => {
    setProjectFilters((prev) => {
      const nextNone = !excludeTasksWithoutProject;
      if ((prev.none ?? true) === nextNone) return prev;
      return { ...prev, none: nextNone };
    });
  }, [excludeTasksWithoutProject]);

  useEffect(() => {
    setProjectFilters((prev) => {
      const next = { none: prev.none ?? !excludeTasksWithoutProject };
      sortedProjects.forEach((project) => {
        const key = String(project.id);
        next[key] = prev[key] ?? true;
      });
      return next;
    });
  }, [sortedProjects, excludeTasksWithoutProject]);

  useEffect(() => {
    if (!resetFiltersKey) return;
    setSearch('');
    setStatusFilters(DEFAULT_STATUS_FILTERS);
    setPriorityFilters(DEFAULT_PRIORITY_FILTERS);
    setMyTasksFilter(false);
    setProjectFilters(buildDefaultProjectFilters());
    setProjectFilterSearch('');
  }, [resetFiltersKey, sortedProjects, excludeTasksWithoutProject]);

  const getTaskProject = (task) => taskProjectMap.get(task.id) || null;

  const getProjectFilterKey = (task) => {
    const project = getTaskProject(task);
    return project ? String(project.id) : 'none';
  };

  const areFiltersActive = useMemo(() => {
    const projectFiltersActive = Object.entries(projectFilters).some(([key, value]) => {
      if (value !== false) return false;
      if (excludeTasksWithoutProject && key === 'none') return false;
      return true;
    });
    return (
      search.trim().length > 0
      || Object.values(statusFilters).some((value) => !value)
      || Object.values(priorityFilters).some((value) => !value)
      || projectFiltersActive
      || myTasksFilter
    );
  }, [search, statusFilters, priorityFilters, projectFilters, myTasksFilter, excludeTasksWithoutProject]);

  const filteredTasks = useMemo(() => {
    let list = tasks
      .filter((task) =>
        task.title.toLowerCase().includes(search.toLowerCase())
        || task.description?.toLowerCase().includes(search.toLowerCase())
        || (task.executor_name || '').toLowerCase().includes(search.toLowerCase())
        || (getTaskProject(task)?.name || '').toLowerCase().includes(search.toLowerCase()),
      )
      .filter((task) => {
        const mappedStatus = mapTaskStatus(task.status);
        return statusFilters[mappedStatus] !== false;
      })
      .filter((task) => priorityFilters[task.priority] !== false)
      .filter((task) => projectFilters[getProjectFilterKey(task)] !== false);

    if (myTasksFilter && currentUser) {
      list = list.filter((task) => (task.executor_id ?? task.assignee_id) === currentUser.id);
    }

    return list;
  }, [
    tasks,
    search,
    statusFilters,
    priorityFilters,
    projectFilters,
    myTasksFilter,
    currentUser,
    taskProjectMap,
  ]);

  useEffect(() => {
    onFilteredTasksChange?.(filteredTasks);
  }, [filteredTasks, onFilteredTasksChange]);

  useEffect(() => {
    onFilterActivityChange?.(areFiltersActive);
  }, [areFiltersActive, onFilterActivityChange]);

  useEffect(() => {
    if (!contextMenu.type) return undefined;

    const handleClick = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      setContextMenu({ type: null, x: 0, y: 0 });
    };

    const timer = window.setTimeout(() => {
      document.addEventListener('click', handleClick);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [contextMenu.type]);

  const toggleFilter = (type, value) => {
    if (type === 'status') {
      setStatusFilters((prev) => ({ ...prev, [value]: !prev[value] }));
    } else if (type === 'priority') {
      setPriorityFilters((prev) => ({ ...prev, [value]: !prev[value] }));
    } else if (type === 'project') {
      setProjectFilters((prev) => ({ ...prev, [value]: !prev[value] }));
    }
  };

  const setFilterGroup = (type, checked) => {
    if (type === 'project') {
      const keys = ['none', ...sortedProjects.map((project) => String(project.id))];
      setProjectFilters(Object.fromEntries(keys.map((key) => [key, checked])));
      return;
    }
    const keys = type === 'status' ? Object.keys(statusFilters) : Object.keys(priorityFilters);
    const next = Object.fromEntries(keys.map((key) => [key, checked]));
    if (type === 'status') {
      setStatusFilters(next);
    } else {
      setPriorityFilters(next);
    }
  };

  const getFilterLabel = (type, key) => {
    if (type === 'status') return STATUS_FILTER_LABELS[key] || key;
    if (type === 'priority') return PRIORITY_FILTER_LABELS[key] || key;
    if (key === 'none') return 'Без проекта';
    const project = sortedProjects.find((item) => String(item.id) === key);
    return project?.name || `Проект #${key}`;
  };

  const openContextMenu = (event, type) => {
    event.preventDefault();
    event.stopPropagation();

    if (contextMenu.type === type) {
      setContextMenu({ type: null, x: 0, y: 0 });
      return;
    }

    if (type === 'project') setProjectFilterSearch('');
    const rect = event.currentTarget.getBoundingClientRect();
    setContextMenu({
      type,
      x: rect.left,
      y: rect.bottom + 6,
    });
  };

  const handleOpenTask = async (task) => {
    if (!task?.id) return;
    try {
      setOpeningTaskId(task.id);
      const fullTask = await taskService.getTask(task.id);
      const project = getTaskProject(task);
      setSelectedTask({
        ...fullTask,
        project_id: project?.id ?? fullTask.project_id ?? null,
        project_name: project?.name ?? fullTask.project_name,
        executor_id: fullTask.assignee_id ?? fullTask.executor_id,
        executor_name: fullTask.assignee_name ?? task.executor_name,
      });
    } catch (error) {
      console.error('Error loading task details:', error);
      setSelectedTask(task);
    } finally {
      setOpeningTaskId(null);
    }
  };

  const handleTaskDetailsUpdate = async () => {
    if (onTaskUpdate) await onTaskUpdate();
    if (!selectedTask?.id) return;
    try {
      const fullTask = await taskService.getTask(selectedTask.id);
      const project = getTaskProject({ ...fullTask, id: fullTask.id });
      setSelectedTask({
        ...fullTask,
        project_id: project?.id ?? fullTask.project_id ?? null,
        project_name: project?.name ?? fullTask.project_name,
        executor_id: fullTask.assignee_id ?? fullTask.executor_id,
        executor_name: fullTask.assignee_name ?? selectedTask.executor_name,
      });
    } catch (error) {
      console.error('Error refreshing task details:', error);
    }
  };

  const renderFilterMenu = () => {
    const type = contextMenu.type;
    if (!type) return null;

    if (type === 'project') {
      const options = ['none', ...sortedProjects.map((project) => String(project.id))];
      const query = projectFilterSearch.trim().toLowerCase();
      const visibleOptions = options.filter((key) => {
        if (!query) return true;
        return getFilterLabel('project', key).toLowerCase().includes(query);
      });
      const activeCount = options.filter((key) => projectFilters[key] !== false).length;

      return createPortal(
        <div
          ref={menuRef}
          className="fixed z-[10020] w-80 overflow-hidden rounded-2xl border border-slate-600/50 bg-slate-900/95 shadow-2xl backdrop-blur-xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-slate-700/60 bg-slate-800/60 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Фильтр по проекту</h4>
                <p className="mt-0.5 text-xs text-slate-400">
                  Выбрано: {activeCount} из {options.length}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => setFilterGroup('project', true)} className="rounded-lg px-2 py-1 text-xs font-medium text-cyan-300 hover:bg-cyan-500/10">
                  Все
                </button>
                <button type="button" onClick={() => setFilterGroup('project', false)} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-700/60 hover:text-slate-200">
                  Сброс
                </button>
              </div>
            </div>
            <SearchInput
              value={projectFilterSearch}
              onChange={(event) => setProjectFilterSearch(event.target.value)}
              placeholder="Поиск проекта…"
              className="mt-3"
              inputClassName="text-sm py-2"
            />
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto p-2">
            {visibleOptions.map((key) => (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  projectFilters[key] ? 'bg-slate-700/50 border border-slate-600/40' : 'border border-transparent hover:bg-slate-800/80'
                }`}
              >
                <input
                  type="checkbox"
                  checked={projectFilters[key] !== false}
                  onChange={() => toggleFilter('project', key)}
                  className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-cyan-500"
                />
                <span className={`text-sm ${projectFilters[key] !== false ? 'text-slate-100' : 'text-slate-400'}`}>
                  {getFilterLabel('project', key)}
                </span>
              </label>
            ))}
          </div>
        </div>,
        document.body,
      );
    }

    const state = type === 'status' ? statusFilters : priorityFilters;
    const options = Object.keys(state);
    const activeCount = Object.values(state).filter(Boolean).length;
    const menuTitle = type === 'status' ? 'Фильтр по статусу' : 'Фильтр по приоритету';

    return createPortal(
      <div
        ref={menuRef}
        className="fixed z-[10020] w-72 overflow-hidden rounded-2xl border border-slate-600/50 bg-slate-900/95 shadow-2xl backdrop-blur-xl"
        style={{ top: contextMenu.y, left: contextMenu.x }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-700/60 bg-slate-800/60 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-100">{menuTitle}</h4>
              <p className="mt-0.5 text-xs text-slate-400">
                Выбрано: {activeCount} из {options.length}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => setFilterGroup(type, true)} className="rounded-lg px-2 py-1 text-xs font-medium text-cyan-300 hover:bg-cyan-500/10">
                Все
              </button>
              <button type="button" onClick={() => setFilterGroup(type, false)} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-700/60 hover:text-slate-200">
                Сброс
              </button>
            </div>
          </div>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto p-2">
          {options.map((key) => (
            <label
              key={key}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                state[key] ? 'bg-slate-700/50 border border-slate-600/40' : 'border border-transparent hover:bg-slate-800/80'
              }`}
            >
              <input
                type="checkbox"
                checked={state[key]}
                onChange={() => toggleFilter(type, key)}
                className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-cyan-500"
              />
              <span className={`text-sm ${state[key] ? 'text-slate-100' : 'text-slate-400'}`}>
                {getFilterLabel(type, key)}
              </span>
              <span className="ml-auto">
                {type === 'status' ? <TaskStatusIcon status={key} /> : <TaskPriorityIcon priority={key} />}
              </span>
            </label>
          ))}
        </div>
      </div>,
      document.body,
    );
  };

  const activeStatusCount = Object.values(statusFilters).filter(Boolean).length;
  const activePriorityCount = Object.values(priorityFilters).filter(Boolean).length;
  const projectOptions = ['none', ...sortedProjects.map((project) => String(project.id))];
  const activeProjectCount = projectOptions.filter((key) => projectFilters[key] !== false).length;

  return (
    <div ref={containerRef} className="task-calendar flex flex-col flex-1 min-h-0 gap-4 relative">
      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск задач..."
          className="flex-grow md:max-w-sm"
        />

        {currentUser && (
          <label className="flex items-center space-x-2 px-3 py-2 bg-slate-800/60 backdrop-blur-sm rounded-md border border-slate-600 hover:border-slate-500 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={myTasksFilter}
              onChange={(event) => setMyTasksFilter(event.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <IconWithText icon={MyTasksIcon} className="text-sm text-slate-300 whitespace-nowrap">
              Мои задачи
            </IconWithText>
          </label>
        )}

        <button
          type="button"
          onClick={(event) => openContextMenu(event, 'status')}
          className="px-3 py-2 text-sm rounded-md border border-slate-600 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors"
        >
          Статус ({activeStatusCount}/{Object.keys(statusFilters).length})
        </button>
        <button
          type="button"
          onClick={(event) => openContextMenu(event, 'priority')}
          className="px-3 py-2 text-sm rounded-md border border-slate-600 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors"
        >
          Приоритет ({activePriorityCount}/{Object.keys(priorityFilters).length})
        </button>
        <button
          type="button"
          onClick={(event) => openContextMenu(event, 'project')}
          className="px-3 py-2 text-sm rounded-md border border-slate-600 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors"
        >
          Проект ({activeProjectCount}/{projectOptions.length})
        </button>

        <span className="text-xs text-slate-500 ml-auto">
          Показано: {filteredTasks.length} из {tasks.length}
        </span>
      </div>

      {contextMenu.type ? renderFilterMenu() : null}

      <div className="task-calendar__body flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-700/50 bg-slate-900/30 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
            <RefreshIcon className="animate-spin" size="sm" />
            Загрузка задач…
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <TasksIcon size="lg" className="mb-3 opacity-40" />
            <p className="text-sm">Нет задач для отображения в календаре</p>
          </div>
        ) : (
          <ProjectTasksCalendar
            tasks={filteredTasks}
            onTaskClick={handleOpenTask}
            openingTaskId={openingTaskId}
          />
        )}
      </div>

      {selectedTask && (
        <TaskDetails
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onTaskUpdate={handleTaskDetailsUpdate}
          onDelete={onDeleteTask}
          currentUser={currentUser}
          overlayZIndex={10000}
        />
      )}
    </div>
  );
}
