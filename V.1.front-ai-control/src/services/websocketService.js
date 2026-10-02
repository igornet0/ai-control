import { 
  WEBSOCKET_CONFIG, 
  calculateReconnectDelay, 
  shouldContinueReconnecting 
} from '../config/websocketConfig';

/**
 * WebSocket service for real-time dashboard updates
 */
class WebSocketService {
  constructor() {
    this.connections = new Map();
    this.reconnectTimers = new Map(); // Таймеры переподключения
    this.reconnectAttempts = new Map(); // Счетчики попыток переподключения
    this.heartbeatIntervals = new Map(); // Интервалы heartbeat
    this.isReconnecting = new Map(); // Флаги для предотвращения множественных переподключений
  }
  
  /**
   * Получает базовый URL для WebSocket соединений (динамически)
   * @returns {string} Базовый URL
   */
  getBaseURL() {
    return WEBSOCKET_CONFIG.baseURL;
  }

  /**
   * Connect to dashboard WebSocket
   * @param {number} dashboardId - Dashboard ID to subscribe to
   * @param {number} userId - User ID for authentication
   * @param {Object} callbacks - Event callbacks
   * @param {Function} callbacks.onMessage - Called for each message
   * @param {Function} [callbacks.onOpen] - Called when connection opens
   * @param {Function} [callbacks.onClose] - Called when connection closes
   * @param {Function} [callbacks.onError] - Called on error
   * @param {Function} [callbacks.onSubscribed] - Called when successfully subscribed
   * @param {boolean} [isReconnect=false] - Internal flag for reconnection attempts
   * @returns {WebSocket} WebSocket instance
   */
  connectToDashboard(dashboardId, userId, callbacks = {}, isReconnect = false) {
    const connectionKey = `dashboard_${dashboardId}`;
    
    // Очищаем предыдущие таймеры и интервалы
    this.clearReconnectTimer(connectionKey);
    this.clearHeartbeat(connectionKey);
    
    // Сбрасываем флаг переподключения при успешном соединении
    if (!isReconnect) {
      this.isReconnecting.delete(connectionKey);
    }
    
    // Close existing connection if any
    if (this.connections.has(connectionKey)) {
      const existingWs = this.connections.get(connectionKey);
      if (existingWs.readyState === WebSocket.OPEN || existingWs.readyState === WebSocket.CONNECTING) {
        existingWs.close();
      }
    }

    const wsUrl = `${this.getBaseURL()}/dashboard`;
    const ws = new WebSocket(wsUrl);
    this.connections.set(connectionKey, ws);

    // Устанавливаем таймаут соединения
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.warn(`WebSocket connection timeout for dashboard ${dashboardId}`);
        ws.close();
        if (callbacks.onError) {
          callbacks.onError(new Error('Connection timeout'));
        }
      }
    }, WEBSOCKET_CONFIG.connectionTimeout);

    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      
      // Сбрасываем счетчик попыток переподключения при успешном соединении
      this.reconnectAttempts.delete(connectionKey);
      this.isReconnecting.delete(connectionKey);
      
            if (callbacks.onOpen) callbacks.onOpen();
      
      // Subscribe to dashboard updates
      this.subscribeToDashboard(ws, dashboardId, userId);
      
      // Запускаем heartbeat если включен
      if (WEBSOCKET_CONFIG.heartbeatInterval > 0) {
        this.startHeartbeat(connectionKey, ws);
      }
    };

    ws.onmessage = (event) => {
      try {
        // Проверяем что данные не пустые
        if (!event.data || event.data.length === 0) {
          console.warn('Empty WebSocket message received');
          return;
        }
        
        const data = JSON.parse(event.data);
        
        // Обрабатываем pong ответ на heartbeat
        if (data.type === 'pong') {
          // Heartbeat успешен, соединение активно
          return;
        }
        
                
        if (callbacks.onMessage) callbacks.onMessage(data);
        
        // Handle subscription confirmation
        if (data.type === 'subscribed' && data.dashboard_id === dashboardId) {
          if (callbacks.onSubscribed) callbacks.onSubscribed(data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        console.error('Raw message data:', event.data);
        if (callbacks.onError) callbacks.onError(error);
      }
    };

    ws.onclose = (event) => {
      clearTimeout(connectionTimeout);
      this.clearHeartbeat(connectionKey);
      
            if (callbacks.onClose) callbacks.onClose(event);
      this.connections.delete(connectionKey);
      
      // Автоматическое переподключение при неожиданном закрытии
      // Коды 1000 и 1001 - нормальное закрытие, не переподключаемся
      // Код 1006 - abnormal closure (network error), переподключаемся
      const shouldReconnect = (event.code !== 1000 && event.code !== 1001) || event.code === 1006;
      
      if (shouldReconnect && !isReconnect && !this.isReconnecting.get(connectionKey)) {
                this.isReconnecting.set(connectionKey, true);
        this.scheduleReconnect(connectionKey, () => {
          this.connectToDashboard(dashboardId, userId, callbacks, true);
        });
      } else if (event.code === 1000 || event.code === 1001) {
                this.isReconnecting.delete(connectionKey);
      }
    };

    ws.onerror = (error) => {
      clearTimeout(connectionTimeout);
      console.error(`WebSocket error for dashboard ${dashboardId}:`, error);
      
      // Если соединение не установилось (readyState === CONNECTING или CLOSED),
      // планируем переподключение
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.CLOSED) {
        // Закрываем соединение, чтобы onclose сработал и запустил переподключение
        try {
          ws.close();
        } catch (e) {
          // Игнорируем ошибки при закрытии
        }
        
        // Если это не переподключение и еще не переподключаемся, планируем его
        if (!isReconnect && !this.isReconnecting.get(connectionKey)) {
          this.connections.delete(connectionKey);
          this.isReconnecting.set(connectionKey, true);
          this.scheduleReconnect(connectionKey, () => {
            this.connectToDashboard(dashboardId, userId, callbacks, true);
          });
        }
      }
      
      if (callbacks.onError) callbacks.onError(error);
    };

    return ws;
  }
  
  /**
   * Планирует переподключение с экспоненциальной задержкой
   * @param {string} connectionKey - Ключ соединения
   * @param {Function} reconnectFn - Функция для переподключения
   */
  scheduleReconnect(connectionKey, reconnectFn) {
    // Проверяем, нужно ли продолжать попытки
    const attemptNumber = this.reconnectAttempts.get(connectionKey) || 0;
    
    if (!shouldContinueReconnecting(attemptNumber)) {
      console.warn(`[WebSocket] Max reconnection attempts reached for ${connectionKey}`);
      // После достижения максимума, ждем еще раз и пробуем снова (бесконечные попытки с большими интервалами)
      const longDelay = WEBSOCKET_CONFIG.maxReconnectDelay * 2;
            const timer = setTimeout(() => {
        // Сбрасываем счетчик и пробуем снова
        this.reconnectAttempts.delete(connectionKey);
        this.reconnectTimers.delete(connectionKey);
        reconnectFn();
      }, longDelay);
      this.reconnectTimers.set(connectionKey, timer);
      return;
    }
    
    // Увеличиваем счетчик попыток
    this.reconnectAttempts.set(connectionKey, attemptNumber + 1);
    
    // Вычисляем задержку
    const delay = calculateReconnectDelay(attemptNumber);
    
        
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(connectionKey);
      reconnectFn();
    }, delay);
    
    this.reconnectTimers.set(connectionKey, timer);
  }
  
  /**
   * Очищает таймер переподключения
   * @param {string} connectionKey - Ключ соединения
   */
  clearReconnectTimer(connectionKey) {
    if (this.reconnectTimers.has(connectionKey)) {
      clearTimeout(this.reconnectTimers.get(connectionKey));
      this.reconnectTimers.delete(connectionKey);
    }
  }
  
  /**
   * Запускает heartbeat для проверки соединения
   * @param {string} connectionKey - Ключ соединения
   * @param {WebSocket} ws - WebSocket соединение
   */
  startHeartbeat(connectionKey, ws) {
    // Очищаем предыдущий интервал если есть
    this.clearHeartbeat(connectionKey);
    
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        this.ping(ws);
      } else {
        // Соединение закрыто, останавливаем heartbeat
        this.clearHeartbeat(connectionKey);
      }
    }, WEBSOCKET_CONFIG.heartbeatInterval);
    
    this.heartbeatIntervals.set(connectionKey, interval);
  }
  
  /**
   * Останавливает heartbeat
   * @param {string} connectionKey - Ключ соединения
   */
  clearHeartbeat(connectionKey) {
    if (this.heartbeatIntervals.has(connectionKey)) {
      clearInterval(this.heartbeatIntervals.get(connectionKey));
      this.heartbeatIntervals.delete(connectionKey);
    }
  }

  /**
   * Subscribe to dashboard updates
   * @param {WebSocket} ws - WebSocket connection
   * @param {number} dashboardId - Dashboard ID
   * @param {number} userId - User ID
   */
  subscribeToDashboard(ws, dashboardId, userId) {
    const message = {
      type: 'subscribe_dashboard',
      dashboard_id: dashboardId,
      user_id: userId
    };
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not ready for subscription');
    }
  }

  /**
   * Unsubscribe from dashboard updates
   * @param {WebSocket} ws - WebSocket connection
   * @param {number} dashboardId - Dashboard ID
   */
  unsubscribeFromDashboard(ws, dashboardId) {
    const message = {
      type: 'unsubscribe_dashboard',
      dashboard_id: dashboardId
    };
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Connect to widget WebSocket
   * @param {number} widgetId - Widget ID to subscribe to
   * @param {number} userId - User ID for authentication
   * @param {Object} callbacks - Event callbacks
   * @returns {WebSocket} WebSocket instance
   */
  connectToWidget(widgetId, userId, callbacks = {}) {
    const connectionKey = `widget_${widgetId}`;
    
    // Close existing connection if any
    if (this.connections.has(connectionKey)) {
      this.connections.get(connectionKey).close();
    }

    const wsUrl = `${this.getBaseURL()}/dashboard`;
    const ws = new WebSocket(wsUrl);
    this.connections.set(connectionKey, ws);

    ws.onopen = () => {
            if (callbacks.onOpen) callbacks.onOpen();
      
      // Subscribe to widget updates
      this.subscribeToWidget(ws, widgetId, userId);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
                
        if (callbacks.onMessage) callbacks.onMessage(data);
        
        // Handle subscription confirmation
        if (data.type === 'subscribed' && data.widget_id === widgetId) {
          if (callbacks.onSubscribed) callbacks.onSubscribed(data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = (event) => {
            if (callbacks.onClose) callbacks.onClose(event);
      this.connections.delete(connectionKey);
    };

    ws.onerror = (error) => {
      console.error(`WebSocket error for widget ${widgetId}:`, error);
      if (callbacks.onError) callbacks.onError(error);
    };

    return ws;
  }

  /**
   * Subscribe to widget updates
   * @param {WebSocket} ws - WebSocket connection
   * @param {number} widgetId - Widget ID
   * @param {number} userId - User ID
   */
  subscribeToWidget(ws, widgetId, userId) {
    const message = {
      type: 'subscribe_widget',
      widget_id: widgetId,
      user_id: userId
    };
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not ready for subscription');
    }
  }

  /**
   * Unsubscribe from widget updates
   * @param {WebSocket} ws - WebSocket connection
   * @param {number} widgetId - Widget ID
   */
  unsubscribeFromWidget(ws, widgetId) {
    const message = {
      type: 'unsubscribe_widget',
      widget_id: widgetId
    };
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Disconnect from a specific dashboard
   * @param {number} dashboardId - Dashboard ID to disconnect from
   */
  disconnectFromDashboard(dashboardId) {
    const connectionKey = `dashboard_${dashboardId}`;
    const ws = this.connections.get(connectionKey);
    
    // Очищаем таймеры и интервалы
    this.clearReconnectTimer(connectionKey);
    this.clearHeartbeat(connectionKey);
    this.reconnectAttempts.delete(connectionKey);
    
    if (ws) {
      this.unsubscribeFromDashboard(ws, dashboardId);
      ws.close(1000, 'Normal closure'); // Нормальное закрытие
      this.connections.delete(connectionKey);
    }
  }

  /**
   * Disconnect from a specific widget
   * @param {number} widgetId - Widget ID to disconnect from
   */
  disconnectFromWidget(widgetId) {
    const connectionKey = `widget_${widgetId}`;
    const ws = this.connections.get(connectionKey);
    
    if (ws) {
      this.unsubscribeFromWidget(ws, widgetId);
      ws.close();
      this.connections.delete(connectionKey);
    }
  }

  /**
   * Disconnect all WebSocket connections
   */
  disconnectAll() {
    // Очищаем все таймеры и интервалы
    this.reconnectTimers.forEach((timer) => clearTimeout(timer));
    this.reconnectTimers.clear();
    
    this.heartbeatIntervals.forEach((interval) => clearInterval(interval));
    this.heartbeatIntervals.clear();
    
    this.reconnectAttempts.clear();
    
    this.connections.forEach((ws, key) => {
            ws.close(1000, 'Normal closure');
    });
    this.connections.clear();
  }

  /**
   * Send ping to keep connection alive
   * @param {WebSocket} ws - WebSocket connection
   */
  ping(ws) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }

  /**
   * Check if user has editing permissions for dashboard
   * @param {Object} dashboard - Dashboard object
   * @param {Object} user - User object
   * @returns {boolean} True if user can edit dashboard
   */
  canEditDashboard(dashboard, user) {
    if (!dashboard || !user) return false;
    
    // Owner can always edit
    if (dashboard.owner_id === user.id) return true;
    
    // Admin can edit any dashboard
    if (user.is_admin) return true;
    
    // Check if dashboard is public and user has edit permissions
    if (dashboard.is_public && dashboard.allow_edit) return true;
    
    return false;
  }

    /**
     * Clean data for JSON serialization
     * @param {any} data - Data to clean
     * @returns {any} Cleaned data
     */
    cleanDataForJSON(data) {
        if (data === null || data === undefined) {
            return data;
        }
        
        if (typeof data === 'string') {
            // Удаляем или заменяем проблемные символы более агрессивно
            return data
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Удаляем управляющие символы
                .replace(/[\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, ' ') // Заменяем специальные пробелы
                .trim();
        }
        
        if (Array.isArray(data)) {
            return data.map(item => this.cleanDataForJSON(item));
        }
        
        if (typeof data === 'object') {
            const cleaned = {};
            for (const [key, value] of Object.entries(data)) {
                // Также очищаем ключи
                const cleanKey = typeof key === 'string' ? 
                    key.replace(/[\u0000-\u001F\u007F-\u009F]/g, '') : key;
                cleaned[cleanKey] = this.cleanDataForJSON(value);
            }
            return cleaned;
        }
        
        return data;
    }

    /**
     * Save widgets configuration
     * @param {number} sheetId - Sheet ID
     * @param {Array} widgets - Widgets data
     * @param {number} userId - User ID
     * @returns {Promise} Promise that resolves when widgets are saved
     */
    async saveWidgets(sheetId, widgets, userId) {
        return new Promise((resolve, reject) => {
            const connectionKey = `dashboard_${sheetId}`;
            const ws = this.connections.get(connectionKey);
            
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket connection not available'));
                return;
            }

            // Очищаем данные от проблемных символов
            const cleanedWidgets = this.cleanDataForJSON(widgets);
            
            const message = {
                type: 'save_widgets',
                sheet_id: sheetId,
                widgets: cleanedWidgets,
                user_id: userId
            };

            
            // Set up one-time message listener
            const handleMessage = (event) => {
                try {
                    // Проверяем что данные не пустые
                    if (!event.data || event.data.length === 0) {
                        console.warn('Empty WebSocket message received');
                        return;
                    }
                    
                    const data = JSON.parse(event.data);
                                        
                    if (data.type === 'widgets_saved') {
                        ws.removeEventListener('message', handleMessage);
                        resolve(data);
                    } else if (data.type === 'error') {
                        ws.removeEventListener('message', handleMessage);
                        reject(new Error(data.message));
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket response:', error);
                    console.error('Raw response data:', event.data);
                    ws.removeEventListener('message', handleMessage);
                    reject(error);
                }
            };

            ws.addEventListener('message', handleMessage);
            
            try {
                const messageStr = JSON.stringify(message);
                                                                
                // Проверяем на проблемные символы
                const hasControlChars = /[\u0000-\u001F\u007F-\u009F]/.test(messageStr);
                if (hasControlChars) {
                    console.warn('Message contains control characters!');
                                    }
                
                ws.send(messageStr);
            } catch (error) {
                console.error('Error sending message:', error);
                console.error('Message that caused error:', message);
                ws.removeEventListener('message', handleMessage);
                reject(error);
            }
        });
    }

  /**
   * Save sheet configuration
   * @param {number} sheetId - Sheet ID
   * @param {Object} sheetData - Sheet data
   * @param {number} userId - User ID
   * @returns {Promise} Promise that resolves when sheet is saved
   */
  async saveSheet(sheetId, sheetData, userId) {
    return new Promise((resolve, reject) => {
      const connectionKey = `dashboard_${sheetId}`;
      const ws = this.connections.get(connectionKey);
      
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket connection not available'));
        return;
      }

      const message = {
        type: 'save_sheet',
        sheet_id: sheetId,
        sheet_data: sheetData,
        user_id: userId
      };

      // Set up one-time message listener
      const handleMessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'sheet_saved') {
            ws.removeEventListener('message', handleMessage);
            resolve(data);
          } else if (data.type === 'error') {
            ws.removeEventListener('message', handleMessage);
            reject(new Error(data.message));
          }
        } catch (error) {
          ws.removeEventListener('message', handleMessage);
          reject(error);
        }
      };

      ws.addEventListener('message', handleMessage);
      ws.send(JSON.stringify(message));
    });
  }

  /**
   * Load widgets configuration
   * @param {number} sheetId - Sheet ID
   * @param {number} userId - User ID
   * @param {number} dashboardId - Dashboard ID (required to find the correct WebSocket connection)
   * @param {Object} activeFilters - Active filters to apply when computing expressions
   * @returns {Promise} Promise that resolves with widgets data
   */
  async loadWidgets(sheetId, userId, dashboardId, activeFilters = null) {
    return new Promise((resolve, reject) => {
      const connectionKey = `dashboard_${dashboardId}`;
      const ws = this.connections.get(connectionKey);
      
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket connection not available'));
        return;
      }

      const message = {
        type: 'load_widgets',
        sheet_id: sheetId,
        user_id: userId
      };
      
      // Добавляем активные фильтры, если они переданы
      if (activeFilters) {
        message.active_filters = activeFilters;
              } else {
              }
      
      
      // Set up one-time message listener
      const handleMessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'widgets_loaded') {
            ws.removeEventListener('message', handleMessage);
            resolve(data);
          } else if (data.type === 'error') {
            ws.removeEventListener('message', handleMessage);
            reject(new Error(data.message));
          }
        } catch (error) {
          ws.removeEventListener('message', handleMessage);
          reject(error);
        }
      };

      ws.addEventListener('message', handleMessage);
      ws.send(JSON.stringify(message));
    });
  }

  /**
   * Load sheet configuration
   * @param {number} sheetId - Sheet ID
   * @param {number} userId - User ID
   * @returns {Promise} Promise that resolves with sheet data
   */
  async loadSheet(sheetId, userId) {
    return new Promise((resolve, reject) => {
      const connectionKey = `dashboard_${sheetId}`;
      const ws = this.connections.get(connectionKey);
      
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket connection not available'));
        return;
      }

      const message = {
        type: 'load_sheet',
        sheet_id: sheetId,
        user_id: userId
      };

      // Set up one-time message listener
      const handleMessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'sheet_loaded') {
            ws.removeEventListener('message', handleMessage);
            resolve(data);
          } else if (data.type === 'error') {
            ws.removeEventListener('message', handleMessage);
            reject(new Error(data.message));
          }
        } catch (error) {
          ws.removeEventListener('message', handleMessage);
          reject(error);
        }
      };

      ws.addEventListener('message', handleMessage);
      ws.send(JSON.stringify(message));
    });
  }
}

export const websocketService = new WebSocketService();
