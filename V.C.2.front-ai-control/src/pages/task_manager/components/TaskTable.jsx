import React, { useState, useMemo, useRef, useEffect } from "react";
import TaskDetails from "./TaskDetails";
import { projectService } from "../../../services/projectService";
import { getTask } from "../../../services/taskService";
import EmployeeHoverTrigger from "../../profile/components/employees/EmployeeHoverTrigger";
import { canDeleteTask } from "../utils/taskPermissions";
import { normalizeTaskStatus } from "../utils/performanceUtils";
import {
  IconWithText,
  LightbulbIcon,
  MyTasksIcon,
  RefreshIcon,
  SearchInput,
  TaskPriorityIcon,
  TasksIcon,
  TaskStatusIcon,
  SearchIcon,
} from "./TaskManagerIcons";

// Данные получаются из API через пропс tasks

// Статусы и приоритеты в соответствии с бэкендом
const statusOrder = { 
  "created": 1,      // Сначала новые задачи
  "in_progress": 2,  // Затем в работе
  "review": 3,       // На проверке
  "on_hold": 4,      // На паузе
  "blocked": 5,      // Заблокированные
  "completed": 6,    // Завершенные
  "cancelled": 7     // Отмененные в конце
};

const priorityOrder = { 
  "urgent": 1,       // Сначала срочные
  "critical": 2,     // Критические
  "high": 3,         // Высокие
  "medium": 4,       // Средние
  "low": 5           // Низкие в конце
};

const statusFilterLabels = {
  created: 'Создана',
  in_progress: 'В работе',
  review: 'На проверке',
  completed: 'Завершена',
  cancelled: 'Отменена',
  on_hold: 'На паузе',
  blocked: 'Заблокирована',
};

const priorityFilterLabels = {
  urgent: 'Срочно',
  critical: 'Критично',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

const statusStyles = {
  "created": "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-slate-300",
  "in_progress": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "review": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  "completed": "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "cancelled": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "on_hold": "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  "blocked": "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

const StatusBadge = ({ status }) => {
  const getStatusTooltip = (status) => {
    const tooltipMap = {
      'created': 'Создана',
      'in_progress': 'В работе',
      'review': 'На проверке',
      'completed': 'Завершена',
      'cancelled': 'Отменена',
      'on_hold': 'На паузе',
      'blocked': 'Заблокирована'
    };
    return tooltipMap[status] || status;
  };

  return (
    <span 
      className={`px-3 py-1 rounded-full text-sm flex items-center justify-center ${statusStyles[status] || statusStyles['created']}`}
      title={getStatusTooltip(status)}
    >
      <TaskStatusIcon status={status} />
    </span>
  );
};

export default function TaskTable({
  tasks = [],
  loading = false,
  onTaskUpdate,
  onDeleteTask,
  currentUser,
  onFilteredTasksChange,
  onFilterActivityChange,
  resetFiltersKey = 0,
  excludeTasksWithoutProject = false,
  openTaskId = null,
  onTaskModalClose,
  selectedEmployeeId = null,
  onEmployeeClick,
}) {
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ field: null, direction: "asc" });
  const [selectedTask, setSelectedTask] = useState(null);

  const [statusFilters, setStatusFilters] = useState({
    created: true,
    in_progress: true,
    review: true,
    completed: true,
    cancelled: true,
    on_hold: true,
    blocked: true,
  });
  const [priorityFilters, setPriorityFilters] = useState({
    urgent: true,
    critical: true,
    high: true,
    medium: true,
    low: true,
  });
  const [myTasksFilter, setMyTasksFilter] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectFilters, setProjectFilters] = useState({ none: true });
  const [projectFilterSearch, setProjectFilterSearch] = useState('');

  const [contextMenu, setContextMenu] = useState({ type: null, x: 0, y: 0 });
  const menuRef = useRef();
  const containerRef = useRef();

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setProjectsLoading(true);
        const data = await projectService.getProjects();
        setProjects(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error loading projects for task table:', error);
        setProjects([]);
      } finally {
        setProjectsLoading(false);
      }
    };
    loadProjects();
  }, []);

  useEffect(() => {
    if (!openTaskId) return undefined;
    const id = Number(openTaskId);
    if (!Number.isFinite(id)) return undefined;
    const fromList = tasks.find((t) => t.id === id);
    if (fromList) {
      setSelectedTask(fromList);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const task = await getTask(id);
        if (!cancelled) setSelectedTask(task);
      } catch (error) {
        console.error('Error opening task from link:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openTaskId, tasks]);

  const sortedProjects = useMemo(
    () =>
      [...projects].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'ru')
      ),
    [projects]
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
      ])
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

  const getTaskProject = (task) => taskProjectMap.get(task.id) || null;

  const getProjectFilterKey = (task) => {
    const project = getTaskProject(task);
    return project ? String(project.id) : 'none';
  };

  const onRowClick = (task) => {
    const project = getTaskProject(task);
    setSelectedTask(
      project
        ? { ...task, project_id: project.id, project_name: project.name }
        : task
    );
  };

  const handleSort = (field) => {
    setSortConfig((prev) => {
      // Если кликаем на то же поле, меняем направление
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      // Если кликаем на новое поле, начинаем с возрастания
      return {
        field,
        direction: "asc",
      };
    });
  };

  const areFiltersActive = useMemo(() => {
    const projectFiltersActive = Object.entries(projectFilters).some(([key, value]) => {
      if (value !== false) return false;
      if (excludeTasksWithoutProject && key === 'none') return false;
      return true;
    });
    return (
      search.trim().length > 0 ||
      Object.values(statusFilters).some((v) => !v) ||
      Object.values(priorityFilters).some((v) => !v) ||
      projectFiltersActive ||
      myTasksFilter
    );
  }, [search, statusFilters, priorityFilters, projectFilters, myTasksFilter, excludeTasksWithoutProject]);

  useEffect(() => {
    if (!resetFiltersKey) return;
    setSearch('');
    setStatusFilters({
      created: true,
      in_progress: true,
      review: true,
      completed: true,
      cancelled: true,
      on_hold: true,
      blocked: true,
    });
    setPriorityFilters({
      urgent: true,
      critical: true,
      high: true,
      medium: true,
      low: true,
    });
    setMyTasksFilter(false);
    setProjectFilters(buildDefaultProjectFilters());
  }, [resetFiltersKey, sortedProjects, excludeTasksWithoutProject]);

  useEffect(() => {
    onFilterActivityChange?.(areFiltersActive);
  }, [areFiltersActive, onFilterActivityChange]);

  const handleContextMenu = (e, type) => {
    e.preventDefault();
    if (type === 'project') {
      setProjectFilterSearch('');
    }
    const headerRect = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    setContextMenu({
      type,
      x: headerRect.left - containerRect.left,
      y: headerRect.bottom - containerRect.top + 6,
    });
  };

  const closeMenu = () => setContextMenu({ type: null, x: 0, y: 0 });

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const toggleFilter = (type, value) => {
    if (type === "status") {
      setStatusFilters((prev) => ({ ...prev, [value]: !prev[value] }));
    } else if (type === "priority") {
      setPriorityFilters((prev) => ({ ...prev, [value]: !prev[value] }));
    } else if (type === "project") {
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
    if (type === 'status') return statusFilterLabels[key] || key;
    if (type === 'priority') return priorityFilterLabels[key] || key;
    if (key === 'none') return 'Без проекта';
    const project = sortedProjects.find((item) => String(item.id) === key);
    return project?.name || `Проект #${key}`;
  };

  const filteredTasks = useMemo(() => {
    let list = tasks
      .filter((t) => 
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase()) ||
        (t.executor_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (getTaskProject(t)?.name || '').toLowerCase().includes(search.toLowerCase())
      )
      .filter((t) => {
        const mappedStatus = normalizeTaskStatus(t.status);
        // Если статус есть в фильтрах, используем значение фильтра, иначе показываем задачу
        return statusFilters.hasOwnProperty(mappedStatus) ? statusFilters[mappedStatus] : true;
      })
        .filter((t) => {
        const mappedPriority = t.priority;
        return priorityFilters.hasOwnProperty(mappedPriority) ? priorityFilters[mappedPriority] : true;
      })
      .filter((t) => {
        const key = getProjectFilterKey(t);
        return projectFilters[key] !== false;
      });

    // Фильтр "Мои задачи"
    if (myTasksFilter && currentUser) {
      list = list.filter((t) => t.executor_id === currentUser.id);
    }

    if (sortConfig.field) {
      list.sort((a, b) => {
        let valA, valB;
        
        switch (sortConfig.field) {
          case "status":
            valA = statusOrder[a.status] || 999;
            valB = statusOrder[b.status] || 999;
            break;
          case "priority":
            valA = priorityOrder[a.priority] || 999;
            valB = priorityOrder[b.priority] || 999;
            break;
          case "due_date":
            valA = a.due_date ? new Date(a.due_date).getTime() : 0;
            valB = b.due_date ? new Date(b.due_date).getTime() : 0;
            break;
          case "created":
            valA = a.created ? new Date(a.created).getTime() : 0;
            valB = b.created ? new Date(b.created).getTime() : 0;
            break;
          case "executor":
            valA = (a.executor_name || '').toLowerCase();
            valB = (b.executor_name || '').toLowerCase();
            break;
          case "title":
            valA = (a.title || '').toLowerCase();
            valB = (b.title || '').toLowerCase();
            break;
          case "project":
            valA = (getTaskProject(a)?.name || '').toLowerCase();
            valB = (getTaskProject(b)?.name || '').toLowerCase();
            break;
          default:
            return 0;
        }
        
        // Для строковых значений используем localeCompare для правильной сортировки
        if (typeof valA === 'string' && typeof valB === 'string') {
          // Обрабатываем пустые строки - они должны быть в конце при сортировке по возрастанию
          if (valA === '' && valB !== '') return sortConfig.direction === "asc" ? 1 : -1;
          if (valB === '' && valA !== '') return sortConfig.direction === "asc" ? -1 : 1;
          if (valA === '' && valB === '') return 0;
          
          const result = valA.localeCompare(valB);
          return sortConfig.direction === "asc" ? result : -result;
        }
        
        // Для числовых значений (даты, статусы, приоритеты)
        // Пустые значения (0) должны быть в конце при сортировке по возрастанию
        if (valA === 0 && valB !== 0) return sortConfig.direction === "asc" ? 1 : -1;
        if (valB === 0 && valA !== 0) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA === 0 && valB === 0) return 0;
        
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [tasks, search, sortConfig, statusFilters, priorityFilters, projectFilters, myTasksFilter, currentUser, taskProjectMap]);

  useEffect(() => {
    onFilteredTasksChange?.(filteredTasks);
  }, [filteredTasks, onFilteredTasksChange]);

  const renderContextMenu = () => {
    const type = contextMenu.type;

    if (type === 'project') {
      const options = ['none', ...sortedProjects.map((project) => String(project.id))];
      const query = projectFilterSearch.trim().toLowerCase();
      const visibleOptions = options.filter((key) => {
        if (!query) return true;
        return getFilterLabel('project', key).toLowerCase().includes(query);
      });
      const activeCount = options.filter((key) => projectFilters[key] !== false).length;

      return (
        <div
          ref={menuRef}
          className="absolute z-50 w-80 overflow-hidden rounded-2xl border border-slate-600/50 bg-slate-900/95 shadow-2xl shadow-black/50 backdrop-blur-xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
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
                <button
                  type="button"
                  onClick={() => setFilterGroup('project', true)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/10"
                >
                  Все
                </button>
                <button
                  type="button"
                  onClick={() => setFilterGroup('project', false)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-slate-200"
                >
                  Сброс
                </button>
              </div>
            </div>
            <input
              type="search"
              value={projectFilterSearch}
              onChange={(event) => setProjectFilterSearch(event.target.value)}
              placeholder="Поиск проекта…"
              className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>

          <div className="max-h-64 space-y-1 overflow-y-auto p-2">
            {projectsLoading ? (
              <p className="px-3 py-2 text-sm text-slate-400">Загрузка проектов…</p>
            ) : visibleOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-400">Ничего не найдено</p>
            ) : (
              visibleOptions.map((key) => {
                const checked = projectFilters[key] !== false;
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                      checked
                        ? 'bg-slate-700/50 border border-slate-600/40'
                        : 'border border-transparent hover:bg-slate-800/80'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFilter('project', key)}
                      className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-cyan-500 focus:ring-2 focus:ring-cyan-500/40 focus:ring-offset-0"
                    />
                    <span className={`text-sm ${checked ? 'text-slate-100' : 'text-slate-400'}`}>
                      {getFilterLabel('project', key)}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      );
    }

    const options = type === "status" ? Object.keys(statusFilters) : Object.keys(priorityFilters);
    const state = type === "status" ? statusFilters : priorityFilters;
    const activeCount = Object.values(state).filter(Boolean).length;
    const menuTitle = type === 'status' ? 'Фильтр по статусу' : 'Фильтр по приоритету';

    return (
      <div
        ref={menuRef}
        className="absolute z-50 w-72 overflow-hidden rounded-2xl border border-slate-600/50 bg-slate-900/95 shadow-2xl shadow-black/50 backdrop-blur-xl"
        style={{ top: contextMenu.y, left: contextMenu.x }}
        onClick={(e) => e.stopPropagation()}
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
              <button
                type="button"
                onClick={() => setFilterGroup(type, true)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/10"
              >
                Все
              </button>
              <button
                type="button"
                onClick={() => setFilterGroup(type, false)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-slate-200"
              >
                Сброс
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto p-2">
          {options.map((key) => {
            const checked = state[key];
            return (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  checked
                    ? 'bg-slate-700/50 border border-slate-600/40'
                    : 'border border-transparent hover:bg-slate-800/80'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleFilter(type, key)}
                  className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-cyan-500 focus:ring-2 focus:ring-cyan-500/40 focus:ring-offset-0"
                />
                <span className={`text-sm ${checked ? 'text-slate-100' : 'text-slate-400'}`}>
                  {getFilterLabel(type, key)}
                </span>
                {type === 'status' ? (
                  <span className="ml-auto">
                    <TaskStatusIcon status={key} />
                  </span>
                ) : (
                  <span className="ml-auto">
                    <TaskPriorityIcon priority={key} />
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {currentUser && (
          <div className="border-t border-slate-700/60 p-2">
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                myTasksFilter
                  ? 'bg-blue-500/10 border border-blue-500/30'
                  : 'border border-transparent hover:bg-slate-800/80'
              }`}
            >
              <input
                type="checkbox"
                checked={myTasksFilter}
                onChange={(e) => setMyTasksFilter(e.target.checked)}
                className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-0"
              />
              <IconWithText icon={MyTasksIcon} className="text-sm text-slate-200">
                Мои задачи
              </IconWithText>
            </label>
          </div>
        )}
      </div>
    );
  };

  return (
  <div ref={containerRef} className="flex flex-col flex-1 min-h-0 gap-4 relative">
    <div className="flex items-center space-x-2 flex-shrink-0">
      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск задач..."
        className="flex-grow md:max-w-sm"
      />
      
      {/* Галочка "Мои задачи" */}
      {currentUser && (
        <label className="flex items-center space-x-2 px-3 py-2 bg-slate-800/60 backdrop-blur-sm rounded-md border border-slate-600 hover:border-slate-500 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={myTasksFilter}
            onChange={(e) => setMyTasksFilter(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
          />
          <IconWithText icon={MyTasksIcon} className="text-sm text-slate-300 whitespace-nowrap">
            Мои задачи
          </IconWithText>
        </label>
      )}
      
      {areFiltersActive && (
        <button
          onClick={() => {
            setStatusFilters({ 
              created: true, 
              in_progress: true, 
              review: true, 
              completed: true, 
              cancelled: true, 
              on_hold: true, 
              blocked: true 
            });
            setPriorityFilters({ 
              urgent: true, 
              critical: true, 
              high: true, 
              medium: true, 
              low: true 
            });
            setProjectFilters(
              Object.fromEntries(
                ['none', ...sortedProjects.map((project) => String(project.id))].map((key) => [key, true])
              )
            );
            setMyTasksFilter(false);
          }}
          title="Очистить все фильтры"
          className="flex-shrink-0 p-2 text-gray-500 hover:text-red-500 rounded-md transition"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 9.293l4.146-4.147a1 1 0 011.415 1.415L11.414 10.7l4.147 4.146a1 1 0 01-1.415 1.415L10 12.12l-4.146 4.147a1 1 0 01-1.415-1.415L8.586 10.7 4.439 6.554a1 1 0 111.415-1.415L10 9.293z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
      {sortConfig.field && (
        <button
          onClick={() => setSortConfig({ field: null, direction: "asc" })}
          title="Сбросить сортировку"
          className="flex-shrink-0 p-2 text-gray-500 hover:text-blue-500 rounded-md transition"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>

    <div className="flex flex-col flex-1 min-h-0 rounded-md">
      <div className="text-xs text-slate-400 mb-2 px-2 flex-shrink-0">
        <IconWithText icon={LightbulbIcon} className="inline-flex">
          Нажмите на заголовки колонок для сортировки задач. ПКМ по «Статус», «Проект» или «Приоритет» — фильтр.
        </IconWithText>
        {sortConfig.field && (
          <span className="ml-2 text-green-400">
            Сортировка по: <strong>{sortConfig.field}</strong> ({sortConfig.direction === "asc" ? "по возрастанию" : "по убыванию"})
          </span>
        )}
        {/* Счетчик задач */}
        <div className="mt-2 text-blue-400">
          {myTasksFilter ? (
            <span>
            <IconWithText icon={MyTasksIcon}>
              Показано <strong>{filteredTasks.length}</strong> ваших задач
            </IconWithText>
              {tasks.length !== filteredTasks.length && (
                <span className="text-slate-400"> (отфильтровано из {tasks.length} всего)</span>
              )}
            </span>
          ) : (
            <span>
            <IconWithText icon={TasksIcon}>
              Показано <strong>{filteredTasks.length}</strong> задач
            </IconWithText>
              {tasks.length !== filteredTasks.length && (
                <span className="text-slate-400"> (отфильтровано из {tasks.length} всего)</span>
              )}
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto rounded-md">
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-slate-300 text-sm bg-slate-800/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-700/50">
            <th
              className="px-3 py-2 cursor-pointer relative hover:bg-slate-700/60 transition-colors"
              onClick={() => handleSort("status")}
              onContextMenu={(e) => handleContextMenu(e, "status")}
            >
              <div className="flex items-center justify-between">
                Статус
                <span className="ml-2 text-slate-400">
                  {sortConfig.field === "status" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                </span>
              </div>
            </th>
            <th 
              className="px-3 py-2 cursor-pointer hover:bg-slate-700/60 transition-colors"
              onClick={() => handleSort("title")}
            >
              <div className="flex items-center justify-between">
                Задача
                <span className="ml-2 text-slate-400">
                  {sortConfig.field === "title" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                </span>
              </div>
            </th>
            <th
              className="px-3 py-2 cursor-pointer relative hover:bg-slate-700/60 transition-colors"
              onClick={() => handleSort("project")}
              onContextMenu={(e) => handleContextMenu(e, "project")}
            >
              <div className="flex items-center justify-between">
                Проект
                <span className="ml-2 text-slate-400">
                  {sortConfig.field === "project" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                </span>
              </div>
            </th>
            <th
              className="px-3 py-2 cursor-pointer hover:bg-slate-700/60 transition-colors"
              onClick={() => handleSort("executor")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  Исполнитель
                  {myTasksFilter && (
                    <span className="text-xs bg-slate-600 text-white px-2 py-1 rounded-full inline-flex items-center gap-1">
                      <MyTasksIcon size="xs" />
                      Мои задачи
                    </span>
                  )}
                </div>
                <span className="ml-2 text-slate-400">
                  {sortConfig.field === "executor" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                </span>
              </div>
            </th>
            <th
              className="px-3 py-2 cursor-pointer hover:bg-slate-700/60 transition-colors"
              onClick={() => handleSort("created")}
            >
              <div className="flex items-center justify-between">
                Создано
                <span className="ml-2 text-slate-400">
                  {sortConfig.field === "created" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                </span>
              </div>
            </th>
            <th
              className="px-3 py-2 cursor-pointer hover:bg-slate-700/60 transition-colors"
              onClick={() => handleSort("due_date")}
            >
              <div className="flex items-center justify-between">
                Срок
                <span className="ml-2 text-slate-400">
                  {sortConfig.field === "due_date" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                </span>
              </div>
            </th>
            <th
              className="px-3 py-2 cursor-pointer hover:bg-slate-700/60 transition-colors"
              onClick={() => handleSort("priority")}
              onContextMenu={(e) => handleContextMenu(e, "priority")}
            >
              <div className="flex items-center justify-between">
                Приоритет
                <span className="ml-2 text-slate-400">
                  {sortConfig.field === "priority" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-6 text-slate-400">
                  <IconWithText icon={RefreshIcon} className="inline-flex">
                    Загрузка задач...
                  </IconWithText>
                </td>
              </tr>
            ) : filteredTasks.length > 0 ? (
              filteredTasks.map((task, i) => (
                <tr
                  key={i}
                  className="bg-slate-800/40 backdrop-blur-sm hover:bg-slate-700/50 transition-all duration-300 cursor-pointer border border-slate-700/30"
                  onClick={() => onRowClick(task)}
                >
                  <td className="px-3 py-2">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-3 py-2 text-white">
                    <div>
                      <div className="font-medium">{task.title}</div>
                      {task.goal_id && (
                        <div className="mt-1">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                            Цель стратегии #{task.goal_id}
                          </span>
                        </div>
                      )}
                      {task.description && (
                        <div className="text-xs text-slate-400 mt-1 truncate max-w-xs">
                          {task.description}
                        </div>
                      )}
                      {task.tags && task.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {task.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-300 text-sm">
                    {(() => {
                      const project = getTaskProject(task);
                      if (!project) {
                        return <span className="text-slate-500 italic">—</span>;
                      }
                      return (
                        <span
                          className="inline-flex max-w-[180px] truncate rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-100"
                          title={project.name}
                        >
                          {project.name}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {task.executor_id ? (
                      <EmployeeHoverTrigger
                        employee={{ id: task.executor_id, name: task.executor_name || 'Исполнитель' }}
                        className="inline-flex max-w-full cursor-pointer"
                      >
                        <div
                          className={`flex items-center max-w-full rounded-lg px-1.5 py-1 -mx-1.5 text-left transition-colors cursor-pointer ${
                            selectedEmployeeId === task.executor_id
                              ? 'bg-cyan-500/15 ring-1 ring-cyan-400/40'
                              : 'hover:bg-slate-600/40'
                          }`}
                          title={
                            selectedEmployeeId === task.executor_id
                              ? 'Сбросить фильтр по сотруднику'
                              : 'Фильтровать панель по этому сотруднику'
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            onEmployeeClick?.({
                              id: task.executor_id,
                              name: task.executor_name || 'Исполнитель',
                            });
                          }}
                        >
                          <div className={`w-6 h-6 rounded-full mr-2 flex items-center justify-center text-xs text-white flex-shrink-0 ${
                            task.executor_id === currentUser?.id
                              ? 'bg-green-500 ring-2 ring-green-300'
                              : 'bg-green-500'
                          }`}>
                            {task.executor_name ? task.executor_name.split(' ').map((n) => n[0]).join('') : 'N/A'}
                          </div>
                          <span className={`text-sm truncate ${
                            selectedEmployeeId === task.executor_id
                              ? 'font-semibold text-cyan-200'
                              : task.executor_id === currentUser?.id
                                ? 'font-semibold text-green-300'
                                : ''
                          }`}>
                            {task.executor_id === currentUser?.id
                              ? `${task.executor_name || 'Не назначен'} (Вы)`
                              : task.executor_name || 'Не назначен'}
                          </span>
                        </div>
                      </EmployeeHoverTrigger>
                    ) : (
                      <span className="text-sm text-slate-500 italic">Не назначен</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-300 text-sm">
                    {new Date(task.created).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "2-digit"
                    })}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {task.due_date ? 
                      new Date(task.due_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      }) : 
                      <span className="text-gray-500 italic">Без срока</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    <span 
                      className={`px-2 py-1 rounded text-sm flex items-center justify-center ${
                        task.priority === 'urgent' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                        task.priority === 'critical' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' :
                        task.priority === 'high' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                        task.priority === 'medium' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                      title={
                        task.priority === 'urgent' ? 'Срочно' :
                        task.priority === 'critical' ? 'Критично' :
                        task.priority === 'high' ? 'Высокий' :
                        task.priority === 'medium' ? 'Средний' :
                        'Низкий'
                      }
                    >
                      <TaskPriorityIcon priority={task.priority} />
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center py-6 text-slate-400">
                  {tasks.length === 0 ? (
                    'Задачи не найдены. Создайте первую задачу!'
                  ) : (
                    <IconWithText icon={SearchIcon} className="inline-flex justify-center">
                      Задачи не найдены по вашим фильтрам
                    </IconWithText>
                  )}
                </td>
              </tr>
            )}
          </tbody>
      </table>
      </div>
    </div>

      {contextMenu.type && renderContextMenu()}

      {/* Рендерим модальное окно с деталями */}
      {selectedTask && (
        <TaskDetails 
          task={selectedTask} 
          onClose={() => {
            setSelectedTask(null);
            onTaskModalClose?.();
          }} 
          onTaskUpdate={onTaskUpdate}
          onDelete={onDeleteTask && canDeleteTask(selectedTask, currentUser) ? onDeleteTask : undefined}
          currentUser={currentUser}
        />
      )}

    </div>
);
}