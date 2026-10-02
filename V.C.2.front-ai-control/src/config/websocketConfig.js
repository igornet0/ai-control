/**
 * Централизованная конфигурация WebSocket соединений
 * Автоматически определяет протокол (ws:// vs wss://) на основе текущей страницы
 * Поддерживает переменные окружения Vite для кастомизации
 */

/**
 * Определяет протокол WebSocket на основе протокола текущей страницы
 * @returns {string} 'ws:' или 'wss:'
 */
const getWebSocketProtocol = () => {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return 'wss:';
  }
  return 'ws:';
};


/**
 * Получает базовый URL для WebSocket соединений (динамически)
 * @returns {string} Базовый URL для WebSocket
 */
export const getWebSocketBaseURL = () => {
  // Проверяем переменную окружения Vite (имеет приоритет)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WS_URL) {
    const envUrl = import.meta.env.VITE_WS_URL;
    // Если URL уже содержит протокол, используем как есть
    if (envUrl.startsWith('ws://') || envUrl.startsWith('wss://')) {
            return envUrl;
    }
    // Если нет протокола, добавляем его
    const url = `${getWebSocketProtocol()}//${envUrl}`;
        return url;
  }
  
  // Всегда используем текущий хост страницы, если доступен (работает и в dev, и в production)
  if (typeof window !== 'undefined' && window.location) {
    const url = `${getWebSocketProtocol()}//${window.location.host}/ws`;
        return url;
  }
  
  // Fallback: определяем режим для SSR или других случаев
  const isProduction = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD === true) ||
                        (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production');
  
  if (isProduction) {
    console.warn('[WebSocket Config] Production mode but window.location not available, using fallback');
    return 'wss://localhost/ws';
  }
  
  // В development используем localhost:8000 (только если window.location недоступен)
    return 'ws://localhost:8000/ws';
};

/**
 * Конфигурация WebSocket соединений
 */
export const WEBSOCKET_CONFIG = {
  /**
   * Получение базового URL для WebSocket соединений (динамически)
   * Используйте getWebSocketBaseURL() вместо прямого доступа к baseURL
   */
  get baseURL() {
    return getWebSocketBaseURL();
  },
  
  /**
   * Интервал переподключения в миллисекундах (начальное значение)
   */
  reconnectInterval: 3000,
  
  /**
   * Максимальное количество попыток переподключения
   * 0 = бесконечные попытки
   */
  maxReconnectAttempts: 5,
  
  /**
   * Интервал отправки heartbeat (ping) в миллисекундах
   * 0 = отключить heartbeat
   */
  heartbeatInterval: 30000,
  
  /**
   * Таймаут установки соединения в миллисекундах
   */
  connectionTimeout: 10000,
  
  /**
   * Использовать экспоненциальную задержку при переподключении
   */
  useExponentialBackoff: true,
  
  /**
   * Максимальная задержка при экспоненциальном переподключении (в миллисекундах)
   */
  maxReconnectDelay: 30000
};

/**
 * Вычисляет задержку для следующей попытки переподключения
 * @param {number} attemptNumber - Номер попытки (начиная с 0)
 * @returns {number} Задержка в миллисекундах
 */
export const calculateReconnectDelay = (attemptNumber) => {
  if (!WEBSOCKET_CONFIG.useExponentialBackoff) {
    return WEBSOCKET_CONFIG.reconnectInterval;
  }
  
  // Экспоненциальная задержка: baseDelay * 2^attemptNumber
  const baseDelay = WEBSOCKET_CONFIG.reconnectInterval * Math.pow(2, attemptNumber);
  
  // Ограничиваем максимальной задержкой
  const delay = Math.min(baseDelay, WEBSOCKET_CONFIG.maxReconnectDelay);
  
  // Добавляем jitter (случайное отклонение до 1 секунды) для предотвращения thundering herd
  const jitter = Math.random() * 1000;
  
  return Math.floor(delay + jitter);
};

/**
 * Проверяет, нужно ли продолжать попытки переподключения
 * @param {number} attemptNumber - Номер попытки (начиная с 0)
 * @returns {boolean} true если нужно продолжать попытки
 */
export const shouldContinueReconnecting = (attemptNumber) => {
  if (WEBSOCKET_CONFIG.maxReconnectAttempts === 0) {
    return true; // Бесконечные попытки
  }
  return attemptNumber < WEBSOCKET_CONFIG.maxReconnectAttempts;
};

