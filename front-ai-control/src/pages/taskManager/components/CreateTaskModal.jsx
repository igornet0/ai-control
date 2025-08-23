import React, { useState } from 'react';
import CustomSelect from '../selector/CustomSelect';
import TaskTags from './TaskTags';

const statusOptions = ["created", "in_progress", "review", "completed", "cancelled", "on_hold", "blocked"];
const priorityOptions = ["low", "medium", "high", "critical", "urgent"];
const taskTypeOptions = ["task", "bug", "feature", "story", "epic", "subtask"];

export default function CreateTaskModal({ onClose, onSave }) {
  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    status: 'created',
    priority: 'medium',
    task_type: 'task',
    due_date: '',
    executor: '',
    estimated_hours: '',
    tags: ''
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setTaskData(prev => ({ ...prev, [field]: value }));
    // Очищаем ошибку при изменении поля
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!taskData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (taskData.estimated_hours && isNaN(taskData.estimated_hours)) {
      newErrors.estimated_hours = 'Estimated hours must be a number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    const taskToSave = {
      title: taskData.title,
      description: taskData.description,
      task_type: taskData.task_type,
      priority: taskData.priority,
      visibility: 'team',
      due_date: taskData.due_date ? new Date(taskData.due_date).toISOString() : null,
      estimated_hours: taskData.estimated_hours ? parseFloat(taskData.estimated_hours) : null,
      tags: taskData.tags ? taskData.tags.split(',').map(tag => tag.trim()) : [],
      executor_id: taskData.executor || null
    };

    onSave(taskToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-30 p-4">
      <div className="bg-[#16251C] rounded-md p-6 w-full max-w-2xl text-white relative shadow-lg max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white text-2xl font-bold leading-none"
          aria-label="Close modal"
        >
          ✕
        </button>

        <h2 className="text-2xl font-semibold mb-6">Create New Task</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Title */}
          <div className="md:col-span-2">
            <label className="block mb-2">
              <span className="text-gray-300">Title *</span>
              <input
                type="text"
                value={taskData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                className={`mt-1 block w-full rounded-md border p-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.title ? 'border-red-500 bg-[#0f1b16]' : 'border-gray-600 bg-[#0f1b16]'
                }`}
                placeholder="Enter task title"
              />
              {errors.title && <span className="text-red-400 text-sm">{errors.title}</span>}
            </label>
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="block mb-2">
              <span className="text-gray-300">Description</span>
              <textarea
                rows={3}
                value={taskData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-600 bg-[#0f1b16] p-2 text-white resize-y focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Enter task description..."
              />
            </label>
          </div>

          {/* Status and Priority */}
          <div>
            <label className="block mb-2">
              <span className="text-gray-300">Status</span>
              <CustomSelect
                options={statusOptions}
                value={taskData.status}
                onChange={(val) => handleChange("status", val)}
              />
            </label>
          </div>

          <div>
            <label className="block mb-2">
              <span className="text-gray-300">Priority</span>
              <CustomSelect
                options={priorityOptions}
                value={taskData.priority}
                onChange={(val) => handleChange("priority", val)}
              />
            </label>
          </div>

          {/* Task Type and Due Date */}
          <div>
            <label className="block mb-2">
              <span className="text-gray-300">Task Type</span>
              <CustomSelect
                options={taskTypeOptions}
                value={taskData.task_type}
                onChange={(val) => handleChange("task_type", val)}
              />
            </label>
          </div>

          <div>
            <label className="block mb-2">
              <span className="text-gray-300">Due Date</span>
              <input
                type="date"
                value={taskData.due_date}
                onChange={(e) => handleChange("due_date", e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-600 bg-[#0f1b16] p-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>
          </div>

          {/* Assignee and Estimated Hours */}
          <div>
            <label className="block mb-2">
              <span className="text-gray-300">Assignee</span>
              <input
                type="text"
                value={taskData.executor}
                onChange={(e) => handleChange("executor", e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-600 bg-[#0f1b16] p-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Enter assignee name"
              />
            </label>
          </div>

          <div>
            <label className="block mb-2">
              <span className="text-gray-300">Estimated Hours</span>
              <input
                type="number"
                step="0.5"
                min="0"
                value={taskData.estimated_hours}
                onChange={(e) => handleChange("estimated_hours", e.target.value)}
                className={`mt-1 block w-full rounded-md border p-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.estimated_hours ? 'border-red-500 bg-[#0f1b16]' : 'border-gray-600 bg-[#0f1b16]'
                }`}
                placeholder="0.0"
              />
              {errors.estimated_hours && <span className="text-red-400 text-sm">{errors.estimated_hours}</span>}
            </label>
          </div>

          {/* Tags */}
          <div className="md:col-span-2">
            <label className="block mb-2">
              <span className="text-gray-300">Tags</span>
              <TaskTags
                tags={taskData.tags ? taskData.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []}
                onTagsChange={(tags) => handleChange("tags", tags.join(', '))}
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 transition"
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}
