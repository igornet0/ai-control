/**
 * Система кэширования для оптимизации API запросов
 */
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.maxSize = 100; // Максимальное количество кэшированных элементов
    this.defaultTTL = 5 * 60 * 1000; // 5 минут по умолчанию
    this.cleanupInterval = 60 * 1000; // Очистка каждую минуту
    
    // Запускаем автоматическую очистку
    this.startCleanup();
  }

  /**
   * Генерация ключа кэша
   */
  generateKey(url, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    
    return `${url}${sortedParams ? `?${sortedParams}` : ''}`;
  }

  /**
   * Получение данных из кэша
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Проверяем TTL
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Обновляем время последнего доступа
    item.lastAccessed = Date.now();
    item.accessCount++;
    
    return item.data;
  }

  /**
   * Сохранение данных в кэш
   */
  set(key, data, ttl = this.defaultTTL) {
    // Проверяем размер кэша
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const item = {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      lastAccessed: Date.now(),
      accessCount: 1
    };

    this.cache.set(key, item);
    
    return item;
  }

  /**
   * Проверка существования ключа в кэше
   */
  has(key) {
    return this.cache.has(key) && this.get(key) !== null;
  }

  /**
   * Удаление элемента из кэша
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Очистка всего кэша
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Получение статистики кэша
   */
  getStats() {
    const now = Date.now();
    let totalItems = 0;
    let expiredItems = 0;
    let totalSize = 0;

    for (const [key, item] of this.cache) {
      totalItems++;
      totalSize += this.estimateSize(item.data);
      
      if (now > item.expiresAt) {
        expiredItems++;
      }
    }

    return {
      totalItems,
      expiredItems,
      totalSize: this.formatBytes(totalSize),
      maxSize: this.maxSize,
      hitRate: this.calculateHitRate()
    };
  }

  /**
   * Оценка размера данных
   */
  estimateSize(data) {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return 0;
    }
  }

  /**
   * Форматирование байтов
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Вычисление hit rate
   */
  calculateHitRate() {
    let totalHits = 0;
    let totalRequests = 0;

    for (const item of this.cache.values()) {
      totalHits += item.accessCount;
      totalRequests += item.accessCount + 1; // +1 для первоначального запроса
    }

    return totalRequests > 0 ? (totalHits / totalRequests * 100).toFixed(2) + '%' : '0%';
  }

  /**
   * Удаление наименее используемых элементов (LRU)
   */
  evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.cache) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Автоматическая очистка просроченных элементов
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Остановка автоматической очистки
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Очистка просроченных элементов
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Получение всех ключей
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Получение размера кэша
   */
  size() {
    return this.cache.size;
  }

  /**
   * Экспорт кэша (для отладки)
   */
  export() {
    const exportData = {};
    
    for (const [key, item] of this.cache) {
      exportData[key] = {
        ...item,
        data: item.data,
        isExpired: Date.now() > item.expiresAt
      };
    }
    
    return exportData;
  }

  /**
   * Импорт кэша (для отладки)
   */
  import(data) {
    this.clear();
    
    for (const [key, item] of Object.entries(data)) {
      if (!item.isExpired) {
        this.cache.set(key, {
          data: item.data,
          createdAt: item.createdAt,
          expiresAt: item.expiresAt,
          lastAccessed: item.lastAccessed,
          accessCount: item.accessCount
        });
      }
    }
  }
}

// Создаем и экспортируем экземпляр
const cacheManager = new CacheManager();

export default cacheManager;
