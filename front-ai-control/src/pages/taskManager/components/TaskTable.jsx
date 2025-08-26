import React, { useState, useMemo, useRef, useEffect } from "react";
import TaskDetails from "./TaskDetails";
import { deleteTask, updateTask } from "../../../services/taskService";

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

const statusStyles = {
  "created": "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  "in_progress": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "review": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  "completed": "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "cancelled": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "on_hold": "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  "blocked": "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

const StatusBadge = ({ status }) => {
  const getStatusDisplayName = (status) => {
    const statusMap = {
      'created': 'Создана',
      'in_progress': 'В работе',
      'review': 'На проверке',
      'completed': 'Завершена',
      'cancelled': 'Отменена',
      'on_hold': 'На паузе',
      'blocked': 'Заблокирована'
    };
    return statusMap[status] || status;
  };

  return (
    <span className={`px-4 py-1 rounded-full text-xs font-semibold ${statusStyles[status] || statusStyles['created']}`}>
      {getStatusDisplayName(status)}
    </span>
  );
};

export default function TaskTable({ tasks = [], loading = false, onTaskUpdate, currentUser }) {
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ field: null, direction: "asc" });
  const [selectedTask, setSelectedTask] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); 

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

  const [contextMenu, setContextMenu] = useState({ type: null, x: 0, y: 0 });
  const menuRef = useRef();

  // Define handleDeleteTask function early in the component
  const handleDeleteTask = async (taskId) => {
    try {
      await deleteTask(taskId);
      setConfirmDelete(null);
      // Уведомляем родительский компонент об обновлении
      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      // Можно добавить уведомление об ошибке
    }
  };

  // Функция для взятия задачи на себя
  const handleTakeOnMyself = async (task, e) => {
    e.stopPropagation(); // Предотвращаем открытие детали задачи
    
    if (!currentUser) {
      alert('You must be logged in to take a task on yourself.');
      return;
    }

    try {
      // Обновляем задачу, устанавливая текущего пользователя как исполнителя
      const updateData = {
        executor_id: currentUser.id,
        status: 'in_progress' // Автоматически меняем статус на "в работе"
      };

      console.log('Taking task on myself:', updateData);
      
      // Отправляем обновление на сервер
      await updateTask(task.id, updateData);
      
      // Уведомляем родительский компонент об обновлении
      if (onTaskUpdate) {
        onTaskUpdate();
      }
      
      // Показываем красивое уведомление
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full';
      notification.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-xl">✅</span>
          <span>Task "${task.title}" taken successfully!</span>
        </div>
        <div class="text-sm text-green-100 mt-1">Status changed to "In Progress"</div>
      `;
      document.body.appendChild(notification);
      
      // Анимация появления
      setTimeout(() => notification.classList.remove('translate-x-full'), 100);
      
      // Автоматически скрываем через 3 секунды
      setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
      
    } catch (error) {
      console.error('Error taking task on myself:', error);
      
      // Показываем уведомление об ошибке
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full';
      notification.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-xl">❌</span>
          <span>Failed to take task on yourself</span>
        </div>
        <div class="text-sm text-red-100 mt-1">Please try again</div>
      `;
      document.body.appendChild(notification);
      
      // Анимация появления
      setTimeout(() => notification.classList.remove('translate-x-full'), 100);
      
      // Автоматически скрываем через 3 секунды
      setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    }
  };

  // Функция для жалобы на задачу
  const handleReportTask = (task, e) => {
    e.stopPropagation(); // Предотвращаем открытие детали задачи
    
    if (!currentUser) {
      alert('You must be logged in to report a task.');
      return;
    }

    // TODO: В будущем здесь будет отправка жалобы администраторам
    console.log('Reporting task:', task.id, 'by user:', currentUser.id);
    
    // Показываем уведомление о том, что жалоба отправлена
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-orange-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full';
    notification.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-xl">🚨</span>
        <span>Task reported successfully!</span>
      </div>
      <div class="text-sm text-orange-100 mt-1">Administrators will review your report</div>
    `;
    document.body.appendChild(notification);
    
    // Анимация появления
    setTimeout(() => notification.classList.remove('translate-x-full'), 100);
    
    // Автоматически скрываем через 4 секунды
    setTimeout(() => {
      notification.classList.add('translate-x-full');
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 4000);
  };

  // Функция для вопроса по задаче
  const handleAskQuestion = (task, e) => {
    e.stopPropagation(); // Предотвращаем открытие детали задачи
    
    if (!currentUser) {
      alert('You must be logged in to ask a question about a task.');
      return;
    }

    // TODO: В будущем здесь будет открытие чата с создателем задачи
    console.log('Asking question about task:', task.id, 'by user:', currentUser.id);
    
    // Показываем уведомление о том, что вопрос отправлен
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full';
    notification.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-xl">❓</span>
        <span>Question sent to task creator!</span>
      </div>
      <div class="text-sm text-blue-100 mt-1">You will be notified when they respond</div>
    `;
    document.body.appendChild(notification);
    
    // Анимация появления
    setTimeout(() => notification.classList.remove('translate-x-full'), 100);
    
    // Автоматически скрываем через 4 секунды
    setTimeout(() => {
      notification.classList.add('translate-x-full');
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 4000);
  };

  const onRowClick = (task) => {
    setSelectedTask(task);
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
    return (
      Object.values(statusFilters).some((v) => !v) ||
      Object.values(priorityFilters).some((v) => !v) ||
      myTasksFilter
    );
  }, [statusFilters, priorityFilters, myTasksFilter]);

  const handleContextMenu = (e, type) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    setContextMenu({
      type,
      x: rect.left + 10, // немного вправо от заголовка
      y: rect.bottom - 280 + 4, // чуть ниже заголовка
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
    }
  };

  const canDeleteTask = (task) => {
    // Проверяем права на удаление задачи
    if (!currentUser) return false;
    
    // Владелец может удалять
    if (task.owner_id === currentUser.id) return true;
    
    // Администраторы могут удалять
    if (currentUser.role === 'admin' || currentUser.role === 'CEO') return true;
    
    return false;
  };

  const filteredTasks = useMemo(() => {
    let list = tasks
      .filter((t) => 
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase()) ||
        (t.executor_name || '').toLowerCase().includes(search.toLowerCase())
      )
      .filter((t) => statusFilters[t.status])
      .filter((t) => priorityFilters[t.priority]);

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
          case "created_at":
            valA = a.created_at ? new Date(a.created_at).getTime() : 0;
            valB = b.created_at ? new Date(b.created_at).getTime() : 0;
            break;
          case "executor":
            valA = (a.executor_name || '').toLowerCase();
            valB = (b.executor_name || '').toLowerCase();
            break;
          case "title":
            valA = (a.title || '').toLowerCase();
            valB = (b.title || '').toLowerCase();
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
  }, [tasks, search, sortConfig, statusFilters, priorityFilters, myTasksFilter, currentUser]);

  const renderContextMenu = () => {
    const type = contextMenu.type;
    const options = type === "status" ? Object.keys(statusFilters) : Object.keys(priorityFilters);
    const state = type === "status" ? statusFilters : priorityFilters;

    return (
      <div
        ref={menuRef}
        className="absolute bg-[#16251C] shadow-lg rounded-md p-2 z-50 text-sm"
        style={{ top: contextMenu.y, left: contextMenu.x, width: 200 }}
      >
                    <h4 className="font-semibold mb-1 capitalize">Фильтр {type}:</h4>
        {options.map((key) => (
          <label key={key} className="flex items-center space-x-2 px-2 py-1 hover:bg-[#1A2B24] rounded">
            <input
              type="checkbox"
              checked={state[key]}
              onChange={() => toggleFilter(type, key)}
            />
            <span>{key}</span>
          </label>
        ))}
        
        {/* Добавляем быстрый доступ к фильтру "Мои задачи" */}
        {currentUser && (
          <>
            <hr className="border-gray-600 my-2" />
            <label className="flex items-center space-x-2 px-2 py-1 hover:bg-[#1A2B24] rounded">
              <input
                type="checkbox"
                checked={myTasksFilter}
                onChange={(e) => setMyTasksFilter(e.target.checked)}
              />
              <span className="text-blue-400">🎯 Мои задачи</span>
            </label>
          </>
        )}

        {/* Быстрые действия для задач */}
        {currentUser && (
          <>
            <hr className="border-gray-600 my-2" />
            <h4 className="font-semibold mb-1 text-gray-300">Быстрые действия:</h4>
            <div className="space-y-1">
              <button
                onClick={() => {
                  // TODO: В будущем здесь будет открытие модального окна для вопроса
                  console.log('Quick action: Ask Question');
                  closeMenu();
                }}
                className="w-full text-left px-2 py-1 hover:bg-[#1A2B24] rounded text-blue-400 hover:text-blue-300 transition-colors"
              >
                ❓ Задать вопрос
              </button>
              <button
                onClick={() => {
                  // TODO: В будущем здесь будет открытие модального окна для жалобы
                  console.log('Quick action: Report Task');
                  closeMenu();
                }}
                className="w-full text-left px-2 py-1 hover:bg-[#1A2B24] rounded text-orange-400 hover:text-orange-300 transition-colors"
              >
                🚨 Пожаловаться
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
  <div className="flex flex-col space-y-4 relative">
    <div className="flex items-center space-x-2">
      <input
        type="text"
        placeholder="🔍 Поиск задач..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="flex-grow md:max-w-sm px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      
      {/* Галочка "Мои задачи" */}
      {currentUser && (
        <label className="flex items-center space-x-2 px-3 py-2 bg-[#1A2B24] rounded-md border border-gray-600 hover:border-gray-500 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={myTasksFilter}
            onChange={(e) => setMyTasksFilter(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
          />
          <span className="text-sm text-gray-300 whitespace-nowrap">
            🎯 Мои задачи
          </span>
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

    <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-md">
      <div className="text-xs text-gray-400 mb-2 px-2">
        💡 Нажмите на заголовки колонок для сортировки задач. Нажмите еще раз для изменения порядка.
        {sortConfig.field && (
          <span className="ml-2 text-green-400">
            Сортировка по: <strong>{sortConfig.field}</strong> ({sortConfig.direction === "asc" ? "по возрастанию" : "по убыванию"})
          </span>
        )}
        {/* Счетчик задач */}
        <div className="mt-2 text-blue-400">
          {myTasksFilter ? (
            <span>
              🎯 Показано <strong>{filteredTasks.length}</strong> ваших задач
              {tasks.length !== filteredTasks.length && (
                <span className="text-gray-400"> (отфильтровано из {tasks.length} всего)</span>
              )}
            </span>
          ) : (
            <span>
              📋 Показано <strong>{filteredTasks.length}</strong> задач
              {tasks.length !== filteredTasks.length && (
                <span className="text-gray-400"> (отфильтровано из {tasks.length} всего)</span>
              )}
            </span>
          )}
        </div>
      </div>
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-gray-300 text-sm bg-[#16251C] sticky top-0 z-10">
            <th
              className="px-3 py-2 cursor-pointer relative hover:bg-[#1A2B24] transition-colors"
              onClick={() => handleSort("status")}
              onContextMenu={(e) => handleContextMenu(e, "status")}
            >
              <div className="flex items-center justify-between">
                Статус
                <span className="ml-2 text-green-400">
                  {sortConfig.field === "status" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                </span>
              </div>
            </th>
            <th 
              className="px-3 py-2 cursor-pointer hover:bg-[#1A2B24] transition-colors"
              onClick={() => handleSort("title")}
            >
              <div className="flex items-center justify-between">
                Задача
                <span className="ml-2 text-green-400">
                  {sortConfig.field === "title" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                </span>
              </div>
            </th>
            <th
              className="px-3 py-2 cursor-pointer hover:bg-[#1A2B24] transition-colors"
              onClick={() => handleSort("executor")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  Исполнитель
                  {myTasksFilter && (
                    <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
                      🎯 Мои задачи
                    </span>
                  )}
                </div>
                <span className="ml-2 text-green-400">
                  {sortConfig.field === "executor" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                </span>
              </div>
            </th>
            <th
              className="px-3 py-2 cursor-pointer hover:bg-[#1A2B24] transition-colors"
              onClick={() => handleSort("created_at")}
            >
              <div className="flex items-center justify-between">
                Создано
                <span className="ml-2 text-green-400">
                  {sortConfig.field === "created_at" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                </span>
              </div>
            </th>
            <th
              className="px-3 py-2 cursor-pointer hover:bg-[#1A2B24] transition-colors"
              onClick={() => handleSort("due_date")}
            >
              <div className="flex items-center justify-between">
                Срок
                <span className="ml-2 text-green-400">
                  {sortConfig.field === "due_date" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                </span>
              </div>
            </th>
            <th
              className="px-3 py-2 cursor-pointer hover:bg-[#1A2B24] transition-colors"
              onClick={() => handleSort("priority")}
              onContextMenu={(e) => handleContextMenu(e, "priority")}
            >
              <div className="flex items-center justify-between">
                Приоритет
                <span className="ml-2 text-green-400">
                  {sortConfig.field === "priority" ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                </span>
              </div>
            </th>
            <th className="px-3 py-2">Действия</th>
          </tr>
        </thead>
        <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-6 text-gray-400">
                  Загрузка задач... 🔄
                </td>
              </tr>
            ) : filteredTasks.length > 0 ? (
              filteredTasks.map((task, i) => (
                <tr
                  key={i}
                  className="bg-[#16251C] dark:bg-[#0f1b16] hover:bg-[#1A2B24] transition-colors cursor-pointer"
                  onClick={() => onRowClick(task)}
                >
                  <td className="px-3 py-2">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-3 py-2 text-white">
                    <div>
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-gray-400 mt-1 truncate max-w-xs">
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
                  <td className="px-3 py-2 text-gray-300">
                    <div className="flex items-center">
                      <div className={`w-6 h-6 rounded-full mr-2 flex items-center justify-center text-xs text-white ${
                        task.executor_id === currentUser?.id 
                          ? 'bg-green-500 ring-2 ring-green-300' 
                          : 'bg-green-500'
                      }`}>
                        {task.executor_name ? task.executor_name.split(' ').map(n => n[0]).join('') : 'N/A'}
                      </div>
                      <span className={`text-sm ${
                        task.executor_id === currentUser?.id ? 'font-semibold text-green-300' : ''
                      }`}>
                        {task.executor_id === currentUser?.id 
                                                      ? `${task.executor_name || 'Не назначен'} (Вы)`  
                          : task.executor_name || 'Не назначен'
                        }
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-300 text-sm">
                    {new Date(task.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "2-digit"
                    })}
                  </td>
                  <td className="px-3 py-2 text-gray-300">
                    {new Date(task.due_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-3 py-2 text-gray-300">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                      task.priority === 'critical' ? 'bg-orange-100 text-orange-800' :
                      task.priority === 'high' ? 'bg-yellow-100 text-yellow-800' :
                      task.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {/* Кнопка "Взять на себя" */}
                      {currentUser && (
                        <button
                          onClick={(e) => handleTakeOnMyself(task, e)}
                          disabled={task.executor_id === currentUser.id}
                          className={`transition-colors ${
                            task.executor_id === currentUser.id
                              ? 'text-gray-500 cursor-not-allowed'
                              : 'text-blue-400 hover:text-blue-300'
                          }`}
                                                  title={
                          task.executor_id === currentUser.id
                            ? 'Эта задача уже назначена вам'
                            : 'Взять эту задачу на себя'
                        }
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        </button>
                      )}
                      
                      {/* Кнопка "Задать вопрос" */}
                      {currentUser && (
                        <button
                          onClick={(e) => handleAskQuestion(task, e)}
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                          title="Задать вопрос по этой задаче"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </button>
                      )}
                      
                      {/* Кнопка "Пожаловаться" */}
                      {currentUser && (
                        <button
                          onClick={(e) => handleReportTask(task, e)}
                          className="text-orange-400 hover:text-orange-300 transition-colors"
                          title="Пожаловаться на эту задачу администраторам"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                          </svg>
                        </button>
                      )}
                      
                      {/* Кнопка удаления */}
                      {canDeleteTask(task) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Предотвращаем открытие детали задачи
                            setConfirmDelete(task.id);
                          }}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          title="Удалить задачу"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center py-6 text-gray-400">
                  {tasks.length === 0 ? 'Задачи не найдены. Создайте первую задачу!' : 'Задачи не найдены по вашим фильтрам 🔍'}
                </td>
              </tr>
            )}
          </tbody>
      </table>
    </div>

      {contextMenu.type && renderContextMenu()}

      {/* Рендерим модальное окно с деталями */}
      {selectedTask && (
        <TaskDetails 
          task={selectedTask} 
          onClose={() => setSelectedTask(null)} 
          onTaskUpdate={onTaskUpdate}
          currentUser={currentUser}
        />
      )}

      {/* Модальное окно подтверждения удаления */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Confirm Delete
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete this task? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTask(confirmDelete)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
);
}