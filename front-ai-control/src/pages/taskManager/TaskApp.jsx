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

const TaskApp = ({ user, onLogout }) => {
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
      <div className="min-h-screen bg-gradient-to-b from-[#0D1414] to-[#16251C] p-6 text-sm">
        <div className="bg-gradient-to-b from-[#0D1414] to-[#16251C] rounded-xl shadow-md p-6">
          <div className="text-center py-12">
            <div className="text-red-400 text-xl mb-4">⚠️ Error Loading Data</div>
            <div className="text-gray-400 mb-6">{error}</div>
            <button 
              onClick={loadData}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0D1414] to-[#16251C] p-6 text-sm">
      <div className="bg-gradient-to-b from-[#0D1414] to-[#16251C] rounded-xl shadow-md p-6">
        <HeaderTabs />
        <div className="mt-6 flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">Задачи</h2>

              </div>
              <div className="flex gap-2">
                {tasks.some(task => 
                  task.title?.includes('Test Task') || 
                  task.title?.includes('Test')
                ) && (
                  <button 
                    onClick={clearTestTasks}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition"
                    title="Очистить тестовые задачи"
                  >
                    🧹 Очистить тестовые задачи
                  </button>
                )}
                {/* Переключатель режимов отображения задач */}
                <div className="flex items-center bg-[#16251C] border border-gray-700 rounded-lg overflow-hidden">
                  <button
                    className={`px-3 py-2 text-sm ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-[#1A2B24]'}`}
                    onClick={() => setViewMode('table')}
                    title="Таблица"
                  >
                    Таблица
                  </button>
                  <button
                    className={`px-3 py-2 text-sm ${viewMode === 'kanban' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-[#1A2B24]'}`}
                    onClick={() => setViewMode('kanban')}
                    title="Канбан-доска (скоро)"
                  >
                    Канбан (скоро)
                  </button>
                </div>
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                >
                  + Новая задача
                </button>
                <button 
                  onClick={loadData}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  title="Обновить данные"
                >
                  {loading ? '🔄' : '🔄'}
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
      </div>

      {/* Модальное окно создания задачи */}
      {showCreateModal && (
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