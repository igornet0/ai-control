import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { teamService } from '../../../../../services/teamService';
import { employeeService } from '../../../../../services/employeeService';
import './CreateTeamModal.css';
import styles from '../../projects/components/EditProjectModal.module.css';
import { CloseIcon, WarningIcon } from '../../../components/TaskManagerIcons';

const initials = (name) => String(name || '?')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase();

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

  const availableResults = searchResults.filter((user) => !selectedUsers.some((u) => u.id === user.id));

  return createPortal(
    <div className={styles.overlay} onClick={() => !loading && onClose()} role="presentation">
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-team-modal-title"
      >
        <div className={styles.head}>
          <div>
            <h3 id="create-team-modal-title">Новая команда</h3>
            <p className={styles.subtitle}>Название, отдел и участники</p>
          </div>
          <button type="button" onClick={onClose} className={styles.close} aria-label="Закрыть">
            <XMarkIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.body}>
            <div className={styles.section}>
              <p className={styles.sectionTitle}>Основное</p>
              <div className={styles.field}>
                <label htmlFor="name">Название <span className={styles.required}>*</span></label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={errors.name ? styles.invalid : ''}
                  placeholder="Например, Backend Core"
                  autoFocus
                />
                {errors.name && <span className={styles.hint}>{errors.name}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="description">Описание</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Чем занимается команда"
                  rows="3"
                />
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label htmlFor="department_id">Отдел</label>
                  <select
                    id="department_id"
                    name="department_id"
                    value={formData.department_id}
                    onChange={handleInputChange}
                    disabled={Boolean(departmentId)}
                  >
                    <option value="">Без отдела</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="tags">Теги</label>
                  <input
                    type="text"
                    id="tags"
                    name="tags"
                    value={formData.tags}
                    onChange={handleInputChange}
                    placeholder="frontend, backend"
                  />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <p className={styles.sectionTitle}>Настройки</p>
              <label className={styles.toggle}>
                <span className={styles.toggleText}>
                  <span className={styles.toggleTitle}>Публичная команда</span>
                  <span className={styles.toggleHint}>Видна всем пользователям</span>
                </span>
                <input
                  type="checkbox"
                  name="is_public"
                  checked={formData.is_public}
                  onChange={handleInputChange}
                  className={styles.switch}
                />
              </label>
              <label className={styles.toggle}>
                <span className={styles.toggleText}>
                  <span className={styles.toggleTitle}>Бессрочная</span>
                  <span className={styles.toggleHint}>Без автоматического расформирования</span>
                </span>
                <input
                  type="checkbox"
                  name="no_deadline"
                  checked={formData.no_deadline}
                  onChange={handleInputChange}
                  className={styles.switch}
                />
              </label>
              {!formData.no_deadline && (
                <div className={styles.field}>
                  <label htmlFor="auto_disband_date">Дата расформирования</label>
                  <input
                    type="datetime-local"
                    id="auto_disband_date"
                    name="auto_disband_date"
                    value={formData.auto_disband_date}
                    onChange={handleInputChange}
                    className={errors.auto_disband_date ? styles.invalid : ''}
                  />
                  {errors.auto_disband_date && <span className={styles.hint}>{errors.auto_disband_date}</span>}
                  <p className={styles.warningNote}>
                    <WarningIcon size="xs" className="shrink-0" />
                    В эту дату команда будет расформирована автоматически — отменить нельзя.
                  </p>
                </div>
              )}
            </div>

            <div className={styles.section}>
              <p className={styles.sectionTitle}>
                Участники
                {selectedUsers.length > 0 && <span className={styles.sectionCount}>{selectedUsers.length}</span>}
              </p>
              <div className={styles.searchWrap}>
                <MagnifyingGlassIcon />
                <input
                  type="text"
                  placeholder="Найти сотрудника — имя или email…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Поиск сотрудника"
                />
                {availableResults.length > 0 && (
                  <div className={styles.searchResults}>
                    {availableResults.map((user) => (
                      <button key={user.id} type="button" onClick={() => handleAddUser(user)}>
                        <span className={styles.resultName}>{user.name || user.login}</span>
                        {user.email && <span className={styles.resultMeta}>{user.email}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedUsers.length > 0 ? (
                <div className={styles.people}>
                  {selectedUsers.map((user) => {
                    const name = user.name || user.login;
                    return (
                      <div key={user.id} className={styles.person}>
                        <div className={styles.avatar}>{initials(name)}</div>
                        <div className={styles.personBody}>
                          <strong>{name}</strong>
                          {user.email && <em>{user.email}</em>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveUser(user.id)}
                          className={styles.removePerson}
                          aria-label={`Убрать ${name}`}
                        >
                          <CloseIcon size="xs" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={`${styles.hintMuted} ${styles.hintAfter}`}>Участников можно добавить и позже</p>
              )}
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" onClick={onClose} className={`${styles.ghost} ${styles.pushRight}`}>
              Отмена
            </button>
            <button type="submit" className={styles.primary} disabled={loading}>
              {loading ? 'Создание…' : 'Создать команду'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

export default CreateTeamModal;
