import React, { useState, useMemo, useRef, useEffect } from "react";
import TaskDetails from "./TaskDetails"; 

const tasksData = [
  { title: "Design new landing page", status: "In Progress", date: "2024-05-20", priority: "High" },
  { title: "Update user documentation", status: "Completed", date: "2024-05-18", priority: "Medium" },
  { title: "Fix login issues", status: "In Progress", date: "2024-05-15", priority: "High" },
  { title: "Reverimi issues", status: "Review", date: "2024-05-15", priority: "Low" },
  { title: "Deploy staging server", status: "Completed", date: "2024-05-22", priority: "High" },
  { title: "Test mobile UI", status: "In Progress", date: "2024-05-16", priority: "Medium" },
  { title: "Client feedback", status: "Review", date: "2024-05-17", priority: "Low" },
  { title: "Sprint retrospective", status: "Completed", date: "2024-05-21", priority: "Medium" },
  { title: "Fix notification bug", status: "In Progress", date: "2024-05-19", priority: "High" },
  { title: "QA review", status: "Review", date: "2024-05-14", priority: "Low" },
];

const statusOrder = { Completed: 1, "In Progress": 2, Review: 3 };
const priorityOrder = { High: 1, Medium: 2, Low: 3 };
const statusStyles = {
  "In Progress": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "Completed": "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "Review": "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

const StatusBadge = ({ status }) => (
  <span className={`px-4 py-1 rounded-full text-xs font-semibold ${statusStyles[status]}`}>
    {status}
  </span>
);

export default function TaskTable() {
  const [tasks] = useState(tasksData);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ field: null, direction: "asc" });
  const [selectedTask, setSelectedTask] = useState(null); 

  const [statusFilters, setStatusFilters] = useState({
    Completed: true,
    "In Progress": true,
    Review: true,
  });
  const [priorityFilters, setPriorityFilters] = useState({
    High: true,
    Medium: true,
    Low: true,
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
          valA = statusOrder[a.status];
          valB = statusOrder[b.status];
        } else if (sortConfig.field === "priority") {
          valA = priorityOrder[a.priority];
          valB = priorityOrder[b.priority];
        } else if (sortConfig.field === "date") {
          valA = new Date(a.date);
          valB = new Date(b.date);
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
            setStatusFilters({ Completed: true, "In Progress": true, Review: true });
            setPriorityFilters({ High: true, Medium: true, Low: true });
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
              onClick={() => handleSort("date")}
            >
              Due Date {sortConfig.field === "date" && (sortConfig.direction === "asc" ? "↑" : "↓")}
            </th>
            <th
              className="px-3 py-2 cursor-pointer"
              onClick={() => handleSort("priority")}
              onContextMenu={(e) => handleContextMenu(e, "priority")}
            >
              Priority {sortConfig.field === "priority" && (sortConfig.direction === "asc" ? "↑" : "↓")}
            </th>
          </tr>
        </thead>
        <tbody>
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task, i) => (
                <tr
                  key={i}
                  className="bg-[#16251C] dark:bg-[#0f1b16] hover:bg-[#1A2B24] transition-colors cursor-pointer"
                  onClick={() => onRowClick(task)} // добавляем клик по строке
                >
                  <td className="px-3 py-2">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-3 py-2 text-white">{task.title}</td>
                  <td className="px-3 py-2 text-gray-300">
                    {new Date(task.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-3 py-2 text-gray-300">{task.priority}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center py-6 text-gray-400">
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
        <TaskDetails task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
);
}