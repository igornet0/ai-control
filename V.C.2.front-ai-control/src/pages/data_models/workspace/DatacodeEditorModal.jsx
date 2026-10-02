/**
 * DatacodeEditorModal — полноэкранный редактор DataCode.
 * Вкладки отображаются внутри iframe-редактора, без дублирования сверху.
 */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { dataModelService } from '../../../services/dataModelService';
import {
  buildEditorSessionPayload,
  collectEditorUploadFiles,
} from './buildDataCodeEditorTabs.js';
import { widgetIdKey } from './widgetGraphOrder.js';
import { parseDbWidgetId } from './widgetDbSync.js';
import { widgetCodeStoragePayload } from './resolveWidgetDataCode.js';
import { prepareDataCodeEditorSession } from './widgetDataCodeState.js';
import { joinTabContentsForCompile } from './compileTabPrefix.js';
import { DATACODE_DOCS_EMBED_URL, DATACODE_DOCS_ROUTE } from '../../../constants/datacodeDocs.js';
import DataCodeEditorWrapper from '../../datacode_editor/DataCodeEditorWrapper.jsx';
import styles from './DatacodeEditorModal.module.css';

const SAVE_DEBOUNCE_MS = 1500;

function splitCodeLines(text) {
  if (!text) return [''];
  return String(text).split('\n');
}

function collectCanvasWidgetIds(engineRef) {
  const widgets = engineRef?.current?.widgetManager?.getAllWidgets?.() || [];
  const ids = [];
  for (const widget of widgets) {
    const id = parseDbWidgetId(widget);
    if (id != null) ids.push(id);
  }
  return ids;
}

function readPreviousDismissed(sessionJson) {
  if (!sessionJson) return [];
  try {
    const parsed = JSON.parse(sessionJson);
    return Array.isArray(parsed?.dismissedWidgetIds) ? parsed.dismissedWidgetIds : [];
  } catch {
    return [];
  }
}

const DatacodeEditorModal = ({
  isOpen,
  onClose,
  engineRef,
  modelId,
  selectedWidgetId = null,
  runtimeOverrides = null,
  sessionEpoch = 0,
  onCodeSaved,
}) => {
  const [initialCodeData, setInitialCodeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editorKey, setEditorKey] = useState(0);
  const [fullCodeOpen, setFullCodeOpen] = useState(false);
  const [fullCodeText, setFullCodeText] = useState('');
  const [docsOpen, setDocsOpen] = useState(false);

  const lastSavedRef = useRef(new Map());
  const lastSessionSavedRef = useRef('');
  const saveTimerRef = useRef(null);
  const pendingSaveRef = useRef(null);
  const tabsRef = useRef([]);
  const fullCodeOpenRef = useRef(false);

  const loadSession = useCallback(async () => {
    if (!engineRef?.current) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    pendingSaveRef.current = null;

    setLoading(true);
    setError(null);

    try {
      const { tabs, activeTab } = await prepareDataCodeEditorSession({
        modelId,
        engineRef,
        selectedWidgetId,
        runtimeOverrides,
      });

      lastSavedRef.current = new Map(
        (tabs || [])
          .filter((tab) => tab.widgetId != null)
          .map((tab) => [widgetIdKey(tab.widgetId), tab.content || '']),
      );
      lastSessionSavedRef.current = JSON.stringify(
        buildEditorSessionPayload(tabs || [], activeTab ?? 0, {
          canvasWidgetIds: collectCanvasWidgetIds(engineRef),
          previousDismissed: [],
        }),
      );

      tabsRef.current = tabs;
      setInitialCodeData(tabs.length ? { tabs, activeTab } : null);
      setEditorKey((key) => key + 1);
      if (fullCodeOpenRef.current) {
        setFullCodeText(joinTabContentsForCompile(tabs));
      }
    } catch (err) {
      setError(err.message || 'Ошибка загрузки');
      setInitialCodeData(null);
    } finally {
      setLoading(false);
    }
  }, [engineRef, modelId, runtimeOverrides, selectedWidgetId]);

  useEffect(() => {
    if (!isOpen) {
      fullCodeOpenRef.current = false;
      setFullCodeOpen(false);
      setFullCodeText('');
      setDocsOpen(false);
      return;
    }
    void loadSession();
  }, [isOpen, loadSession, sessionEpoch]);

  const persistTabs = useCallback(async (updatedTabs, activeTab = 0) => {
    if (!modelId) return;

    const changedWidgetIds = [];
    for (const tab of updatedTabs) {
      const tabWidgetId = tab.widgetId != null ? Number(tab.widgetId) : NaN;
      if (!Number.isFinite(tabWidgetId)) continue;
      const key = widgetIdKey(tabWidgetId);
      const prev = lastSavedRef.current.get(key);
      if (prev === (tab.content || '')) continue;

      await dataModelService.saveModelCode(
        modelId,
        widgetCodeStoragePayload(tab),
        false,
        tabWidgetId,
      );
      lastSavedRef.current.set(key, tab.content || '');
      changedWidgetIds.push(tabWidgetId);
    }

    const sessionPayload = buildEditorSessionPayload(updatedTabs, activeTab, {
      canvasWidgetIds: collectCanvasWidgetIds(engineRef),
      previousDismissed: readPreviousDismissed(lastSessionSavedRef.current),
    });
    const sessionKey = JSON.stringify(sessionPayload);
    if (sessionKey !== lastSessionSavedRef.current) {
      await dataModelService.saveModelCode(modelId, sessionPayload, false);
      lastSessionSavedRef.current = sessionKey;
    }

    if (changedWidgetIds.length && onCodeSaved) {
      onCodeSaved(changedWidgetIds);
    }
  }, [engineRef, modelId, onCodeSaved]);

  const scheduleTabSave = useCallback((updatedTabs, activeTab = 0) => {
    if (!modelId) return;
    pendingSaveRef.current = { tabs: updatedTabs, activeTab };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      const pending = pendingSaveRef.current;
      pendingSaveRef.current = null;
      saveTimerRef.current = null;
      if (!pending) return;
      try {
        await persistTabs(pending.tabs, pending.activeTab);
      } catch (err) {
        console.warn('[DatacodeEditorModal] Save failed:', err);
      }
    }, SAVE_DEBOUNCE_MS);
  }, [modelId, persistTabs]);

  const handleCodeChange = useCallback((_code, codeData) => {
    const tabs = codeData?.tabs || [];
    if (!tabs.length) return;
    tabsRef.current = tabs;
    if (fullCodeOpenRef.current) {
      setFullCodeText(joinTabContentsForCompile(tabs));
    }
    scheduleTabSave(tabs, codeData?.activeTab ?? 0);
  }, [scheduleTabSave]);

  const handleToggleFullCode = useCallback(() => {
    const next = !fullCodeOpenRef.current;
    fullCodeOpenRef.current = next;
    setFullCodeOpen(next);
    if (next) {
      setDocsOpen(false);
      setFullCodeText(joinTabContentsForCompile(tabsRef.current));
    }
  }, []);

  const handleToggleDocs = useCallback(() => {
    setDocsOpen((open) => {
      const next = !open;
      if (next) {
        fullCodeOpenRef.current = false;
        setFullCodeOpen(false);
      }
      return next;
    });
  }, []);

  const handleOpenDocsInNewTab = useCallback(() => {
    window.open(DATACODE_DOCS_ROUTE, '_blank', 'noopener,noreferrer');
  }, []);

  const handleCopyFullCode = useCallback(async () => {
    if (!fullCodeText) return;
    try {
      await navigator.clipboard.writeText(fullCodeText);
    } catch (err) {
      console.warn('[DatacodeEditorModal] Clipboard write failed:', err);
    }
  }, [fullCodeText]);

  const handleClose = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (pending && modelId) {
      void persistTabs(pending.tabs, pending.activeTab).catch((err) => {
        console.warn('[DatacodeEditorModal] Flush save failed:', err);
      });
    }
    fullCodeOpenRef.current = false;
    setFullCodeOpen(false);
    setDocsOpen(false);
    onClose?.();
  }, [modelId, onClose, persistTabs]);

  if (!isOpen) return null;

  const filesToUpload = collectEditorUploadFiles(
    engineRef.current?.widgetManager?.getAllWidgets?.() || [],
  );

  return (
    <div className={styles.overlay} onClick={handleClose} role="presentation">
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Редактор DataCode"
      >
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title}>Редактор DataCode</span>
            {loading && <span className={styles.loadingBadge}>загрузка…</span>}
          </div>
          <div className={styles.headerRight}>
            <button
              type="button"
              className={`${styles.headerBtn} ${docsOpen ? styles.headerBtnActive : ''}`}
              onClick={handleToggleDocs}
              aria-pressed={docsOpen}
              title="Открыть документацию DataCode рядом с редактором"
            >
              Документация
            </button>
            <button
              type="button"
              className={`${styles.headerBtn} ${fullCodeOpen ? styles.headerBtnActive : ''}`}
              onClick={handleToggleFullCode}
              aria-pressed={fullCodeOpen}
              title="Показать весь код всех вкладок с нумерацией строк"
            >
              Весь код
            </button>
            <button className={styles.closeBtn} onClick={handleClose} aria-label="Закрыть">
              ×
            </button>
          </div>
        </div>

        {error && (
          <div className={styles.errorBar}>{error}</div>
        )}

        <div className={styles.editorArea}>
          <div className={styles.editorMain}>
          {loading && !initialCodeData?.tabs?.length ? (
            <div className={styles.loadingPlaceholder}>Загрузка вкладок…</div>
          ) : (
            <DataCodeEditorWrapper
              key={`dc-editor-${editorKey}`}
              isOpen={true}
              embedded={true}
              onClose={handleClose}
              initialCodeData={initialCodeData}
              onCodeChange={handleCodeChange}
              fileToUpload={filesToUpload}
              modelId={modelId}
              onOpenDocs={() => {
                fullCodeOpenRef.current = false;
                setFullCodeOpen(false);
                setDocsOpen(true);
              }}
            />
          )}
          {fullCodeOpen && (
            <div className={styles.fullCodeOverlay} role="region" aria-label="Весь код">
              <div className={styles.fullCodeToolbar}>
                <span className={styles.fullCodeMeta}>
                  {fullCodeText.trim()
                    ? `${splitCodeLines(fullCodeText).length} строк`
                    : 'Нет кода'}
                </span>
                <button
                  type="button"
                  className={styles.headerBtn}
                  onClick={handleCopyFullCode}
                  disabled={!fullCodeText.trim()}
                >
                  Копировать
                </button>
              </div>
              <div className={styles.fullCodeScroll}>
                {fullCodeText.trim() ? (
                  <pre className={styles.fullCodePre}>
                    {splitCodeLines(fullCodeText).map((line, index) => (
                      <div key={index} className={styles.fullCodeLine}>
                        <span className={styles.fullCodeGutter}>{index + 1}</span>
                        <span className={styles.fullCodeText}>{line || ' '}</span>
                      </div>
                    ))}
                  </pre>
                ) : (
                  <div className={styles.loadingPlaceholder}>Нет кода во вкладках</div>
                )}
              </div>
            </div>
          )}
          </div>
          {docsOpen && (
            <aside className={styles.docsPanel} aria-label="Документация DataCode">
              <div className={styles.docsToolbar}>
                <span className={styles.docsTitle}>Документация DataCode</span>
                <button
                  type="button"
                  className={styles.headerBtn}
                  onClick={handleOpenDocsInNewTab}
                  title="Открыть документацию в новой вкладке"
                >
                  Новая вкладка
                </button>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => setDocsOpen(false)}
                  aria-label="Закрыть документацию"
                >
                  ×
                </button>
              </div>
              <iframe
                className={styles.docsFrame}
                src={DATACODE_DOCS_EMBED_URL}
                title="Документация DataCode"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatacodeEditorModal;
