import React, { useState, useEffect } from 'react';
import CustomSelect from '../../../selector/CustomSelect';
import { teamService } from '../../../../../services/teamService';
import { getTasks } from '../../../../../services/taskService';
import './CreateProjectModal.css';
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

  const { openTeam, openTask, detailLayers } = useProjectPickerDetails({
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

  return (
    <>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Создать новый проект</h2>
          <button onClick={onClose} className="close-btn"><CloseIcon size="sm" /></button>
        </div>

        {errors.general && (
          <div className="error-message">
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} className="project-form">
          <div className="form-group">
            <label>Название проекта *</label>
            <input
              type="text"
              value={projectData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={errors.name ? 'error-input' : ''}
              placeholder="Введите название проекта"
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label>Описание</label>
            <textarea
              value={projectData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Опишите проект"
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Статус</label>
              <CustomSelect
                options={projectStatusOptions}
                value={projectData.status}
                onChange={(val) => handleChange('status', val)}
                menuZIndex={10050}
              />
            </div>

            <div className="form-group">
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

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={projectData.no_deadline}
                onChange={(e) => handleChange('no_deadline', e.target.checked)}
              />
              Без срока
            </label>
            <small>Проект будет выполняться без ограничений по времени</small>
          </div>

          {!projectData.no_deadline && (
            <div className="form-row">
              <div className="form-group">
                <label>Дата начала</label>
                <input
                  type="date"
                  value={projectData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Дата окончания</label>
                <input
                  type="date"
                  value={projectData.due_date}
                  onChange={(e) => handleChange('due_date', e.target.value)}
                  className={errors.due_date ? 'error-input' : ''}
                />
                {errors.due_date && <span className="error-text">{errors.due_date}</span>}
              </div>
            </div>
          )}

          {projectData.no_deadline && (
            <div className="form-group">
              <div className="deadline-status">
                Срок выполнения: <strong>Без срока</strong>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Бюджет (₽)</label>
            <input
              type="number"
              value={projectData.budget}
              onChange={(e) => handleChange('budget', e.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
              className={errors.budget ? 'error-input' : ''}
            />
            {errors.budget && <span className="error-text">{errors.budget}</span>}
          </div>

          <div className="form-group">
            <label>Теги</label>
            <div className="tags-input">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Добавить тег"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="add-tag-btn"
              >
                +
              </button>
            </div>
            {projectData.tags.length > 0 && (
              <div className="tags-list">
                {projectData.tags.map((tag, index) => (
                  <span key={index} className="tag">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="remove-tag-btn"
                    >
                      <CloseIcon size="xs" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Загрузить файлы</label>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(e.target.files)}
              className="file-input"
            />
            {files && files.length > 0 && (
              <div className="selected-files">
                <p>Выбрано файлов: {files.length}</p>
                <ul>
                  {Array.from(files).map((file, index) => (
                    <li key={index} title={file.name} className="file-item">
                      <div className="file-info">
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">({Math.round(file.size / 1024)} KB)</span>
                      </div>
                      <div className="file-status">
                        {uploading ? (
                          <span className="status-uploading inline-flex items-center gap-1">
                            <UploadingIcon size="xs" className="animate-pulse" />
                            Загружается...
                          </span>
                        ) : (
                          <span className="status-ready inline-flex items-center gap-1">
                            <CheckIcon size="xs" />
                            Готов
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {uploading && (
              <div className="upload-progress">
                <div className="progress-header">
                  <span className="progress-text">Загрузка файлов...</span>
                  <span className="progress-percent">{uploadProgress}%</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                {uploadProgress < 100 && (
                  <div className="progress-message">
                    <small className="inline-flex items-center gap-1">
                      <WarningIcon size="xs" className="text-amber-500 shrink-0" />
                      Дождитесь завершения загрузки всех файлов
                    </small>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Команды{departmentId ? ' отдела' : ''}</label>
            <TeamsPicker
              teams={teams}
              value={projectData.team_ids}
              onChange={(ids) => handleChange('team_ids', ids)}
              onTeamOpen={openTeam}
              emptyMessage="Нет доступных команд. Сначала создайте команду в отделе."
            />
          </div>

          <div className="form-group">
            <label>Задачи проекта</label>
            <TasksPicker
              catalogTasks={tasks}
              loading={tasksLoading}
              value={projectData.task_ids}
              onChange={(ids) => handleChange('task_ids', ids)}
              onTaskOpen={openTask}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="cancel-btn"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || uploading}
              className="submit-btn"
            >
              {uploading && uploadProgress < 100 
                ? `Загрузка файлов... ${uploadProgress}%` 
                : loading 
                ? 'Создание...' 
                : 'Создать проект'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
    {detailLayers}
    </>
  );
};

export default CreateProjectModal;
