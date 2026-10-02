import React, { useState, useEffect } from 'react';
import { connectionService } from '../../../services/connectionService';
import { AdminIcon, CONNECTION_TYPE_ICONS } from './AdminIcons';

const CONNECTION_TYPES = {
  smb: { label: 'SMB', icon: CONNECTION_TYPE_ICONS.smb },
  database: { label: 'База данных', icon: CONNECTION_TYPE_ICONS.database },
  api: { label: 'API', icon: CONNECTION_TYPE_ICONS.api },
};

export default function Connections({ activeTab }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [searchUsers, setSearchUsers] = useState('');
  const [userFilter, setUserFilter] = useState('all'); // all, selected, unselected

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    connection_type: 'smb',
    is_active: true,
    connection_config: {}
  });

  useEffect(() => {
    if (activeTab === 'admin') {
      loadConnections();
    }
  }, [activeTab, filterType]);

  useEffect(() => {
    if (showAccessModal) {
      loadUsers();
    }
  }, [showAccessModal]);

  // Обновляем selectedUsers когда загружается selectedConnection
  // Этот useEffect служит как резервный механизм, если данные изменятся
  useEffect(() => {
    if (!selectedConnection) {
            return;
    }
    
                
    // Используем функциональную форму setSelectedUsers, чтобы не зависеть от текущего значения
    setSelectedUsers(prevSelectedUsers => {
      // Проверяем наличие user_accesses
      const userAccesses = selectedConnection.user_accesses;
      
      if (!userAccesses) {
        console.warn('user_accesses is missing in selectedConnection');
        // Если ранее были выбранные пользователи, но теперь нет данных - оставляем как есть
        // Это позволяет сохранить выбор, если данные временно недоступны
        return prevSelectedUsers;
      }
      
      if (!Array.isArray(userAccesses)) {
        console.warn('user_accesses is not an array:', typeof userAccesses, userAccesses);
        return prevSelectedUsers;
      }
      
      if (userAccesses.length === 0) {
                        // Если нет доступов, очищаем выбранных пользователей
        // НО только если мы уверены, что данные загружены (selectedConnection установлен)
        if (prevSelectedUsers.length > 0) {
                    return [];
        }
        return prevSelectedUsers;
      }
      
            
      // Берем все доступы (не только активные), чтобы показать всех пользователей с доступом
      const userIds = userAccesses
        .map((a, index) => {
          if (!a || typeof a !== 'object') {
            return null;
          }
          
          // Проверяем разные варианты структуры объекта и приводим к числу
          const userId = a.user_id !== undefined ? a.user_id : 
                        a.userId !== undefined ? a.userId : 
                        (a.user && a.user.id !== undefined ? a.user.id : null);
          
          if (userId === null || userId === undefined || userId === '') {
            return null;
          }
          
          const numId = typeof userId === 'string' ? parseInt(userId, 10) : Number(userId);
          if (isNaN(numId) || numId <= 0) {
            return null;
          }
          
          return numId;
        })
        .filter(id => id !== null && id !== undefined && !isNaN(id) && id > 0);
      
      // Удаляем дубликаты
      const uniqueUserIds = [...new Set(userIds)].sort();
            
      // Нормализуем предыдущие selectedUsers для сравнения
      const prevIds = prevSelectedUsers
        .map(id => {
          const numId = typeof id === 'string' ? parseInt(id, 10) : Number(id);
          return !isNaN(numId) && numId > 0 ? numId : null;
        })
        .filter(id => id !== null)
        .sort();
      
      // Сравниваем нормализованные массивы
      if (JSON.stringify(prevIds) !== JSON.stringify(uniqueUserIds)) {
                return uniqueUserIds;
      } else {
                return prevSelectedUsers;
      }
    });
  }, [selectedConnection]); // Зависимость только от selectedConnection

  const loadConnections = async () => {
    setLoading(true);
    setError(null);
    try {
      const connectionType = filterType !== 'all' ? filterType : null;
      const data = await connectionService.getConnections(0, 100, connectionType);
      setConnections(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading connections:', err);
      setError('Ошибка загрузки соединений');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setUsers([]); // Очищаем список перед загрузкой
      const data = await connectionService.getUsersList();
      setUsers(data || []);
    } catch (err) {
      console.error('Error loading users:', err);
      setUsers([]);
      alert('Ошибка загрузки списка пользователей: ' + (err.response?.data?.detail || err.message || 'Неизвестная ошибка'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingConnection) {
        await connectionService.updateConnection(editingConnection.id, formData);
      } else {
        await connectionService.createConnection(formData);
      }
      setShowModal(false);
      setEditingConnection(null);
      resetForm();
      loadConnections();
    } catch (err) {
      console.error('Error saving connection:', err);
      alert('Ошибка сохранения соединения');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Вы уверены, что хотите удалить это соединение?')) return;
    
    try {
      await connectionService.deleteConnection(id);
      loadConnections();
    } catch (err) {
      console.error('Error deleting connection:', err);
      alert('Ошибка удаления соединения');
    }
  };

  const handleEdit = async (connection) => {
    try {
      const fullConnection = await connectionService.getConnection(connection.id);
      setEditingConnection(fullConnection);
      setFormData({
        name: fullConnection.name,
        description: fullConnection.description || '',
        connection_type: fullConnection.connection_type,
        is_active: fullConnection.is_active,
        connection_config: fullConnection.connection_config || {}
      });
      setShowModal(true);
    } catch (err) {
      console.error('Error loading connection:', err);
      alert('Ошибка загрузки соединения');
    }
  };

  const handleManageAccess = async (connection) => {
    try {
            setShowAccessModal(true); // Открываем модальное окно сразу
      setSearchUsers(''); // Сбрасываем поиск
      setUserFilter('all'); // Сбрасываем фильтр
      
      // Загружаем пользователей и соединение параллельно
      const [fullConnection, usersList] = await Promise.all([
        connectionService.getConnection(connection.id),
        connectionService.getUsersList()
      ]);
      
                                                                                          
      if (!fullConnection) {
        throw new Error('Соединение не найдено');
      }
      
      // Устанавливаем список пользователей
      setUsers(usersList || []);
      
      // Проверяем, что user_accesses действительно массив
      // ВАЖНО: Проверяем разные варианты названия поля в ответе
      let userAccesses = fullConnection.user_accesses || fullConnection.user_access || fullConnection.accesses || [];
      
      if (!Array.isArray(userAccesses)) {
        console.warn('⚠ user_accesses is not an array:', typeof userAccesses, userAccesses);
        console.warn('  - Trying to convert or set to empty array');
        userAccesses = [];
      }
      
      // Убеждаемся, что поле установлено в объекте
      fullConnection.user_accesses = userAccesses;
      
                              
      // Извлекаем user_id из доступов к соединению
      // ВАЖНО: Берем ВСЕ доступы из БД (не только активные), чтобы показать всех пользователей с доступом
      let extractedUserIds = [];
      
      const accesses = fullConnection.user_accesses || [];
      
      if (accesses && Array.isArray(accesses) && accesses.length > 0) {
                
        extractedUserIds = accesses
          .map((access, idx) => {
            if (!access || typeof access !== 'object') {
              console.warn(`[${idx}] Invalid access object:`, access);
              return null;
            }
            
            // Извлекаем user_id из объекта доступа
            // Бэкенд возвращает структуру: { id, connection_id, user_id, access_level, ... }
            const userId = access.user_id !== undefined ? access.user_id : 
                          access.userId !== undefined ? access.userId : 
                          (access.user && access.user.id !== undefined ? access.user.id : null);
            
                        
            if (userId === null || userId === undefined || userId === '') {
              console.warn(`[${idx}] Missing user_id in access object`);
              return null;
            }
            
            // Приводим к числу
            const numId = typeof userId === 'string' ? parseInt(userId, 10) : Number(userId);
            if (isNaN(numId) || numId <= 0) {
              console.warn(`[${idx}] Invalid numeric user_id: ${userId} -> ${numId}`);
              return null;
            }
            
            return numId;
          })
          .filter(id => id !== null && id !== undefined);
        
        // Удаляем дубликаты (на случай, если в БД есть дубликаты)
        extractedUserIds = [...new Set(extractedUserIds)];
              } else {
        console.warn(`⚠ No user accesses found in response for connection ${connection.id}!`);
        console.warn('This means either:');
        console.warn('  1. No accesses exist in DB table connection_accesses for this connection');
        console.warn('  2. Backend is not returning accesses correctly');
        console.warn('  3. Response structure is different than expected');
        extractedUserIds = [];
      }
      
                        
      // Устанавливаем соединение и выбранных пользователей одновременно
      // Используем функциональные обновления для гарантии правильной последовательности
      setSelectedConnection(fullConnection);
      setSelectedUsers(extractedUserIds);
      
                      } catch (err) {
      console.error('Error loading connection:', err);
      console.error('Error details:', err.response?.data || err.message);
      const errorMessage = err.response?.data?.detail || err.message || 'Неизвестная ошибка';
      alert('Ошибка загрузки соединения: ' + errorMessage);
      setShowAccessModal(false); // Закрываем модальное окно при ошибке
      setSelectedConnection(null);
      setSelectedUsers([]);
    }
  };

  const handleSaveAccess = async () => {
    try {
      if (!selectedConnection) {
        alert('Соединение не выбрано');
        return;
      }
      
      const userAccesses = selectedConnection.user_accesses || [];
      // Безопасное извлечение user_id из разных возможных структур
      const currentUserIds = userAccesses
        .map(a => {
          if (!a) return null;
          const userId = a.user_id || a.userId || (a.user && a.user.id);
          if (userId !== null && userId !== undefined) {
            const numId = typeof userId === 'string' ? parseInt(userId, 10) : Number(userId);
            return !isNaN(numId) && numId > 0 ? numId : null;
          }
          return null;
        })
        .filter(id => id !== null && id !== undefined && !isNaN(id) && id > 0);
      
      // Нормализуем selectedUsers к числам
      const normalizedSelectedUsers = selectedUsers.map(id => {
        const numId = typeof id === 'string' ? parseInt(id, 10) : Number(id);
        return !isNaN(numId) && numId > 0 ? numId : null;
      }).filter(id => id !== null);
      
                  
      const toAdd = normalizedSelectedUsers.filter(id => !currentUserIds.includes(id));
      const toRemove = currentUserIds.filter(id => !normalizedSelectedUsers.includes(id));
      
                  
      for (const userId of toAdd) {
        await connectionService.grantAccess(selectedConnection.id, {
          user_id: userId,
          access_level: 'read'
        });
      }
      
      for (const userId of toRemove) {
        const access = userAccesses.find(a => {
          const accessUserId = a.user_id || a.userId || (a.user && a.user.id);
          if (accessUserId) {
            const numAccessUserId = typeof accessUserId === 'string' ? parseInt(accessUserId, 10) : Number(accessUserId);
            return !isNaN(numAccessUserId) && numAccessUserId === userId;
          }
          return false;
        });
        if (access) {
          await connectionService.revokeAccess(selectedConnection.id, access.id);
        }
      }
      
      // Перезагружаем соединение с обновленными доступами перед закрытием модального окна
            const updatedConnection = await connectionService.getConnection(selectedConnection.id);
                  
      setShowAccessModal(false);
      setSelectedConnection(null);
      setSelectedUsers([]);
      setSearchUsers('');
      setUserFilter('all');
      loadConnections();
    } catch (err) {
      console.error('Error managing access:', err);
      alert('Ошибка управления доступом: ' + (err.response?.data?.detail || err.message || 'Неизвестная ошибка'));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      connection_type: 'smb',
      is_active: true,
      connection_config: {}
    });
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => {
      // Приводим userId к числу для корректного сравнения
      const numUserId = typeof userId === 'string' ? parseInt(userId) : userId;
      const numPrev = prev.map(id => typeof id === 'string' ? parseInt(id) : id);
      
      if (numPrev.includes(numUserId)) {
        return numPrev.filter(id => id !== numUserId);
      } else {
        return [...numPrev, numUserId];
      }
    });
  };

  // Фильтрация пользователей по поиску и фильтру
  const getFilteredUsers = () => {
    let filtered = users;

    // Фильтр по поиску
    if (searchUsers.trim()) {
      const searchLower = searchUsers.toLowerCase();
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.login.toLowerCase().includes(searchLower)
      );
    }

    // Фильтр по выбранным/невыбранным
    if (userFilter === 'selected') {
      filtered = filtered.filter(user => {
        const numUserId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
        return selectedUsers.some(id => {
          const numId = typeof id === 'string' ? parseInt(id) : id;
          return numId === numUserId;
        });
      });
    } else if (userFilter === 'unselected') {
      filtered = filtered.filter(user => {
        const numUserId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
        return !selectedUsers.some(id => {
          const numId = typeof id === 'string' ? parseInt(id) : id;
          return numId === numUserId;
        });
      });
    }

    return filtered;
  };


  const handleTestConnection = async (connection) => {
    try {
      setTestLoading(true);
      setTestResult(null);
      setShowTestModal(true);
      
      // Если connection - это объект с id (существующее соединение)
      if (connection && connection.id) {
        const result = await connectionService.testConnection(connection.id);
        setTestResult(result);
        // Обновляем список соединений после теста, чтобы обновить статус
        await loadConnections();
      } else {
        // Если connection - это данные формы (новое соединение)
        const result = await connectionService.testConnectionConfig({
          connection_type: connection.connection_type || formData.connection_type,
          connection_config: connection.connection_config || formData.connection_config
        });
        setTestResult(result);
      }
    } catch (err) {
      console.error('Error testing connection:', err);
      setTestResult({
        success: false,
        message: 'Ошибка тестирования соединения',
        error: err.response?.data?.detail || err.message || 'Неизвестная ошибка'
      });
      // Обновляем список соединений даже при ошибке, чтобы обновить статус
      if (connection && connection.id) {
        await loadConnections();
      }
    } finally {
      setTestLoading(false);
    }
  };

  const handleTestFormConnection = async () => {
    // Тестируем соединение с данными из формы
    await handleTestConnection({
      connection_type: formData.connection_type,
      connection_config: formData.connection_config
    });
  };

  const getConnectionConfigFields = (type) => {
    switch (type) {
      case 'smb':
        return [
          { key: 'server', label: 'Сервер', type: 'text', required: true },
          { key: 'share_name', label: 'Имя шары', type: 'text', required: true },
          { key: 'username', label: 'Имя пользователя', type: 'text', required: true },
          { key: 'password', label: 'Пароль', type: 'password', required: true },
          { key: 'domain', label: 'Домен', type: 'text', required: false },
          { key: 'port', label: 'Порт', type: 'number', required: false, default: 445 }
        ];
      case 'database':
        return [
          { key: 'host', label: 'Хост', type: 'text', required: true },
          { key: 'port', label: 'Порт', type: 'number', required: true },
          { key: 'database', label: 'База данных', type: 'text', required: true },
          { key: 'username', label: 'Имя пользователя', type: 'text', required: true },
          { key: 'password', label: 'Пароль', type: 'password', required: true },
          { key: 'db_type', label: 'Тип БД', type: 'select', required: true, options: [
            { value: 'postgresql', label: 'PostgreSQL' },
            { value: 'mysql', label: 'MySQL' },
            { value: 'mariadb', label: 'MariaDB' },
            { value: 'sqlite', label: 'SQLite' },
            { value: 'oracle', label: 'Oracle' },
            { value: 'mssql', label: 'SQL Server' },
            { value: 'mongodb', label: 'MongoDB' }
          ]}
        ];
      case 'api':
        return [
          { key: 'base_url', label: 'Base URL', type: 'text', required: true },
          { key: 'api_key', label: 'API Key', type: 'password', required: true }
        ];
      default:
        return [];
    }
  };

  const renderConfigFields = () => {
    const fields = getConnectionConfigFields(formData.connection_type);
    return fields.map(field => (
      <div key={field.key}>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
          {field.label} {field.required && '*'}
        </label>
        {field.type === 'select' ? (
          <select
            value={formData.connection_config[field.key] || ''}
            onChange={(e) => {
              setFormData({
                ...formData,
                connection_config: {
                  ...formData.connection_config,
                  [field.key]: e.target.value
                }
              });
            }}
            className="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:border-indigo-500 focus:outline-none"
            required={field.required}
          >
            <option value="">Выберите {field.label.toLowerCase()}</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={field.type}
            value={formData.connection_config[field.key] || (field.default || '')}
            onChange={(e) => {
              const value = field.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value;
              setFormData({
                ...formData,
                connection_config: {
                  ...formData.connection_config,
                  [field.key]: value
                }
              });
            }}
            className="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:border-indigo-500 focus:outline-none"
            required={field.required}
          />
        )}
      </div>
    ));
  };

  if (activeTab !== 'admin') return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg" style={{ color: 'var(--color-text-secondary)' }}>
          Загрузка соединений...
        </div>
      </div>
    );
  }

  const filteredConnections = filterType === 'all' 
    ? connections 
    : connections.filter(c => c.connection_type === filterType);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="card animate-slideInLeft">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--color-text-primary)' }}>
            <AdminIcon name="plug" size="lg" boxed boxColor="sky" />
            Соединения
          </h2>
          <button
            onClick={() => {
              resetForm();
              setEditingConnection(null);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
          >
            <AdminIcon name="plus" size="sm" />
            Добавить соединение
          </button>
        </div>

        {/* Фильтр по типу */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-lg text-sm transition-all ${
              filterType === 'all'
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Все
          </button>
          {Object.entries(CONNECTION_TYPES).map(([key, { label, icon }]) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm transition-all ${
                filterType === key
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <AdminIcon name={icon} size="sm" />
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/20 text-red-300 rounded-lg">
            {error}
          </div>
        )}

        {filteredConnections.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
            Нет соединений
          </div>
        ) : (
          <div className="space-y-4">
            {filteredConnections.map((connection) => {
              const typeInfo = CONNECTION_TYPES[connection.connection_type] || {
                label: connection.connection_type,
                icon: 'plug',
              };
              return (
                <div
                  key={connection.id}
                  className="p-4 border rounded-lg"
                  style={{ borderColor: 'var(--color-border-muted)' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <AdminIcon name={typeInfo.icon} boxed boxColor="indigo" />
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                          {connection.name}
                        </h3>
                        <span className={`px-2 py-1 text-xs rounded ${
                          connection.is_active 
                            ? 'bg-green-500/20 text-green-300' 
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                          {connection.is_active ? 'Активно' : 'Неактивно'}
                        </span>
                      </div>
                      {connection.description && (
                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                          {connection.description}
                        </p>
                      )}
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Тип: {typeInfo.label} | 
                        Статус: <span className={`${
                          connection.connection_status === 'connected' ? 'text-green-400' :
                          connection.connection_status === 'error' ? 'text-red-400' :
                          connection.connection_status === 'disconnected' ? 'text-yellow-400' :
                          'text-slate-400'
                        }`}>
                          {connection.connection_status === 'connected' ? (
                            <span className="inline-flex items-center gap-1">
                              <AdminIcon name="success" size="sm" /> Подключено
                            </span>
                          ) : connection.connection_status === 'error' ? (
                            <span className="inline-flex items-center gap-1">
                              <AdminIcon name="error" size="sm" /> Ошибка
                            </span>
                          ) : connection.connection_status === 'disconnected' ? (
                            <span className="inline-flex items-center gap-1">
                              <AdminIcon name="warning" size="sm" /> Отключено
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <AdminIcon name="unknown" size="sm" /> Неизвестно
                            </span>
                          )}
                        </span> |
                        Пользователей с доступом: {connection.access_count || 0}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTestConnection(connection)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-sm bg-green-500/20 text-green-300 rounded hover:bg-green-500/30"
                      >
                        <AdminIcon name="test" size="sm" />
                        Тест
                      </button>
                      <button
                        onClick={() => handleManageAccess(connection)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-sm bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30"
                      >
                        <AdminIcon name="users" size="sm" />
                        Доступ
                      </button>
                      <button
                        onClick={() => handleEdit(connection)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-sm bg-yellow-500/20 text-yellow-300 rounded hover:bg-yellow-500/30"
                      >
                        <AdminIcon name="edit" size="sm" />
                        Изменить
                      </button>
                      <button
                        onClick={() => handleDelete(connection.id)}
                        className="px-3 py-1 text-sm bg-red-500/20 text-red-300 rounded hover:bg-red-500/30"
                      >
                        <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="w-4 h-4"
                              aria-hidden="true"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Модальное окно для создания/редактирования */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              {editingConnection ? 'Редактировать' : 'Создать'} соединение
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Название *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Описание
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Тип соединения *
                </label>
                <select
                  value={formData.connection_type}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      connection_type: e.target.value,
                      connection_config: {}
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  required
                >
                  {Object.entries(CONNECTION_TYPES).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {formData.connection_type === 'api' && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                    Тип авторизации
                  </label>
                  <select
                    value={formData.connection_config.auth_type || ''}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        connection_config: {
                          ...formData.connection_config,
                          auth_type: e.target.value
                        }
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Выберите тип авторизации</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="api_key">API Key</option>
                    <option value="basic">Basic Auth</option>
                    <option value="oauth2">OAuth 2.0</option>
                    <option value="custom_header">Custom Header</option>
                  </select>
                </div>
              )}

              {renderConfigFields()}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_active" className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Активно
                </label>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleTestFormConnection}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all shadow-lg hover:shadow-xl font-medium border border-purple-400/30"
                  disabled={!formData.name || !formData.connection_config || Object.keys(formData.connection_config).length === 0}
                >
                  <AdminIcon name="test" size="sm" />
                  Тест
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingConnection(null);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
                >
                  {editingConnection ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно для управления доступом */}
      {showAccessModal && selectedConnection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Управление доступом: {selectedConnection.name}
            </h3>

            {/* Поиск и фильтры */}
            <div className="mb-4 space-y-2">
              <input
                type="text"
                placeholder="Поиск по имени, email или login..."
                value={searchUsers}
                onChange={(e) => setSearchUsers(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:border-indigo-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setUserFilter('all')}
                  className={`px-3 py-1 rounded-lg text-sm transition-all ${
                    userFilter === 'all'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Все
                </button>
                <button
                  onClick={() => setUserFilter('selected')}
                  className={`px-3 py-1 rounded-lg text-sm transition-all ${
                    userFilter === 'selected'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Выбранные ({selectedUsers.length})
                </button>
                <button
                  onClick={() => setUserFilter('unselected')}
                  className={`px-3 py-1 rounded-lg text-sm transition-all ${
                    userFilter === 'unselected'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Невыбранные
                </button>
              </div>
            </div>

            {/* Список пользователей */}
            <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
              {users.length === 0 ? (
                <div className="text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                  Загрузка пользователей...
                </div>
              ) : getFilteredUsers().length === 0 ? (
                <div className="text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                  Пользователи не найдены
                </div>
              ) : (
                getFilteredUsers().map((user) => {
                  // Нормализуем ID пользователя к числу
                  const numUserId = typeof user.id === 'string' ? parseInt(user.id, 10) : Number(user.id);
                  
                  // Нормализуем selectedUsers к числам для сравнения
                  const normalizedSelectedUsers = selectedUsers
                    .map(id => {
                      const numId = typeof id === 'string' ? parseInt(id, 10) : Number(id);
                      return !isNaN(numId) && numId > 0 ? numId : null;
                    })
                    .filter(id => id !== null);
                  
                  // Проверяем, выбран ли пользователь (есть ли у него доступ в БД)
                  const isSelected = normalizedSelectedUsers.includes(numUserId);
                  
                  // Отладочное логирование для первого пользователя
                  if (user.id === getFilteredUsers()[0]?.id && process.env.NODE_ENV === 'development') {
                                      }
                  
                  return (
                    <div
                      key={user.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-indigo-500/20 border border-indigo-500/30' 
                          : 'hover:bg-slate-700'
                      }`}
                      onClick={() => toggleUserSelection(user.id)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleUserSelection(user.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4"
                        aria-label={`Выбрать пользователя ${user.name}`}
                      />
                      <div className="flex-1">
                        <div className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {user.name}
                        </div>
                        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {user.login} ({user.email})
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowAccessModal(false);
                  setSelectedConnection(null);
                  setSelectedUsers([]);
                  setUsers([]);
                  setSearchUsers('');
                  setUserFilter('all');
                }}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveAccess}
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
                disabled={!selectedConnection}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для тестирования соединения */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                <AdminIcon name="test" size="md" />
                Тестирование соединения
              </h3>
              <button
                onClick={() => {
                  setShowTestModal(false);
                  setTestResult(null);
                }}
                className="text-slate-400 hover:text-white p-1"
                aria-label="Закрыть"
              >
                <AdminIcon name="close" size="md" />
              </button>
            </div>

            {testLoading ? (
              <div className="text-center py-8">
                <div className="text-lg" style={{ color: 'var(--color-text-secondary)' }}>
                  Тестирование соединения...
                </div>
              </div>
            ) : testResult ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${
                  testResult.success 
                    ? 'bg-green-500/20 border border-green-500/30' 
                    : 'bg-red-500/20 border border-red-500/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <AdminIcon name={testResult.success ? 'success' : 'error'} size="lg" />
                    <div>
                      <div className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {testResult.message}
                      </div>
                      {testResult.error && (
                        <div className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                          Ошибка: {testResult.error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {testResult.success && testResult.data && (
                  <div className="space-y-4">
                    {/* SMB: Показываем директории и файлы */}
                    {testResult.data.directories !== undefined && (
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                          <AdminIcon name="folder" size="sm" />
                          Директории ({testResult.data.total_directories || 0})
                        </h4>
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {testResult.data.directories && testResult.data.directories.length > 0 ? (
                            testResult.data.directories.map((dir, idx) => (
                              <div
                                key={idx}
                                className="p-2 rounded bg-slate-700/50 text-sm flex items-center gap-2"
                                style={{ color: 'var(--color-text-secondary)' }}
                              >
                                <AdminIcon name="folder" size="sm" />
                                {dir.name}
                              </div>
                            ))
                          ) : (
                            <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                              Директории не найдены
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {testResult.data.files !== undefined && (
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                          <AdminIcon name="file" size="sm" />
                          Файлы ({testResult.data.total_files || 0})
                        </h4>
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {testResult.data.files && testResult.data.files.length > 0 ? (
                            testResult.data.files.map((file, idx) => (
                              <div
                                key={idx}
                                className="p-2 rounded bg-slate-700/50 text-sm flex justify-between"
                                style={{ color: 'var(--color-text-secondary)' }}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <AdminIcon name="file" size="sm" />
                                  {file.name}
                                </span>
                                {file.size !== undefined && (
                                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    {(file.size / 1024).toFixed(2)} KB
                                  </span>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                              Файлы не найдены
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Database: Показываем таблицы */}
                    {testResult.data.tables !== undefined && (
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                          <AdminIcon name="database" size="sm" />
                          Таблицы ({testResult.data.total_tables || 0})
                        </h4>
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {testResult.data.tables && testResult.data.tables.length > 0 ? (
                            testResult.data.tables.map((table, idx) => (
                              <div
                                key={idx}
                                className="p-2 rounded bg-slate-700/50 text-sm flex items-center gap-2"
                                style={{ color: 'var(--color-text-secondary)' }}
                              >
                                <AdminIcon name="database" size="sm" />
                                {table.full_name || `${table.schema}.${table.name}`}
                              </div>
                            ))
                          ) : (
                            <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                              Таблицы не найдены
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* API: Показываем ответ */}
                    {testResult.data.status_code !== undefined && (
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                          <AdminIcon name="plug" size="sm" />
                          Ответ API
                        </h4>
                        <div className="space-y-2">
                          <div className="p-2 rounded bg-slate-700/50 text-sm">
                            <span className="font-medium">Статус: </span>
                            <span className={`${
                              testResult.data.status_code >= 200 && testResult.data.status_code < 300
                                ? 'text-green-400'
                                : 'text-red-400'
                            }`}>
                              {testResult.data.status_code}
                            </span>
                          </div>
                          {testResult.data.response && (
                            <div>
                              <div className="font-medium mb-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                Тело ответа:
                              </div>
                              <pre className="p-3 rounded bg-slate-900 text-xs overflow-x-auto max-h-60 overflow-y-auto">
                                {JSON.stringify(testResult.data.response, null, 2)}
                              </pre>
                            </div>
                          )}
                          {testResult.data.headers && (
                            <div>
                              <div className="font-medium mb-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                Заголовки:
                              </div>
                              <pre className="p-3 rounded bg-slate-900 text-xs overflow-x-auto max-h-40 overflow-y-auto">
                                {JSON.stringify(testResult.data.headers, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setShowTestModal(false);
                  setTestResult(null);
                }}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
