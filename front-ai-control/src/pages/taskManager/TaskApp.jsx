import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HeaderTabs from "./components/HeaderTabs";
import TaskTable from "./components/TaskTable";
import ProgressChart from "./components/ProgressChart";
import BarChart from "./components/BarChart";
import TeamRatings from "./components/TeamRatings";
import CreateTaskModal from "./components/CreateTaskModal";
import Notification from "../../components/Notification";
import { getTasks, createTask, deleteTask } from "../../services/taskService";
import KanbanBoard from './components/KanbanBoard';

// Импортируем вкладки
import FilesPage from './tabs/files/FilesPage';
import OverviewPage from './tabs/overview/OverviewPage';
import Projects from './tabs/projects/Projects';
import StatisticsPage from './tabs/statistics/StatisticsPage';
import Teams from './tabs/teams/Teams';

const TaskApp = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('Задачи');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban'
  const navigate = useNavigate();
  const location = useLocation();

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
      console.log('Raw tasks from API:', tasksData);
      
      // Фильтруем тестовые задачи
      const filteredTasks = tasksData.filter(task => {
        const isTestTask = 
          task.title?.includes('Test Task') ||
          task.title?.includes('Test') ||
          task.description?.includes('test') ||
          task.description?.includes('Test');
        
        return !isTestTask;
      });
      
      console.log('Filtered tasks:', filteredTasks);
      console.log('Tasks with statuses:', filteredTasks.map(t => ({ id: t.id, title: t.title, status: t.status })));
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
      console.log('Creating task with data:', taskData);
      console.log('Task status being sent:', taskData.status);
      
      // Добавляем owner_id если не указан
      if (!taskData.owner_id && user) {
        taskData.owner_id = user.id;
      }
      
      const createdTask = await createTask(taskData);
      console.log('Task created successfully:', createdTask);
      console.log('Created task status:', createdTask.status);
      
      await loadData(); // Перезагружаем данные после создания
      setShowCreateModal(false);
      setNotification({ message: 'Task created successfully!', type: 'success' });
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
      console.error('Error updating tasks:', error);
      setError('Failed to update tasks. Please refresh the page.');
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
              <div className="text-6xl mb-6 animate-bounce">⚠️</div>
              <div className="text-red-400 text-2xl font-semibold mb-4">Ошибка загрузки данных</div>
              <div className="text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">{error}</div>
              <button 
                onClick={loadData}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-8 py-4 rounded-xl 
                         hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 
                         transform hover:scale-105 hover:shadow-xl font-medium
                         focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
              >
                🔄 Попробовать снова
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
          <>
            <div className="mt-6 flex flex-col lg:flex-row gap-6">
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                  <div className="animate-slideInLeft">
                    <h1 className="text-3xl font-bold text-slate-100 tracking-tight">
                      📋 Управление задачами
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
                        🧹 Очистить тестовые
                      </button>
                    )}
                    
                    {/* Переключатель режимов отображения задач */}
                    <div className="flex items-center bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 rounded-xl overflow-hidden shadow-lg">
                      <button
                        className={`w-24 px-3 py-2.5 text-sm font-medium transition-all duration-300 flex items-center justify-center gap-1 ${
                          viewMode === 'table' 
                            ? 'bg-slate-600 text-slate-100 shadow-md border-r border-slate-500' 
                            : 'text-slate-300 bg-transparent hover:bg-slate-700/40 hover:text-slate-100'
                        }`}
                        onClick={() => setViewMode('table')}
                        title="Таблица"
                      >
                        <span className="text-xs">📊</span>
                        <span>Таблица</span>
                      </button>
                      <button
                        className={`w-24 px-3 py-2.5 text-sm font-medium transition-all duration-300 flex items-center justify-center gap-1 ${
                          viewMode === 'kanban' 
                            ? 'bg-slate-600 text-slate-100 shadow-md border-l border-slate-500' 
                            : 'text-slate-300 bg-transparent hover:bg-slate-700/40 hover:text-slate-100'
                        }`}
                        onClick={() => setViewMode('kanban')}
                        title="Канбан-доска"
                      >
                        <span className="text-xs">🗂️</span>
                        <span>Канбан</span>
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => setShowCreateModal(true)}
                      className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-6 py-2.5 rounded-xl
                               hover:from-slate-700 hover:to-slate-800 transition-all duration-300 
                               transform hover:scale-105 hover:shadow-xl font-medium
                               focus:outline-none focus:ring-4 focus:ring-slate-500/50"
                    >
                      ✨ Новая задача
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
                        <span className="animate-spin inline-block">🔄</span>
                      ) : (
                        '🔄'
                      )}
                    </button>
                  </div>
                </div>
                {viewMode === 'table' ? (
                  <TaskTable 
                    tasks={tasks} 
                    loading={loading} 
                    onTaskUpdate={handleTaskUpdate} 
                    currentUser={user} 
                  />
                ) : (
                  <KanbanBoard 
                    tasks={tasks} 
                    currentUser={user}
                    onTaskUpdate={handleTaskUpdate}
                  />
                )}
              </div>

              <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
                <ProgressChart tasks={tasks} />
                <BarChart tasks={tasks} />
                <TeamRatings />
              </div>
            </div>
          </>
        );
      case 'Обзор':
        return <OverviewPage user={user} />;
      case 'Статистика':
        return <StatisticsPage />;
      case 'Проекты':
        return <Projects user={user} onLogout={onLogout} />;
      case 'Команды':
        return <Teams user={user} onLogout={onLogout} />;
      case 'Файлы':
        return <FilesPage user={user} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6 animate-fadeIn">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 p-6 sm:p-8 animate-scaleIn">
          <HeaderTabs activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="animate-fadeIn">
            <div key={activeTab} className="animate-scaleIn">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>

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