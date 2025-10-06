import React, { useState, useEffect } from 'react';
import { authFetch } from '../../../../../services/http';
import './CreateTeamModal.css'; // Используем те же стили

const EditTeamModal = ({ team, onClose, onSubmit }) => {
  const [teamData, setTeamData] = useState({
    name: '',
    description: '',
    status: 'active',
    is_public: false,
    tags: []
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [tagInput, setTagInput] = useState('');

  // Инициализируем данные команды при открытии модального окна
  useEffect(() => {
    if (team) {
      setTeamData({
        name: team.name || '',
        description: team.description || '',
        status: team.status || 'active',
        is_public: team.is_public || false,
        tags: team.tags || []
      });
      
      // Устанавливаем текущих участников команды
      if (team.members) {
        setSelectedMembers(team.members.map(member => ({
          user_id: member.user_id,
          username: member.user?.username || `User ${member.user_id}`,
          role: member.role || 'member'
        })));
      }
    }
    
    // Загружаем список всех доступных пользователей
    loadAvailableUsers();
  }, [team]);

  const loadAvailableUsers = async () => {
    try {
      const users = await authFetch('/auth/users/');
      setAvailableUsers(users || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleChange = (field, value) => {
    setTeamData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Очищаем ошибку для поля при изменении
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Управление тегами
  const addTag = () => {
    if (tagInput.trim() && !teamData.tags.includes(tagInput.trim())) {
      setTeamData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setTeamData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTagKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  // Управление участниками
  const addMember = (user) => {
    if (!selectedMembers.find(member => member.user_id === user.id)) {
      setSelectedMembers(prev => [...prev, {
        user_id: user.id,
        username: user.username,
        role: 'member'
      }]);
    }
  };

  const removeMember = (userId) => {
    setSelectedMembers(prev => prev.filter(member => member.user_id !== userId));
  };

  const updateMemberRole = (userId, newRole) => {
    setSelectedMembers(prev => prev.map(member => 
      member.user_id === userId ? { ...member, role: newRole } : member
    ));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!teamData.name.trim()) {
      newErrors.name = 'Название команды обязательно';
    }
    
    if (teamData.name.trim().length > 100) {
      newErrors.name = 'Название команды не должно превышать 100 символов';
    }

    if (teamData.description && teamData.description.length > 500) {
      newErrors.description = 'Описание не должно превышать 500 символов';
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
        ...teamData,
        members: selectedMembers
      };
      
      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error('Error updating team:', error);
      setErrors({ 
        general: error.response?.data?.detail || 'Ошибка при обновлении команды' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Редактировать команду</h2>
          <button type="button" onClick={onClose} className="close-btn">
            ✕
          </button>
        </div>

        {errors.general && (
          <div className="error-message">
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} className="team-form">
          <div className="form-group">
            <label>Название команды *</label>
            <input
              type="text"
              value={teamData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={errors.name ? 'error-input' : ''}
              placeholder="Введите название команды"
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label>Описание</label>
            <textarea
              value={teamData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className={errors.description ? 'error-input' : ''}
              placeholder="Опишите команду"
              rows={3}
            />
            {errors.description && <span className="error-text">{errors.description}</span>}
          </div>

          <div className="form-group">
            <label>Статус команды *</label>
            <select
              value={teamData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className={errors.status ? 'error-input' : ''}
            >
              <option value="active">Активная</option>
              <option value="inactive">Неактивная</option>
              <option value="archived">Архивная</option>
              <option value="disbanded">Расформированная</option>
            </select>
            {errors.status && <span className="error-text">{errors.status}</span>}
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={teamData.is_public}
                onChange={(e) => handleChange('is_public', e.target.checked)}
              />
              <span className="checkbox-text">Публичная команда</span>
              <small className="form-hint">Публичные команды видны всем пользователям</small>
            </label>
          </div>

          {/* Управление тегами */}
          <div className="form-group">
            <label>Теги команды</label>
            <div className="tags-input-container">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleTagKeyPress}
                placeholder="Введите тег и нажмите Enter"
                className="tag-input"
              />
              <button type="button" onClick={addTag} className="add-tag-btn">
                Добавить
              </button>
            </div>
            
            {teamData.tags.length > 0 && (
              <div className="tags-list">
                {teamData.tags.map((tag, index) => (
                  <span key={index} className="tag-item">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="remove-tag-btn"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Управление участниками */}
          <div className="form-group">
            <label>Участники команды</label>
            
            {/* Добавление участников */}
            <div className="members-add-section">
              <select 
                onChange={(e) => {
                  const userId = parseInt(e.target.value);
                  const user = availableUsers.find(u => u.id === userId);
                  if (user) {
                    addMember(user);
                    e.target.value = '';
                  }
                }}
                className="member-select"
              >
                <option value="">Выберите пользователя для добавления</option>
                {availableUsers
                  .filter(user => !selectedMembers.find(member => member.user_id === user.id))
                  .map(user => (
                    <option key={user.id} value={user.id}>
                      {user.username} ({user.email})
                    </option>
                  ))}
              </select>
            </div>

            {/* Список текущих участников */}
            {selectedMembers.length > 0 && (
              <div className="members-list">
                <h4>Текущие участники:</h4>
                {selectedMembers.map((member) => (
                  <div key={member.user_id} className="member-item">
                    <span className="member-name">{member.username}</span>
                    <select
                      value={member.role}
                      onChange={(e) => updateMemberRole(member.user_id, e.target.value)}
                      className="member-role-select"
                    >
                      <option value="member">Участник</option>
                      <option value="leader">Лидер</option>
                      <option value="owner">Владелец</option>
                      <option value="guest">Гость</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeMember(member.user_id)}
                      className="remove-member-btn"
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              {loading ? 'Обновление...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTeamModal;
