import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import TaskSidebar from "./components/TaskSidebar";
import TaskTable from "./components/TaskTable";
import ProgressChart from "./components/ProgressChart";
import BarChart from "./components/BarChart";
import TeamRatings from "./components/TeamRatings";
import CreateTaskModal from "./components/CreateTaskModal";
import Notification from "../../components/Notification";
import DraggableGrid from "../../components/DraggableGrid";
import { getTasks, createTask, deleteTask } from "../../services/taskService";
import { projectService } from "../../services/projectService";
import { applyStatsScope, formatStatsScopeLabel, canFilterOverdueTasks, isTaskOverdue } from "./utils/performanceUtils";
import KanbanBoard from './components/KanbanBoard';
import TaskCalendar from './components/TaskCalendar';
import {
  CalendarViewIcon,
  ChartIcon,
  CleanIcon,
  CreateIcon,
  IconWithText,
  KanbanIcon,
  RefreshIcon,
  TableViewIcon,
  TasksIcon,
  WarningIcon,
} from './components/TaskManagerIcons';

// Импортируем вкладки
import FilesPage from './tabs/files/FilesPage';
import OverviewPage from './tabs/overview/OverviewPage';
import Projects from './tabs/projects/Projects';
import StatisticsPage from './tabs/statistics/StatisticsPage';
import Teams from './tabs/teams/Teams';
import taskStyles from './TaskApp.module.css';

const TaskApp = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('Задачи');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban' | 'calendar'
  const [isStatisticsExpanded, setIsStatisticsExpanded] = useState(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState(null);
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState(null);
  const [overdueFilter, setOverdueFilter] = useState(false);
  const [statsScope, setStatsScope] = useState(null);
  const [performanceContext, setPerformanceContext] = useState({
    segment: null,
    teams: [],
    projects: [],
  });
  const [tableFilteredTasks, setTableFilteredTasks] = useState(null);
  const [tableFiltersActive, setTableFiltersActive] = useState(false);
  const [calendarFilteredTasks, setCalendarFilteredTasks] = useState(null);
  const [calendarFiltersActive, setCalendarFiltersActive] = useState(false);
  const [tableFiltersResetKey, setTableFiltersResetKey] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const [deepLinkTaskId, setDeepLinkTaskId] = useState(null);
  const [deepLinkProjectId, setDeepLinkProjectId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    const tabMap = {
      overview: 'Обзор',
      statistics: 'Статистика',
      tasks: 'Задачи',
      projects: 'Проекты',
      teams: 'Команды',
    };
    if (tabParam && tabMap[tabParam]) {
      setActiveTab(tabMap[tabParam]);
      if (tabParam === 'tasks') {
        setIsStatisticsExpanded(true);
      }
    }

    const teamId = Number(params.get('team'));
    if (params.has('team') && !Number.isNaN(teamId) && teamId > 0) {
      setActiveTab('Задачи');
      setIsStatisticsExpanded(true);
      setStatsScope({
        type: 'team',
        id: teamId,
        teamId,
        label: params.get('label') || 'Команда',
      });
    }

    const projectId = Number(params.get('project'));
    if (params.has('project') && !Number.isNaN(projectId) && projectId > 0) {
      setActiveTab('Проекты');
      setDeepLinkProjectId(projectId);
    } else {
      setDeepLinkProjectId(null);
    }

    const taskId = params.get('task');
    if (!taskId) {
      setDeepLinkTaskId(null);
      return;
    }
    const parsed = Number(taskId);
    if (!Number.isNaN(parsed)) {
      setActiveTab('Задачи');
      setViewMode('table');
      setDeepLinkTaskId(parsed);
    }
  }, [location.search]);

  const clearTaskDeepLink = () => {
    const params = new URLSearchParams(location.search);
    if (!params.has('task')) return;
    params.delete('task');
    const next = params.toString();
    navigate(next ? `${location.pathname}?${next}` : location.pathname, { replace: true });
  };

  // Фильтрация задач по выбранным фильтрам
  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    if (overdueFilter) {
      filtered = filtered.filter((task) => isTaskOverdue(task));
    }
    
    if (selectedStatusFilter) {
      filtered = filtered.filter(task => task.status === selectedStatusFilter);
    }
    
    if (selectedPriorityFilter) {
      filtered = filtered.filter(task => task.priority === selectedPriorityFilter);
    }
    
    return filtered;
  }, [tasks, selectedStatusFilter, selectedPriorityFilter, overdueFilter]);

  const displayTasksForStats = useMemo(() => {
    let base;
    if (viewMode === 'table' && tableFilteredTasks !== null) {
      base = tableFilteredTasks;
    } else if (viewMode === 'calendar' && calendarFilteredTasks !== null) {
      base = calendarFilteredTasks;
    } else if (selectedStatusFilter || selectedPriorityFilter) {
      base = filteredTasks;
    } else {
      base = tasks;
    }
    return base;
  }, [
    viewMode,
    tableFilteredTasks,
    calendarFilteredTasks,
    tasks,
    filteredTasks,
    selectedStatusFilter,
    selectedPriorityFilter,
  ]);

  const widgetTasks = useMemo(() => {
    return applyStatsScope(displayTasksForStats, statsScope, performanceContext);
  }, [displayTasksForStats, statsScope, performanceContext]);

  const tasksForList = useMemo(() => {
    let list = selectedStatusFilter || selectedPriorityFilter || overdueFilter ? filteredTasks : tasks;
    const teamMode =
      performanceContext.segment === 'teams'
      || statsScope?.type === 'team'
      || (statsScope?.type === 'employee' && (statsScope?.teamId != null || statsScope?.team_id != null));
    const hasScope = Boolean(
      statsScope?.type
      || statsScope?.taskIds?.length
      || statsScope?.userIds?.length,
    );
    if (teamMode || hasScope) {
      list = applyStatsScope(list, statsScope, performanceContext);
    }
    return list;
  }, [tasks, filteredTasks, selectedStatusFilter, selectedPriorityFilter, overdueFilter, statsScope, performanceContext]);

  const statsScopeLabel = formatStatsScopeLabel(statsScope, performanceContext);
  const showOverdueFilter = canFilterOverdueTasks(user, performanceContext);

  // Обработчики для фильтрации
  const handleStatusFilter = (status) => {
    if (selectedStatusFilter === status) {
      setSelectedStatusFilter(null); // Сброс фильтра при повторном клике
    } else {
      setSelectedStatusFilter(status);
      setSelectedPriorityFilter(null); // Сбрасываем фильтр приоритета при выборе статуса
    }
  };

  const handleOverdueChange = (next) => {
    setOverdueFilter(next);
    if (next && selectedStatusFilter === 'completed') {
      setSelectedStatusFilter(null);
    }
  };

  const handlePriorityFilter = (priority) => {
    if (selectedPriorityFilter === priority) {
      setSelectedPriorityFilter(null); // Сброс фильтра при повторном клике
    } else {
      setSelectedPriorityFilter(priority);
      setSelectedStatusFilter(null); // Сбрасываем фильтр статуса при выборе приоритета
    }
  };

  const handleEmployeeFilter = (employee) => {
    if (!employee?.id) return;
    setStatsScope((prev) => {
      if (prev?.type === 'employee' && prev.id === employee.id) {
        if (prev.teamId != null) {
          return {
            type: 'team',
            id: prev.teamId,
            teamId: prev.teamId,
            label: prev.teamLabel || 'Команда',
          };
        }
        return null;
      }
      const teamId = prev?.type === 'team' ? prev.id : prev?.teamId;
      const teamLabel = prev?.type === 'team' ? prev.label : prev?.teamLabel;
      return {
        type: 'employee',
        id: employee.id,
        label: employee.name || `Сотрудник #${employee.id}`,
        userIds: [employee.id],
        ...(teamId != null ? { teamId, teamLabel } : {}),
      };
    });
  };

  const handleClearFilters = () => {
    setSelectedStatusFilter(null);
    setSelectedPriorityFilter(null);
    setOverdueFilter(false);
    setStatsScope(null);
    setTableFiltersResetKey((key) => key + 1);
  };

  useEffect(() => {
    if (viewMode !== 'table') {
      setTableFilteredTasks(null);
    }
    if (viewMode !== 'calendar') {
      setCalendarFilteredTasks(null);
    }
  }, [viewMode]);

  useEffect(() => {
    loadData();
  }, []);

  // Обновляем данные при возвращении на страницу задач (только если данные устарели)
  useEffect(() => {
    if (location.pathname === '/tasks' && tasks.length === 0) {
      // Загружаем данные только если их нет
      loadData();
    }
  }, [location.pathname]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Загружаем только задачи
      const tasksData = await getTasks();
            
      // Фильтруем тестовые задачи
      const filteredTasks = tasksData.filter(task => {
        const isTestTask = 
          task.title?.includes('Test Task') ||
          task.title?.includes('Test') ||
          task.description?.includes('test') ||
          task.description?.includes('Test');
        
        return !isTestTask;
      });
      
                  setTasks(filteredTasks);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Не удалось загрузить данные. Пожалуйста, обновите страницу.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (taskData) => {
    try {
      setError(null);
      const projectId = taskData.project_id || null;
      const payload = { ...taskData };
      delete payload.project_id;

                  
      // Добавляем owner_id если не указан
      if (!payload.owner_id && user) {
        payload.owner_id = user.id;
      }
      
      const createdTask = await createTask(payload);
      
      if (projectId && createdTask?.id) {
        await projectService.addTaskToProject(projectId, createdTask.id);
      }
      
      await loadData();
      setShowCreateModal(false);
      setNotification({
        message: projectId
          ? 'Задача создана и привязана к проекту'
          : 'Задача успешно создана',
        type: 'success',
      });
    } catch (error) {
      console.error('Error creating task:', error);
      console.error('Error response:', error.response);
      console.error('Error details:', error.response?.data);
      setNotification({ message: `Failed to create task: ${error.response?.data?.detail || error.message}`, type: 'error' });
    }
  };

  const handleTaskUpdate = async () => {
    try {
            await loadData(); // Перезагружаем данные после обновления
          } catch (error) {
      console.error('❌ Error updating tasks:', error);
      setError('Failed to update tasks. Please refresh the page.');
    }
  };

  const handleDeleteTask = async (task) => {
    try {
      await deleteTask(task.id);
      await handleTaskUpdate();
      setNotification({ message: 'Задача удалена', type: 'success' });
    } catch (error) {
      console.error('Error deleting task:', error);
      setNotification({
        message: error.response?.data?.detail || 'Не удалось удалить задачу',
        type: 'error',
      });
    }
  };

  const clearTestTasks = async () => {
    try {
      setLoading(true);
      
      // Получаем все задачи
      const allTasks = await getTasks();
      
      // Находим тестовые задачи
      const testTasks = allTasks.filter(task => {
        const isTestTask = 
          task.title?.includes('Test Task') ||
          task.title?.includes('Test') ||
          task.description?.includes('test') ||
          task.description?.includes('Test');
        
        return isTestTask;
      });
      
      // Удаляем тестовые задачи
      for (const task of testTasks) {
        try {
          await deleteTask(task.id);
        } catch (error) {
          console.error(`Error deleting test task ${task.id}:`, error);
        }
      }
      
      // Перезагружаем данные
      await loadData();
      setNotification({ 
        message: `Cleared ${testTasks.length} test tasks`, 
        type: 'success' 
      });
    } catch (error) {
      console.error('Error clearing test tasks:', error);
      setNotification({ 
        message: 'Failed to clear test tasks', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] p-6 animate-fadeIn">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-br from-[#1e293b] to-[#334155] rounded-2xl shadow-2xl border border-slate-700 p-8 backdrop-filter backdrop-blur-xl">
            <div className="text-center py-16 animate-scaleIn">
              <WarningIcon size="4xl" className="mb-6 animate-bounce text-amber-400 mx-auto" />
              <div className="text-red-400 text-2xl font-semibold mb-4">Ошибка загрузки данных</div>
              <div className="text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">{error}</div>
              <button 
                onClick={loadData}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-8 py-4 rounded-xl 
                         hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 
                         transform hover:scale-105 hover:shadow-xl font-medium
                         focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
              >
                <IconWithText icon={RefreshIcon}>
                  Попробовать снова
                </IconWithText>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Задачи':
        return (
          <div
            className={
              isStatisticsExpanded
                ? 'flex flex-col min-h-[calc(100vh-260px)]'
                : 'flex flex-col flex-1 min-h-0'
            }
          >
            <div
              className={
                isStatisticsExpanded
                  ? 'mt-6 flex flex-col lg:flex-row gap-6 flex-1 min-h-[calc(100vh-320px)]'
                  : 'mt-6 flex flex-col lg:flex-row gap-6 flex-1 min-h-0'
              }
            >
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 flex-shrink-0">
                  <div className="animate-slideInLeft">
                    <h1 className="text-3xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
                      <TasksIcon size="lg" className="text-blue-400" />
                      Управление задачами
                    </h1>
                    <p className="text-slate-400 mt-1">Организуйте и отслеживайте свои проекты</p>
                  </div>
                  <div className="flex flex-wrap gap-3 animate-slideInRight">
                    {tasks.some(task => 
                      task.title?.includes('Test Task') || 
                      task.title?.includes('Test')
                    ) && (
                      <button 
                        onClick={clearTestTasks}
                        className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2.5 rounded-xl
                                 hover:from-orange-600 hover:to-red-600 transition-all duration-300 
                                 transform hover:scale-105 hover:shadow-lg font-medium
                                 focus:outline-none focus:ring-4 focus:ring-orange-500/50"
                        title="Очистить тестовые задачи"
                      >
                        <IconWithText icon={CleanIcon}>
                          Очистить тестовые
                        </IconWithText>
                      </button>
                    )}
                    
                    {/* Переключатель режимов отображения задач */}
                    <div className="flex items-center bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 rounded-xl overflow-hidden shadow-lg">
                      <button
                        className={`min-w-[5.5rem] px-3 py-2.5 text-sm font-medium transition-all duration-300 flex items-center justify-center gap-1 ${
                          viewMode === 'table' 
                            ? 'bg-slate-600 text-slate-100 shadow-md border-r border-slate-500' 
                            : 'text-slate-300 bg-transparent hover:bg-slate-700/40 hover:text-slate-100'
                        }`}
                        onClick={() => setViewMode('table')}
                        title="Таблица"
                      >
                        <TableViewIcon size="xs" />
                        <span>Таблица</span>
                      </button>
                      <button
                        className={`min-w-[5.5rem] px-3 py-2.5 text-sm font-medium transition-all duration-300 flex items-center justify-center gap-1 ${
                          viewMode === 'kanban' 
                            ? 'bg-slate-600 text-slate-100 shadow-md border-x border-slate-500' 
                            : 'text-slate-300 bg-transparent hover:bg-slate-700/40 hover:text-slate-100'
                        }`}
                        onClick={() => setViewMode('kanban')}
                        title="Канбан-доска"
                      >
                        <KanbanIcon size="xs" />
                        <span>Канбан</span>
                      </button>
                      <button
                        className={`min-w-[5.5rem] px-3 py-2.5 text-sm font-medium transition-all duration-300 flex items-center justify-center gap-1 ${
                          viewMode === 'calendar'
                            ? 'bg-slate-600 text-slate-100 shadow-md border-l border-slate-500'
                            : 'text-slate-300 bg-transparent hover:bg-slate-700/40 hover:text-slate-100'
                        }`}
                        onClick={() => setViewMode('calendar')}
                        title="Календарь задач"
                      >
                        <CalendarViewIcon size="xs" />
                        <span>Календарь</span>
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => setShowCreateModal(true)}
                      className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-6 py-2.5 rounded-xl
                               hover:from-slate-700 hover:to-slate-800 transition-all duration-300 
                               transform hover:scale-105 hover:shadow-xl font-medium
                               focus:outline-none focus:ring-4 focus:ring-slate-500/50"
                    >
                      <IconWithText icon={CreateIcon}>
                        Новая задача
                      </IconWithText>
                    </button>
                    
                    <button 
                      onClick={loadData}
                      disabled={loading}
                      className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white px-4 py-2.5 rounded-xl
                               hover:from-blue-600 hover:to-cyan-700 transition-all duration-300 
                               transform hover:scale-105 hover:shadow-lg font-medium disabled:opacity-50 
                               disabled:cursor-not-allowed disabled:transform-none
                               focus:outline-none focus:ring-4 focus:ring-blue-500/50"
                      title="Обновить данные"
                    >
                      {loading ? (
                        <RefreshIcon className="animate-spin" size="sm" />
                      ) : (
                        <RefreshIcon size="sm" />
                      )}
                    </button>
                  </div>
                </div>
                {viewMode === 'table' ? (
                  <TaskTable 
                    tasks={tasksForList} 
                    loading={loading} 
                    onTaskUpdate={handleTaskUpdate}
                    onDeleteTask={handleDeleteTask}
                    currentUser={user}
                    onFilteredTasksChange={setTableFilteredTasks}
                    onFilterActivityChange={setTableFiltersActive}
                    resetFiltersKey={tableFiltersResetKey}
                    openTaskId={deepLinkTaskId}
                    onTaskModalClose={clearTaskDeepLink}
                    selectedEmployeeId={statsScope?.type === 'employee' ? statsScope.id : null}
                    onEmployeeClick={handleEmployeeFilter}
                  />
                ) : viewMode === 'kanban' ? (
                  <KanbanBoard 
                    tasks={tasksForList} 
                    currentUser={user}
                    onTaskUpdate={handleTaskUpdate}
                    onDeleteTask={handleDeleteTask}
                  />
                ) : (
                  <TaskCalendar
                    tasks={tasksForList}
                    loading={loading}
                    currentUser={user}
                    onTaskUpdate={handleTaskUpdate}
                    onDeleteTask={handleDeleteTask}
                    onFilteredTasksChange={setCalendarFilteredTasks}
                    onFilterActivityChange={setCalendarFiltersActive}
                    resetFiltersKey={tableFiltersResetKey}
                  />
                )}
              </div>

            </div>
          </div>
        );
      case 'Обзор':
        return <OverviewPage user={user} />;
      case 'Статистика':
        return <StatisticsPage />;
      case 'Проекты':
        return <Projects user={user} onLogout={onLogout} deepLinkProjectId={deepLinkProjectId} />;
      case 'Команды':
        return <Teams user={user} onLogout={onLogout} />;
      case 'Файлы':
        return <FilesPage user={user} />;
      default:
        return null;
    }
  };

  return (
    <div className={taskStyles.workspace}>
      <TaskSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main
        className={`${taskStyles.main} ${
          activeTab === 'Задачи' && isStatisticsExpanded ? taskStyles.mainExpandedStats : ''
        }`}
      >
        {activeTab === 'Задачи' && (
          <div className={taskStyles.topBar}>
            <button
              type="button"
              onClick={() => setIsStatisticsExpanded(!isStatisticsExpanded)}
              className={taskStyles.statsToggle}
              aria-label={isStatisticsExpanded ? 'Скрыть статистику' : 'Показать статистику'}
            >
              <svg
                className={`${taskStyles.statsToggleIcon} ${isStatisticsExpanded ? taskStyles.statsToggleIconExpanded : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <IconWithText icon={ChartIcon}>
                Статистика
              </IconWithText>
            </button>
          </div>
        )}

        {activeTab === 'Задачи' && isStatisticsExpanded && (
          <div className={`${taskStyles.statsPanel} space-y-6 animate-fadeIn`}>
            {/* Индикатор активных фильтров */}
            {(selectedStatusFilter || selectedPriorityFilter || overdueFilter || statsScope || tableFiltersActive || calendarFiltersActive) && (
              <div className="flex items-center gap-3 p-3 bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700/50 flex-wrap">
                <span className="text-sm text-slate-300">Активные фильтры:</span>
                {tableFiltersActive && viewMode === 'table' && tableFilteredTasks && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/50">
                    Таблица: {tableFilteredTasks.length} задач
                  </span>
                )}
                {calendarFiltersActive && viewMode === 'calendar' && calendarFilteredTasks && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/50">
                    Календарь: {calendarFilteredTasks.length} задач
                  </span>
                )}
                {statsScopeLabel && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/50">
                    {statsScopeLabel}
                  </span>
                )}
                {overdueFilter && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/50">
                    Просроченные
                  </span>
                )}
                {selectedStatusFilter && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/50">
                    Статус: {selectedStatusFilter}
                  </span>
                )}
                {selectedPriorityFilter && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/50">
                    Приоритет: {selectedPriorityFilter}
                  </span>
                )}
                <button
                  onClick={handleClearFilters}
                  className="ml-auto px-3 py-1 rounded-lg text-xs font-medium bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 transition-all"
                >
                  Сбросить фильтры
                </button>
              </div>
            )}
            <DraggableGrid
              user={user}
              enableDragAndDrop
              layoutType="task-widgets"
            >
              <div data-card-id="progress-chart">
                <ProgressChart
                  tasks={widgetTasks}
                  onStatusClick={handleStatusFilter}
                  selectedStatus={selectedStatusFilter}
                  canFilterOverdue={showOverdueFilter}
                  overdueOnly={overdueFilter}
                  onOverdueChange={handleOverdueChange}
                />
              </div>
              <div data-card-id="bar-chart">
                <BarChart
                  tasks={widgetTasks}
                  onPriorityClick={handlePriorityFilter}
                  selectedPriority={selectedPriorityFilter}
                  scopeLabel={statsScopeLabel}
                />
              </div>
              <div data-card-id="team-ratings">
                <TeamRatings
                  tasks={displayTasksForStats}
                  user={user}
                  statsScope={statsScope}
                  onScopeChange={setStatsScope}
                  onPerformanceContextChange={setPerformanceContext}
                />
              </div>
            </DraggableGrid>
          </div>
        )}

        <div className={taskStyles.contentPanel}>
          <div
            key={activeTab}
            className={`${taskStyles.tabContent} ${activeTab === 'Задачи' ? taskStyles.tabContentFill : ''}`}
          >
            {renderTabContent()}
          </div>
        </div>
      </main>

      {/* Модальное окно создания задачи - показываем только на вкладке Задачи */}
      {showCreateModal && activeTab === 'Задачи' && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateTask}
        />
      )}

      {/* Уведомления */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default TaskApp;