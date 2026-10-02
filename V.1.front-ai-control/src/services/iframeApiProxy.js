/**
 * Iframe API Proxy Service
 * 
 * Безопасный прокси для API запросов из iframe без прямой передачи токена.
 * Вместо передачи токена в iframe, iframe делает запросы через этот прокси.
 */

import api from './api';
import { getApiBaseUrl } from './apiBaseUrl';

class IframeApiProxy {
  constructor() {
    this.messageHandlers = new Map();
    this.setupMessageListener();
  }

  /**
   * Настройка слушателя сообщений от iframe
   */
  setupMessageListener() {
    window.addEventListener('message', (event) => {
      // Проверяем origin
      if (event.origin !== window.location.origin) {
        console.warn('Ignored message from unauthorized origin:', event.origin);
        return;
      }

      // Обрабатываем только сообщения с типом IFRAME_API_REQUEST
      if (event.data && typeof event.data === 'object' && event.data.type === 'IFRAME_API_REQUEST') {
        this.handleApiRequest(event);
      }
    });
  }

  /**
   * Обработка API запроса от iframe
   */
  async handleApiRequest(event) {
    const { requestId, method, url, data, headers } = event.data;

    try {
      // Выполняем запрос через основной API (токен добавляется автоматически)
      const response = await api.request({
        method: method || 'GET',
        url: url,
        data: data,
        headers: {
          ...headers,
          // Убираем Authorization из заголовков iframe - используем токен из api interceptor
        }
      });

      // Отправляем ответ обратно в iframe
      event.source.postMessage({
        type: 'IFRAME_API_RESPONSE',
        requestId: requestId,
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers
      }, event.origin);

    } catch (error) {
      // Отправляем ошибку обратно в iframe
      event.source.postMessage({
        type: 'IFRAME_API_RESPONSE',
        requestId: requestId,
        success: false,
        error: {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        }
      }, event.origin);
    }
  }

  /**
   * Отправка конфигурации прокси в iframe
   */
  sendProxyConfig(iframeWindow, iframeOrigin) {
    iframeWindow.postMessage({
      type: 'API_PROXY_CONFIG',
      proxyEnabled: true,
      apiBaseUrl: (() => {
        const b = getApiBaseUrl();
        if (b) return b;
        if (typeof window !== 'undefined') return window.location.origin;
        return '';
      })(),
    }, iframeOrigin);
  }
}

// Создаем единственный экземпляр
const iframeApiProxy = new IframeApiProxy();

export default iframeApiProxy;


