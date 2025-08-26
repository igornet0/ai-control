import React, { useState, useEffect } from 'react';
import { projectService } from '../../../services/projectService';
import CustomSelect from '../selector/CustomSelect';
import TaskTags from './TaskTags';
import './CreateTaskModal.css';

const statusOptions = [
  { value: "created", label: "Создана" },
  { value: "in_progress", label: "В работе" },
  { value: "review", label: "На проверке" },
  { value: "completed", label: "Завершена" },
  { value: "cancelled", label: "Отменена" },
  { value: "on_hold", label: "На паузе" },
  { value: "blocked", label: "Заблокирована" }
];

const priorityOptions = [
  { value: "low", label: "Низкий" },
  { value: "medium", label: "Средний" },
  { value: "high", label: "Высокий" },
  { value: "critical", label: "Критичный" },
  { value: "urgent", label: "Срочный" }
];

const taskTypeOptions = [
  { value: "task", label: "Задача" },
  { value: "bug", label: "Ошибка" },
  { value: "feature", label: "Функция" },
  { value: "story", label: "История" },
  { value: "epic", label: "Эпик" },
  { value: "subtask", label: "Подзадача" }
];

export default function CreateTaskModal({ onClose, onSave }) {
  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    status: 'created',
    priority: 'medium',
    task_type: 'task',
    due_date: '',
    start_date: '',
    estimated_hours: '',
    tags: '',
    project_id: null
  });

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [newTag, setNewTag] = useState('');

  // Загрузка проектов
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectsData = await projectService.getProjects();
        setProjects(projectsData);
      } catch (error) {
        console.error('Error loading projects:', error);
      }
    };
    loadProjects();
  }, []);

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
      newErrors.title = 'Название обязательно';
    }
    
    if (taskData.estimated_hours && isNaN(taskData.estimated_hours)) {
      newErrors.estimated_hours = 'Оценка в часах должна быть числом';
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
      status: taskData.status,
      task_type: taskData.task_type,
      priority: taskData.priority,
      visibility: 'team',
      due_date: taskData.due_date && taskData.due_date.trim() !== '' ? new Date(taskData.due_date).toISOString() : null,
      estimated_hours: taskData.estimated_hours && taskData.estimated_hours.trim() !== '' ? parseFloat(taskData.estimated_hours) : null,
      tags: taskData.tags && taskData.tags.trim() !== '' ? taskData.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
      executor_id: null // Fixed: Send null instead of string value
    };

    console.log('Task data being sent:', taskToSave);
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

        <h2 className="text-2xl font-semibold mb-6">Создать новую задачу</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Title */}
          <div className="md:col-span-2">
            <label className="block mb-2">
              <span className="text-gray-300">Название *</span>
              <input
                type="text"
                value={taskData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                className={`mt-1 block w-full rounded-md border p-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.title ? 'border-red-500 bg-[#0f1b16]' : 'border-gray-600 bg-[#0f1b16]'
                }`}
                placeholder="Введите название задачи"
              />
              {errors.title && <span className="text-red-400 text-sm">{errors.title}</span>}
            </label>
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="block mb-2">
              <span className="text-gray-300">Описание</span>
              <textarea
                rows={3}
                value={taskData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-600 bg-[#0f1b16] p-2 text-white resize-y focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Введите описание задачи..."
              />
            </label>
          </div>

          {/* Status and Priority */}
          <div>
            <label className="block mb-2">
              <span className="text-gray-300">Статус</span>
              <CustomSelect
                options={statusOptions}
                value={taskData.status}
                onChange={(val) => handleChange("status", val)}
              />
            </label>
          </div>

          <div>
            <label className="block mb-2">
              <span className="text-gray-300">Приоритет</span>
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
              <span className="text-gray-300">Тип задачи</span>
              <CustomSelect
                options={taskTypeOptions}
                value={taskData.task_type}
                onChange={(val) => handleChange("task_type", val)}
              />
            </label>
          </div>

          <div>
            <label className="block mb-2">
              <span className="text-gray-300">Срок выполнения</span>
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
              <span className="text-gray-300">Оценка в часах</span>
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
              <span className="text-gray-300">Теги</span>
              <TaskTags
                tags={taskData.tags ? taskData.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []}
                onTagsChange={(tags) => handleChange("tags", tags.join(', '))}
              />
            </label>
          </div>

          <div className="form-group">
            <label>Тип задачи</label>
            <CustomSelect
              value={taskData.task_type}
              onChange={(value) => handleChange('task_type', value)}
              options={[
                { value: 'task', label: 'Задача' },
                { value: 'bug', label: 'Ошибка' },
                { value: 'feature', label: 'Функция' },
                { value: 'story', label: 'История' },
                { value: 'epic', label: 'Эпик' },
                { value: 'subtask', label: 'Подзадача' }
              ]}
            />
          </div>

          <div className="form-group">
            <label>Проект (опционально)</label>
            <CustomSelect
              value={taskData.project_id}
              onChange={(value) => handleChange('project_id', value)}
              options={[
                { value: null, label: 'Без проекта' },
                ...projects.map(project => ({
                  value: project.id,
                  label: project.name
                }))
              ]}
              placeholder="Выберите проект"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 transition"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 transition"
          >
            Создать задачу
          </button>
        </div>
      </div>
    </div>
  );
}
