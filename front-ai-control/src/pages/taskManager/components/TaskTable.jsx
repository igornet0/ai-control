import React, { useState, useMemo, useRef, useEffect } from "react";
import TaskDetails from "./TaskDetails";
import { deleteTask } from "../../../services/taskService"; 

// Данные получаются из API через пропс tasks

// Статусы и приоритеты в соответствии с бэкендом
const statusOrder = { 
  "completed": 1, 
  "in_progress": 2, 
  "review": 3, 
  "created": 4, 
  "cancelled": 5, 
  "on_hold": 6, 
  "blocked": 7 
};

const priorityOrder = { 
  "urgent": 1, 
  "critical": 2, 
  "high": 3, 
  "medium": 4, 
  "low": 5 
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
      'created': 'Created',
      'in_progress': 'In Progress',
      'review': 'Review',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'on_hold': 'On Hold',
      'blocked': 'Blocked'
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

  const [contextMenu, setContextMenu] = useState({ type: null, x: 0, y: 0 });
  const menuRef = useRef();

  const onRowClick = (task) => {
    setSelectedTask(task);
  };

  const handleSort = (field) => {
    setSortConfig((prev) => {
      const isSame = prev.field === field;
      return {
        field,
        direction: isSame && prev.direction === "asc" ? "desc" : "asc",
      };
    });
  };

  const areFiltersActive = useMemo(() => {
    return (
      Object.values(statusFilters).some((v) => !v) ||
      Object.values(priorityFilters).some((v) => !v)
    );
  }, [statusFilters, priorityFilters]);

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

      console.error('Error deleting task:', error);
      alert('Failed to delete task. Please try again.');
    }
  };

  const canDeleteTask = (task) => {
    return currentUser && task.owner_id === currentUser.id;
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

    if (sortConfig.field) {
      list.sort((a, b) => {
        let valA, valB;
        if (sortConfig.field === "status") {
          valA = statusOrder[a.status];
          valB = statusOrder[b.status];
        } else if (sortConfig.field === "priority") {
          valA = priorityOrder[a.priority];
          valB = priorityOrder[b.priority];
        } else if (sortConfig.field === "due_date") {
          valA = new Date(a.due_date);
          valB = new Date(b.due_date);
        } else if (sortConfig.field === "created_at") {
          valA = new Date(a.created_at);
          valB = new Date(b.created_at);
        } else if (sortConfig.field === "executor") {
          valA = (a.executor_name || '').toLowerCase();
          valB = (b.executor_name || '').toLowerCase();
        }
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [tasks, search, sortConfig, statusFilters, priorityFilters]);

  const renderContextMenu = () => {
    const type = contextMenu.type;
    const options = type === "status" ? Object.keys(statusFilters) : Object.keys(priorityFilters);
    const state = type === "status" ? statusFilters : priorityFilters;

    return (
      <div
        ref={menuRef}
        className="absolute bg-[#16251C] shadow-lg rounded-md p-2 z-50 text-sm"
        style={{ top: contextMenu.y, left: contextMenu.x, width: 180 }}
      >
        <h4 className="font-semibold mb-1 capitalize">Filter {type}:</h4>
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
      </div>
    );
  };

  return (
  <div className="flex flex-col space-y-4 relative">
    <div className="flex items-center space-x-2">
      <input
        type="text"
        placeholder="🔍 Search tasks..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="flex-grow md:max-w-sm px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
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
    </div>

    <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-md">
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-gray-300 text-sm bg-[#16251C] sticky top-0 z-10">
            <th
              className="px-3 py-2 cursor-pointer relative"
              onClick={() => handleSort("status")}
              onContextMenu={(e) => handleContextMenu(e, "status")}
            >
              Status {sortConfig.field === "status" && (sortConfig.direction === "asc" ? "↑" : "↓")}
            </th>
            <th className="px-3 py-2">Task</th>
            <th
              className="px-3 py-2 cursor-pointer"
              onClick={() => handleSort("executor")}
            >
              Assignee {sortConfig.field === "executor" && (sortConfig.direction === "asc" ? "↑" : "↓")}
            </th>
            <th
              className="px-3 py-2 cursor-pointer"
              onClick={() => handleSort("created_at")}
            >
              Created {sortConfig.field === "created_at" && (sortConfig.direction === "asc" ? "↑" : "↓")}
            </th>
            <th
              className="px-3 py-2 cursor-pointer"
              onClick={() => handleSort("due_date")}
            >
              Due Date {sortConfig.field === "due_date" && (sortConfig.direction === "asc" ? "↑" : "↓")}
            </th>
            <th
              className="px-3 py-2 cursor-pointer"
              onClick={() => handleSort("priority")}
              onContextMenu={(e) => handleContextMenu(e, "priority")}
            >
              Priority {sortConfig.field === "priority" && (sortConfig.direction === "asc" ? "↑" : "↓")}
            </th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-6 text-gray-400">
                  Loading tasks... 🔄
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
                      <div className="w-6 h-6 bg-green-500 rounded-full mr-2 flex items-center justify-center text-xs text-white">
                        {task.executor_name ? task.executor_name.split(' ').map(n => n[0]).join('') : 'N/A'}
                      </div>
                      <span className="text-sm">{task.executor_name || 'Unassigned'}</span>
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
                    {canDeleteTask(task) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Предотвращаем открытие детали задачи
                          setConfirmDelete(task.id);
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title="Delete task"
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
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center py-6 text-gray-400">
                  {tasks.length === 0 ? 'No tasks found. Create your first task!' : 'No tasks matched your filters 🔍'}
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