import React, { useEffect, useRef } from 'react';
import { dataModelService } from '../../services/dataModelService';
import iframeApiProxy from '../../services/iframeApiProxy';
import { DATACODE_DOCS_EMBED_URL, DATACODE_DOCS_ROUTE } from '../../constants/datacodeDocs.js';
import styles from './DataCodeEditorWrapper.module.css';

/**
 * DataCodeEditorWrapper - React компонент-обертка для HTML редактора Datacode
 * Отображает редактор в iframe внутри модального окна
 */
const DataCodeEditorWrapper = ({
  isOpen,
  onClose,
  initialCode = '',
  initialCodeData = null,  // { tabs: [{ name, content }], activeTab } из БД
  onCodeChange,
  embedded = false,
  fileToUpload = null,  // Может быть один файл или массив файлов
  modelId = null,       // Контекст модели: сохранение кода и выполнение через execute-code
  onOpenDocs = null,
}) => {
  const iframeRef = useRef(null);
  const initialCodeSentRef = useRef(false);
  const iframeOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  // Нормализуем fileToUpload в массив
  const filesToUpload = Array.isArray(fileToUpload) ? fileToUpload : (fileToUpload ? [fileToUpload] : []);

  // Сбрасываем флаг при закрытии, чтобы при следующем открытии снова отправить начальный код
  useEffect(() => {
    if (!isOpen) initialCodeSentRef.current = false;
  }, [isOpen]);

  const sendProxyConfigToEditor = React.useCallback((targetWindow) => {
    if (!targetWindow) return;
    iframeApiProxy.sendProxyConfig(targetWindow, iframeOrigin);
  }, [iframeOrigin]);

  // Отправка начального кода и конфига в редактор по готовности (EDITOR_READY)
  const sendInitialDataToEditor = React.useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      sendProxyConfigToEditor(iframe.contentWindow);
      if (modelId != null) {
        iframe.contentWindow.postMessage({ type: 'MODEL_CONTEXT', modelId }, iframeOrigin);
      }

      if (!initialCodeSentRef.current) {
        initialCodeSentRef.current = true;
        if (initialCodeData?.tabs?.length) {
          iframe.contentWindow.postMessage({
            type: 'SET_INITIAL_CODE_DATA',
            code_data: initialCodeData,
          }, iframeOrigin);
        } else if (initialCode) {
          iframe.contentWindow.postMessage({
            type: 'SET_CODE',
            code: initialCode,
          }, iframeOrigin);
        }
      }

      if (filesToUpload.length > 0) {
        const convertFile = (fileItem) => new Promise((resolve) => {
          const isText = fileItem.filename.endsWith('.txt')
            || fileItem.filename.endsWith('.csv')
            || fileItem.filename.endsWith('.json');
          const reader = new FileReader();
          if (isText) {
            reader.onload = (e) => resolve({ filename: fileItem.filename, content: e.target.result });
            reader.readAsText(fileItem.file);
          } else {
            reader.onload = (e) => {
              try {
                const base64 = btoa(
                  new Uint8Array(e.target.result).reduce((data, byte) => data + String.fromCharCode(byte), ''),
                );
                resolve({ filename: fileItem.filename, content: `base64:${base64}` });
              } catch (err) {
                console.error('[DataCodeEditorWrapper] Error converting file:', err);
                resolve(null);
              }
            };
            reader.readAsArrayBuffer(fileItem.file);
          }
        });
        Promise.all(filesToUpload.map(convertFile))
          .then((convertedFiles) => {
            const validFiles = convertedFiles.filter((f) => f !== null);
            if (validFiles.length && iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                { type: 'SET_FILES_TO_UPLOAD', files: validFiles },
                iframeOrigin,
              );
            }
          })
          .catch((err) => console.error('[DataCodeEditorWrapper] Error converting files:', err));
      }
    } catch (error) {
      console.error('[DataCodeEditorWrapper] Error sending data to editor:', error);
    }
  }, [filesToUpload, iframeOrigin, initialCode, initialCodeData, modelId, sendProxyConfigToEditor]);

  useEffect(() => {
    if (!isOpen) return;
    const handleMessage = (event) => {
      if (event.data?.type === 'EDITOR_READY') {
        sendInitialDataToEditor();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, sendInitialDataToEditor]);

  // Слушаем сообщения от редактора
  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = async (event) => {
      if (!event.data) return;

      if (event.data.type === 'CODE_CHANGED' && onCodeChange) {
        onCodeChange(event.data.code, event.data.code_data);
      }

      if (event.data.type === 'OPEN_DATACODE_DOCS') {
        if (typeof onOpenDocs === 'function') {
          onOpenDocs();
        } else {
          window.open(DATACODE_DOCS_ROUTE, '_blank', 'noopener,noreferrer');
        }
      }

      if (event.data.type === 'EXECUTE_FOR_MODEL' && modelId != null && iframeRef.current?.contentWindow) {
        const { requestId, code, files } = event.data;
        try {
          const data = await dataModelService.executeModelCode(modelId, code, files || null);
          iframeRef.current.contentWindow.postMessage({
            type: 'EXECUTE_FOR_MODEL_RESPONSE',
            requestId,
            success: data.success,
            output: data.output,
            error: data.error,
            data: data.data,
          }, event.origin);
        } catch (err) {
          const message = err.response?.data?.detail || err.message || 'Execution failed';
          iframeRef.current.contentWindow.postMessage({
            type: 'EXECUTE_FOR_MODEL_RESPONSE',
            requestId,
            success: false,
            error: message,
          }, event.origin);
        }
      }

      if (event.data.type === 'REQUEST_API_CONFIG' && iframeRef.current?.contentWindow) {
        sendProxyConfigToEditor(iframeRef.current.contentWindow);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isOpen, modelId, onCodeChange, onOpenDocs, sendProxyConfigToEditor]);

  if (!isOpen && !embedded) return null;

  const containerClass = embedded
    ? styles.embeddedContainer
    : styles.modalContainer;

  const iframeSrc = initialCodeData?.tabs?.length
    ? '/datacode-editor/index.html'
    : `/datacode-editor/index.html${initialCode ? `?code=${encodeURIComponent(initialCode)}` : ''}`;

  return (
    <div className={containerClass}>
      {!embedded && (
        <div className={styles.modalOverlay} onClick={onClose}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Редактор DataCode</h2>
              <div className={styles.modalHeaderActions}>
                <button
                  type="button"
                  className={styles.docsButton}
                  onClick={() => window.open(DATACODE_DOCS_ROUTE, '_blank', 'noopener,noreferrer')}
                  title="Открыть документацию DataCode"
                >
                  Документация
                </button>
                <button className={styles.closeButton} onClick={onClose}>×</button>
              </div>
            </div>
            <div className={styles.editorContainer}>
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                className={styles.editorIframe}
                title="DataCode Editor"
              />
            </div>
          </div>
        </div>
      )}
      {embedded && (
        <div className={styles.embeddedWrapper}>
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className={styles.editorIframe}
            title="DataCode Editor"
          />
        </div>
      )}
    </div>
  );
};

export default DataCodeEditorWrapper;
