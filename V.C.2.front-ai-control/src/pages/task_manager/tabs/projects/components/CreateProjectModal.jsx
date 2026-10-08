import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import CustomSelect from '../../../selector/CustomSelect';
import { teamService } from '../../../../../services/teamService';
import { getTasks } from '../../../../../services/taskService';
import './CreateProjectModal.css';
import styles from './EditProjectModal.module.css';
import { CheckIcon, CloseIcon, UploadingIcon, WarningIcon } from '../../../components/TaskManagerIcons';
import { TasksPicker, TeamsPicker, useProjectPickerDetails } from './ProjectFormSelectors';
import { projectPriorityOptions, projectStatusOptions } from './projectFormOptions';

const CreateProjectModal = ({ onClose, onSubmit, departmentId = null }) => {
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
    no_deadline: true  // Добавляем флаг "Без срока"
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

  // Загрузка команд для выбора
  useEffect(() => {
    const loadTeams = async () => {
      try {
        const params = departmentId ? { department_id: departmentId } : {};
        const teamsData = await teamService.getTeams(params);
        setTeams(teamsData);
      } catch (error) {
        console.error('Error loading teams:', error);
      }
    };
    loadTeams();
  }, [departmentId]);

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

  const reloadTeams = async () => {
    try {
      const params = departmentId ? { department_id: departmentId } : {};
      const teamsData = await teamService.getTeams(params);
      setTeams(Array.isArray(teamsData) ? teamsData : []);
    } catch (error) {
      console.error('Error reloading teams:', error);
    }
  };

  const { openTeam, openTask, closeNested, detailLayers } = useProjectPickerDetails({
    catalogTasks: tasks,
    onTeamsChanged: reloadTeams,
  });

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
    
    if (!projectData.no_deadline && projectData.start_date && projectData.due_date) {
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
        start_date: projectData.no_deadline ? null : (projectData.start_date ? new Date(projectData.start_date).toISOString() : null),
        due_date: projectData.no_deadline ? null : (projectData.due_date ? new Date(projectData.due_date).toISOString() : null)
      };

      setUploading(true);
      setUploadProgress(0);
      await onSubmit(submitData, Array.from(files || []), (evt) => {
        if (evt && evt.total) {
          const percent = Math.round((evt.loaded * 100) / evt.total);
          setUploadProgress(percent);
        }
      });
      
      // Проект успешно создан со всеми файлами
      onClose();
    } catch (error) {
      console.error('Error creating project:', error);
      
      // Определяем тип ошибки для пользователя
      if (error.message === 'Файлы не были загружены') {
        setErrors({ general: 'Ошибка при загрузке файлов. Проект не был создан. Попробуйте еще раз.' });
      } else if (error.response && error.response.status === 413) {
        setErrors({ general: 'Файлы слишком большие. Уменьшите размер файлов и попробуйте снова.' });
      } else if (error.message && error.message.includes('File type not allowed')) {
        setErrors({ general: 'Недопустимый тип файла. Проверьте форматы файлов.' });
      } else {
        setErrors({ general: 'Ошибка при создании проекта. Проверьте данные и попробуйте снова.' });
      }
    } finally {
      setLoading(false);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (closeNested()) return;
      onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, closeNested]);

  const fileList = files ? Array.from(files) : [];

  return createPortal(
    <>
    <div className={`${styles.overlay} project-modal-overlay`} onClick={() => !loading && onClose()} role="presentation">
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-modal-title"
      >
        <div className={styles.head}>
          <div>
            <h3 id="create-project-modal-title">Новый проект</h3>
            <p className={styles.subtitle}>Название, сроки, команды и задачи</p>
          </div>
          <button type="button" onClick={onClose} className={styles.close} aria-label="Закрыть">
            <XMarkIcon />
          </button>
        </div>

        {errors.general && <div className={styles.error} role="alert">{errors.general}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.body}>
            <div className={styles.section}>
              <p className={styles.sectionTitle}>Основное</p>
              <div className={styles.field}>
                <label htmlFor="create-project-name">Название <span className={styles.required}>*</span></label>
                <input
                  id="create-project-name"
                  type="text"
                  value={projectData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className={errors.name ? styles.invalid : ''}
                  placeholder="Например, Портал для клиентов"
                  autoFocus
                />
                {errors.name && <span className={styles.hint}>{errors.name}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="create-project-description">Описание</label>
                <textarea
                  id="create-project-description"
                  value={projectData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Цель и ожидаемый результат"
                  rows={3}
                />
              </div>
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

              <label className={styles.toggle}>
                <span className={styles.toggleText}>
                  <span className={styles.toggleTitle}>Без срока</span>
                  <span className={styles.toggleHint}>Проект без ограничений по времени</span>
                </span>
                <input
                  type="checkbox"
                  checked={projectData.no_deadline}
                  onChange={(e) => handleChange('no_deadline', e.target.checked)}
                  className={styles.switch}
                />
              </label>

              {!projectData.no_deadline && (
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label htmlFor="create-project-start">Дата начала</label>
                    <input
                      id="create-project-start"
                      type="date"
                      value={projectData.start_date}
                      onChange={(e) => handleChange('start_date', e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="create-project-due">Дата окончания</label>
                    <input
                      id="create-project-due"
                      type="date"
                      value={projectData.due_date}
                      onChange={(e) => handleChange('due_date', e.target.value)}
                      className={errors.due_date ? styles.invalid : ''}
                    />
                    {errors.due_date && <span className={styles.hint}>{errors.due_date}</span>}
                  </div>
                </div>
              )}

              <div className={styles.field}>
                <label htmlFor="create-project-budget">Бюджет, ₽</label>
                <input
                  id="create-project-budget"
                  type="number"
                  value={projectData.budget}
                  onChange={(e) => handleChange('budget', e.target.value)}
                  placeholder="Не указан"
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
                    placeholder="Добавить тег и нажать Enter"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    aria-label="Новый тег"
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
              <p className={styles.sectionTitle}>Команды{departmentId ? ' отдела' : ''}</p>
              <TeamsPicker
                teams={teams}
                value={projectData.team_ids}
                onChange={(ids) => handleChange('team_ids', ids)}
                onTeamOpen={openTeam}
                emptyMessage="Нет доступных команд. Сначала создайте команду в отделе."
              />
            </div>

            <div className={styles.section}>
              <p className={styles.sectionTitle}>Задачи</p>
              <TasksPicker
                catalogTasks={tasks}
                loading={tasksLoading}
                value={projectData.task_ids}
                onChange={(ids) => handleChange('task_ids', ids)}
                onTaskOpen={openTask}
              />
            </div>

            <div className={styles.section}>
              <p className={styles.sectionTitle}>Файлы</p>
              <div className={styles.fileBox}>
                <input type="file" multiple onChange={(e) => setFiles(e.target.files)} />
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
          </div>

          <div className={styles.footer}>
            <button type="button" onClick={onClose} className={`${styles.ghost} ${styles.pushRight}`}>
              Отмена
            </button>
            <button type="submit" disabled={loading || uploading} className={styles.primary}>
              {uploading && uploadProgress < 100
                ? `Загрузка ${uploadProgress}%`
                : loading
                  ? 'Создание…'
                  : 'Создать проект'}
            </button>
          </div>
        </form>
      </div>
    </div>
    {detailLayers}
    </>,
    document.body
  );
};

export default CreateProjectModal;
