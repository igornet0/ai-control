import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  UsersIcon,
  EyeIcon,
  Cog6ToothIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { flowService } from '../../services/flowService';
import { dashboardService } from '../../services/dashboardService';
import { TEAM_ROLES } from '../../services/employeeService';
import { isPlatformAdmin } from '../../utils/isPlatformAdmin';
import styles from './FlowManagement.module.css';

function matchesSearch(haystack, query) {
  if (!query) return true;
  return String(haystack || '').toLowerCase().includes(query);
}

function SearchableCheckboxList({
  items,
  getId,
  getLabel,
  isChecked,
  onToggle,
  searchPlaceholder,
  emptyText,
  idPrefix,
}) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const filtered = useMemo(
    () => items.filter((item) => matchesSearch(getLabel(item), term)),
    [items, getLabel, term],
  );

  return (
    <div className={styles.searchableList}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        className={styles.listSearch}
      />
      <div className={styles.usersList}>
        {filtered.map((item) => {
          const id = getId(item);
          const inputId = `${idPrefix}-${id}`;
          return (
            <div key={id} className={styles.userItem}>
              <input
                type="checkbox"
                id={inputId}
                checked={isChecked(id)}
                onChange={() => onToggle(id)}
                className={styles.checkbox}
              />
              <label htmlFor={inputId} className={styles.userLabel}>
                {getLabel(item)}
              </label>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className={styles.accessTypeDescription}>{emptyText}</p>
        )}
        {items.length > 0 && filtered.length === 0 && (
          <p className={styles.accessTypeDescription}>Ничего не найдено</p>
        )}
      </div>
    </div>
  );
}

const FlowManagement = () => {
  const { user } = useAuth();
  const [flows, setFlows] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDashboardsModal, setShowDashboardsModal] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
  const [currentFlow, setCurrentFlow] = useState(null);
  const [flowDashboards, setFlowDashboards] = useState([]);
  const [availableDashboards, setAvailableDashboards] = useState([]);
  const [dashboardActionLoading, setDashboardActionLoading] = useState({});
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teamRoles, setTeamRoles] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    access_type: 'private',
    allowed_users: [],
    allowed_roles: [],
    allowed_teams: [],
    allowed_departments: [],
    settings: {}
  });

  const platformRoleOptions = [
    { id: 'admin', label: 'Администратор' },
    { id: 'user', label: 'Пользователь' },
  ];

  const accessTypes = [
    { id: 'private', name: 'Приватный', description: 'Только создатель' },
    { id: 'public', name: 'Публичный', description: 'Все пользователи' },
    { id: 'restricted', name: 'Ограниченный', description: 'Роли, команды, отделы и пользователи' }
  ];

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Загружаем потоки
        const flowsData = await flowService.getFlows();
        setFlows(flowsData.flows || []);

        try {
          const options = await flowService.getAssignableOptions().catch(() => null);
          if (options) {
            setUsers(options.users || []);
            setTeams(options.teams || []);
            setDepartments(options.departments || []);
            setTeamRoles(options.team_roles || []);
          } else {
            const usersData = await flowService.getAssignableUsers();
            setUsers(usersData.users || []);
          }
        } catch (usersError) {
          console.warn('Failed to load assignable options:', usersError);
          setUsers([]);
          setTeams([]);
          setDepartments([]);
          setTeamRoles([]);
        }
        
      } catch (error) {
        console.error('Error loading flow data:', error);
        alert('Ошибка загрузки данных потоков');
      } finally {
        setLoading(false);
      }
    };

    if (isPlatformAdmin(user)) {
      loadData();
    }
  }, [user]);

  const openCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      access_type: 'private',
      allowed_users: [],
      allowed_roles: [],
      allowed_teams: [],
      allowed_departments: [],
      settings: {}
    });
    setShowCreateModal(true);
  };

  const openEditModal = (flow) => {
    setEditingFlow(flow);
    setFormData({
      name: flow.name,
      description: flow.description || '',
      access_type: flow.access_type,
      allowed_users: flow.allowed_users || [],
      allowed_roles: flow.allowed_roles || [],
      allowed_teams: flow.allowed_teams || [],
      allowed_departments: flow.allowed_departments || [],
      settings: flow.settings || {}
    });
    setShowEditModal(true);
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDashboardsModal(false);
    setEditingFlow(null);
    setCurrentFlow(null);
    setFlowDashboards([]);
  };

  const openDashboardsModal = async (flow) => {
    try {
      setCurrentFlow(flow);
      setShowDashboardsModal(true);
      
      // Загружаем дашборды потока
      const dashboardsData = await flowService.getFlowDashboards(flow.id);
      const inFlow = dashboardsData.dashboards || [];
      setFlowDashboards(inFlow);

      const allDashboards = await dashboardService.getDashboards().catch(() => []);
      const inFlowIds = new Set(inFlow.map((dashboard) => dashboard.id));
      setAvailableDashboards((allDashboards || []).filter((dashboard) => !inFlowIds.has(dashboard.id)));
    } catch (error) {
      console.error('Error loading flow dashboards:', error);
      alert('Ошибка загрузки дашбордов потока');
    }
  };

  const toggleDashboardVisibility = async (dashboardId, visible) => {
    if (!currentFlow?.id) return;
    setDashboardActionLoading((prev) => ({ ...prev, [dashboardId]: true }));
    try {
      if (visible) {
        await flowService.publishDashboardToFlow(currentFlow.id, { dashboard_id: dashboardId });
      } else {
        await flowService.removeDashboardFromFlow(currentFlow.id, dashboardId);
      }

      const dashboardsData = await flowService.getFlowDashboards(currentFlow.id);
      const inFlow = dashboardsData.dashboards || [];
      setFlowDashboards(inFlow);

      const allDashboards = await dashboardService.getDashboards().catch(() => []);
      const inFlowIds = new Set(inFlow.map((dashboard) => dashboard.id));
      setAvailableDashboards((allDashboards || []).filter((dashboard) => !inFlowIds.has(dashboard.id)));

      const flowsData = await flowService.getFlows();
      setFlows(flowsData.flows || []);
    } catch (error) {
      console.error('Error changing dashboard visibility in flow:', error);
      alert('Не удалось изменить отображение дашборда в потоке');
    } finally {
      setDashboardActionLoading((prev) => ({ ...prev, [dashboardId]: false }));
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleUserToggle = (userId) => {
    const value = Number(userId);
    setFormData((prev) => {
      const current = (prev.allowed_users || []).map((id) => Number(id));
      return {
        ...prev,
        allowed_users: current.includes(value)
          ? current.filter((id) => id !== value)
          : [...current, value],
      };
    });
  };

  const handleRoleToggle = (roleId) => {
    setFormData(prev => ({
      ...prev,
      allowed_roles: prev.allowed_roles.includes(roleId)
        ? prev.allowed_roles.filter(id => id !== roleId)
        : [...prev.allowed_roles, roleId]
    }));
  };

  const toggleIdList = (field, rawId) => {
    const value = Number(rawId);
    setFormData((prev) => {
      const current = (prev[field] || []).map((item) => Number(item));
      return {
        ...prev,
        [field]: current.includes(value)
          ? current.filter((id) => id !== value)
          : [...current, value],
      };
    });
  };

  const createFlow = async () => {
    try {
      const { settings: _ignoredSettings, ...accessFields } = formData;
      await flowService.createFlow(accessFields);
      closeModals();
      
      // Перезагружаем список потоков
      const flowsData = await flowService.getFlows();
      setFlows(flowsData.flows || []);
      
      alert('Поток успешно создан!');
    } catch (error) {
      console.error('Error creating flow:', error);
      alert('Ошибка создания потока');
    }
  };

  const updateFlow = async () => {
    try {
      // Do not send nested settings.allowed_* — they are stale copies and overwrite lists on the API.
      const { settings: _ignoredSettings, ...accessFields } = formData;
      await flowService.updateFlow(editingFlow.id, accessFields);
      closeModals();
      
      // Перезагружаем список потоков
      const flowsData = await flowService.getFlows();
      setFlows(flowsData.flows || []);
      
      alert('Поток успешно обновлен!');
    } catch (error) {
      console.error('Error updating flow:', error);
      alert('Ошибка обновления потока');
    }
  };

  const deleteFlow = async (flowId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот поток?')) {
      try {
        await flowService.deleteFlow(flowId);
        
        // Перезагружаем список потоков
        const flowsData = await flowService.getFlows();
        setFlows(flowsData.flows || []);
        
        alert('Поток успешно удален!');
      } catch (error) {
        console.error('Error deleting flow:', error);
        alert('Ошибка удаления потока');
      }
    }
  };

  if (!isPlatformAdmin(user)) {
    return (
      <div className={styles.flowManagement}>
        <div className={styles.container}>
          <div className={styles.accessDenied}>
            <h2>Доступ запрещен</h2>
            <p>У вас нет прав для управления потоками.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.flowManagement}>
        <div className={styles.container}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
            <div style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-secondary)' }}>
              Загрузка потоков...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.flowManagement}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Управление потоками</h1>
          <button
            onClick={openCreateModal}
            className="btn btn-primary"
          >
            <PlusIcon style={{ width: '1.25rem', height: '1.25rem' }} />
            Создать поток
          </button>
        </div>

        <div className={styles.flowsGrid}>
          {flows.map((flow) => (
            <div key={flow.id} className={`card ${styles.flowCard}`}>
              <div className={styles.flowHeader}>
                <h3 className={styles.flowTitle}>{flow.name}</h3>
                <div className={styles.flowActions}>
                  <button
                    onClick={() => openEditModal(flow)}
                    className={`btn btn-sm btn-outline ${styles.actionButton}`}
                    title="Редактировать поток"
                  >
                    <PencilIcon style={{ width: '1rem', height: '1rem' }} />
                  </button>
                  <button
                    onClick={() => deleteFlow(flow.id)}
                    className={`btn btn-sm btn-danger ${styles.actionButton}`}
                    title="Удалить поток"
                  >
                    <TrashIcon style={{ width: '1rem', height: '1rem' }} />
                  </button>
                </div>
              </div>
              
              <div className={styles.flowContent}>
                {flow.description && (
                  <p className={styles.flowDescription}>{flow.description}</p>
                )}
                
                <div className={styles.flowMeta}>
                  <div className={styles.flowMetaItem}>
                    <Cog6ToothIcon style={{ width: '1rem', height: '1rem' }} />
                    <span>{accessTypes.find(t => t.id === flow.access_type)?.name}</span>
                  </div>
                  
                  {flow.access_type === 'restricted' && (
                    <div className={styles.flowMetaItem}>
                      <UsersIcon style={{ width: '1rem', height: '1rem' }} />
                      <span>{flow.allowed_users?.length || 0} пользователей</span>
                    </div>
                  )}
                  
                  <div className={styles.flowMetaItem}>
                    <span className={`${styles.status} ${flow.is_active ? styles.active : styles.inactive}`}>
                      {flow.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className={styles.flowFooter}>
                <button
                  onClick={() => openDashboardsModal(flow)}
                  className="btn btn-primary btn-sm"
                >
                  <EyeIcon style={{ width: '1rem', height: '1rem' }} />
                  Просмотр дашбордов
                </button>
              </div>
            </div>
          ))}
        </div>

        {flows.length === 0 && (
          <div className={styles.emptyState}>
            <p>Потоки не найдены. Создайте первый поток для начала работы.</p>
            <button
              onClick={openCreateModal}
              className="btn btn-primary"
            >
              <PlusIcon style={{ width: '1.25rem', height: '1.25rem' }} />
              Создать поток
            </button>
          </div>
        )}
      </div>

      {/* Модальное окно создания/редактирования потока */}
      {(showCreateModal || showEditModal) && (
        <div className={styles.modalOverlay}>
          <div className={`card ${styles.modalContent}`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {showCreateModal ? 'Создать поток' : 'Редактировать поток'}
              </h3>
              <button
                onClick={closeModals}
                className={styles.modalCloseButton}
                title="Закрыть"
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Название потока</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={styles.input}
                  placeholder="Введите название потока"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.label}>Описание</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className={styles.textarea}
                  placeholder="Введите описание потока"
                  rows="3"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.label}>Тип доступа</label>
                <div className={styles.accessTypesGrid}>
                  {accessTypes.map((type) => (
                    <div
                      key={type.id}
                      className={`${styles.accessTypeCard} ${
                        formData.access_type === type.id ? styles.selected : ''
                      }`}
                      onClick={() => handleInputChange('access_type', type.id)}
                    >
                      <h4 className={styles.accessTypeName}>{type.name}</h4>
                      <p className={styles.accessTypeDescription}>{type.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {formData.access_type === 'restricted' && (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Роли платформы</label>
                    <div className={styles.usersList}>
                      {platformRoleOptions.map((role) => (
                        <div key={role.id} className={styles.userItem}>
                          <input
                            type="checkbox"
                            id={`role-${role.id}`}
                            checked={formData.allowed_roles.includes(role.id)}
                            onChange={() => handleRoleToggle(role.id)}
                            className={styles.checkbox}
                          />
                          <label htmlFor={`role-${role.id}`} className={styles.userLabel}>
                            {role.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>TeamRole</label>
                    <div className={styles.usersList}>
                      {(teamRoles.length > 0 ? teamRoles : TEAM_ROLES.map((id) => ({ id, name: id }))).map((role) => (
                        <div key={role.id} className={styles.userItem}>
                          <input
                            type="checkbox"
                            id={`team-role-${role.id}`}
                            checked={formData.allowed_roles.includes(role.id)}
                            onChange={() => handleRoleToggle(role.id)}
                            className={styles.checkbox}
                          />
                          <label htmlFor={`team-role-${role.id}`} className={styles.userLabel}>
                            {role.name || role.id}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Команды</label>
                    <SearchableCheckboxList
                      items={teams}
                      getId={(team) => team.id}
                      getLabel={(team) => team.name || `Команда ${team.id}`}
                      isChecked={(id) => formData.allowed_teams.map(Number).includes(Number(id))}
                      onToggle={(id) => toggleIdList('allowed_teams', id)}
                      searchPlaceholder="Поиск команды…"
                      emptyText="Команды не найдены"
                      idPrefix="team"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Отделы</label>
                    <SearchableCheckboxList
                      items={departments}
                      getId={(dept) => dept.id}
                      getLabel={(dept) => dept.name || `Отдел ${dept.id}`}
                      isChecked={(id) => formData.allowed_departments.map(Number).includes(Number(id))}
                      onToggle={(id) => toggleIdList('allowed_departments', id)}
                      searchPlaceholder="Поиск отдела…"
                      emptyText="Отделы не найдены"
                      idPrefix="dept"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Пользователи</label>
                    <SearchableCheckboxList
                      items={users}
                      getId={(userItem) => userItem.id}
                      getLabel={(userItem) => `${userItem.name || ''} (${userItem.login || userItem.email || userItem.id})`}
                      isChecked={(id) => formData.allowed_users.map(Number).includes(Number(id))}
                      onToggle={handleUserToggle}
                      searchPlaceholder="Поиск по имени, логину или email…"
                      emptyText="Пользователи не найдены"
                      idPrefix="user"
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className={styles.modalActions}>
              <button
                onClick={closeModals}
                className="btn btn-secondary"
              >
                Отмена
              </button>
              <button
                onClick={showCreateModal ? createFlow : updateFlow}
                className="btn btn-primary"
                disabled={!formData.name.trim()}
              >
                {showCreateModal ? 'Создать поток' : 'Сохранить изменения'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно просмотра дашбордов потока */}
      {showDashboardsModal && currentFlow && (
        <div className={styles.modalOverlay}>
          <div className={`card ${styles.modalContent}`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                Дашборды потока "{currentFlow.name}"
              </h3>
              <button
                onClick={closeModals}
                className={styles.modalCloseButton}
                title="Закрыть"
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              {availableDashboards.length > 0 && (
                <div className={styles.availableDashboardsSection}>
                  <h4 className={styles.availableDashboardsTitle}>Можно добавить в поток</h4>
                  <div className={styles.dashboardsList}>
                    {availableDashboards.map((dashboard) => (
                      <div key={`available-${dashboard.id}`} className={styles.dashboardItem}>
                        <div className={styles.dashboardInfo}>
                          <h4 className={styles.dashboardName}>{dashboard.name}</h4>
                          {dashboard.description && (
                            <p className={styles.dashboardDescription}>{dashboard.description}</p>
                          )}
                          <div className={styles.dashboardMeta}>
                            <span className={`${styles.status} ${styles.inactive}`}>Скрыт из потока</span>
                          </div>
                        </div>
                        <div className={styles.dashboardActions}>
                          <button
                            onClick={() => toggleDashboardVisibility(dashboard.id, true)}
                            className="btn btn-primary btn-sm"
                            disabled={dashboardActionLoading[dashboard.id]}
                          >
                            <EyeIcon style={{ width: '1rem', height: '1rem' }} />
                            {dashboardActionLoading[dashboard.id] ? 'Добавление...' : 'Показать'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {flowDashboards.length > 0 ? (
                <div className={styles.dashboardsList}>
                  {flowDashboards.map((dashboard) => (
                    <div key={dashboard.id} className={styles.dashboardItem}>
                      <div className={styles.dashboardInfo}>
                        <h4 className={styles.dashboardName}>{dashboard.name}</h4>
                        {dashboard.description && (
                          <p className={styles.dashboardDescription}>{dashboard.description}</p>
                        )}
                        <div className={styles.dashboardMeta}>
                          <span className={`${styles.status} ${styles.active}`}>
                            В потоке
                          </span>
                          {dashboard.published_at && (
                            <span className={styles.publicBadge}>
                              Опубл.: {new Date(dashboard.published_at).toLocaleString('ru-RU')}
                            </span>
                          )}
                          {dashboard.is_public && (
                            <span className={styles.publicBadge}>Публичный</span>
                          )}
                        </div>
                      </div>
                      <div className={styles.dashboardActions}>
                        <button
                          onClick={() => {
                            // Переход к дашборду
                            window.open(`/dashboard/${dashboard.id}`, '_blank');
                          }}
                          className="btn btn-primary btn-sm"
                          disabled={dashboardActionLoading[dashboard.id]}
                        >
                          <EyeIcon style={{ width: '1rem', height: '1rem' }} />
                          Открыть
                        </button>
                        <button
                          onClick={() => toggleDashboardVisibility(dashboard.id, false)}
                          className="btn btn-secondary btn-sm"
                          disabled={dashboardActionLoading[dashboard.id]}
                          title="Скрыть дашборд из потока"
                        >
                          <EyeSlashIcon style={{ width: '1rem', height: '1rem' }} />
                          {dashboardActionLoading[dashboard.id] ? 'Скрытие...' : 'Скрыть'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <p>В этом потоке пока нет дашбордов.</p>
                </div>
              )}
            </div>
            
            <div className={styles.modalActions}>
              <button
                onClick={closeModals}
                className="btn btn-secondary"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowManagement;
