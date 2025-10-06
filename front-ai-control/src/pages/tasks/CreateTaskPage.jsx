import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { taskService } from '../../services/taskService';
import LoadingWrapper from '../../components/LoadingWrapper';
import useLoading from '../../hooks/useLoading';
import styles from './CreateTaskPage.module.css';

// Опции для селектов
const statusOptions = [
  { value: "created", label: "Создана", icon: "📝" },
  { value: "in_progress", label: "В работе", icon: "⚡" },
  { value: "review", label: "На проверке", icon: "👀" },
  { value: "completed", label: "Завершена", icon: "✅" },
  { value: "cancelled", label: "Отменена", icon: "❌" },
  { value: "on_hold", label: "На паузе", icon: "⏸️" },
  { value: "blocked", label: "Заблокирована", icon: "🚫" }
];

const priorityOptions = [
  { value: "low", label: "Низкий", icon: "🟢", color: "text-green-400" },
  { value: "medium", label: "Средний", icon: "🟡", color: "text-yellow-400" },
  { value: "high", label: "Высокий", icon: "🟠", color: "text-orange-400" },
  { value: "critical", label: "Критичный", icon: "🔴", color: "text-red-400" },
  { value: "urgent", label: "Срочный", icon: "🚨", color: "text-red-500" }
];

const taskTypeOptions = [
  { value: "task", label: "Задача", icon: "📋" },
  { value: "bug", label: "Ошибка", icon: "🐛" },
  { value: "feature", label: "Функция", icon: "✨" },
  { value: "story", label: "История", icon: "📖" },
  { value: "epic", label: "Эпик", icon: "🎯" },
  { value: "subtask", label: "Подзадача", icon: "📌" }
];

// Шаблоны задач
const TASK_TEMPLATES = [
  {
    id: 1,
    name: "🐛 Исправление бага",
    description: "Стандартный шаблон для исправления ошибок",
    category: "Bug Fix",
    template: {
      title: "Исправить ошибку: ",
      description: "Описание проблемы:\n\nШаги для воспроизведения:\n1. \n2. \n3. \n\nОжидаемый результат:\n\nФактический результат:\n\nВлияние на пользователей:\n\nПриоритет исправления:",
      task_type: "bug",
      priority: "high",
      tags: "bug,исправление,критично"
    }
  },
  {
    id: 2,
    name: "✨ Новая функция",
    description: "Шаблон для разработки новых возможностей",
    category: "Feature",
    template: {
      title: "Добавить функцию: ",
      description: "Описание функции:\n\nБизнес-требования:\n\nТехнические требования:\n\nКритерии приемки:\n- [ ] \n- [ ] \n- [ ] \n\nДизайн/Макеты:\n\nЗависимости:",
      task_type: "feature",
      priority: "medium",
      tags: "feature,разработка,новая-функция"
    }
  },
  {
    id: 3,
    name: "📋 Код-ревью",
    description: "Шаблон для проверки кода",
    category: "Review",
    template: {
      title: "Код-ревью: ",
      description: "Компоненты для проверки:\n\nПулл-реквест/Ветка:\n\nЧек-лист:\n- [ ] Соответствие стандартам кодирования\n- [ ] Покрытие тестами\n- [ ] Производительность\n- [ ] Безопасность\n- [ ] Читаемость кода\n- [ ] Документация\n\nОсобое внимание:",
      task_type: "task",
      priority: "medium",
      tags: "review,качество,код"
    }
  },
  {
    id: 4,
    name: "🧪 Тестирование",
    description: "Шаблон для задач тестирования",
    category: "Testing",
    template: {
      title: "Протестировать: ",
      description: "Область тестирования:\n\nТип тестирования:\n- [ ] Функциональное\n- [ ] Регрессионное\n- [ ] Интеграционное\n- [ ] UI/UX\n\nТест-кейсы:\n1. \n2. \n3. \n\nОкружение:\n\nОжидаемые результаты:\n\nКритерии завершения:",
      task_type: "task",
      priority: "high",
      tags: "testing,qa,проверка"
    }
  },
  {
    id: 5,
    name: "📚 Документация",
    description: "Шаблон для создания документации",
    category: "Documentation",
    template: {
      title: "Создать документацию: ",
      description: "Тип документации:\n\nЦель документации:\n\nЦелевая аудитория:\n\nСодержание:\n- [ ] \n- [ ] \n- [ ] \n\nФормат документа:\n\nГде будет размещена:\n\nСрок актуальности:",
      task_type: "task",
      priority: "low",
      tags: "документация,описание,техписание"
    }
  }
];

const CreateTaskPage = () => {
  const navigate = useNavigate();
  const { loading, loadingMessage, withLoading } = useLoading(false);
  
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
    project_id: null,
    no_deadline: true
  });

  const [errors, setErrors] = useState({});
  const [newTag, setNewTag] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);


  const handleChange = (field, value) => {
    setTaskData(prev => ({ ...prev, [field]: value }));
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

  const handleTemplateSelect = (template) => {
    setTaskData(prev => ({
      ...prev,
      title: template.template.title,
      description: template.template.description,
      task_type: template.template.task_type,
      priority: template.template.priority,
      tags: template.template.tags
    }));
    setSelectedTemplate(template);
    setShowTemplates(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    await withLoading(async () => {
      const taskToSave = {
        title: taskData.title,
        description: taskData.description,
        status: taskData.status,
        task_type: taskData.task_type,
        priority: taskData.priority,
        visibility: 'team',
        due_date: taskData.no_deadline ? null : (taskData.due_date && taskData.due_date.trim() !== '' ? new Date(taskData.due_date).toISOString() : null),
        start_date: taskData.no_deadline ? null : (taskData.start_date && taskData.start_date.trim() !== '' ? new Date(taskData.start_date).toISOString() : null),
        estimated_hours: taskData.estimated_hours && taskData.estimated_hours.trim() !== '' ? parseFloat(taskData.estimated_hours) : null,
        tags: taskData.tags && taskData.tags.trim() !== '' ? taskData.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        executor_id: null
      };

      await taskService.createTask(taskToSave);
      navigate('/tasks');
    }, 'Создание задачи...');
  };

  const addTag = () => {
    if (newTag.trim() && !taskData.tags.split(',').map(t => t.trim()).includes(newTag.trim())) {
      const currentTags = taskData.tags ? taskData.tags.split(',').map(t => t.trim()).filter(t => t) : [];
      handleChange('tags', [...currentTags, newTag.trim()].join(', '));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    const currentTags = taskData.tags ? taskData.tags.split(',').map(t => t.trim()).filter(t => t) : [];
    const updatedTags = currentTags.filter(tag => tag !== tagToRemove);
    handleChange('tags', updatedTags.join(', '));
  };

  const getCurrentTags = () => {
    return taskData.tags ? taskData.tags.split(',').map(t => t.trim()).filter(t => t) : [];
  };

  return (
    <LoadingWrapper loading={loading} message={loadingMessage} type="fullscreen">
      <div className={styles.createTaskPage}>
        <div className={styles.container}>
          {/* Заголовок */}
          <div className={styles.header}>
            <div className={styles.headerContent}>
              <div className={styles.titleSection}>
                <h1 className={styles.title}>
                  <span className={styles.titleIcon}>✨</span>
                  Создание новой задачи
                </h1>
                <p className={styles.subtitle}>
                  Создайте структурированную задачу с подробным описанием и настройками
                </p>
              </div>
              <div className={styles.headerActions}>
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className={styles.templateButton}
                >
                  <span className={styles.templateIcon}>📋</span>
                  Шаблоны
                </button>
                <button
                  onClick={() => navigate('/tasks')}
                  className={styles.backButton}
                >
                  <span className={styles.backIcon}>←</span>
                  Назад к задачам
                </button>
              </div>
            </div>
          </div>

          {/* Шаблоны */}
          {showTemplates && (
            <div className={styles.templatesSection}>
              <div className={styles.templatesHeader}>
                <h3 className={styles.templatesTitle}>Выберите шаблон</h3>
                <button
                  onClick={() => setShowTemplates(false)}
                  className={styles.closeTemplates}
                >
                  ✕
                </button>
              </div>
              <div className={styles.templatesGrid}>
                {TASK_TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className={`${styles.templateCard} ${selectedTemplate?.id === template.id ? styles.templateCardSelected : ''}`}
                  >
                    <div className={styles.templateHeader}>
                      <h4 className={styles.templateName}>{template.name}</h4>
                      <span className={styles.templateCategory}>{template.category}</span>
                    </div>
                    <p className={styles.templateDescription}>{template.description}</p>
                    <div className={styles.templateMeta}>
                      <span className={`${styles.priorityBadge} ${styles[`priority-${template.template.priority}`]}`}>
                        {template.template.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Форма */}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGrid}>
              {/* Основная информация */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>📝</span>
                  Основная информация
                </h3>
                
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Название задачи *
                  </label>
                  <input
                    type="text"
                    value={taskData.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
                    placeholder="Введите название задачи"
                  />
                  {errors.title && <span className={styles.errorText}>{errors.title}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Описание
                  </label>
                  <textarea
                    rows={6}
                    value={taskData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    className={styles.textarea}
                    placeholder="Подробное описание задачи..."
                  />
                </div>
              </div>

              {/* Настройки задачи */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>⚙️</span>
                  Настройки задачи
                </h3>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Статус</label>
                    <select
                      value={taskData.status}
                      onChange={(e) => handleChange("status", e.target.value)}
                      className={styles.select}
                    >
                      {statusOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.icon} {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Приоритет</label>
                    <select
                      value={taskData.priority}
                      onChange={(e) => handleChange("priority", e.target.value)}
                      className={styles.select}
                    >
                      {priorityOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.icon} {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Тип задачи</label>
                    <select
                      value={taskData.task_type}
                      onChange={(e) => handleChange("task_type", e.target.value)}
                      className={styles.select}
                    >
                      {taskTypeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.icon} {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>
              </div>

              {/* Временные рамки */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>📅</span>
                  Временные рамки
                </h3>

                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={taskData.no_deadline}
                      onChange={(e) => handleChange("no_deadline", e.target.checked)}
                      className={styles.checkbox}
                    />
                    <span className={styles.checkboxText}>Без срока выполнения</span>
                  </label>
                </div>

                {!taskData.no_deadline && (
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Дата начала</label>
                      <input
                        type="date"
                        value={taskData.start_date}
                        onChange={(e) => handleChange("start_date", e.target.value)}
                        className={styles.input}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Срок выполнения</label>
                      <input
                        type="date"
                        value={taskData.due_date}
                        onChange={(e) => handleChange("due_date", e.target.value)}
                        className={styles.input}
                      />
                    </div>
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Оценка времени (часы)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={taskData.estimated_hours}
                    onChange={(e) => handleChange("estimated_hours", e.target.value)}
                    className={`${styles.input} ${errors.estimated_hours ? styles.inputError : ''}`}
                    placeholder="0.0"
                  />
                  {errors.estimated_hours && <span className={styles.errorText}>{errors.estimated_hours}</span>}
                </div>
              </div>

              {/* Теги */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>🏷️</span>
                  Теги
                </h3>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Добавить тег</label>
                  <div className={styles.tagInput}>
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      className={styles.input}
                      placeholder="Введите тег и нажмите Enter"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className={styles.addTagButton}
                    >
                      +
                    </button>
                  </div>
                </div>

                {getCurrentTags().length > 0 && (
                  <div className={styles.tagsContainer}>
                    <label className={styles.label}>Текущие теги</label>
                    <div className={styles.tagsList}>
                      {getCurrentTags().map((tag, index) => (
                        <span key={index} className={styles.tag}>
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className={styles.removeTag}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Кнопки действий */}
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => navigate('/tasks')}
                className={styles.cancelButton}
              >
                Отмена
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={loading}
              >
                {loading ? 'Создание...' : 'Создать задачу'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </LoadingWrapper>
  );
};

export default CreateTaskPage;
