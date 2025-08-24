import React, { useState, useEffect } from 'react';
import { teamService } from '../../../services/teamService';
import './CreateProjectModal.css';

const CreateProjectModal = ({ onClose, onSubmit }) => {
  const [projectData, setProjectData] = useState({
    name: '',
    description: '',
    status: 'planning',
    priority: 'medium',
    start_date: '',
    due_date: '',
    budget: '',
    tags: [],
    team_ids: []
  });

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [newTag, setNewTag] = useState('');

  // Загрузка команд для выбора
  useEffect(() => {
    const loadTeams = async () => {
      try {
        const teamsData = await teamService.getTeams();
        setTeams(teamsData);
      } catch (error) {
        console.error('Error loading teams:', error);
      }
    };
    loadTeams();
  }, []);

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

  const handleTeamToggle = (teamId) => {
    setProjectData(prev => ({
      ...prev,
      team_ids: prev.team_ids.includes(teamId)
        ? prev.team_ids.filter(id => id !== teamId)
        : [...prev.team_ids, teamId]
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
        due_date: projectData.due_date ? new Date(projectData.due_date).toISOString() : null
      };

      await onSubmit(submitData);
    } catch (error) {
      console.error('Error creating project:', error);
      setErrors({ general: 'Ошибка при создании проекта' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Создать новый проект</h2>
          <button onClick={onClose} className="close-btn">✕</button>
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
              <select
                value={projectData.status}
                onChange={(e) => handleChange('status', e.target.value)}
              >
                <option value="planning">Планирование</option>
                <option value="active">Активный</option>
                <option value="on_hold">На паузе</option>
                <option value="completed">Завершен</option>
                <option value="cancelled">Отменен</option>
                <option value="archived">Архивный</option>
              </select>
            </div>

            <div className="form-group">
              <label>Приоритет</label>
              <select
                value={projectData.priority}
                onChange={(e) => handleChange('priority', e.target.value)}
              >
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
                <option value="critical">Критический</option>
                <option value="urgent">Срочный</option>
              </select>
            </div>
          </div>

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
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Команды</label>
            <div className="teams-selection">
              {teams.map(team => (
                <label key={team.id} className="team-checkbox">
                  <input
                    type="checkbox"
                    checked={projectData.team_ids.includes(team.id)}
                    onChange={() => handleTeamToggle(team.id)}
                  />
                  <span className="team-name">{team.name}</span>
                  {team.description && (
                    <span className="team-description">{team.description}</span>
                  )}
                </label>
              ))}
            </div>
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
              disabled={loading}
              className="submit-btn"
            >
              {loading ? 'Создание...' : 'Создать проект'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;
