import api from '../services/api';

/**
 * Утилита для проверки работоспособности API endpoints
 */
class APIHealthCheck {
  constructor() {
    this.endpoints = {
      dashboards: [
        { method: 'GET', path: '/api/dashboards/', name: 'List Dashboards' },
        { method: 'GET', path: '/api/dashboards/stats', name: 'Dashboard Stats' },
        { method: 'GET', path: '/api/dashboards/templates', name: 'Dashboard Templates' }
      ],
      tasks: [
        { method: 'GET', path: '/api/tasks/', name: 'List Tasks' },
        { method: 'GET', path: '/api/tasks/stats', name: 'Task Stats' },
        { method: 'GET', path: '/api/tasks/progress', name: 'Task Progress' }
      ],
      metrics: [
        { method: 'GET', path: '/api/metrics/performance', name: 'Performance Metrics' },
        { method: 'GET', path: '/api/metrics/status', name: 'Status Metrics' },
        { method: 'GET', path: '/api/metrics/team-ratings', name: 'Team Ratings' }
      ],
      auth: [
        { method: 'GET', path: '/api/auth/me', name: 'User Profile' }
      ]
    };
    
    this.healthStatus = new Map();
    this.lastCheck = null;
    this.checkInterval = 5 * 60 * 1000; // 5 минут
  }

  /**
   * Проверка всех endpoints
   */
  async checkAllEndpoints() {
    const results = {
      overall: 'unknown',
      endpoints: {},
      timestamp: new Date().toISOString()
    };

    let healthyEndpoints = 0;
    let totalEndpoints = 0;

    for (const [name, endpoint] of Object.entries(this.endpoints)) {
      totalEndpoints++;
      try {
        const startTime = Date.now();
        const response = await fetch(endpoint.url, {
          method: 'GET',
          headers: endpoint.headers || {},
          signal: AbortSignal.timeout(endpoint.timeout || 5000)
        });
        const responseTime = Date.now() - startTime;

        if (response.ok) {
          results.endpoints[name] = {
            status: 'healthy',
            responseTime,
            statusCode: response.status
          };
          healthyEndpoints++;
        } else {
          results.endpoints[name] = {
            status: 'unhealthy',
            responseTime,
            statusCode: response.status,
            error: `HTTP ${response.status}`
          };
        }
      } catch (error) {
        results.endpoints[name] = {
          status: 'error',
          responseTime: null,
          error: error.message
        };
      }
    }

    // Determine overall health
    if (healthyEndpoints === totalEndpoints) {
      results.overall = 'healthy';
    } else if (healthyEndpoints === 0) {
      results.overall = 'critical';
    } else {
      results.overall = 'degraded';
    }

    this.lastResults = results;
    return results;
  }

  /**
   * Проверка отдельного endpoint
   */
  async checkEndpoint(endpoint) {
    const startTime = Date.now();
    
    try {
      const response = await api.get(endpoint.path, {
        timeout: 5000, // 5 секунд таймаут
        validateStatus: (status) => status < 500 // Считаем успешными статусы < 500
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        ...endpoint,
        healthy: true,
        responseTime,
        status: response.status,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        ...endpoint,
        healthy: false,
        responseTime,
        error: error.message,
        status: error.response?.status || 'timeout',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Получение статуса здоровья
   */
  getHealthStatus() {
    return {
      overall: this.healthStatus.get('overall'),
      lastCheck: this.lastCheck,
      isHealthy: this.healthStatus.get('overall')?.overall === 'healthy'
    };
  }

  /**
   * Автоматическая проверка каждые 5 минут
   */
  startAutoCheck(intervalMinutes = 5) {
    if (this.autoCheckInterval) {
      this.stopAutoCheck();
    }
    
    this.autoCheckInterval = setInterval(() => {
      this.checkAllEndpoints();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Остановка автоматической проверки
   */
  stopAutoCheck() {
    if (this.autoCheckInterval) {
      clearInterval(this.autoCheckInterval);
      this.autoCheckInterval = null;
    }
  }

  /**
   * Проверка конкретной категории
   */
  async checkCategory(category) {
    if (!this.endpoints[category]) {
      throw new Error(`Unknown category: ${category}`);
    }
    
    const results = [];
    for (const endpoint of this.endpoints[category]) {
      const health = await this.checkEndpoint(endpoint);
      results.push(health);
    }
    
    return results;
  }

  /**
   * Получение проблемных endpoints
   */
  getProblematicEndpoints() {
    const overall = this.healthStatus.get('overall');
    if (!overall) return [];
    
    return overall.details.filter(endpoint => !endpoint.healthy);
  }

  /**
   * Экспорт результатов в JSON
   */
  exportHealthReport() {
    const overall = this.healthStatus.get('overall');
    if (!overall) return null;
    
    return {
      ...overall,
      exportTimestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  }
}

// Создаем и экспортируем экземпляр
const apiHealthCheck = new APIHealthCheck();

// Автоматически запускаем проверку при импорте
if (typeof window !== 'undefined') {
  // Только в браузере
  apiHealthCheck.startAutoCheck();
}

export default apiHealthCheck;
