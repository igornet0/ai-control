import React, { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import iframeApiProxy from '../../services/iframeApiProxy';
import { DATACODE_DOCS_ROUTE } from '../../constants/datacodeDocs.js';
import styles from './DataCodeEditorPage.module.css';

/**
 * DataCodeEditorPage - Страница редактора DataCode
 * Загружает HTML редактор через iframe
 * 
 * БЕЗОПАСНОСТЬ:
 * - Проверка origin для всех postMessage
 * - Sandbox атрибуты для iframe
 * - Валидация входящих сообщений
 */
const DataCodeEditorPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const iframeRef = useRef(null);
  const initialCode = searchParams.get('code') || '';
  
  // Безопасный origin для iframe (наш же домен)
  const iframeOrigin = window.location.origin;

  useEffect(() => {
    // ✅ БЕЗОПАСНОСТЬ: Используем прокси вместо прямой передачи токена
    const iframe = iframeRef.current;
    const handleLoad = () => {
      if (iframe?.contentWindow) {
        try {
          // ✅ Предпочтительный метод: отправляем конфигурацию прокси (без токена)
          iframeApiProxy.sendProxyConfig(iframe.contentWindow, iframeOrigin);
          
          // Устаревший метод (для обратной совместимости) - оставляем, но не рекомендуется
          // const apiBaseUrl = api.defaults?.baseURL || 'http://localhost:8000';
          // const authToken = getAccessToken();
          // iframe.contentWindow.postMessage({
          //   type: 'API_CONFIG',
          //   apiBaseUrl: apiBaseUrl,
          //   authToken: authToken
          // }, iframeOrigin);
        } catch (error) {
          console.error('Error sending API config to editor:', error);
        }
      }
    };

    if (iframe) {
      iframe.addEventListener('load', handleLoad);
      if (iframe.contentDocument?.readyState === 'complete') {
        handleLoad();
      }
    }

    return () => {
      if (iframe) {
        iframe.removeEventListener('load', handleLoad);
      }
    };
  }, [iframeOrigin]);

  useEffect(() => {
    // Слушаем сообщения от редактора с проверкой origin
    const handleMessage = (event) => {
      // ✅ КРИТИЧНО: Проверяем origin перед обработкой сообщения
      if (event.origin !== iframeOrigin) {
        console.warn('Ignored message from unauthorized origin:', event.origin);
        return;
      }

      if (event.data && typeof event.data === 'object') {
        // ✅ Валидация типа сообщения
        if (event.data.type === 'EDITOR_CLOSED') {
          navigate(-1); // Возвращаемся назад
        }

        if (event.data.type === 'OPEN_DATACODE_DOCS') {
          window.open(DATACODE_DOCS_ROUTE, '_blank', 'noopener,noreferrer');
        }
        
        // ✅ БЕЗОПАСНОСТЬ: Обработка запроса API конфигурации от редактора
        if (event.data.type === 'REQUEST_API_CONFIG' && iframeRef.current?.contentWindow) {
          // ✅ Используем безопасный прокси вместо прямой передачи токена
          iframeApiProxy.sendProxyConfig(iframeRef.current.contentWindow, iframeOrigin);
          
          // Устаревший метод (для обратной совместимости)
          // const apiBaseUrl = api.defaults?.baseURL || 'http://localhost:8000';
          // const authToken = getAccessToken();
          // iframeRef.current.contentWindow.postMessage({
          //   type: 'API_CONFIG',
          //   apiBaseUrl: apiBaseUrl,
          //   authToken: authToken
          // }, iframeOrigin);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [navigate, iframeOrigin]);

  return (
    <div className={styles.editorPage}>
      <div className={styles.editorHeader}>
        <h1 className={styles.editorTitle}>Редактор DataCode</h1>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.docsButton}
            onClick={() => window.open(DATACODE_DOCS_ROUTE, '_blank', 'noopener,noreferrer')}
            title="Открыть документацию DataCode"
          >
            Документация
          </button>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => navigate(-1)}
          >
            ← Назад
          </button>
        </div>
      </div>
      <div className={styles.editorContainer}>
        <iframe
          ref={iframeRef}
          src={`/datacode-editor/index.html${initialCode ? `?code=${encodeURIComponent(initialCode)}` : ''}`}
          className={styles.editorIframe}
          title="DataCode Editor"
          sandbox="allow-scripts allow-same-origin allow-forms"
          // ✅ БЕЗОПАСНОСТЬ: Sandbox ограничивает возможности iframe
          // allow-scripts - разрешить JavaScript
          // allow-same-origin - разрешить доступ к родительскому окну (нужно для postMessage)
          // allow-forms - разрешить формы
          // НЕ добавляем allow-top-navigation - предотвращает навигацию родителя
        />
      </div>
    </div>
  );
};

export default DataCodeEditorPage;

