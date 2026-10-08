import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import CustomSelect from "../selector/CustomSelect";
import { updateTask, getTask, submitTaskForReview, approveTaskReview, rejectTaskReview } from "../../../services/taskService";
import { getTaskPermissions } from "../utils/taskPermissions";
import { getTaskChangeLog } from "../utils/taskChangeLogUtils";
import { isTaskOverdue, normalizeTaskStatus } from "../utils/performanceUtils";
import { toDateInputValue, fromDateInputValue } from "../utils/dateInputUtils";
import { projectService } from "../../../services/projectService";
import ProjectSearchPicker, { findProjectIdForTask } from "../../../components/shared/ProjectSearchPicker";
import TaskTeamAssigneeFields from "./TaskTeamAssigneeFields";
import TaskComments from "./TaskComments";
import TaskTimeLog from "./TaskTimeLog";
import TaskAttachments from "./TaskAttachments";
import {
  CheckIcon,
  CloseIcon,
  IconWithText,
  MyTasksIcon,
  TaskStatusIcon,
} from "./TaskManagerIcons";
import { showTaskToast } from "../../../components/shared/taskToast";
import ConfirmDialog from "../../../components/shared/ConfirmDialog";
import { confirmAction } from "../../../components/shared/confirmAction";
import { useDocumentTitle } from "../../../hooks/useDocumentTitle";

const statusOptions = [
  { value: "created", label: "Создана" },
  { value: "in_progress", label: "В работе" },
  { value: "review", label: "На проверке" },
  { value: "completed", label: "Завершена" },
  { value: "cancelled", label: "Отменена" },
  { value: "on_hold", label: "На паузе" },
  { value: "blocked", label: "Заблокирована" },
];

const priorityOptions = [
  { value: "low", label: "Низкий" },
  { value: "medium", label: "Средний" },
  { value: "high", label: "Высокий" },
  { value: "critical", label: "Критичный" },
  { value: "urgent", label: "Срочный" },
];

const STATUS_META = {
  created: { label: "Создана", badge: "bg-slate-500/15 text-slate-200 ring-slate-400/30" },
  in_progress: { label: "В работе", badge: "bg-blue-500/15 text-blue-200 ring-blue-400/30" },
  review: { label: "На проверке", badge: "bg-amber-500/15 text-amber-200 ring-amber-400/30" },
  completed: { label: "Завершена", badge: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30" },
  cancelled: { label: "Отменена", badge: "bg-slate-600/20 text-slate-400 ring-slate-500/30" },
  on_hold: { label: "На паузе", badge: "bg-orange-500/15 text-orange-200 ring-orange-400/30" },
  blocked: { label: "Заблокирована", badge: "bg-red-500/15 text-red-200 ring-red-400/30" },
};

function SectionTitle({ children, aside }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2.5">
      <h3 className="text-sm font-semibold text-slate-200">{children}</h3>
      {aside}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <span className="text-xs font-medium text-slate-400 mb-1.5 block">{label}</span>
      {children}
    </div>
  );
}

/** Редактируемые поля задачи в том виде, в каком их держит форма. */
const buildEditableSnapshot = (task) => ({
  title: task.title || "",
  status: normalizeTaskStatus(task.status) || "created",
  priority: task.priority || "medium",
  due_date: toDateInputValue(task.due_date),
  description: task.description || "",
  executor_id: task.executor_id ?? null,
  team_id: task.team_id ?? null,
  checklist: Array.isArray(task.meta_data?.checklist) ? task.meta_data.checklist : [],
});

export default function TaskDetails({ task, onClose, onSave, onDelete, onTaskUpdate, currentUser, overlayZIndex = 9999 }) {
  useDocumentTitle([task.title || (task.id ? `Задача #${task.id}` : "Новая задача"), "Задачи"]);
  // Локальный стейт для редактирования
  const [editedTask, setEditedTask] = useState({
    title: task.title || "",
    status: normalizeTaskStatus(task.status) || "created",
    priority: task.priority || "medium",
    due_date: toDateInputValue(task.due_date),
    description: task.description || "",
  });
  const [executor, setExecutor] = useState(() => (
    task.executor_id
      ? { id: task.executor_id, name: task.executor_name || "" }
      : null
  ));
  const [teamId, setTeamId] = useState(task.team_id ?? null);

  // Состояние, с которым сравниваем форму, чтобы понять, есть ли несохранённые изменения.
  const [baseline, setBaseline] = useState(() => buildEditableSnapshot(task));
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [activityTab, setActivityTab] = useState('comments');
  const [commentCount, setCommentCount] = useState(0);
  const [timeLogCount, setTimeLogCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [checklistItems, setChecklistItems] = useState([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectId, setProjectId] = useState(task.project_id ?? null);
  const [projectResolved, setProjectResolved] = useState(!!task.project_id);
  const [projectChanging, setProjectChanging] = useState(false);
  const [isWorkflowBusy, setIsWorkflowBusy] = useState(false);

  const permissions = useMemo(
    () => getTaskPermissions(task, currentUser),
    [task, currentUser, task.permissions],
  );
  const canEdit = permissions.can_edit;
  const canModerate = permissions.can_moderate;
  const canTakeTask = permissions.can_take_task;
  const canReassign = Boolean(
    permissions.can_reassign
    ?? (permissions.can_delete || permissions.is_department_manager || permissions.is_team_manager),
  );
  const isAlreadyAssignedToMe =
    currentUser?.id != null &&
    (executor?.id ?? task.executor_id) === currentUser.id;
  const showTakeOnMyselfButton = isAlreadyAssignedToMe || canTakeTask;

  const changeLog = useMemo(() => getTaskChangeLog(task), [task.meta_data?.change_log, task.id]);
  // Стабильная ссылка: новый [] на каждой перерисовке сбрасывал бы список вложений
  const initialAttachments = useMemo(
    () => task.attachments || task.meta_data?.attachments || [],
    [task.attachments, task.meta_data?.attachments],
  );

  const filteredStatusOptions = useMemo(() => {
    if (permissions.can_submit_review) {
      return statusOptions.filter(
        (option) => option.value !== "review" && option.value !== "completed",
      );
    }
    return statusOptions;
  }, [permissions.can_submit_review]);

  // Блокируем скролл body при открытии модального окна
  useEffect(() => {
    // Сохраняем текущее значение overflow
    const originalOverflow = document.body.style.overflow;
    // Блокируем скролл
    document.body.style.overflow = 'hidden';
    
    // Восстанавливаем скролл при размонтировании
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Закрываем модальное окно при нажатии Escape (с вопросом, если есть несохранённые изменения)
  const escapeHandlerRef = useRef(null);
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        escapeHandlerRef.current?.();
      }
    };

    document.addEventListener('keydown', handleEscape, true);
    return () => {
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, []);

  // Загружаем чек-лист из meta_data при загрузке компонента
  useEffect(() => {
    const checklist = Array.isArray(task.meta_data?.checklist) ? task.meta_data.checklist : [];
    setChecklistItems(checklist);
    setBaseline((prev) => ({ ...prev, checklist }));
  }, [task.meta_data]);

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
    setProjectId(task.project_id ?? null);
    setProjectResolved(!!task.project_id);
  }, [task.id, task.project_id]);

  useEffect(() => {
    setTeamId(task.team_id ?? null);
    setExecutor(
      task.executor_id
        ? { id: task.executor_id, name: task.executor_name || '' }
        : null,
    );
    setBaseline((prev) => ({
      ...prev,
      executor_id: task.executor_id ?? null,
      team_id: task.team_id ?? null,
    }));
  }, [task.id, task.team_id, task.executor_id, task.executor_name]);

  useEffect(() => {
    if (task.project_id || projectResolved) return;

    let cancelled = false;

    const resolveProjectFromApi = async () => {
      try {
        const fullTask = await getTask(task.id);
        if (!cancelled && fullTask?.project_id) {
          setProjectId(fullTask.project_id);
        }
      } catch (error) {
        console.error('Error resolving task project:', error);
      } finally {
        if (!cancelled) {
          setProjectResolved(true);
        }
      }
    };

    if (!projectsLoading) {
      const foundId = findProjectIdForTask(projects, task.id);
      if (foundId != null) {
        setProjectId(foundId);
        setProjectResolved(true);
        return undefined;
      }
    }

    if (projectsLoading) return undefined;

    resolveProjectFromApi();
    return () => {
      cancelled = true;
    };
  }, [projects, projectsLoading, task.id, task.project_id, projectResolved]);

  const handleProjectChange = async (nextProjectId) => {
    if (nextProjectId === projectId) return;

    try {
      setProjectChanging(true);
      setErrors((prev) => ({ ...prev, project: '' }));

      let currentProjectId = projectId;
      if (!currentProjectId) {
        try {
          const fullTask = await getTask(task.id);
          currentProjectId = fullTask?.project_id ?? null;
        } catch (error) {
          console.error('Error loading current task project:', error);
        }
      }

      if (currentProjectId && currentProjectId !== nextProjectId) {
        await projectService.removeTaskFromProject(currentProjectId, task.id);
      }
      if (nextProjectId) {
        try {
          await projectService.addTaskToProject(nextProjectId, task.id);
        } catch (error) {
          if (error.response?.status === 409) {
            setProjectId(nextProjectId);
            if (onTaskUpdate) onTaskUpdate();
            return;
          }
          throw error;
        }
      }

      setProjectId(nextProjectId);
      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error) {
      console.error('Error updating task project:', error);
      setErrors({
        project: error.response?.data?.detail || 'Не удалось изменить проект задачи',
      });
    } finally {
      setProjectChanging(false);
    }
  };

  // Функция для переключения состояния пункта чек-листа
  const toggleChecklistItem = (itemId) => {
    if (!canEdit) return;
    setChecklistItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const completed = !item.completed;
      return {
        ...item,
        completed,
        completed_at: completed ? new Date().toISOString() : undefined,
      };
    }));
  };

  // Функция для добавления нового пункта чек-листа
  const addChecklistItem = () => {
    if (!canEdit || !newChecklistItem.trim()) return;
    
    const newItem = {
      id: Date.now() + Math.random(),
      text: newChecklistItem.trim(),
      completed: false
    };
    
    setChecklistItems(prev => [...prev, newItem]);
    setNewChecklistItem('');
  };

  // Функция для удаления пункта чек-листа
  const removeChecklistItem = (itemId) => {
    if (!canEdit) return;
    setChecklistItems(prev => prev.filter(item => item.id !== itemId));
  };

  // Функция для начала редактирования пункта
  const startEditingItem = (itemId, currentText) => {
    setEditingItemId(itemId);
    setEditingText(currentText);
  };

  // Функция для сохранения изменений пункта
  const saveEditingItem = () => {
    if (editingText.trim() && editingItemId) {
      setChecklistItems(prev => prev.map(item => 
        item.id === editingItemId ? { ...item, text: editingText.trim() } : item
      ));
    }
    setEditingItemId(null);
    setEditingText('');
  };

  // Функция для отмены редактирования
  const cancelEditingItem = () => {
    setEditingItemId(null);
    setEditingText('');
  };

  // Обработка нажатия Enter при добавлении пункта
  const handleChecklistKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChecklistItem();
    }
  };

  // Обработка нажатия Enter при редактировании пункта
  const handleEditKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEditingItem();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditingItem();
    }
  };

  // Текущее состояние формы в том же виде, что и baseline
  const currentSnapshot = useMemo(() => ({
    ...editedTask,
    executor_id: executor?.id ?? null,
    team_id: teamId ?? null,
    checklist: checklistItems,
  }), [editedTask, executor, teamId, checklistItems]);

  const isDirty = useMemo(
    () => JSON.stringify(currentSnapshot) !== JSON.stringify(baseline),
    [currentSnapshot, baseline],
  );
  // Без права редактирования сохранить всё равно нельзя — спрашивать незачем.
  const hasUnsavedChanges = canEdit && isDirty;

  // Закрытие вкладки / перезагрузка страницы: браузер покажет свой стандартный вопрос.
  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /** Сохраняет задачу; true — если сохранение прошло успешно. */
  const saveTask = async () => {
    if (!canEdit) {
      return false;
    }

    if (!validateForm()) {
      return false;
    }

    try {
      setIsSaving(true);
      
      // Подготавливаем данные для отправки
      const updateData = {
        title: editedTask.title,
        status: editedTask.status,
        priority: editedTask.priority,
        due_date: fromDateInputValue(editedTask.due_date),
        description: editedTask.description && editedTask.description.trim() !== '' ? editedTask.description : null,
        meta_data: {
          ...(task.meta_data || {}),
          checklist: checklistItems.length > 0 ? checklistItems : undefined
        },
      };

      if ((executor?.id ?? null) !== (task.executor_id ?? null)) {
        updateData.executor_id = executor?.id ?? null;
      }

      if ((teamId ?? null) !== (task.team_id ?? null)) {
        updateData.team_id = teamId ?? null;
      }

                  
      // Отправляем обновление на сервер
      const updated = await updateTask(task.id, updateData);
      setBaseline(currentSnapshot);
      
      setExecutor(
        executor?.id
          ? { id: executor.id, name: executor.name }
          : null,
      );
      
      // Вызываем callback для обновления родительского компонента
      if (onTaskUpdate) {
        onTaskUpdate();
      }
      
      // Вызываем callback для сохранения (если передан)
      if (onSave) {
        onSave({
          ...task,
          ...editedTask,
          ...updated,
          executor_id: executor?.id ?? null,
          executor_name: executor?.name || '',
          team_id: teamId ?? null,
        });
      }

      return true;
    } catch (error) {
      console.error('Error updating task:', error);
      setErrors({ general: 'Failed to update task. Please try again.' });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (await saveTask()) {
      onClose();
    }
  };

  const handleWorkflowAction = async (action) => {
    const actionMap = {
      submit: submitTaskForReview,
      approve: approveTaskReview,
      reject: rejectTaskReview,
    };
    const request = actionMap[action];
    if (!request) return;

    try {
      setIsWorkflowBusy(true);
      setErrors({});
      const updated = await request(task.id);
      if (updated?.status) {
        const nextStatus = normalizeTaskStatus(updated.status);
        setEditedTask((prev) => ({ ...prev, status: nextStatus }));
        setBaseline((prev) => ({ ...prev, status: nextStatus }));
      }
      if (onTaskUpdate) {
        onTaskUpdate();
      }
      showTaskToast({
        type: 'success',
        title: action === 'submit'
          ? 'Задача отправлена на проверку'
          : action === 'approve'
            ? 'Задача подтверждена'
            : 'Задача возвращена на доработку',
        duration: 3000,
      });
      if (action === 'approve') {
        onClose();
      }
    } catch (error) {
      console.error('Workflow action failed:', error);
      setErrors({
        general: error.response?.data?.detail || 'Не удалось выполнить действие',
      });
    } finally {
      setIsWorkflowBusy(false);
    }
  };

  // Функция для взятия задачи на себя
  const handleTakeOnMyself = async () => {
    if (!currentUser) {
      setErrors({ general: 'You must be logged in to take a task on yourself.' });
      return;
    }

    try {
      setIsSaving(true);
      
      // Обновляем задачу, устанавливая текущего пользователя как исполнителя
      const updateData = {
        executor_id: currentUser.id,
        status: 'in_progress' // Автоматически меняем статус на "в работе"
      };

            
      // Отправляем обновление на сервер
      await updateTask(task.id, updateData);
      
      const assigneeName = currentUser.name || currentUser.username || currentUser.login || 'Я';
      setExecutor({ id: currentUser.id, name: assigneeName });
      setEditedTask((prev) => ({ ...prev, status: updateData.status }));
      setBaseline((prev) => ({ ...prev, executor_id: currentUser.id, status: updateData.status }));
      
      // Вызываем callback для обновления родительского компонента
      if (onTaskUpdate) {
        onTaskUpdate();
      }
      
      setErrors({});
    } catch (error) {
      console.error('Error taking task on myself:', error);
      setErrors({ general: 'Failed to take task on yourself. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Вычисляем прогресс чек-листа
  const checklistProgress = useMemo(() => {
    if (checklistItems.length === 0) return null;
    const completed = checklistItems.filter(item => item.completed).length;
    return { completed, total: checklistItems.length, percentage: Math.round((completed / checklistItems.length) * 100) };
  }, [checklistItems]);

  const handleOverlayClick = (e) => {
    // Закрываем модальное окно только при клике на overlay, а не на содержимое
    if (e.target === e.currentTarget) {
      safeClose(e);
    }
  };

  /** Avoid click-through to calendar/kanban under the portal after unmount. */
  const closeNow = () => {
    window.setTimeout(() => {
      onClose?.();
    }, 0);
  };

  /** Закрыть окно; при несохранённых изменениях — сначала спросить. */
  const safeClose = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
      return;
    }
    closeNow();
  };

  const handleUnsavedCancel = () => {
    if (isSaving) return;
    setShowUnsavedDialog(false);
  };

  const handleUnsavedDiscard = () => {
    if (isSaving) return;
    setShowUnsavedDialog(false);
    closeNow();
  };

  const handleUnsavedSave = async () => {
    if (isSaving) return;
    const saved = await saveTask();
    setShowUnsavedDialog(false);
    // При ошибке остаёмся в форме — там видно, что пошло не так.
    if (saved) {
      closeNow();
    }
  };

  escapeHandlerRef.current = showUnsavedDialog ? handleUnsavedCancel : safeClose;

  const statusMeta = STATUS_META[editedTask.status] || STATUS_META.created;
  const overdue = isTaskOverdue({ due_date: editedTask.due_date, status: editedTask.status });
  const hasWorkflowActions = Boolean(
    permissions.can_approve_review
    || permissions.can_reject_review
    || permissions.can_submit_review
    || (currentUser && showTakeOnMyselfButton)
  );
  const activityTabs = [
    { id: 'comments', label: 'Комментарии', count: commentCount },
    { id: 'time', label: 'Учёт времени', count: timeLogCount },
    { id: 'history', label: 'История', count: changeLog.length },
  ];

  return createPortal(
    <>
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-start p-2 sm:p-4 sm:pt-10 animate-fadeIn"
      style={{ zIndex: overlayZIndex }}
      onClick={handleOverlayClick}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editedTask.title || 'Задача'}
        className="w-full max-w-6xl max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-5rem)] flex flex-col rounded-2xl border border-slate-700/60 bg-slate-900 text-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Шапка: номер, статус, проект и название */}
        <header className="relative shrink-0 border-b border-slate-700/60 bg-slate-800/40 px-4 sm:px-6 pt-4 pb-3">
          <div className="flex items-center gap-2 flex-wrap text-xs pr-10">
            {task.id && (
              <span className="font-mono text-slate-400">#{task.id}</span>
            )}
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ring-1 ring-inset ${statusMeta.badge}`}>
              <TaskStatusIcon status={editedTask.status} size="xs" />
              {statusMeta.label}
            </span>
            {overdue && (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 font-medium bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-400/30">
                Просрочена
              </span>
            )}
            {hasUnsavedChanges && (
              <span className="inline-flex items-center gap-1.5 text-amber-300/90">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden />
                Есть несохранённые изменения
              </span>
            )}
          </div>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={safeClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
            aria-label="Close details"
            title="Закрыть (Esc)"
          >
            <CloseIcon size="md" />
          </button>

          <input
            type="text"
            value={editedTask.title}
            onChange={(e) => handleChange("title", e.target.value)}
            disabled={!canEdit}
            aria-label="Название задачи"
            className={`mt-2 w-full -mx-2 px-2 py-1 rounded-lg bg-transparent text-xl sm:text-2xl font-semibold text-white placeholder:text-slate-500 border transition-colors focus:outline-none focus:bg-slate-800/70 focus:border-blue-500/60 disabled:cursor-not-allowed ${
              errors.title ? 'border-red-500/60' : 'border-transparent hover:border-slate-600/60'
            }`}
            placeholder="Название задачи"
          />
          {errors.title && <span className="text-red-400 text-sm mt-1 block">{errors.title}</span>}
        </header>

        {/* Прокручиваемое содержимое */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {(errors.general
            || (permissions.is_assignee_locked && editedTask.status === 'review')
            || (permissions.is_assignee_locked && editedTask.status === 'completed')
            || permissions.workflow_warning
            || task.meta_data?.workflow?.warning) && (
            <div className="px-4 sm:px-6 pt-4 space-y-2">
              {errors.general && (
                <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-200 text-sm">
                  {errors.general}
                </div>
              )}
              {permissions.is_assignee_locked && editedTask.status === 'review' && (
                <div className="p-3 bg-amber-900/30 border border-amber-700/50 rounded-lg text-amber-100 text-sm">
                  На проверке у начальника отдела — редактирование недоступно до возврата на доработку.
                </div>
              )}
              {permissions.is_assignee_locked && editedTask.status === 'completed' && (
                <div className="p-3 bg-slate-700/40 border border-slate-600/50 rounded-lg text-slate-200 text-sm">
                  Подтверждена — редактирование недоступно.
                </div>
              )}
              {(permissions.workflow_warning || task.meta_data?.workflow?.warning) && (
                <div className="p-3 bg-orange-900/30 border border-orange-700/50 rounded-lg text-orange-100 text-sm">
                  {permissions.workflow_warning || task.meta_data?.workflow?.warning}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-6 p-4 sm:p-6">
            {/* Основное: описание, чек-лист, файлы, активность */}
            <div className="min-w-0 space-y-6">
              <section>
                <SectionTitle>Описание</SectionTitle>
                <textarea
                  rows={5}
                  value={editedTask.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  disabled={!canEdit}
                  className="w-full rounded-xl border border-slate-700/60 bg-slate-800/40 p-3.5 text-sm leading-relaxed text-slate-100 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors hover:border-slate-600 disabled:opacity-60 disabled:cursor-not-allowed placeholder:text-slate-500"
                  placeholder="Опишите, что нужно сделать…"
                />
              </section>

              <section>
                <SectionTitle
                  aside={checklistProgress && (
                    <span className="text-xs text-slate-400 tabular-nums">
                      {checklistProgress.completed} из {checklistProgress.total}
                    </span>
                  )}
                >
                  Чек-лист
                </SectionTitle>

                {checklistProgress && (
                  <div className="h-1.5 rounded-full bg-slate-700/60 overflow-hidden mb-3" aria-hidden>
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${checklistProgress.percentage}%` }}
                    />
                  </div>
                )}

                {checklistItems.length > 0 && (
                  <ul className="space-y-1 mb-2 max-h-64 overflow-y-auto">
                    {checklistItems.map((item) => (
                      <li
                        key={item.id}
                        className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-800/60 transition-colors"
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={Boolean(item.completed)}
                          aria-label={item.text}
                          onClick={() => toggleChecklistItem(item.id)}
                          disabled={!canEdit}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors disabled:cursor-not-allowed ${
                            item.completed
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-slate-500 hover:border-emerald-400'
                          }`}
                        >
                          {item.completed && (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          {editingItemId === item.id ? (
                            <input
                              type="text"
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyPress={handleEditKeyPress}
                              onBlur={saveEditingItem}
                              autoFocus
                              className="w-full text-sm rounded-md px-2 py-1 bg-slate-800 border border-blue-500/60 text-white focus:outline-none"
                            />
                          ) : (
                            <>
                              <span
                                className={`text-sm block truncate ${canEdit ? 'cursor-text' : ''} ${
                                  item.completed ? 'text-slate-500 line-through' : 'text-slate-200'
                                }`}
                                onDoubleClick={() => canEdit && startEditingItem(item.id, item.text)}
                                title={canEdit ? 'Дважды щёлкните, чтобы изменить' : undefined}
                              >
                                {item.text}
                              </span>
                              {item.completed && item.completed_at && (
                                <span className="text-[11px] text-slate-500 block">
                                  Выполнено {new Date(item.completed_at).toLocaleString('ru-RU', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  })}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        {editingItemId !== item.id && canEdit && (
                          <button
                            type="button"
                            onClick={() => removeChecklistItem(item.id)}
                            className="p-1 rounded text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                            title="Удалить пункт"
                            aria-label="Удалить пункт"
                          >
                            <CloseIcon size="xs" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {canEdit ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyPress={handleChecklistKeyPress}
                      className="flex-1 min-w-0 rounded-lg border border-dashed border-slate-600/70 bg-transparent px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-solid focus:border-blue-500/60 focus:bg-slate-800/50 transition-colors"
                      placeholder="+ Добавить пункт и нажать Enter"
                    />
                    {newChecklistItem.trim() && (
                      <button
                        type="button"
                        onClick={addChecklistItem}
                        className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
                      >
                        Добавить
                      </button>
                    )}
                  </div>
                ) : checklistItems.length === 0 && (
                  <p className="text-sm text-slate-500">Пунктов нет</p>
                )}
              </section>

              <section className="pt-6 border-t border-slate-700/50">
                <TaskAttachments
                  taskId={task.id}
                  projectId={projectId}
                  initialAttachments={initialAttachments}
                  currentUser={currentUser}
                  canUpload={!!currentUser}
                  canDelete={permissions.can_edit}
                  embedded
                  onAttachmentsChange={() => {
                    if (onTaskUpdate) onTaskUpdate();
                  }}
                />
              </section>

              {/* Активность: комментарии, учёт времени, история */}
              <section className="pt-6 border-t border-slate-700/50">
                <div role="tablist" aria-label="Активность" className="flex gap-1 mb-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_rgba(51,65,85,0.5)]">
                  {activityTabs.map((tab) => {
                    const active = activityTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setActivityTab(tab.id)}
                        className={`shrink-0 whitespace-nowrap px-2.5 sm:px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                          active
                            ? 'border-blue-500 text-white'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {tab.label}
                        {tab.count > 0 && (
                          <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                            active ? 'bg-blue-500/20 text-blue-200' : 'bg-slate-700/70 text-slate-300'
                          }`}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Вкладки не размонтируются: таймер учёта времени и черновик комментария не теряются */}
                <div role="tabpanel" hidden={activityTab !== 'comments'}>
                  <TaskComments
                    taskId={task.id}
                    task={task}
                    currentUser={currentUser}
                    canModerate={canModerate}
                    embedded
                    onCountChange={setCommentCount}
                  />
                </div>
                <div role="tabpanel" hidden={activityTab !== 'time'}>
                  <TaskTimeLog
                    taskId={task.id}
                    currentUser={currentUser}
                    canModerate={canModerate}
                    embedded
                    onCountChange={setTimeLogCount}
                  />
                </div>
                <div role="tabpanel" hidden={activityTab !== 'history'}>
                  {changeLog.length > 0 ? (
                    <ol className="relative space-y-4 border-l border-slate-700/70 ml-1.5">
                      {changeLog.map((entry) => (
                        <li key={entry.id} className="pl-4">
                          <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-slate-600 ring-4 ring-slate-900" aria-hidden />
                          <p className="text-sm text-slate-200 leading-snug">
                            <span className="font-medium">{entry.who}</span>
                            <span className="text-slate-400"> · {entry.text}</span>
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">{entry.when}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-slate-500 py-6 text-center">Изменений пока нет</p>
                  )}
                </div>
              </section>
            </div>

            {/* Боковая панель: параметры и действия */}
            <aside className="order-first lg:order-none space-y-4">
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-4">
                <Field label="Статус">
                  <CustomSelect
                    options={filteredStatusOptions}
                    value={editedTask.status}
                    onChange={(val) => handleChange("status", val)}
                    disabled={!canEdit}
                  />
                </Field>
                <Field label="Приоритет">
                  <CustomSelect
                    options={priorityOptions}
                    value={editedTask.priority}
                    onChange={(val) => handleChange("priority", val)}
                    showPriorityIcons
                    disabled={!canEdit}
                  />
                </Field>
                <Field label="Срок выполнения">
                  <input
                    type="date"
                    value={editedTask.due_date}
                    onChange={(e) => handleChange("due_date", e.target.value)}
                    disabled={!canEdit}
                    className={`w-full rounded-lg border px-3 py-2.5 text-white bg-slate-800 [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                      overdue ? 'border-red-500/60' : 'border-slate-600'
                    }`}
                  />
                  {overdue && <span className="text-red-400 text-xs mt-1 block">Срок прошёл</span>}
                  {errors.due_date && <span className="text-red-400 text-xs mt-1 block">{errors.due_date}</span>}
                </Field>
                <Field label={projectChanging ? 'Проект · сохранение…' : 'Проект'}>
                  <ProjectSearchPicker
                    projects={projects}
                    loading={projectsLoading || !projectResolved}
                    value={projectId}
                    onChange={handleProjectChange}
                    disabled={projectChanging || !canEdit}
                    variant="button"
                    fullWidth
                    buttonPlaceholder="Без проекта"
                  />
                  {errors.project && (
                    <span className="text-red-400 text-xs mt-1 block">{errors.project}</span>
                  )}
                </Field>
                <div className="pt-4 border-t border-slate-700/50">
                  <TaskTeamAssigneeFields
                    variant="details"
                    teamId={teamId}
                    teamName={task.team_name}
                    executor={executor}
                    onTeamChange={setTeamId}
                    onExecutorChange={setExecutor}
                    disabled={isSaving || !canReassign}
                  />
                </div>
              </div>

              {hasWorkflowActions && (
                <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-2">
                  {(permissions.can_approve_review || permissions.can_reject_review) && (
                    <>
                      <p className="text-sm font-medium text-slate-200">Задача на проверке</p>
                      <p className="text-xs text-slate-400 mb-1">
                        Исполнитель: {task.executor_name || executor?.name || 'не назначен'}
                      </p>
                      <div className="flex gap-2">
                        {permissions.can_approve_review && (
                          <button
                            type="button"
                            onClick={() => handleWorkflowAction('approve')}
                            disabled={isWorkflowBusy || isSaving}
                            className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {isWorkflowBusy ? '…' : 'Подтвердить'}
                          </button>
                        )}
                        {permissions.can_reject_review && (
                          <button
                            type="button"
                            onClick={() => handleWorkflowAction('reject')}
                            disabled={isWorkflowBusy || isSaving}
                            className="flex-1 px-3 py-2 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {isWorkflowBusy ? '…' : 'На доработку'}
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {permissions.can_submit_review && (
                    <button
                      type="button"
                      onClick={() => handleWorkflowAction('submit')}
                      disabled={isWorkflowBusy || isSaving}
                      className="w-full px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {isWorkflowBusy ? 'Отправка…' : 'Отправить на проверку'}
                    </button>
                  )}

                  {currentUser && showTakeOnMyselfButton && (
                    isAlreadyAssignedToMe ? (
                      <p className="flex items-center justify-center gap-2 py-1.5 text-sm text-emerald-300">
                        <CheckIcon size="sm" />
                        Назначена на вас
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleTakeOnMyself}
                        disabled={isSaving}
                        className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {isSaving ? 'Назначаю…' : (
                          <IconWithText icon={MyTasksIcon} gap="gap-2">
                            Взять на себя
                          </IconWithText>
                        )}
                      </button>
                    )
                  )}
                </div>
              )}

              {task.created && (
                <dl className="px-1 text-xs text-slate-500 space-y-1">
                  <div className="flex justify-between gap-3">
                    <dt>Создана</dt>
                    <dd className="text-slate-400">
                      {new Date(task.created).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}
                    </dd>
                  </div>
                  {task.updated && (
                    <div className="flex justify-between gap-3">
                      <dt>Обновлена</dt>
                      <dd className="text-slate-400">
                        {new Date(task.updated).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </aside>
          </div>
        </div>

        {/* Подвал: всегда виден */}
        <footer className="shrink-0 flex items-center gap-2 border-t border-slate-700/60 bg-slate-800/40 px-4 sm:px-6 py-3">
          {onDelete && permissions.can_delete && (
            <button
              type="button"
              onClick={async () => {
                const confirmed = await confirmAction({
                  title: "Удалить задачу?",
                  message: "Задача, её комментарии и загруженные в неё файлы будут удалены. Привязанные документы останутся в 2А.",
                  confirmLabel: "Удалить",
                  danger: true,
                });
                if (confirmed) {
                  onDelete(task);
                  window.setTimeout(() => onClose?.(), 0);
                }
              }}
              className="px-3 py-2 rounded-lg text-red-300 hover:text-red-200 hover:bg-red-900/30 text-sm font-medium transition-colors"
            >
              Удалить
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={safeClose}
              className="px-4 py-2 rounded-lg bg-slate-700/60 hover:bg-slate-600/70 text-slate-200 text-sm font-medium transition-colors"
            >
              Закрыть
            </button>
            {canEdit && (
              <button
                type="button"
                disabled={!isDirty || isSaving}
                onClick={handleSave}
                className="px-5 py-2 rounded-lg text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-700/50 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Сохранение…' : 'Сохранить'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>

    <ConfirmDialog
      open={showUnsavedDialog}
      title="Сохранить изменения?"
      message="В задаче есть несохранённые изменения. Если закрыть без сохранения, они будут потеряны."
      cancelLabel="Отмена"
      altConfirmLabel="Не сохранять"
      confirmLabel="Сохранить"
      loading={isSaving}
      onCancel={handleUnsavedCancel}
      onAltConfirm={handleUnsavedDiscard}
      onConfirm={handleUnsavedSave}
      zIndex={overlayZIndex + 10}
    />
    </>,
    document.body
  );
}
