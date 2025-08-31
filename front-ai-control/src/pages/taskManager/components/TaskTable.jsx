import React, { useState, useMemo, useRef, useEffect } from "react";
import TaskDetails from "./TaskDetails";
import taskService from "../../../services/taskService";

const TaskTable = () => {
  // Состояния для реальных данных
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ field: null, direction: "asc" });
  const [selectedTask, setSelectedTask] = useState(null);

  const [statusFilters, setStatusFilters] = useState({
    completed: true,
    in_progress: true,
    review: true,
    created: true,
    cancelled: true,
    on_hold: true,
    blocked: true
  });
  
  const [priorityFilters, setPriorityFilters] = useState({
    low: true,
    medium: true,
    high: true,
    critical: true,
    urgent: true
  });

  const [contextMenu, setContextMenu] = useState({ type: null, x: 0, y: 0 });
  const menuRef = useRef();

  // Загрузка задач при монтировании компонента
  useEffect(() => {
    loadTasks();
  }, []);

  // Загрузка задач
  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await taskService.getTasks({
        page: 1,
        size: 100,
        sort_by: 'created_at',
        sort_order: 'desc'
      });
      
      setTasks(response);
    } catch (err) {
      setError('Failed to load tasks');
      // Fallback к заглушкам при ошибке
      setTasks(getFallbackTasks());
    } finally {
      setLoading(false);
    }
  };

  // Fallback данные при ошибках API
  const getFallbackTasks = () => [
    { id: 1, title: "Design new landing page", status: "in_progress", due_date: "2024-05-20", priority: "high" },
    { id: 2, title: "Update user documentation", status: "completed", due_date: "2024-05-18", priority: "medium" },
    { id: 3, title: "Fix login issues", status: "in_progress", due_date: "2024-05-15", priority: "high" },
    { id: 4, title: "Review UI components", status: "review", due_date: "2024-05-15", priority: "low" },
    { id: 5, title: "Deploy staging server", status: "completed", due_date: "2024-05-22", priority: "high" },
    { id: 6, title: "Test mobile UI", status: "in_progress", due_date: "2024-05-16", priority: "medium" },
    { id: 7, title: "Client feedback review", status: "review", due_date: "2024-05-17", priority: "low" },
    { id: 8, title: "Sprint retrospective", status: "completed", due_date: "2024-05-21", priority: "medium" },
    { id: 9, title: "Fix notification bug", status: "in_progress", due_date: "2024-05-19", priority: "high" },
    { id: 10, title: "QA review", status: "review", due_date: "2024-05-14", priority: "low" },
  ];

  const statusOrder = { 
    completed: 1, 
    in_progress: 2, 
    review: 3, 
    created: 4, 
    on_hold: 5, 
    blocked: 6, 
    cancelled: 7 
  };
  
  const priorityOrder = { 
    low: 1, 
    medium: 2, 
    high: 3, 
    critical: 4, 
    urgent: 5 
  };
  
  const statusStyles = {
    "in_progress": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    "completed": "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    "review": "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    "created": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    "on_hold": "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    "blocked": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    "cancelled": "bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-400"
  };

  const priorityStyles = {
    "low": "text-gray-600 dark:text-gray-400",
    "medium": "text-yellow-600 dark:text-yellow-400",
    "high": "text-orange-600 dark:text-orange-400",
    "critical": "text-red-600 dark:text-red-400",
    "urgent": "text-red-800 dark:text-red-300 font-bold"
  };

  const StatusBadge = ({ status }) => (
    <span className={`px-4 py-1 rounded-full text-xs font-semibold ${statusStyles[status] || statusStyles.created}`}>
      {status.replace('_', ' ').toUpperCase()}
    </span>
  );

  const PriorityBadge = ({ priority }) => (
    <span className={`px-2 py-1 rounded text-xs font-medium ${priorityStyles[priority] || priorityStyles.medium}`}>
      {priority.toUpperCase()}
    </span>
  );

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
      x: rect.left + 10,
      y: rect.bottom - 280 + 4,
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

  const filteredTasks = useMemo(() => {
    let list = tasks
      .filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
      .filter((t) => statusFilters[t.status])
      .filter((t) => priorityFilters[t.priority]);

    if (sortConfig.field) {
      list.sort((a, b) => {
        let valA, valB;
        if (sortConfig.field === "status") {
          valA = statusOrder[a.status] || 999;
          valB = statusOrder[b.status] || 999;
        } else if (sortConfig.field === "priority") {
          valA = priorityOrder[a.priority] || 999;
          valB = priorityOrder[b.priority] || 999;
        } else if (sortConfig.field === "due_date") {
          valA = new Date(a.due_date || '9999-12-31');
          valB = new Date(b.due_date || '9999-12-31');
        } else if (sortConfig.field === "created_at") {
          valA = new Date(a.created_at || '1970-01-01');
          valB = new Date(b.created_at || '1970-01-01');
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
        className="absolute bg-[#16251C] shadow-lg rounded-md p-2 z-20 text-sm"
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
            <span>{key.replace('_', ' ').toUpperCase()}</span>
          </label>
        ))}
      </div>
    );
  };

  const handleRefresh = () => {
    loadTasks();
  };

  if (loading) {
    return (
      <div className="flex flex-col space-y-4 relative">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          <span className="ml-2 text-gray-400">Loading tasks...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col space-y-4 relative">
        <div className="bg-red-900 text-red-100 p-4 rounded-lg text-center">
          <p className="font-semibold">Error: {error}</p>
          <button 
            onClick={handleRefresh}
            className="mt-2 px-4 py-2 bg-red-700 hover:bg-red-600 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
        <button
          onClick={handleRefresh}
          className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm"
          title="Refresh tasks"
        >
          🔄
        </button>
        {areFiltersActive && (
          <button
            onClick={() => {
              setStatusFilters({
                completed: true, in_progress: true, review: true, 
                created: true, on_hold: true, blocked: true, cancelled: true
              });
              setPriorityFilters({
                low: true, medium: true, high: true, critical: true, urgent: true
              });
            }}
            title="Clear all filters"
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
              <th
                className="px-3 py-2 cursor-pointer"
                onClick={() => handleSort("created_at")}
              >
                Created {sortConfig.field === "created_at" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <tr
                  key={task.id}
                  className="bg-[#16251C] dark:bg-[#0f1b16] hover:bg-[#1A2B24] transition-colors cursor-pointer"
                  onClick={() => onRowClick(task)}
                >
                  <td className="px-3 py-2">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-3 py-2 text-white">{task.title}</td>
                  <td className="px-3 py-2 text-gray-300">
                    {task.due_date ? (
                      new Date(task.due_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    ) : (
                      <span className="text-gray-500">No due date</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-300">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-3 py-2 text-gray-300">
                    {task.created_at ? (
                      new Date(task.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center py-6 text-gray-400">
                  No tasks matched 🔍
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
          onSave={async (updatedTask) => {
            try {
              await taskService.updateTask(updatedTask.id, updatedTask);
              // Обновляем локальное состояние
              setTasks(prev => prev.map(t => 
                t.id === updatedTask.id ? updatedTask : t
              ));
              setSelectedTask(null);
            } catch (err) {
              alert('Failed to update task');
            }
          }}
          onDelete={async (taskToDelete) => {
            try {
              await taskService.deleteTask(taskToDelete.id);
              // Удаляем из локального состояния
              setTasks(prev => prev.filter(t => t.id !== taskToDelete.id));
              setSelectedTask(null);
            } catch (err) {
              alert('Failed to delete task');
            }
          }}
        />
      )}
    </div>
  );
};

export default TaskTable;