import React, { useState, useEffect } from "react";
import CustomSelect from "../selector/CustomSelect";

const statusOptions = ["Completed", "In Progress", "Review"];
const priorityOptions = ["High", "Medium", "Low"];

export default function TaskDetails({ task, onClose, onSave, onDelete }) {
  // Локальный стейт для редактирования
  const [editedTask, setEditedTask] = useState({
    title: task.title || "",
    status: task.status || "In Progress",
    priority: task.priority || "Medium",
    date: task.date || new Date().toISOString().slice(0, 10),
    description: task.description || "",
  });

  const [isDirty, setIsDirty] = useState(false);

  // Отслеживаем изменения, чтобы понимать, изменялись ли поля
  useEffect(() => {
    const dirty =
      editedTask.title !== task.title ||
      editedTask.status !== task.status ||
      editedTask.priority !== task.priority ||
      editedTask.date !== task.date ||
      editedTask.description !== (task.description || "");
    setIsDirty(dirty);
  }, [editedTask, task]);

  const handleChange = (field, value) => {
    setEditedTask((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (onSave) {
      onSave({ ...task, ...editedTask });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-30 p-4">
      <div className="bg-[#16251C] rounded-md p-6 w-full max-w-lg text-white relative shadow-lg max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white text-2xl font-bold leading-none"
          aria-label="Close details"
        >
          ✕
        </button>

        <h2 className="text-2xl font-semibold mb-4">Task Details</h2>

        <label className="block mb-3">
          <span className="text-gray-300">Title:</span>
          <input
            type="text"
            value={editedTask.title}
            onChange={(e) => handleChange("title", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-600 bg-[#0f1b16] p-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </label>

        <label className="block mb-3">
          <span className="text-gray-300">Description:</span>
          <textarea
            rows={4}
            value={editedTask.description}
            onChange={(e) => handleChange("description", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-600 bg-[#0f1b16] p-2 text-white resize-y focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Add task description..."
          />
        </label>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <label className="block">
            <span className="text-gray-300">Status:</span>
            <CustomSelect
            options={statusOptions}
            value={editedTask.status}
            onChange={(val) => handleChange("status", val)}
            />
          </label>

          <label className="block">
            <span className="text-gray-300">Priority:</span>
            <CustomSelect
                options={priorityOptions}
                value={editedTask.priority}
                onChange={(val) => handleChange("priority", val)}
                className="mt-1 block w-full"
            />
          </label>
        </div>

        <label className="block mb-4">
          <span className="text-gray-300">Due Date:</span>
          <input
            type="date"
            value={editedTask.date}
            onChange={(e) => handleChange("date", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-600 bg-[#0f1b16] p-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </label>

        {/* Опционально можно показать даты создания/обновления, если есть */}
        {task.createdAt && (
          <p className="text-gray-400 text-sm mb-1">
            Created:{" "}
            {new Date(task.createdAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        )}
        {task.updatedAt && (
          <p className="text-gray-400 text-sm mb-4">
            Updated:{" "}
            {new Date(task.updatedAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        )}

        <div className="flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 transition"
          >
            Cancel
          </button>

          <div className="flex space-x-3">
            {onDelete && (
              <button
                onClick={() => {
                  if (window.confirm("Are you sure you want to delete this task?")) {
                    onDelete(task);
                    onClose();
                  }
                }}
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 transition"
              >
                Delete
              </button>
            )}

            <button
              disabled={!isDirty}
              onClick={handleSave}
              className={`px-4 py-2 rounded-md ${
                isDirty
                  ? "bg-green-600 hover:bg-green-700 cursor-pointer"
                  : "bg-green-900 cursor-not-allowed"
              } text-white transition`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}