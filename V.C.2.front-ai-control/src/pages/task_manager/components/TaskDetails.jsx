import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import CustomSelect from "../selector/CustomSelect";
import { updateTask, getTask, submitTaskForReview, approveTaskReview, rejectTaskReview } from "../../../services/taskService";
import { getTaskPermissions } from "../utils/taskPermissions";
import { getTaskChangeLog } from "../utils/taskChangeLogUtils";
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
} from "./TaskManagerIcons";
import { showTaskToast } from "../../../components/shared/taskToast";
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

export default function TaskDetails({ task, onClose, onSave, onDelete, onTaskUpdate, currentUser, overlayZIndex = 9999 }) {
  useDocumentTitle([task.title || (task.id ? `Задача #${task.id}` : "Новая задача"), "Задачи"]);
  // Локальный стейт для редактирования
  const [editedTask, setEditedTask] = useState({
    title: task.title || "",
    status: task.status || "created",
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

  const [isDirty, setIsDirty] = useState(false);
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

  // Закрываем модальное окно при нажатии Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleEscape, true);
    return () => {
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [onClose]);

  // Загружаем чек-лист из meta_data при загрузке компонента
  useEffect(() => {
    if (task.meta_data && task.meta_data.checklist && Array.isArray(task.meta_data.checklist)) {
      setChecklistItems(task.meta_data.checklist);
    } else {
      setChecklistItems([]);
    }
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
    setIsDirty(true);
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
    setIsDirty(true);
  };

  // Функция для удаления пункта чек-листа
  const removeChecklistItem = (itemId) => {
    if (!canEdit) return;
    setChecklistItems(prev => prev.filter(item => item.id !== itemId));
    setIsDirty(true);
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
      setIsDirty(true);
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

  // Отслеживаем изменения, чтобы понимать, изменялись ли поля
  useEffect(() => {
    const originalChecklist = task.meta_data?.checklist || [];
    const checklistChanged = JSON.stringify(checklistItems) !== JSON.stringify(originalChecklist);
    
    const dirty =
      editedTask.title !== task.title ||
      editedTask.status !== task.status ||
      editedTask.priority !== task.priority ||
      editedTask.due_date !== toDateInputValue(task.due_date) ||
      editedTask.description !== (task.description || "") ||
      (executor?.id ?? null) !== (task.executor_id ?? null) ||
      (teamId ?? null) !== (task.team_id ?? null) ||
      checklistChanged;
    setIsDirty(dirty);
  }, [editedTask, executor, teamId, task, checklistItems]);

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

  const handleSave = async () => {
    if (!canEdit) {
      return;
    }

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
      
      onClose();
    } catch (error) {
      console.error('Error updating task:', error);
      setErrors({ general: 'Failed to update task. Please try again.' });
    } finally {
      setIsSaving(false);
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
        setEditedTask((prev) => ({ ...prev, status: updated.status }));
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
  const safeClose = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    window.setTimeout(() => {
      onClose?.();
    }, 0);
  };

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 pt-12 animate-fadeIn"
      style={{ zIndex: overlayZIndex }}
      onClick={handleOverlayClick}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      <div 
        className="bg-gradient-to-br from-slate-800/95 via-slate-900/95 to-slate-800/95 rounded-2xl p-6 w-full max-w-5xl text-white relative shadow-2xl max-h-[92vh] overflow-y-auto border border-slate-700/50 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={safeClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white transition-all duration-200 text-xl font-bold leading-none z-10"
          aria-label="Close details"
        >
          <CloseIcon size="md" />
        </button>

        {/* Шапка: название + проект */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-5 pr-10">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={editedTask.title}
              onChange={(e) => handleChange("title", e.target.value)}
              disabled={!canEdit}
              className={`w-full rounded-xl border px-4 py-3 text-xl font-semibold text-white bg-slate-800/40 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed placeholder:text-slate-500 ${
                errors.title ? 'border-red-500/50' : 'border-slate-600/40 hover:border-slate-500/50'
              }`}
              placeholder="Название задачи"
            />
            {errors.title && <span className="text-red-400 text-sm mt-1 block">{errors.title}</span>}
          </div>

          <div className="shrink-0 w-full sm:w-56">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5 block">
              Проект
              {projectChanging && <span className="normal-case ml-2 text-slate-400">· сохранение…</span>}
            </span>
            <ProjectSearchPicker
              projects={projects}
              loading={projectsLoading || !projectResolved}
              value={projectId}
              onChange={handleProjectChange}
              disabled={projectChanging || !canEdit}
              variant="button"
              buttonPlaceholder="Без проекта"
            />
            {errors.project && (
              <span className="text-red-400 text-xs mt-1 block">{errors.project}</span>
            )}
          </div>
        </div>

        {errors.general && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-200 text-sm backdrop-blur-sm">
            {errors.general}
          </div>
        )}

        {permissions.is_assignee_locked && editedTask.status === 'review' && (
          <div className="mb-4 p-3 bg-amber-900/30 border border-amber-700/50 rounded-lg text-amber-100 text-sm">
            На проверке у начальника отдела — редактирование недоступно до возврата на доработку.
          </div>
        )}

        {permissions.is_assignee_locked && editedTask.status === 'completed' && (
          <div className="mb-4 p-3 bg-slate-700/40 border border-slate-600/50 rounded-lg text-slate-200 text-sm">
            Подтверждена — редактирование недоступно.
          </div>
        )}

        {(permissions.workflow_warning || task.meta_data?.workflow?.warning) && (
          <div className="mb-4 p-3 bg-orange-900/30 border border-orange-700/50 rounded-lg text-orange-100 text-sm">
            {permissions.workflow_warning || task.meta_data?.workflow?.warning}
          </div>
        )}

        {/* Описание */}
        <label className="block mb-5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5 block">Описание</span>
          <textarea
            rows={3}
            value={editedTask.description}
            onChange={(e) => handleChange("description", e.target.value)}
            disabled={!canEdit}
            className="w-full rounded-xl border border-slate-600/40 bg-slate-800/40 backdrop-blur-sm p-4 text-white resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all hover:border-slate-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="Добавьте описание задачи..."
          />
        </label>

        {/* Чек-лист и файлы — на всю ширину */}
        <div className="mb-5 p-4 bg-slate-800/25 backdrop-blur-sm rounded-xl border border-slate-700/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 uppercase tracking-wide">
              <CheckIcon size="sm" className="text-green-400" />
              <span>Чек-лист</span>
            </h3>
            {checklistProgress && (
              <span className="text-xs text-slate-400">
                {checklistProgress.completed}/{checklistProgress.total} ({checklistProgress.percentage}%)
              </span>
            )}
          </div>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newChecklistItem}
              onChange={(e) => setNewChecklistItem(e.target.value)}
              onKeyPress={handleChecklistKeyPress}
              disabled={!canEdit}
              className="flex-1 rounded-lg border border-slate-600/50 bg-slate-800/50 backdrop-blur-sm p-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Добавить пункт..."
            />
            <button
              onClick={addChecklistItem}
              disabled={!canEdit || !newChecklistItem.trim()}
              className="px-3 py-2 rounded-lg bg-blue-600/80 hover:bg-blue-700/80 disabled:bg-slate-700/50 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-medium transition-all whitespace-nowrap"
            >
              Добавить
            </button>
          </div>

          {checklistItems.length > 0 ? (
            <div className="space-y-1.5 max-h-40 overflow-y-auto mb-3">
              {checklistItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                    item.completed
                      ? 'bg-slate-700/20 border border-slate-600/30 opacity-70'
                      : 'bg-slate-700/30 border border-slate-600/40'
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center cursor-pointer flex-shrink-0 ${
                      item.completed
                        ? 'bg-green-500/20 border-green-500/50'
                        : 'bg-slate-800/50 border-slate-500/50 hover:border-green-500/50'
                    }`}
                    onClick={() => toggleChecklistItem(item.id)}
                  >
                    {item.completed && (
                      <svg className="w-2 h-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingItemId === item.id ? (
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyPress={handleEditKeyPress}
                        onBlur={saveEditingItem}
                        autoFocus
                        className={`w-full text-sm rounded px-2 py-0.5 bg-slate-800/80 border border-blue-500/50 text-white focus:outline-none ${
                          item.completed ? 'line-through text-slate-500' : ''
                        }`}
                      />
                    ) : (
                      <>
                        <span
                          className={`text-sm cursor-pointer truncate block ${
                            item.completed ? 'text-slate-500 line-through' : 'text-slate-200'
                          }`}
                          onDoubleClick={() => startEditingItem(item.id, item.text)}
                        >
                          {item.text}
                        </span>
                        {item.completed && item.completed_at && (
                          <span className="text-[11px] text-slate-500 mt-0.5 block">
                            Выполнено: {new Date(item.completed_at).toLocaleString('ru-RU', {
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
                      onClick={() => removeChecklistItem(item.id)}
                      className="text-slate-500 hover:text-red-400 p-1 shrink-0"
                      title="Удалить"
                    >
                      <CloseIcon size="xs" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-xs italic mb-3">Нет пунктов в чек-листе</p>
          )}

          <div className="pt-3 border-t border-slate-700/40">
            <TaskAttachments
              taskId={task.id}
              projectId={projectId}
              initialAttachments={task.attachments || task.meta_data?.attachments || []}
              currentUser={currentUser}
              canUpload={!!currentUser}
              canDelete={permissions.can_edit}
              embedded
              onAttachmentsChange={() => {
                if (onTaskUpdate) onTaskUpdate();
              }}
            />
          </div>
        </div>

        {/* Две колонки: слева параметры и действия, справа учёт времени */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Левая колонка */}
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-slate-700/40 bg-slate-800/25 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5 block">Статус</span>
                  <CustomSelect
                    options={filteredStatusOptions}
                    value={editedTask.status}
                    onChange={(val) => handleChange("status", val)}
                    disabled={!canEdit}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5 block">Приоритет</span>
                  <CustomSelect
                    options={priorityOptions}
                    value={editedTask.priority}
                    onChange={(val) => handleChange("priority", val)}
                    showPriorityIcons
                    disabled={!canEdit}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5 block">Срок выполнения</span>
                <input
                  type="date"
                  value={editedTask.due_date}
                  onChange={(e) => handleChange("due_date", e.target.value)}
                  disabled={!canEdit}
                  className={`w-full rounded-lg border px-3 py-2.5 text-white bg-slate-800/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                    errors.due_date ? 'border-red-500/50' : 'border-slate-600/50'
                  }`}
                />
                {errors.due_date && <span className="text-red-400 text-xs mt-1 block">{errors.due_date}</span>}
              </label>

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

            {(permissions.can_approve_review || permissions.can_reject_review) && (
              <div className="p-4 rounded-xl border border-blue-600/30 bg-blue-950/25">
                <h3 className="text-sm font-semibold text-slate-100 mb-1">Проверка задачи</h3>
                <p className="text-xs text-slate-400 mb-3">
                  Исполнитель: {task.executor_name || executor?.name || 'Не назначен'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {permissions.can_approve_review && (
                    <button
                      type="button"
                      onClick={() => handleWorkflowAction('approve')}
                      disabled={isWorkflowBusy || isSaving}
                      className="flex-1 min-w-[120px] px-3 py-2 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {isWorkflowBusy ? '…' : 'Подтвердить'}
                    </button>
                  )}
                  {permissions.can_reject_review && (
                    <button
                      type="button"
                      onClick={() => handleWorkflowAction('reject')}
                      disabled={isWorkflowBusy || isSaving}
                      className="flex-1 min-w-[120px] px-3 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {isWorkflowBusy ? '…' : 'На доработку'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {permissions.can_submit_review && (
              <button
                type="button"
                onClick={() => handleWorkflowAction('submit')}
                disabled={isWorkflowBusy || isSaving}
                className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-sm font-medium disabled:opacity-50"
              >
                {isWorkflowBusy ? 'Отправка…' : 'Отправить на проверку'}
              </button>
            )}

            {currentUser && showTakeOnMyselfButton && (
              <button
                onClick={handleTakeOnMyself}
                disabled={isSaving || isAlreadyAssignedToMe}
                className={`w-full px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${
                  isSaving || isAlreadyAssignedToMe
                    ? 'bg-slate-700/50 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                }`}
              >
                {isSaving ? 'Принимаю…' :
                  isAlreadyAssignedToMe
                    ? (
                      <IconWithText icon={CheckIcon} gap="gap-2">
                        Уже назначена на вас
                      </IconWithText>
                    )
                    : (
                      <IconWithText icon={MyTasksIcon} gap="gap-2">
                        Взять на себя
                      </IconWithText>
                    )
                }
              </button>
            )}

            {task.created && (
              <div className="p-3 rounded-lg bg-slate-800/20 border border-slate-700/30 text-xs text-slate-500 space-y-2">
                <div className="space-y-0.5">
                  <p>
                    Создано:{' '}
                    {new Date(task.created).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  {task.updated && (
                    <p>
                      Обновлено:{' '}
                      {new Date(task.updated).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  )}
                </div>
                {changeLog.length > 0 && (
                  <div className="pt-2 border-t border-slate-700/40 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      История изменений
                    </p>
                    {changeLog.map((entry) => (
                      <p key={entry.id} className="text-slate-400 leading-snug">
                        <span className="text-slate-500">{entry.when}</span>
                        {' · '}
                        <span className="text-slate-300">{entry.who}</span>
                        {': '}
                        {entry.text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700/40">
              <button
                type="button"
                onClick={safeClose}
                className="px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-200 text-sm font-medium"
              >
                Отмена
              </button>
              {onDelete && permissions.can_delete && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Вы уверены, что хотите удалить эту задачу?")) {
                      onDelete(task);
                      window.setTimeout(() => onClose?.(), 0);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-red-900/50 hover:bg-red-800/60 text-red-200 text-sm font-medium"
                >
                  Удалить
                </button>
              )}
              <button
                disabled={!canEdit || !isDirty || isSaving}
                onClick={handleSave}
                className={`ml-auto px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  canEdit && isDirty && !isSaving
                    ? "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
                    : "bg-slate-700/50 cursor-not-allowed text-slate-400"
                }`}
              >
                {isSaving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>

          {/* Правая колонка */}
          <div className="space-y-4">
            <TaskTimeLog taskId={task.id} currentUser={currentUser} canModerate={canModerate} />
          </div>
        </div>

        <div className="mt-5">
          <TaskComments taskId={task.id} task={task} currentUser={currentUser} canModerate={canModerate} />
        </div>
      </div>
    </div>,
    document.body
  );
}