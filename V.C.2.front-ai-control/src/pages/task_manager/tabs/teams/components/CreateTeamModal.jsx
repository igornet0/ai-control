import React, { useState, useEffect } from 'react';
import { teamService } from '../../../../../services/teamService';
import { employeeService } from '../../../../../services/employeeService';
import './CreateTeamModal.css';
import { CloseIcon, IconWithText, WarningIcon } from '../../../components/TaskManagerIcons';

const CreateTeamModal = ({ onClose, onSubmit, departmentId = null }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    department_id: departmentId ? String(departmentId) : '',
    is_public: false,
    auto_disband_date: '',
    tags: '',
    member_ids: [],
    no_deadline: true
  });
  const [departments, setDepartments] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const depts = await employeeService.getDepartments();
        setDepartments(depts);
      } catch (error) {
        console.error('Error loading departments:', error);
      }
    };
    loadDepartments();
  }, []);

  // Поиск пользователей
  const searchUsers = async (term) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const users = await teamService.searchUsers(term);
      setSearchResults(users);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm) {
        searchUsers(searchTerm);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Очищаем ошибку для поля
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleAddUser = (user) => {
    if (!selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(prev => [...prev, user]);
      setFormData(prev => ({
        ...prev,
        member_ids: [...prev.member_ids, user.id]
      }));
    }
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleRemoveUser = (userId) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
    setFormData(prev => ({
      ...prev,
      member_ids: prev.member_ids.filter(id => id !== userId)
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Название команды обязательно';
    }

    if (formData.auto_disband_date) {
      const selectedDate = new Date(formData.auto_disband_date);
      const today = new Date();
      if (selectedDate <= today) {
        newErrors.auto_disband_date = 'Дата должна быть в будущем';
      }
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
      
      const teamData = {
        ...formData,
        department_id: formData.department_id ? Number(formData.department_id) : null,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        auto_disband_date: formData.no_deadline ? null : (formData.auto_disband_date ? new Date(formData.auto_disband_date).toISOString() : null)
      };

      await onSubmit(teamData);
    } catch (error) {
      console.error('Error creating team:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Создать команду</h2>
          <button className="close-btn" onClick={onClose}><CloseIcon size="sm" /></button>
        </div>

        <form onSubmit={handleSubmit} className="team-form">
          <div className="form-group">
            <label htmlFor="name">Название команды *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={errors.name ? 'error' : ''}
              placeholder="Введите название команды"
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="description">Описание</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Опишите назначение команды"
              rows="3"
            />
          </div>

          <div className="form-group">
            <label htmlFor="department_id">Отдел</label>
            <select
              id="department_id"
              name="department_id"
              value={formData.department_id}
              onChange={handleInputChange}
              disabled={Boolean(departmentId)}
            >
              <option value="">— без отдела —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <small>Привязка команды к отделу для оргструктуры и статистики</small>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="is_public"
                checked={formData.is_public}
                onChange={handleInputChange}
              />
              Публичная команда
            </label>
            <small>Публичные команды видны всем пользователям</small>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="no_deadline"
                checked={formData.no_deadline}
                onChange={handleInputChange}
              />
              Без срока расформирования
            </label>
            <small>Команда будет существовать без автоматического расформирования</small>
          </div>

          {!formData.no_deadline && (
            <div className="form-group">
              <label htmlFor="auto_disband_date">Дата автоматического расформирования</label>
              <input
                type="datetime-local"
                id="auto_disband_date"
                name="auto_disband_date"
                value={formData.auto_disband_date}
                onChange={handleInputChange}
                className={errors.auto_disband_date ? 'error' : ''}
              />
              {errors.auto_disband_date && (
                <span className="error-text">{errors.auto_disband_date}</span>
              )}
              <small className="warning-text">
                <IconWithText icon={WarningIcon} className="text-amber-500 text-sm">
                  Это действие нельзя отменить! Команда будет автоматически расформирована в указанную дату.
                </IconWithText>
              </small>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="tags">Теги (через запятую)</label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              placeholder="frontend, backend, design"
            />
          </div>

          <div className="form-group">
            <label>Добавить участников</label>
            <div className="user-search">
              <input
                type="text"
                placeholder="Поиск пользователей..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="user-search-input"
              />
              
              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map(user => (
                    <div 
                      key={user.id} 
                      className="search-result-item"
                      onClick={() => handleAddUser(user)}
                    >
                      <span className="user-name">{user.name || user.login}</span>
                      <span className="user-email">{user.email}</span>
                      {user.login && user.login !== user.name && (
                        <span className="user-role">{user.login}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedUsers.length > 0 && (
              <div className="selected-users">
                <h4>Выбранные участники:</h4>
                {selectedUsers.map(user => (
                  <div key={user.id} className="selected-user">
                    <span>{user.name || user.login}{user.email ? ` (${user.email})` : ''}</span>
                    <button 
                      type="button"
                      onClick={() => handleRemoveUser(user.id)}
                      className="remove-user-btn"
                    >
                      <CloseIcon size="xs" />
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
              className="btn btn-secondary"
            >
              Отмена
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Создание...' : 'Создать команду'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTeamModal;
