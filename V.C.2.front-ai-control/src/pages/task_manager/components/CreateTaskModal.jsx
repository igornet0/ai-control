import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { projectService } from '../../../services/projectService';
import CustomSelect from '../selector/CustomSelect';
import TaskTags from './TaskTags';
import ProjectSearchPicker from '../../../components/shared/ProjectSearchPicker';
import TaskTeamAssigneeFields from './TaskTeamAssigneeFields';
import './CreateTaskModal.css';
import { CalendarViewIcon, CloseIcon, LightbulbIcon, SearchIcon, TaskTemplateIcon } from './TaskManagerIcons';
import { fromDateInputValue } from '../utils/dateInputUtils';

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
    icon: 'bug',
    name: "Исправление бага",
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
    icon: 'feature',
    name: "Новая функция",
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
    icon: 'review',
    name: "Код-ревью",
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
    icon: 'testing',
    name: "Тестирование",
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
    icon: 'documentation',
    name: "Документация",
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
    icon: 'release',
    name: "Релиз",
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
    icon: 'refactoring',
    name: "Рефакторинг",
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
    icon: 'security',
    name: "Безопасность",
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
    icon: 'analytics',
    name: "Аналитика",
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
    icon: 'design',
    name: "UI/UX улучшения",
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
    icon: 'performance',
    name: "Оптимизация производительности",
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
    icon: 'integration',
    name: "Интеграция",
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
    icon: 'infrastructure',
    name: "Инфраструктура",
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
    icon: 'mobile',
    name: "Мобильная разработка",
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
    icon: 'automation',
    name: "Автоматизация",
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
    icon: 'learning',
    name: "Обучение/Исследование",
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

const TEMPLATE_CATEGORY_LABELS = {
  'Bug Fix': 'Баг',
  Feature: 'Функция',
  Review: 'Ревью',
  Testing: 'Тесты',
  Documentation: 'Документы',
  Release: 'Релиз',
  Refactoring: 'Рефакторинг',
  Security: 'Безопасность',
  Analytics: 'Аналитика',
  Design: 'Дизайн',
  Performance: 'Скорость',
  Integration: 'Интеграция',
  Infrastructure: 'Инфра',
  Mobile: 'Мобильное',
  Automation: 'Автоматизация',
  Learning: 'Обучение',
};

const TEMPLATE_PRIORITY_LABELS = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критичный',
  urgent: 'Срочный',
};

const TEMPLATE_CATEGORIES = [...new Set(TASK_TEMPLATES.map((item) => item.category))];

function templateCategoryTone(category) {
  if (category === 'Bug Fix' || category === 'Security') return 'danger';
  if (category === 'Release' || category === 'Testing') return 'success';
  if (category === 'Performance' || category === 'Feature') return 'accent';
  if (category === 'Design' || category === 'Learning') return 'warm';
  return 'neutral';
}

function templatePriorityTone(priority) {
  if (priority === 'critical' || priority === 'urgent') return 'danger';
  if (priority === 'high') return 'warn';
  if (priority === 'medium') return 'accent';
  return 'neutral';
}

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
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [newTag, setNewTag] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateQuery, setTemplateQuery] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [checklistItems, setChecklistItems] = useState([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [teamId, setTeamId] = useState(null);
  const [executor, setExecutor] = useState(null);

  // Загрузка проектов
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setProjectsLoading(true);
        const projectsData = await projectService.getProjects();
        setProjects(Array.isArray(projectsData) ? projectsData : []);
      } catch (error) {
        console.error('Error loading projects:', error);
        setProjects([]);
      } finally {
        setProjectsLoading(false);
      }
    };
    loadProjects();
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

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

  // Функция для парсинга чек-листа из описания
  const parseChecklistFromDescription = (description) => {
    if (!description) return { cleanDescription: '', checklistItems: [] };
    
    // Регулярное выражение для поиска чек-листа в формате - [ ] или - [x] или * [ ] и т.д.
    const checklistRegex = /^[\s]*[-*]\s*\[([ xX]?)\]\s*(.+)$/gm;
    const checklistLines = [];
    let cleanDescription = description;
    
    // Находим все пункты чек-листа
    let match;
    const linesToRemove = [];
    
    while ((match = checklistRegex.exec(description)) !== null) {
      const isChecked = match[1].toLowerCase() === 'x';
      const text = match[2].trim();
      if (text) {
        checklistLines.push({
          fullMatch: match[0],
          isChecked,
          text
        });
        linesToRemove.push(match[0]);
      }
    }
    
    // Удаляем строки с чек-листом из описания
    if (linesToRemove.length > 0) {
      linesToRemove.forEach(line => {
        // Экранируем специальные символы для регулярного выражения
        const escapedLine = line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Удаляем строку с чек-листом
        cleanDescription = cleanDescription
          .replace(new RegExp(escapedLine + '\\s*\\n?', 'g'), '')
          .trim();
      });
      
      // Очищаем описание от пустых строк и лишних пробелов
      cleanDescription = cleanDescription
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n')
        .trim();
    }
    
    return { cleanDescription, checklistItems: checklistLines };
  };

  const handleTemplateSelect = (templateData) => {
    // Парсим описание и извлекаем чек-лист
    const { cleanDescription, checklistItems: parsedChecklist } = parseChecklistFromDescription(
      templateData.template.description
    );
    
    // Создаем элементы чек-листа из распарсенных данных
    if (parsedChecklist.length > 0) {
      const newChecklistItems = parsedChecklist.map((item, index) => ({
        id: Date.now() + index + Math.random(),
        text: item.text,
        completed: item.isChecked
      }));
      setChecklistItems(newChecklistItems);
    } else {
      // Если чек-листа нет, очищаем существующий
      setChecklistItems([]);
    }
    
    // Заполняем форму данными из шаблона
    setTaskData(prev => ({
      ...prev,
      title: templateData.template.title,
      description: cleanDescription, // Используем очищенное от чек-листа описание
      task_type: templateData.template.task_type,
      priority: templateData.template.priority,
      tags: templateData.template.tags
    }));
    
        setShowTemplates(false);
    setTemplateQuery('');
    setTemplateCategory('all');
  };

  const filteredTemplates = useMemo(() => {
    const query = templateQuery.trim().toLowerCase();
    return TASK_TEMPLATES.filter((template) => {
      if (templateCategory !== 'all' && template.category !== templateCategory) {
        return false;
      }
      if (!query) return true;
      const haystack = [
        template.name,
        template.description,
        TEMPLATE_CATEGORY_LABELS[template.category] || template.category,
        template.template?.tags,
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [templateQuery, templateCategory]);

  // Функции для работы с чек-листом
  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    
    const newItem = {
      id: Date.now() + Math.random(),
      text: newChecklistItem.trim(),
      completed: false
    };
    
    setChecklistItems(prev => [...prev, newItem]);
    setNewChecklistItem('');
  };

  const toggleChecklistItem = (itemId) => {
    setChecklistItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    ));
  };

  const removeChecklistItem = (itemId) => {
    setChecklistItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleChecklistKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChecklistItem();
    }
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    const assigneeId = executor?.id ?? null;
    const taskToSave = {
      title: taskData.title,
      description: taskData.description,
      status: taskData.status,
      task_type: taskData.task_type,
      priority: taskData.priority,
      visibility: teamId ? 'team' : 'personal',
      due_date: taskData.no_deadline ? null : fromDateInputValue(taskData.due_date),
      start_date: taskData.no_deadline ? null : fromDateInputValue(taskData.start_date),
      estimated_hours: taskData.estimated_hours && taskData.estimated_hours.trim() !== '' ? parseFloat(taskData.estimated_hours) : null,
      tags: taskData.tags && taskData.tags.trim() !== '' ? taskData.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
      team_id: teamId || null,
      assignee_id: assigneeId,
      executor_id: assigneeId,
      meta_data: checklistItems.length > 0 ? { checklist: checklistItems } : {},
      project_id: taskData.project_id || null,
    };

        onSave(taskToSave);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-[10000] p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-600 rounded-lg p-6 w-full max-w-2xl text-white relative shadow-2xl max-h-[90vh] overflow-y-auto overflow-x-visible"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-slate-700 text-2xl font-bold leading-none w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
          aria-label="Close modal"
        >
          <CloseIcon size="md" />
        </button>

        <div className="flex justify-between items-center mb-6 pr-8">
          <h2 className="text-2xl font-semibold bg-gradient-to-r from-slate-200 to-slate-400 bg-clip-text text-transparent">Создать новую задачу</h2>
          <button
            onClick={() => setShowTemplates((open) => !open)}
            className={`create-task-templates__open${showTemplates ? ' is-open' : ''}`}
            title="Создать задачу из готового шаблона"
          >
            {showTemplates ? 'Скрыть шаблоны' : 'Из шаблона'}
          </button>
        </div>

        {showTemplates && (
          <section className="create-task-templates">
            <div className="create-task-templates__header">
              <div>
                <h3>Шаблоны задач</h3>
                <p>Заполнят название, описание и приоритет — останется только уточнить детали</p>
              </div>
              <span className="create-task-templates__count">
                {filteredTemplates.length} из {TASK_TEMPLATES.length}
              </span>
            </div>

            <div className="create-task-templates__search">
              <SearchIcon className="create-task-templates__search-icon" size="sm" />
              <input
                type="search"
                value={templateQuery}
                onChange={(event) => setTemplateQuery(event.target.value)}
                placeholder="Поиск по названию или тегам…"
                autoComplete="off"
              />
            </div>

            <div className="create-task-templates__filters">
              <button
                type="button"
                className={`create-task-templates__chip${templateCategory === 'all' ? ' is-active' : ''}`}
                onClick={() => setTemplateCategory('all')}
              >
                Все
              </button>
              {TEMPLATE_CATEGORIES.map((category) => (
                <button
                  type="button"
                  key={category}
                  className={`create-task-templates__chip${templateCategory === category ? ' is-active' : ''}`}
                  onClick={() => setTemplateCategory(category)}
                >
                  {TEMPLATE_CATEGORY_LABELS[category] || category}
                </button>
              ))}
            </div>

            <div className="create-task-templates__grid">
              {filteredTemplates.length === 0 ? (
                <p className="create-task-templates__empty">Нет шаблонов по этому запросу</p>
              ) : (
                filteredTemplates.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    className="create-task-templates__card"
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <div className="create-task-templates__card-top">
                      <span className={`create-task-templates__icon is-${templateCategoryTone(template.category)}`}>
                        <TaskTemplateIcon icon={template.icon} size="sm" />
                      </span>
                      <span className={`create-task-templates__priority is-${templatePriorityTone(template.template.priority)}`}>
                        {TEMPLATE_PRIORITY_LABELS[template.template.priority] || template.template.priority}
                      </span>
                    </div>
                    <h4>{template.name}</h4>
                    <p>{template.description}</p>
                    <span className="create-task-templates__category">
                      {TEMPLATE_CATEGORY_LABELS[template.category] || template.category}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="create-task-templates__footer">
              <span>
                <LightbulbIcon size="xs" className="text-slate-500" />
                Клик по карточке подставит шаблон в форму
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowTemplates(false);
                  setTemplateQuery('');
                  setTemplateCategory('all');
                }}
              >
                Закрыть
              </button>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
          {/* Title */}
          <div className="md:col-span-2">
            <label className="block mb-2">
              <span className="text-slate-300">Название *</span>
              <input
                type="text"
                value={taskData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                className={`mt-1 block w-full rounded-lg border p-3 text-white bg-slate-800 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                  errors.title ? 'border-red-500' : 'border-slate-600'
                }`}
                placeholder="Введите название задачи"
              />
              {errors.title && <span className="text-red-400 text-sm mt-1 block">{errors.title}</span>}
            </label>
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="block mb-2">
              <span className="text-slate-300">Описание</span>
              <textarea
                rows={3}
                value={taskData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-800 p-3 text-white resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 backdrop-blur-sm"
                placeholder="Введите описание задачи..."
              />
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="block mb-2">
              <span className="text-slate-300">Проект</span>
              <span className="block text-xs text-slate-500 mt-0.5 mb-1">
                Привязать задачу к существующему проекту (необязательно)
              </span>
              <ProjectSearchPicker
                projects={projects}
                loading={projectsLoading}
                value={taskData.project_id}
                onChange={(projectId) => handleChange('project_id', projectId)}
              />
            </label>
          </div>

          <TaskTeamAssigneeFields
            teamId={teamId}
            executor={executor}
            onTeamChange={setTeamId}
            onExecutorChange={setExecutor}
          />

          {/* Status and Priority */}
          <div>
            <label className="block mb-2">
              <span className="text-slate-300">Статус</span>
              <CustomSelect
                options={statusOptions}
                value={taskData.status}
                onChange={(val) => handleChange("status", val)}
              />
            </label>
          </div>

          <div>
            <label className="block mb-2">
              <span className="text-slate-300">Приоритет</span>
              <CustomSelect
                options={priorityOptions}
                value={taskData.priority}
                onChange={(val) => handleChange("priority", val)}
              />
            </label>
          </div>

          <div>
            <label className="block mb-2">
              <span className="text-slate-300">Тип задачи</span>
              <CustomSelect
                options={taskTypeOptions}
                value={taskData.task_type}
                onChange={(val) => handleChange("task_type", val)}
              />
            </label>
          </div>

          <div>
            <label className="block mb-2">
              <span className="text-slate-300">Оценка в часах</span>
              <input
                type="number"
                step="0.5"
                min="0"
                value={taskData.estimated_hours}
                onChange={(e) => handleChange("estimated_hours", e.target.value)}
                className={`mt-1 block w-full rounded-lg border p-3 text-white bg-slate-800 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                  errors.estimated_hours ? 'border-red-500' : 'border-slate-600'
                }`}
                placeholder="0.0"
              />
              {errors.estimated_hours && <span className="text-red-400 text-sm mt-1 block">{errors.estimated_hours}</span>}
            </label>
          </div>

          <div className="md:col-span-2">
            <section className="create-task-deadline">
              <div className="create-task-deadline__header">
                <div className="create-task-deadline__title">
                  <CalendarViewIcon size="sm" className="text-blue-400" />
                  <span>Срок выполнения</span>
                </div>
                <div className="create-task-deadline__toggle" role="group" aria-label="Режим срока">
                  <button
                    type="button"
                    className={`create-task-deadline__toggle-btn${taskData.no_deadline ? ' is-active' : ''}`}
                    onClick={() => handleChange('no_deadline', true)}
                    aria-pressed={taskData.no_deadline}
                  >
                    Без срока
                  </button>
                  <button
                    type="button"
                    className={`create-task-deadline__toggle-btn${!taskData.no_deadline ? ' is-active' : ''}`}
                    onClick={() => handleChange('no_deadline', false)}
                    aria-pressed={!taskData.no_deadline}
                  >
                    Указать даты
                  </button>
                </div>
              </div>

              {taskData.no_deadline ? (
                <p className="create-task-deadline__hint">
                  Дедлайн не задан — даты можно добавить позже в карточке задачи
                </p>
              ) : (
                <div className="create-task-deadline__dates">
                  <label className="create-task-deadline__field">
                    <span>Дата начала</span>
                    <input
                      type="date"
                      value={taskData.start_date}
                      onChange={(e) => handleChange('start_date', e.target.value)}
                    />
                  </label>
                  <label className="create-task-deadline__field">
                    <span>Срок выполнения</span>
                    <input
                      type="date"
                      value={taskData.due_date}
                      onChange={(e) => handleChange('due_date', e.target.value)}
                    />
                  </label>
                </div>
              )}
            </section>
          </div>

          {/* Tags */}
          <div className="md:col-span-2">
            <label className="block mb-2">
              <span className="text-slate-300">Теги</span>
              <TaskTags
                tags={taskData.tags ? taskData.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []}
                onTagsChange={(tags) => handleChange("tags", tags.join(', '))}
              />
            </label>
          </div>

          {/* Checklist */}
          <div className="md:col-span-2">
            <label className="block mb-2">
              <span className="text-slate-300">Чек-лист</span>
              <div className="mt-2 bg-slate-800/50 border border-slate-600 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyPress={handleChecklistKeyPress}
                    className="flex-1 rounded-lg border border-slate-600 bg-slate-700 p-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                    placeholder="Добавить пункт чек-листа..."
                  />
                  <button
                    onClick={addChecklistItem}
                    disabled={!newChecklistItem.trim()}
                    className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-medium transition-all duration-200 whitespace-nowrap"
                  >
                    Добавить
                  </button>
                </div>

                {checklistItems.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {checklistItems.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 bg-slate-700/50 border rounded-lg transition-all duration-200 ${
                          item.completed
                            ? 'border-slate-600 opacity-60'
                            : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => toggleChecklistItem(item.id)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all duration-200"
                        />
                        <span
                          className={`flex-1 text-sm transition-all duration-200 ${
                            item.completed
                              ? 'text-slate-500 line-through'
                              : 'text-slate-200'
                          }`}
                        >
                          {item.text}
                        </span>
                        <button
                          onClick={() => removeChecklistItem(item.id)}
                          className="text-slate-400 hover:text-red-400 transition-colors opacity-80 hover:opacity-100 p-1 rounded hover:bg-slate-600"
                          title="Удалить пункт"
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm italic text-center py-4">
                    Нет пунктов в чек-листе. Добавьте первый пункт выше.
                  </div>
                )}

                {checklistItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-600 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Выполнено: {checklistItems.filter(item => item.completed).length} / {checklistItems.length}
                    </span>
                    {checklistItems.filter(item => item.completed).length > 0 && (
                      <button
                        onClick={() => setChecklistItems(prev => prev.filter(item => !item.completed))}
                        className="text-slate-400 hover:text-red-400 transition-colors underline"
                      >
                        Удалить выполненные
                      </button>
                    )}
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-slate-600">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-all duration-200 font-medium shadow-md hover:shadow-lg"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 font-medium shadow-md hover:shadow-lg"
          >
            Создать задачу
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
