import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import CustomSelect from '../../../selector/CustomSelect';
import { teamService } from '../../../../../services/teamService';
import { getTasks } from '../../../../../services/taskService';
import './CreateProjectModal.css';
import styles from './EditProjectModal.module.css';
import { CheckIcon, CloseIcon, UploadingIcon, WarningIcon } from '../../../components/TaskManagerIcons';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { TasksPicker, TeamsPicker, mergeProjectTeamsForPicker, useProjectPickerDetails } from './ProjectFormSelectors';
import { projectPriorityOptions, projectStatusOptions } from './projectFormOptions';
import { collectProjectManagers, userCanAssignProjectManagers, userCanConfigureProjectCard } from './projectManagers';
import useAuth from '../../../../../hooks/useAuth';

function personInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const EditProjectModal = ({ project, onClose, onSubmit, onDelete }) => {
  const { user } = useAuth();
  const canConfigureCard = userCanConfigureProjectCard(user, project);
  const canAssignManagers = userCanAssignProjectManagers(user, project);
  const [projectData, setProjectData] = useState({
    name: '',
    description: '',
    status: 'planning',
    priority: 'medium',
    start_date: '',
    due_date: '',
    budget: '',
    tags: [],
    team_ids: [],
    task_ids: []
  });

  const [teams, setTeams] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [newTag, setNewTag] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [extraManagers, setExtraManagers] = useState([]);
  const [managerSearch, setManagerSearch] = useState('');
  const [managerResults, setManagerResults] = useState([]);
  const [cardVisibleIds, setCardVisibleIds] = useState(() => new Set());

  // Initialize form data when project changes
  useEffect(() => {
    if (project) {
      setProjectData({
        name: project.name || '',
        description: project.description || '',
        status: project.status || 'planning',
        priority: project.priority || 'medium',
        start_date: project.start_date ? project.start_date.split('T')[0] : '',
        due_date: project.due_date ? project.due_date.split('T')[0] : '',
        budget: project.budget ? project.budget.toString() : '',
        tags: project.tags || [],
        team_ids: (project.teams || []).map(t => t.team_id),
        task_ids: (project.tasks || []).map(t => t.id)
      });
      setExtraManagers(Array.isArray(project.extra_managers) ? project.extra_managers : []);
      const allIds = collectProjectManagers(project).map((m) => Number(m.user_id));
      if (Array.isArray(project.card_manager_ids)) {
        setCardVisibleIds(new Set(project.card_manager_ids.map(Number)));
      } else {
        setCardVisibleIds(new Set(allIds));
      }
      setManagerSearch('');
      setManagerResults([]);
    }
  }, [project]);

  // Загрузка команд для выбора
  useEffect(() => {
    const loadTeams = async () => {
      try {
        const teamsData = await teamService.getTeams({ include_members: true });
        setTeams(Array.isArray(teamsData) ? teamsData : []);
      } catch (error) {
        console.error('Error loading teams:', error);
        setTeams([]);
      }
    };
    loadTeams();
  }, []);

  const pickerTeams = useMemo(
    () => mergeProjectTeamsForPicker(teams, project?.teams),
    [teams, project?.teams]
  );

  const reloadTeams = async () => {
    try {
      const teamsData = await teamService.getTeams({ include_members: true });
      setTeams(Array.isArray(teamsData) ? teamsData : []);
    } catch (error) {
      console.error('Error reloading teams:', error);
    }
  };

  const { openTeam, openTask, closeNested, detailLayers } = useProjectPickerDetails({
    catalogTasks: tasks,
    onTeamsChanged: reloadTeams,
  });

  // Загрузка задач для выбора
  useEffect(() => {
    const loadTasks = async () => {
      try {
        setTasksLoading(true);
        const all = await getTasks();
        setTasks(Array.isArray(all) ? all : []);
      } catch (e) {
        console.error('Error loading tasks:', e);
        setTasks([]);
      } finally {
        setTasksLoading(false);
      }
    };
    loadTasks();
  }, []);

  useEffect(() => {
    if (!canAssignManagers || managerSearch.trim().length < 2) {
      setManagerResults([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const users = await teamService.searchUsers(managerSearch.trim());
        const taken = new Set([
          project?.manager_id,
          ...extraManagers.map((m) => m.user_id),
        ].filter(Boolean));
        setManagerResults((users || []).filter((u) => !taken.has(u.id)));
      } catch {
        setManagerResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [canAssignManagers, managerSearch, extraManagers, project?.manager_id]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        if (closeNested()) return;
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, closeNested]);

  const handleChange = (field, value) => {
    setProjectData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !projectData.tags.includes(newTag.trim())) {
      setProjectData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setProjectData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!projectData.name.trim()) {
      newErrors.name = 'Название проекта обязательно';
    }
    
    if (projectData.start_date && projectData.due_date) {
      if (new Date(projectData.start_date) > new Date(projectData.due_date)) {
        newErrors.due_date = 'Дата окончания должна быть позже даты начала';
      }
    }

    if (projectData.budget && parseFloat(projectData.budget) < 0) {
      newErrors.budget = 'Бюджет не может быть отрицательным';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      // Подготавливаем данные для отправки
      const submitData = {
        ...projectData,
        budget: projectData.budget ? parseFloat(projectData.budget) : null,
        start_date: projectData.start_date ? new Date(projectData.start_date).toISOString() : null,
        due_date: projectData.due_date ? new Date(projectData.due_date).toISOString() : null,
        ...(canAssignManagers
          ? { extra_manager_ids: extraManagers.map((m) => m.user_id) }
          : {}),
        ...(canConfigureCard ? { card_manager_ids: Array.from(cardVisibleIds) } : {}),
      };

      if (files && files.length > 0) {
        setUploading(true);
        setUploadProgress(0);
        await onSubmit(submitData, Array.from(files), (evt) => {
          if (evt && evt.total) {
            const percent = Math.round((evt.loaded * 100) / evt.total);
            setUploadProgress(percent);
          }
        });
      } else {
        await onSubmit(submitData, [], null);
      }
      
      onClose();
    } catch (error) {
      console.error('Error updating project:', error);
      setErrors({ general: 'Ошибка при обновлении проекта' });
    } finally {
      setLoading(false);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !project?.id) return;
    try {
      setDeleting(true);
      await onDelete(project.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error('Error deleting project:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (!project) return null;

  const fileList = files ? Array.from(files) : [];

  return createPortal(
    <>
    <div className={`${styles.overlay} project-modal-overlay`} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-project-modal-title"
      >
        <div className={styles.head}>
          <div>
            <p className={styles.kicker}>Проект</p>
            <h3 id="edit-project-modal-title">{project.name || 'Редактирование'}</h3>
            <p className={styles.subtitle}>Название, сроки, менеджеры, команды и задачи. Изменения сохраняются после обновления.</p>
          </div>
          <button type="button" onClick={onClose} className={styles.close} aria-label="Закрыть">
            <XMarkIcon />
          </button>
        </div>

        {errors.general && <div className={styles.error}>{errors.general}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Основное</p>
            <div className={styles.field}>
              <label>Название <span className={styles.required}>*</span></label>
              <input
                type="text"
                value={projectData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={errors.name ? styles.invalid : ''}
                placeholder="Введите название проекта"
              />
              {errors.name && <span className={styles.hint}>{errors.name}</span>}
            </div>
            <div className={styles.field}>
              <label>Описание</label>
              <textarea
                value={projectData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Опишите проект"
                rows={3}
              />
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionTitle}>Менеджеры</p>
            <p className={styles.hintMuted}>
              Владелец задаётся при создании.
              {canAssignManagers
                ? ' Дополнительных менеджеров могут назначать владелец и уже добавленные менеджеры проекта — они тоже смогут редактировать проект.'
                : ' Назначать менеджеров могут только владелец и уже добавленные менеджеры проекта.'}
              {canConfigureCard ? ' Отметьте, кого показывать в строке «Менеджер» на карточке проекта.' : ''}
            </p>
            <div className={styles.people}>
              <div className={styles.person}>
                <div className={styles.avatar}>{personInitials(project.manager_name || project.manager_username)}</div>
                <div className={styles.personBody}>
                  <strong>{project.manager_name || project.manager_username || 'Не указан'}</strong>
                  <em>{project.manager_email || project.manager_username || ''}</em>
                </div>
                {canConfigureCard && (
                  <label className={styles.cardToggle}>
                    <input
                      type="checkbox"
                      checked={cardVisibleIds.has(Number(project.manager_id))}
                      onChange={() => {
                        const id = Number(project.manager_id);
                        setCardVisibleIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          return next;
                        });
                      }}
                    />
                    На карточке
                  </label>
                )}
                <span className={styles.ownerBadge}>Владелец</span>
              </div>
              {extraManagers.map((m) => (
                <div key={m.user_id} className={styles.person}>
                  <div className={styles.avatar}>{personInitials(m.name || m.username)}</div>
                  <div className={styles.personBody}>
                    <strong>{m.name || m.username || `ID ${m.user_id}`}</strong>
                    <em>{m.email || m.username || ''}</em>
                  </div>
                  {canConfigureCard && (
                    <label className={styles.cardToggle}>
                      <input
                        type="checkbox"
                        checked={cardVisibleIds.has(Number(m.user_id))}
                        onChange={() => {
                          const id = Number(m.user_id);
                          setCardVisibleIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                          });
                        }}
                      />
                      На карточке
                    </label>
                  )}
                  {canAssignManagers && (
                    <button
                      type="button"
                      className={styles.removePerson}
                      onClick={() => {
                        setExtraManagers((prev) => prev.filter((x) => x.user_id !== m.user_id));
                        setCardVisibleIds((prev) => {
                          const next = new Set(prev);
                          next.delete(Number(m.user_id));
                          return next;
                        });
                      }}
                      aria-label={`Убрать ${m.name || m.username}`}
                    >
                      <CloseIcon size="xs" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canAssignManagers && (
              <div className={styles.searchWrap}>
                <MagnifyingGlassIcon />
                <input
                  type="text"
                  value={managerSearch}
                  onChange={(e) => setManagerSearch(e.target.value)}
                  placeholder="Найти сотрудника по имени или email…"
                />
                {managerResults.length > 0 && (
                  <div className={styles.searchResults}>
                    {managerResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setExtraManagers((prev) => [
                            ...prev,
                            {
                              user_id: u.id,
                              name: u.name,
                              email: u.email,
                              username: u.login || u.username,
                            },
                          ]);
                          setCardVisibleIds((prev) => new Set(prev).add(Number(u.id)));
                          setManagerSearch('');
                          setManagerResults([]);
                        }}
                      >
                        {u.name} — {u.email}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.section}>
            <p className={styles.sectionTitle}>Параметры</p>
            <div className={styles.row}>
              <div className={styles.field}>
                <label>Статус</label>
                <CustomSelect
                  options={projectStatusOptions}
                  value={projectData.status}
                  onChange={(val) => handleChange('status', val)}
                  menuZIndex={10050}
                />
              </div>
              <div className={styles.field}>
                <label>Приоритет</label>
                <CustomSelect
                  options={projectPriorityOptions}
                  value={projectData.priority}
                  onChange={(val) => handleChange('priority', val)}
                  showPriorityIcons
                  menuZIndex={10050}
                />
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label>Дата начала</label>
                <input
                  type="date"
                  value={projectData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>Дата окончания</label>
                <input
                  type="date"
                  value={projectData.due_date}
                  onChange={(e) => handleChange('due_date', e.target.value)}
                  className={errors.due_date ? styles.invalid : ''}
                />
                {errors.due_date && <span className={styles.hint}>{errors.due_date}</span>}
              </div>
            </div>
            <div className={styles.field}>
              <label>Бюджет (₽)</label>
              <input
                type="number"
                value={projectData.budget}
                onChange={(e) => handleChange('budget', e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                className={errors.budget ? styles.invalid : ''}
              />
              {errors.budget && <span className={styles.hint}>{errors.budget}</span>}
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionTitle}>Теги</p>
            <div className={styles.field}>
              <div className={styles.tagsRow}>
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Добавить тег"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                />
                <button type="button" onClick={handleAddTag} className={styles.addTag} aria-label="Добавить тег">
                  +
                </button>
              </div>
              {projectData.tags.length > 0 && (
                <div className={styles.tags}>
                  {projectData.tags.map((tag) => (
                    <span key={tag} className={styles.tag}>
                      {tag}
                      <button type="button" onClick={() => handleRemoveTag(tag)} aria-label={`Убрать ${tag}`}>
                        <CloseIcon size="xs" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionTitle}>Команды</p>
            <TeamsPicker
              teams={pickerTeams}
              value={projectData.team_ids}
              onChange={(ids) => handleChange('team_ids', ids)}
              onTeamOpen={openTeam}
              emptyMessage="Нет доступных команд"
            />
          </div>

          <div className={styles.section}>
            <p className={styles.sectionTitle}>Задачи</p>
            <TasksPicker
              catalogTasks={tasks}
              projectTasks={project?.tasks}
              loading={tasksLoading}
              value={projectData.task_ids}
              onChange={(ids) => handleChange('task_ids', ids)}
              onTaskOpen={openTask}
            />
          </div>

          <div className={styles.section}>
            <p className={styles.sectionTitle}>Файлы</p>
            <div className={styles.fileBox}>
              <input
                type="file"
                multiple
                onChange={(e) => setFiles(e.target.files)}
              />
              {fileList.length > 0 && (
                <ul className={styles.files}>
                  {fileList.map((file) => (
                    <li key={file.name} title={file.name} className={styles.fileItem}>
                      <div>
                        <div className={styles.fileName}>{file.name}</div>
                        <div className={styles.fileMeta}>{Math.round(file.size / 1024)} KB</div>
                      </div>
                      {uploading ? (
                        <span className={`${styles.uploading} inline-flex items-center gap-1`}>
                          <UploadingIcon size="xs" className="animate-pulse" />
                          Загрузка
                        </span>
                      ) : (
                        <span className={`${styles.ready} inline-flex items-center gap-1`}>
                          <CheckIcon size="xs" />
                          Готов
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {uploading && (
                <div className={styles.progress}>
                  <div className={styles.progressHead}>
                    <span>Загрузка файлов</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className={styles.bar}>
                    <div className={styles.fill} style={{ width: `${uploadProgress}%` }} />
                  </div>
                  {uploadProgress < 100 && (
                    <p className={styles.hint}>
                      <WarningIcon size="xs" className="text-amber-500 shrink-0" />
                      {' '}Дождитесь завершения загрузки
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={styles.footer}>
            {onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading || uploading || deleting}
                className={styles.danger}
              >
                Удалить
              </button>
            )}
            <button type="button" onClick={onClose} className={styles.ghost}>
              Отмена
            </button>
            <button type="submit" disabled={loading || uploading} className={styles.primary}>
              {uploading && uploadProgress < 100
                ? `Загрузка ${uploadProgress}%`
                : loading
                  ? 'Сохранение…'
                  : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
    {detailLayers}
    <ConfirmDialog
      open={showDeleteConfirm}
      title="Удалить проект?"
      message={`Вы уверены, что хотите удалить проект «${project.name}»? Это действие нельзя отменить.`}
      confirmLabel="Удалить"
      cancelLabel="Отмена"
      variant="danger"
      loading={deleting}
      onConfirm={handleDelete}
      onCancel={() => !deleting && setShowDeleteConfirm(false)}
      zIndex={10060}
    />
    </>,
    document.body
  );
};

export default EditProjectModal;
