import React, { useState, useEffect } from "react";
import CustomSelect from "../selector/CustomSelect";
import { updateTask } from "../../../services/taskService";
import TaskComments from "./TaskComments";
import TaskTimeLog from "./TaskTimeLog";

const statusOptions = ["created", "in_progress", "review", "completed", "cancelled", "on_hold", "blocked"];
const priorityOptions = ["low", "medium", "high", "critical", "urgent"];

export default function TaskDetails({ task, onClose, onSave, onDelete, onTaskUpdate, currentUser }) {
  // Локальный стейт для редактирования
  const [editedTask, setEditedTask] = useState({
    title: task.title || "",
    status: task.status || "created",
    priority: task.priority || "medium",
    due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : "",
    description: task.description || "",
    executor_name: task.executor_name || "",
  });

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Отслеживаем изменения, чтобы понимать, изменялись ли поля
  useEffect(() => {
    const dirty =
      editedTask.title !== task.title ||
      editedTask.status !== task.status ||
      editedTask.priority !== task.priority ||
      editedTask.due_date !== (task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : "") ||
      editedTask.description !== (task.description || "") ||
      editedTask.executor_name !== (task.executor_name || "");
    setIsDirty(dirty);
  }, [editedTask, task]);

  const handleChange = (field, value) => {
    setEditedTask((prev) => ({ ...prev, [field]: value }));
    // Очищаем ошибку при изменении поля
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!editedTask.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (editedTask.due_date && new Date(editedTask.due_date) < new Date()) {
      newErrors.due_date = 'Due date cannot be in the past';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsSaving(true);
      
      // Подготавливаем данные для отправки
      const updateData = {
        title: editedTask.title,
        status: editedTask.status,
        priority: editedTask.priority,
        due_date: editedTask.due_date ? new Date(editedTask.due_date).toISOString() : null,
        description: editedTask.description,
        // executor_id будет обновлен через отдельный API если нужно
      };

      // Отправляем обновление на сервер
      await updateTask(task.id, updateData);
      
      // Вызываем callback для обновления родительского компонента
      if (onTaskUpdate) {
        onTaskUpdate();
      }
      
      // Вызываем callback для сохранения (если передан)
      if (onSave) {
        onSave({ ...task, ...editedTask });
      }
      
      onClose();
    } catch (error) {
      console.error('Error updating task:', error);
      setErrors({ general: 'Failed to update task. Please try again.' });
    } finally {
      setIsSaving(false);
    }
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

        {errors.general && (
          <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded text-red-200 text-sm">
            {errors.general}
          </div>
        )}

        <label className="block mb-3">
          <span className="text-gray-300">Title: *</span>
          <input
            type="text"
            value={editedTask.title}
            onChange={(e) => handleChange("title", e.target.value)}
            className={`mt-1 block w-full rounded-md border p-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500 ${
              errors.title ? 'border-red-500 bg-[#0f1b16]' : 'border-gray-600 bg-[#0f1b16]'
            }`}
            placeholder="Enter task title"
          />
          {errors.title && <span className="text-red-400 text-sm">{errors.title}</span>}
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

        <div className="grid grid-cols-2 gap-4 mb-4">
          <label className="block">
            <span className="text-gray-300">Due Date:</span>
            <input
              type="date"
              value={editedTask.due_date}
              onChange={(e) => handleChange("due_date", e.target.value)}
              className={`mt-1 block w-full rounded-md border p-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500 ${
                errors.due_date ? 'border-red-500 bg-[#0f1b16]' : 'border-gray-600 bg-[#0f1b16]'
              }`}
            />
            {errors.due_date && <span className="text-red-400 text-sm">{errors.due_date}</span>}
          </label>

          <label className="block">
            <span className="text-gray-300">Assignee:</span>
            <input
              type="text"
              value={editedTask.executor_name}
              onChange={(e) => handleChange("executor_name", e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-600 bg-[#0f1b16] p-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Enter assignee name"
            />
          </label>
        </div>

        {/* Опционально можно показать даты создания/обновления, если есть */}
        {task.created_at && (
          <p className="text-gray-400 text-sm mb-1">
            Created:{" "}
            {new Date(task.created_at).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        )}
        {task.updated_at && (
          <p className="text-gray-400 text-sm mb-4">
            Updated:{" "}
            {new Date(task.updated_at).toLocaleString("en-US", {
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
              disabled={!isDirty || isSaving}
              onClick={handleSave}
              className={`px-4 py-2 rounded-md ${
                isDirty && !isSaving
                  ? "bg-green-600 hover:bg-green-700 cursor-pointer"
                  : "bg-green-900 cursor-not-allowed"
              } text-white transition`}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Комментарии к задаче */}
        <div className="mt-6">
          <TaskComments taskId={task.id} currentUser={currentUser} />
        </div>

        {/* Временные логи */}
        <div className="mt-6">
          <TaskTimeLog taskId={task.id} currentUser={currentUser} />
        </div>
      </div>
    </div>
  );
}