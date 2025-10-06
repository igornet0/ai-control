import React, { useMemo, useState } from 'react';
import { deleteTask, updateTask } from '../../../services/taskService';

const priorityOrder = { urgent: 1, critical: 2, high: 3, medium: 4, low: 5 };

const statusRu = {
  created: 'Создана',
  in_progress: 'В работе',
  review: 'На проверке',
  completed: 'Завершена',
  cancelled: 'Отменена',
  on_hold: 'На паузе',
  blocked: 'Заблокирована'
};

const priorityRu = {
  urgent: 'Срочно',
  critical: 'Критично',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий'
};

const typeRu = {
  task: 'Задача',
  bug: 'Ошибка',
  feature: 'Функция',
  story: 'История',
  epic: 'Эпик',
  subtask: 'Подзадача'
};

function TaskCard({ task, currentUser, onTaskUpdate, onCardClick }) {
  return (
    <div 
      className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-lg p-3 text-sm text-slate-100 cursor-pointer hover:bg-slate-700/50 transition-all duration-300"
      onClick={() => onCardClick(task)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium leading-snug break-words">{task.title}</div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
          task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
          task.priority === 'critical' ? 'bg-orange-100 text-orange-800' :
          task.priority === 'high' ? 'bg-yellow-100 text-yellow-800' :
          task.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-800'
        }`}>{priorityRu[task.priority] || task.priority}</span>
      </div>
      <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
        <span className="px-2 py-0.5 rounded bg-slate-700/50 border border-slate-600/50">{statusRu[task.status] || task.status}</span>
        {task.task_type && (
          <span className="px-2 py-0.5 rounded bg-slate-700/50 border border-slate-600/50">{typeRu[task.task_type] || task.task_type}</span>
        )}
      </div>
      <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
        <span>Исполнитель: {task.executor_name || 'Не назначен'}</span>
        <span>Срок: {task.due_date ? new Date(task.due_date).toLocaleDateString('ru-RU') : '—'}</span>
      </div>
    </div>
  );
}

function TaskActionModal({ task, currentUser, onClose, onTaskUpdate }) {
  const [loading, setLoading] = useState(false);

  const canDeleteTask = () => {
    if (!currentUser) return false;
    if (task.owner_id === currentUser.id) return true;
    if (currentUser.role === 'admin' || currentUser.role === 'CEO') return true;
    return false;
  };

  const canTakeTask = () => {
    if (!currentUser) return false;
    return !task.executor_id || task.executor_id !== currentUser.id;
  };

  const handleTakeTask = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const updateData = {
        executor_id: currentUser.id,
        status: 'in_progress'
      };
      
      await updateTask(task.id, updateData);
      onTaskUpdate();
      onClose();
    } catch (error) {
      console.error('Error taking task:', error);
      alert('Ошибка при взятии задачи');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!canDeleteTask()) return;
    
    if (!window.confirm('Вы уверены, что хотите удалить эту задачу? Это действие нельзя отменить.')) {
      return;
    }
    
    setLoading(true);
    try {
      await deleteTask(task.id);
      onTaskUpdate();
      onClose();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Ошибка при удалении задачи');
    } finally {
      setLoading(false);
    }
  };

  const handleReportTask = () => {
    // Заглушка для жалобы
    alert('Функция жалобы будет реализована в будущем');
  };

  const handleAskQuestion = () => {
    // Заглушка для вопроса
    alert('Функция вопроса будет реализована в будущем');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#16251C] rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Действия с задачей</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold leading-none"
          >
            ×
          </button>
        </div>
        
        <div className="mb-4 p-3 bg-[#0F1717] rounded border border-gray-600">
          <h4 className="font-medium text-white mb-2">{task.title}</h4>
          <div className="text-xs text-gray-400">
            <div>Статус: {statusRu[task.status] || task.status}</div>
            <div>Приоритет: {priorityRu[task.priority] || task.priority}</div>
            <div>Исполнитель: {task.executor_name || 'Не назначен'}</div>
          </div>
        </div>

        <div className="space-y-2">
          {canTakeTask() && (
            <button
              onClick={handleTakeTask}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded transition-colors"
            >
              {loading ? 'Загрузка...' : 'Взять задачу на себя'}
            </button>
          )}
          
          {canDeleteTask() && (
            <button
              onClick={handleDeleteTask}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white px-4 py-2 rounded transition-colors"
            >
              {loading ? 'Загрузка...' : 'Удалить задачу'}
            </button>
          )}
          
          <button
            onClick={handleReportTask}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded transition-colors"
          >
            Пожаловаться
          </button>
          
          <button
            onClick={handleAskQuestion}
            className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
          >
            Спросить вопрос
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KanbanBoard({ tasks = [], currentUser, onTaskUpdate }) {
  const [selectedTask, setSelectedTask] = useState(null);

  const columns = useMemo(() => {
    const byPriority = (a, b) => (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);

    const problem = [];
    const inWork = [];
    const review = [];
    const done = [];

    for (const t of tasks) {
      // Приоритизируем колонку "С проблемой" для on_hold/blocked, чтобы не дублировать в "В работе"
      if (t.status === 'on_hold' || t.status === 'blocked') {
        problem.push(t);
        continue;
      }
      if (t.status === 'in_progress' || t.status === 'created') {
        inWork.push(t);
        continue;
      }
      if (t.status === 'review') {
        review.push(t);
        continue;
      }
      if (t.status === 'completed' || t.status === 'cancelled') {
        done.push(t);
        continue;
      }
    }

    problem.sort(byPriority);
    inWork.sort(byPriority);
    review.sort(byPriority);
    done.sort(byPriority);

    return { problem, inWork, review, done };
  }, [tasks]);

  const handleCardClick = (task) => {
    setSelectedTask(task);
  };

  const handleCloseModal = () => {
    setSelectedTask(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-red-300 mb-2">С проблемой</h3>
          <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
            {columns.problem.length === 0 ? (
              <div className="text-xs text-slate-500">Нет задач</div>
            ) : (
              columns.problem.map(t => (
                <TaskCard 
                  key={t.id} 
                  task={t} 
                  currentUser={currentUser}
                  onTaskUpdate={onTaskUpdate}
                  onCardClick={handleCardClick}
                />
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-blue-300 mb-2">В работе</h3>
          <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
            {columns.inWork.length === 0 ? (
              <div className="text-xs text-slate-500">Нет задач</div>
            ) : (
              columns.inWork.map(t => (
                <TaskCard 
                  key={t.id} 
                  task={t} 
                  currentUser={currentUser}
                  onTaskUpdate={onTaskUpdate}
                  onCardClick={handleCardClick}
                />
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-yellow-300 mb-2">На проверке</h3>
          <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
            {columns.review.length === 0 ? (
              <div className="text-xs text-slate-500">Нет задач</div>
            ) : (
              columns.review.map(t => (
                <TaskCard 
                  key={t.id} 
                  task={t} 
                  currentUser={currentUser}
                  onTaskUpdate={onTaskUpdate}
                  onCardClick={handleCardClick}
                />
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Готово</h3>
          <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
            {columns.done.length === 0 ? (
              <div className="text-xs text-slate-500">Нет задач</div>
            ) : (
              columns.done.map(t => (
                <TaskCard 
                  key={t.id} 
                  task={t} 
                  currentUser={currentUser}
                  onTaskUpdate={onTaskUpdate}
                  onCardClick={handleCardClick}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {selectedTask && (
        <TaskActionModal
          task={selectedTask}
          currentUser={currentUser}
          onClose={handleCloseModal}
          onTaskUpdate={onTaskUpdate}
        />
      )}
    </>
  );
}
