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

// Расширенный набор шаблонов для различных типов задач
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
  },
  {
    id: 6,
    name: "🚀 Релиз",
    description: "Подготовка и выпуск новой версии",
    category: "Release",
    template: {
      title: "Релиз версии ",
      description: "Версия:\n\nЧто включено в релиз:\n- \n- \n- \n\nЧек-лист подготовки:\n- [ ] Код-ревью завершено\n- [ ] Тестирование пройдено\n- [ ] Документация обновлена\n- [ ] Changelog подготовлен\n- [ ] База данных готова\n- [ ] Мониторинг настроен\n\nПлан развертывания:\n\nПлан отката:",
      task_type: "epic",
      priority: "critical",
      tags: "релиз,деплой,production"
    }
  },
  {
    id: 7,
    name: "🔧 Рефакторинг",
    description: "Улучшение существующего кода",
    category: "Refactoring",
    template: {
      title: "Рефакторинг: ",
      description: "Область рефакторинга:\n\nТекущие проблемы:\n\nЦели рефакторинга:\n- [ ] Улучшение читаемости\n- [ ] Повышение производительности\n- [ ] Упрощение архитектуры\n- [ ] Устранение дублирования\n\nПлан работы:\n1. \n2. \n3. \n\nРиски:\n\nТестирование после рефакторинга:",
      task_type: "task",
      priority: "medium",
      tags: "рефакторинг,оптимизация,код"
    }
  },
  {
    id: 8,
    name: "🔐 Безопасность",
    description: "Задачи по информационной безопасности",
    category: "Security",
    template: {
      title: "Безопасность: ",
      description: "Тип проблемы безопасности:\n\nОписание уязвимости:\n\nУровень критичности:\n- [ ] Низкий\n- [ ] Средний\n- [ ] Высокий\n- [ ] Критический\n\nВозможные последствия:\n\nПлан исправления:\n1. \n2. \n3. \n\nТребуется ли экстренное исправление:\n\nТестирование безопасности:",
      task_type: "bug",
      priority: "critical",
      tags: "безопасность,уязвимость,критично"
    }
  },
  {
    id: 9,
    name: "📊 Аналитика",
    description: "Сбор и анализ данных",
    category: "Analytics",
    template: {
      title: "Аналитика: ",
      description: "Цель анализа:\n\nИсточники данных:\n\nМетрики для отслеживания:\n- \n- \n- \n\nПериод анализа:\n\nИнструменты:\n\nОжидаемые выводы:\n\nФормат отчета:\n\nПолучатели отчета:",
      task_type: "task",
      priority: "medium",
      tags: "аналитика,данные,отчет"
    }
  },
  {
    id: 10,
    name: "🎨 UI/UX улучшения",
    description: "Улучшение пользовательского интерфейса",
    category: "Design",
    template: {
      title: "UI/UX: ",
      description: "Область интерфейса:\n\nТекущие проблемы:\n\nПредлагаемые улучшения:\n\nЦелевая аудитория:\n\nКритерии успеха:\n- [ ] \n- [ ] \n- [ ] \n\nТребуются ли макеты:\n\nТестирование с пользователями:\n\nВлияние на другие компоненты:",
      task_type: "feature",
      priority: "medium",
      tags: "ui,ux,дизайн,интерфейс"
    }
  },
  {
    id: 11,
    name: "⚡ Оптимизация производительности",
    description: "Улучшение скорости работы системы",
    category: "Performance",
    template: {
      title: "Оптимизация: ",
      description: "Проблемная область:\n\nТекущие метрики производительности:\n\nЦелевые метрики:\n\nПредполагаемые причины:\n\nПлан оптимизации:\n1. \n2. \n3. \n\nИнструменты для измерения:\n\nПотенциальные риски:\n\nТестирование производительности:",
      task_type: "task",
      priority: "high",
      tags: "производительность,оптимизация,скорость"
    }
  },
  {
    id: 12,
    name: "🤝 Интеграция",
    description: "Интеграция с внешними системами",
    category: "Integration",
    template: {
      title: "Интеграция с ",
      description: "Система для интеграции:\n\nЦель интеграции:\n\nТип интеграции:\n- [ ] API\n- [ ] Webhook\n- [ ] База данных\n- [ ] Файловый обмен\n\nТребования к данным:\n\nФормат обмена:\n\nАутентификация:\n\nОбработка ошибок:\n\nТестирование интеграции:",
      task_type: "feature",
      priority: "high",
      tags: "интеграция,api,внешние-системы"
    }
  },
  {
    id: 13,
    name: "🏗️ Инфраструктура",
    description: "Настройка и поддержка инфраструктуры",
    category: "Infrastructure",
    template: {
      title: "Инфраструктура: ",
      description: "Тип работы:\n- [ ] Настройка сервера\n- [ ] Обновление системы\n- [ ] Мониторинг\n- [ ] Резервное копирование\n- [ ] Масштабирование\n\nОкружение:\n- [ ] Development\n- [ ] Staging\n- [ ] Production\n\nТребования:\n\nПлан выполнения:\n1. \n2. \n3. \n\nВремя простоя:\n\nПлан отката:",
      task_type: "task",
      priority: "high",
      tags: "инфраструктура,сервер,devops"
    }
  },
  {
    id: 14,
    name: "📱 Мобильная разработка",
    description: "Задачи для мобильных приложений",
    category: "Mobile",
    template: {
      title: "Мобильное: ",
      description: "Платформа:\n- [ ] iOS\n- [ ] Android\n- [ ] Cross-platform\n\nОписание задачи:\n\nТребования:\n\nОсобенности платформы:\n\nТестирование на устройствах:\n\nПроизводительность:\n\nРазмер приложения:\n\nOffline поддержка:",
      task_type: "feature",
      priority: "medium",
      tags: "мобильное,ios,android,приложение"
    }
  },
  {
    id: 15,
    name: "🔄 Автоматизация",
    description: "Автоматизация процессов и задач",
    category: "Automation",
    template: {
      title: "Автоматизация: ",
      description: "Процесс для автоматизации:\n\nТекущий ручной процесс:\n\nЧастота выполнения:\n\nВремя экономии:\n\nИнструменты:\n- [ ] Скрипты\n- [ ] CI/CD\n- [ ] Cron jobs\n- [ ] Workflow\n\nВходные данные:\n\nВыходные данные:\n\nОбработка ошибок:\n\nУведомления:",
      task_type: "task",
      priority: "medium",
      tags: "автоматизация,скрипты,ci-cd"
    }
  },
  {
    id: 16,
    name: "🎓 Обучение/Исследование",
    description: "Изучение новых технологий",
    category: "Learning",
    template: {
      title: "Изучить: ",
      description: "Технология/Тема:\n\nЦель изучения:\n\nПрактическое применение:\n\nРесурсы для изучения:\n- \n- \n- \n\nВремя на изучение:\n\nПлан изучения:\n1. \n2. \n3. \n\nКритерии завершения:\n\nПоделиться знаниями с командой:",
      task_type: "task",
      priority: "low",
      tags: "обучение,исследование,технологии"
    }
  }
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
    project_id: null,
    no_deadline: true  // Добавляем флаг "Без срока"
  });

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [newTag, setNewTag] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

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

  const handleTemplateSelect = (templateData) => {
    // Заполняем форму данными из шаблона
    setTaskData(prev => ({
      ...prev,
      title: templateData.template.title,
      description: templateData.template.description,
      task_type: templateData.template.task_type,
      priority: templateData.template.priority,
      tags: templateData.template.tags
    }));
    
    console.log('Applied template:', templateData.name);
    setShowTemplates(false);
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
      due_date: taskData.no_deadline ? null : (taskData.due_date && taskData.due_date.trim() !== '' ? new Date(taskData.due_date).toISOString() : null),
      start_date: taskData.no_deadline ? null : (taskData.start_date && taskData.start_date.trim() !== '' ? new Date(taskData.start_date).toISOString() : null),
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

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Создать новую задачу</h2>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
            title="Создать задачу из готового шаблона"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Создать из шаблона
          </button>
        </div>

        {/* Выпадающий список шаблонов */}
        {showTemplates && (
          <div className="mb-6 bg-[#0f1b16] border border-gray-600 rounded-md p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-green-400">Выберите шаблон задачи</h3>
              <span className="text-sm text-gray-400">{TASK_TEMPLATES.length} шаблонов доступно</span>
            </div>
            
            <div className="max-h-80 overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {TASK_TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="p-3 bg-[#16251C] border border-gray-700 rounded-md cursor-pointer hover:bg-[#1A2B24] hover:border-green-500 hover:shadow-lg transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-white mb-1 group-hover:text-green-300">{template.name}</h4>
                        <p className="text-sm text-gray-400 mb-2 line-clamp-2">{template.description}</p>
                        <div className="flex items-center justify-between">
                          <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
                            template.category === 'Bug Fix' ? 'bg-red-100 text-red-800' :
                            template.category === 'Feature' ? 'bg-blue-100 text-blue-800' :
                            template.category === 'Security' ? 'bg-yellow-100 text-yellow-800' :
                            template.category === 'Performance' ? 'bg-purple-100 text-purple-800' :
                            template.category === 'Release' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {template.category}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            template.template.priority === 'critical' ? 'bg-red-600 text-white' :
                            template.template.priority === 'high' ? 'bg-orange-600 text-white' :
                            template.template.priority === 'medium' ? 'bg-blue-600 text-white' :
                            'bg-gray-600 text-white'
                          }`}>
                            {template.template.priority}
                          </span>
                        </div>
                      </div>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-green-400 ml-2 flex-shrink-0 group-hover:text-green-300 transition-colors"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-700 flex justify-between items-center">
              <div className="text-xs text-gray-500">
                💡 Шаблоны помогают быстро создавать структурированные задачи
              </div>
              <button
                onClick={() => setShowTemplates(false)}
                className="text-gray-400 hover:text-white text-sm underline transition-colors"
              >
                Отменить выбор шаблона
              </button>
            </div>
          </div>
        )}

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
              <span className="text-gray-300 flex items-center">
                <input
                  type="checkbox"
                  checked={taskData.no_deadline}
                  onChange={(e) => handleChange("no_deadline", e.target.checked)}
                  className="mr-2"
                />
                Без срока
              </span>
            </label>
            {!taskData.no_deadline && (
              <div className="space-y-2">
                <label className="block">
                  <span className="text-gray-300">Дата начала</span>
                  <input
                    type="date"
                    value={taskData.start_date}
                    onChange={(e) => handleChange("start_date", e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-600 bg-[#0f1b16] p-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </label>
                <label className="block">
                  <span className="text-gray-300">Срок выполнения</span>
                  <input
                    type="date"
                    value={taskData.due_date}
                    onChange={(e) => handleChange("due_date", e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-600 bg-[#0f1b16] p-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </label>
              </div>
            )}
            {taskData.no_deadline && (
              <div className="text-sm text-gray-400 italic">
                Срок выполнения: Без срока
              </div>
            )}
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
