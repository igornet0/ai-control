/**
 * Система логирования и мониторинга
 */
class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      CRITICAL: 4
    };
    
    this.currentLevel = this.levels.INFO;
    this.enableConsole = true;
    this.enableRemote = false;
    this.remoteEndpoint = '/api/logs';
    
    // Автоматическая очистка старых логов
    this.startCleanup();
    
    // Перехват глобальных ошибок
    this.setupGlobalErrorHandling();
  }

  /**
   * Логирование сообщения
   */
  log(level, message, data = null, context = {}) {
    if (this.levels[level] < this.currentLevel) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        ...context
      }
    };

    // Добавляем в локальный массив
    this.logs.push(logEntry);
    
    // Ограничиваем размер
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Выводим в консоль
    if (this.enableConsole) {
      this.logToConsole(logEntry);
    }

    // Отправляем на сервер для критических ошибок
    if (this.enableRemote && level === 'CRITICAL') {
      this.sendToRemote(logEntry);
    }

    return logEntry;
  }

  /**
   * Логирование в консоль
   */
  logToConsole(logEntry) {
    const { level, message, data, context } = logEntry;
    
    const consoleMethod = level === 'ERROR' || level === 'CRITICAL' ? 'error' :
                         level === 'WARN' ? 'warn' :
                         level === 'INFO' ? 'info' : 'log';
    
    const prefix = `[${level}] ${new Date(logEntry.timestamp).toLocaleTimeString()}`;
    
    if (data) {
      console[consoleMethod](prefix, message, data, context);
    } else {
      console[consoleMethod](prefix, message, context);
    }
  }

  /**
   * Отправка лога на сервер
   */
  async sendToRemote(logEntry) {
    try {
      const response = await fetch(this.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry)
      });
      
      if (!response.ok) {
        console.warn('Failed to send log to remote endpoint:', response.status);
      }
    } catch (error) {
      console.warn('Error sending log to remote endpoint:', error);
    }
  }

  /**
   * Удобные методы для разных уровней логирования
   */
  debug(message, data = null, context = {}) {
    return this.log('DEBUG', message, data, context);
  }

  info(message, data = null, context = {}) {
    return this.log('INFO', message, data, context);
  }

  warn(message, data = null, context = {}) {
    return this.log('WARN', message, data, context);
  }

  error(message, data = null, context = {}) {
    return this.log('ERROR', message, data, context);
  }

  critical(message, data = null, context = {}) {
    return this.log('CRITICAL', message, data, context);
  }

  /**
   * Логирование API запросов
   */
  logAPIRequest(method, url, params = {}, response = null, error = null) {
    const context = {
      type: 'api_request',
      method,
      url,
      params,
      responseStatus: response?.status,
      responseTime: response?.responseTime,
      error: error?.message
    };

    if (error) {
      this.error(`API Request Failed: ${method} ${url}`, error, context);
    } else {
      this.info(`API Request: ${method} ${url}`, { params, response: response?.data }, context);
    }
  }

  /**
   * Логирование производительности
   */
  logPerformance(operation, duration, details = {}) {
    const context = {
      type: 'performance',
      operation,
      duration,
      ...details
    };

    if (duration > 1000) {
      this.warn(`Slow operation: ${operation} took ${duration}ms`, details, context);
    } else {
      this.debug(`Performance: ${operation} took ${duration}ms`, details, context);
    }
  }

  /**
   * Логирование пользовательских действий
   */
  logUserAction(action, details = {}) {
    const context = {
      type: 'user_action',
      action,
      ...details
    };

    this.info(`User Action: ${action}`, details, context);
  }

  /**
   * Логирование ошибок компонентов
   */
  logComponentError(componentName, error, props = {}) {
    const context = {
      type: 'component_error',
      component: componentName,
      props,
      stack: error.stack
    };

    this.error(`Component Error in ${componentName}: ${error.message}`, error, context);
  }

  /**
   * Настройка глобальной обработки ошибок
   */
  setupGlobalErrorHandling() {
    // Перехват необработанных ошибок
    window.addEventListener('error', (event) => {
      this.error('Unhandled Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }, {
        type: 'global_error',
        error: event.error
      });
    });

    // Перехват необработанных промисов
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled Promise Rejection', {
        reason: event.reason
      }, {
        type: 'unhandled_promise_rejection'
      });
    });

    // Перехват ошибок fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = Date.now();
      
      try {
        const response = await originalFetch(...args);
        const duration = Date.now() - startTime;
        
        this.logPerformance('fetch', duration, {
          url: args[0],
          method: args[1]?.method || 'GET',
          status: response.status
        });
        
        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        this.error('Fetch Error', error, {
          type: 'fetch_error',
          url: args[0],
          method: args[1]?.method || 'GET',
          duration
        });
        
        throw error;
      }
    };
  }

  /**
   * Получение логов по фильтрам
   */
  getLogs(filters = {}) {
    let filteredLogs = [...this.logs];

    if (filters.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filters.level);
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(searchTerm) ||
        JSON.stringify(log.data).toLowerCase().includes(searchTerm)
      );
    }

    if (filters.startDate) {
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) >= new Date(filters.startDate)
      );
    }

    if (filters.endDate) {
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) <= new Date(filters.endDate)
      );
    }

    if (filters.limit) {
      filteredLogs = filteredLogs.slice(-filters.limit);
    }

    return filteredLogs;
  }

  /**
   * Получение статистики логов
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {},
      byType: {},
      recentErrors: 0,
      recentWarnings: 0
    };

    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    for (const log of this.logs) {
      // Подсчет по уровням
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      
      // Подсчет по типам
      const type = log.context.type || 'general';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      
      // Подсчет недавних ошибок и предупреждений
      if (new Date(log.timestamp).getTime() > oneHourAgo) {
        if (log.level === 'ERROR' || log.level === 'CRITICAL') {
          stats.recentErrors++;
        } else if (log.level === 'WARN') {
          stats.recentWarnings++;
        }
      }
    }

    return stats;
  }

  /**
   * Экспорт логов
   */
  exportLogs(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    } else if (format === 'csv') {
      return this.convertToCSV(this.logs);
    }
    
    return this.logs;
  }

  /**
   * Конвертация в CSV
   */
  convertToCSV(logs) {
    if (logs.length === 0) return '';
    
    const headers = ['timestamp', 'level', 'message', 'data', 'context'];
    const csvRows = [headers.join(',')];
    
    for (const log of logs) {
      const row = headers.map(header => {
        const value = log[header];
        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(row.join(','));
    }
    
    return csvRows.join('\n');
  }

  /**
   * Очистка старых логов
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const initialCount = this.logs.length;
      
      this.logs = this.logs.filter(log => 
        new Date(log.timestamp).getTime() > oneDayAgo
      );
      
      const removedCount = initialCount - this.logs.length;
      if (removedCount > 0) {
        this.debug(`Cleaned up ${removedCount} old log entries`);
      }
    }, 60 * 60 * 1000); // Каждый час
  }

  /**
   * Остановка очистки
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Настройка уровня логирования
   */
  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.currentLevel = this.levels[level];
      this.info(`Log level changed to: ${level}`);
    }
  }

  /**
   * Включение/выключение консольного вывода
   */
  setConsoleOutput(enabled) {
    this.enableConsole = enabled;
    this.info(`Console output ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Включение/выключение удаленного логирования
   */
  setRemoteLogging(enabled, endpoint = null) {
    this.enableRemote = enabled;
    if (endpoint) {
      this.remoteEndpoint = endpoint;
    }
    this.info(`Remote logging ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Создаем и экспортируем экземпляр
const logger = new Logger();

export default logger;
