import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { WorkspaceEngine } from './core/WorkspaceEngine.js';
import { DataSourceWidget } from './widgets/DataSourceWidget.js';
import { DataModelWidget } from './widgets/DataModelWidget.js';
import { ProcessingBlockWidget } from './widgets/ProcessingBlockWidget.js';
import { RelationshipWidget } from './widgets/RelationshipWidget.js';
import { FormulaWidget } from './widgets/FormulaWidget.js';
import { eventBus } from './core/EventBus.js';
import PropertiesPanel from './PropertiesPanel.jsx';
import ConnectionsOverlay from './ConnectionsOverlay.jsx';
import { dataModelService } from '../../../services/dataModelService';
import { persistWorkspaceState } from './widgetDbSync.js';
import {
  persistMissingWidgetDataCode,
  pruneEditorSessionForDeletedWidgets,
} from './widgetDataCodeState.js';
import CompileFileStagingModal from './CompileFileStagingModal.jsx';
import DatacodeEditorModal from './DatacodeEditorModal.jsx';
import {
  buildCompileFilesPayload,
  buildCompileSmbPayload,
  collectLocalFileRequirements,
  waitForFileParseIdle,
} from './compileFileUtils.js';
import {
  applyFkCheckWarningsToWidgets,
  parseFkCheckWarnings,
} from './fkCheckWarning.js';

const WORKSPACE_AUTOSAVE_MS = 8000;
import {
  IconDataSource,
  IconDataModel,
  IconFilter,
  IconTransform,
  IconJoin,
  IconFormula,
  IconAggregate,
  IconRelationship,
} from './WidgetPanelIcons';
import styles from './DataModelWorkspace.module.css';
import { usePanelResize } from './usePanelResize.js';
import DataModelAiAssistant from './DataModelAiAssistant.jsx';

const DataModelWorkspace = ({ onSave, initialData, modelName, onBack, onSaveAndExit, modelId }) => {
  const viewportRef = useRef(null);
  const workspaceRef = useRef(null);
  const engineRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  
  // Отладочный эффект для отслеживания изменений zoom
  useEffect(() => {
      }, [zoom]);

  // Дополнительная синхронизация zoom через периодическую проверку
  // Это гарантирует, что UI всегда синхронизирован с ViewportController
  // Используется как fallback, если события не доходят
  useEffect(() => {
    if (!engineRef.current) return;

    const syncInterval = setInterval(() => {
      if (engineRef.current && engineRef.current.viewportController) {
        const currentZoom = engineRef.current.viewportController.zoom;
        setZoom(prevZoom => {
          // Обновляем только если значение действительно изменилось
          if (Math.abs(prevZoom - currentZoom) > 0.001) {
                        return currentZoom;
          }
          return prevZoom;
        });
      }
    }, 200); // Проверяем каждые 200мс для баланса между отзывчивостью и производительностью

    return () => clearInterval(syncInterval);
  }, []);
  const [compileModalOpen, setCompileModalOpen] = useState(false);
  const [compileStagingOpen, setCompileStagingOpen] = useState(false);
  const [compileStagingRequirements, setCompileStagingRequirements] = useState([]);
  const [compileLoading, setCompileLoading] = useState(false);
  const [compileResult, setCompileResult] = useState(null);
  const [compileError, setCompileError] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewCode, setPreviewCode] = useState('');
  const [previewError, setPreviewError] = useState(null);
  const [previewWidgetIds, setPreviewWidgetIds] = useState([]);
  const [datacodeEditorOpen, setDatacodeEditorOpen] = useState(false);
  const [datacodeEditorContext, setDatacodeEditorContext] = useState({
    selectedWidgetId: null,
    runtimeOverrides: null,
  });
  const [datacodeEditorRefreshKey, setDatacodeEditorRefreshKey] = useState(0);
  const [datacodeSessionEpoch, setDatacodeSessionEpoch] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingExit, setSavingExit] = useState(false);
  const [engineReady, setEngineReady] = useState(false);

  const {
    leftWidth,
    rightWidth,
    startResizeLeft,
    startResizeRight,
    resizing,
  } = usePanelResize();

  // Инициализация движка (только один раз)
  useEffect(() => {
    if (!viewportRef.current || !workspaceRef.current) {
      console.warn('[DataModelWorkspace] Refs not ready');
      return;
    }

    // Если движок уже создан, не создаем заново
    if (engineRef.current) {
      return;
    }

    // Создаем движок
    const engine = new WorkspaceEngine(viewportRef.current, workspaceRef.current);
    engineRef.current = engine;
    setEngineReady(true);

    // Синхронизируем начальное значение zoom
    const initialZoom = engine.viewportController.zoom;
    if (initialZoom !== 1) {
      setZoom(initialZoom);
    }

    // Регистрируем виджеты
    engine.registerWidget('data-source', DataSourceWidget);
    engine.registerWidget('data-model', DataModelWidget);
    engine.registerWidget('processing-block', ProcessingBlockWidget);
    engine.registerWidget('relationship', RelationshipWidget);
    engine.registerWidget('formula', FormulaWidget);

    // Подписка на события zoom
    const unsubscribeZoom = eventBus.on('viewport:zoom', (data) => {
            // Обрабатываем разные форматы данных события
      let zoomValue = null;
      
      if (data && typeof data === 'object' && 'zoom' in data) {
        zoomValue = data.zoom;
      } else if (typeof data === 'number') {
        zoomValue = data;
      }
      
            
      if (typeof zoomValue === 'number' && !isNaN(zoomValue)) {
        // Обновляем состояние напрямую, без requestAnimationFrame
        // Это гарантирует немедленное обновление UI
        setZoom(prevZoom => {
          const newZoom = zoomValue;
          if (Math.abs(prevZoom - newZoom) > 0.0001) {
                      }
          return newZoom;
        });
      } else {
        console.warn('[DataModelWorkspace] Invalid zoom value in event:', data, 'Type:', typeof data);
      }
    });

    // Старые подписки на сохранение удалены - теперь используется автоматическое сохранение

    return () => {
      unsubscribeZoom();
    };
  }, []);

  // Загрузка initialData только при первом открытии / смене снимка (не после автосохранения в БД)
  useEffect(() => {
    if (!engineRef.current || !initialData) {
      return;
    }

    let fingerprint = '';
    try {
      fingerprint = JSON.stringify(initialData);
    } catch (error) {
      console.error('[DataModelWorkspace] Failed to fingerprint initial data:', error);
      return;
    }

    if (importedInitialDataRef.current === fingerprint) {
      return;
    }

    try {
      engineRef.current.importJSON(fingerprint);
      importedInitialDataRef.current = fingerprint;
      setTimeout(() => {
        const currentZoom = engineRef.current?.viewportController?.zoom;
        if (typeof currentZoom === 'number') {
          setZoom(currentZoom);
        }
      }, 150);
    } catch (error) {
      console.error('[DataModelWorkspace] Failed to reload initial data:', error);
    }
  }, [initialData]);

  const workspaceDirtyRef = useRef(false);
  const isFlushingRef = useRef(false);
  const importedInitialDataRef = useRef(null);

  const markWorkspaceDirty = useCallback(() => {
    workspaceDirtyRef.current = true;
    setHasUnsavedChanges(true);
  }, []);

  const flushWorkspaceToDatabase = useCallback(async ({ force = false } = {}) => {
    if (!modelId || !engineRef.current || isFlushingRef.current) return;
    if (!force && !workspaceDirtyRef.current) return;

    isFlushingRef.current = true;
    try {
      const state = engineRef.current.getState();
      if (onSave) {
        await onSave(state);
      } else {
        await persistWorkspaceState(modelId, state);
      }
      workspaceDirtyRef.current = false;
      setHasUnsavedChanges(false);
          } catch (error) {
      console.error('[DataModelWorkspace] Error saving workspace:', error);
      throw error;
    } finally {
      isFlushingRef.current = false;
    }
  }, [modelId, onSave]);

  // Периодическое сохранение (каждые 8 с), только если были изменения
  useEffect(() => {
    if (!modelId) return undefined;

    const intervalId = setInterval(() => {
      void flushWorkspaceToDatabase();
    }, WORKSPACE_AUTOSAVE_MS);

    return () => clearInterval(intervalId);
  }, [modelId, flushWorkspaceToDatabase]);

  // Отмечаем workspace «грязным» при изменениях (без немедленного сохранения)
  useEffect(() => {
    if (!engineRef.current) return undefined;

    const markDirty = () => markWorkspaceDirty();
    const unsubMove = eventBus.on('widget:move-end', markDirty);
    const unsubResize = eventBus.on('widget:resize-end', markDirty);
    const unsubSettings = eventBus.on('widget:settings:changed', markDirty);
    const unsubAdd = eventBus.on('widget:added', markDirty);
    const unsubDel = eventBus.on('widget:deleted', markDirty);
    const unsubConnAdd = eventBus.on('connection:added', markDirty);
    const unsubConnDel = eventBus.on('connection:deleted', markDirty);
    const unsubConnSettings = eventBus.on('connection:settings:changed', markDirty);

    return () => {
      unsubMove();
      unsubResize();
      unsubSettings();
      unsubAdd();
      unsubDel();
      unsubConnAdd();
      unsubConnDel();
      unsubConnSettings();
    };
  }, [markWorkspaceDirty]);

  // Автоматическое сохранение при удалении виджета
  useEffect(() => {
    if (!engineRef.current || !modelId) return;
    
    const unsubscribeDelete = eventBus.on('widget:deleted', async ({ widgetId }) => {
      // Проверяем, что это числовой ID из БД
      const id = typeof widgetId === 'number' 
        ? widgetId 
        : (typeof widgetId === 'string' && /^\d+$/.test(widgetId) ? parseInt(widgetId, 10) : null);
      
      if (!id) {
        console.warn('[DataModelWorkspace] Widget has no DB ID, cannot delete from DB');
        return;
      }
      
      try {
        await dataModelService.deleteDataModelWidget(modelId, id);
        await pruneEditorSessionForDeletedWidgets(modelId, [id]);
        setDatacodeEditorRefreshKey((key) => key + 1);
        setDatacodeSessionEpoch((key) => key + 1);
      } catch (error) {
        console.error('[DataModelWorkspace] Error deleting widget from DB:', error);
      }
    });
    
    return () => {
      unsubscribeDelete();
    };
  }, [modelId]);

  const handleBack = async () => {
    if (!onBack) return;
    try {
      await flushWorkspaceToDatabase({ force: true });
    } catch (error) {
      console.error('[DataModelWorkspace] Save before back failed:', error);
    }
    onBack();
  };

  const handleSaveAndExit = async () => {
    if (savingExit) return;
    setSavingExit(true);
    try {
      await flushWorkspaceToDatabase({ force: true });
      if (onSaveAndExit) {
        await onSaveAndExit(engineRef.current?.getState?.() || null);
      } else if (onBack) {
        onBack();
      }
    } catch (error) {
      console.error('[DataModelWorkspace] Save and exit failed:', error);
    } finally {
      setSavingExit(false);
    }
  };

  const handleAddWidget = async (type, config = {}) => {
    if (!engineRef.current) {
      console.warn('[DataModelWorkspace] Engine not initialized');
      return;
    }

    if (!modelId) {
      console.warn('[DataModelWorkspace] modelId not available, widget will be created locally');
      // Можно показать уведомление пользователю
    }

    const viewport = viewportRef.current;
    if (!viewport) {
      console.warn('[DataModelWorkspace] Viewport ref not available');
      return;
    }
    
    const viewportRect = viewport.getBoundingClientRect();
    const centerX = viewportRect.width / 2;
    const centerY = viewportRect.height / 2;

    const workspacePos = engineRef.current.viewportController.viewportToWorkspace(centerX, centerY);

    try {
      // Если modelId доступен, создаем виджет в БД сразу
      if (modelId) {
        const widgetData = {
          widget_type: type,
          widget_config: {
            ...(config.config || {}),
            settings: config.settings || {},
            styles: config.styles || {}
          },
          data_source: config.dataSource || null,
          data_config: config.dataConfig || {},
          position_x: workspacePos.x - 125,
          position_y: workspacePos.y - 75,
          width: config.width || 250,
          order_index: 0, // Будет обновлено при сохранении
          is_visible: true,
          refresh_interval: config.refreshInterval || 60
        };

        const createdWidget = await dataModelService.createDataModelWidget(modelId, widgetData);
        // Ширина в API и на канвасе хранится в пикселях.
        const defaultPixelWidths = { 'data-source': 250, 'data-model': 320, 'processing-block': 250, 'formula': 350, 'relationship': 200 };
        const pixelWidth = defaultPixelWidths[type] ?? 250;
        const widget = engineRef.current.addWidget(type, {
          id: createdWidget.id,
          x: createdWidget.position_x,
          y: createdWidget.position_y,
          width: pixelWidth,
          ...config
        });
        markWorkspaceDirty();
        
        return widget;
      } else {
        // Fallback: создаем виджет локально, если modelId недоступен
        return engineRef.current.addWidget(type, {
          x: workspacePos.x - 125,
          y: workspacePos.y - 75,
          ...config
        });
      }
    } catch (error) {
      console.error('[DataModelWorkspace] Error creating widget in DB, creating locally:', error);
      // Fallback: создаем виджет локально при ошибке
      return engineRef.current.addWidget(type, {
        x: workspacePos.x - 125,
        y: workspacePos.y - 75,
        ...config
      });
    }
  };

  const canCompileModel = Boolean(modelId && !compileLoading);

  const compileButtonTitle = useMemo(() => {
    if (compileLoading) return 'Выполняется компиляция…';
    if (!modelId) {
      return 'Сохраните модель данных — без идентификатора модели компиляция недоступна.';
    }
    return 'Скомпилировать объединённый Datacode всех виджетов на листе';
  }, [modelId, compileLoading]);

  const runCompileWithPayload = async (requirements, fileAssignments = {}) => {
    if (!modelId || compileLoading) return;
    setCompileModalOpen(true);
    setCompileLoading(true);
    setCompileError(null);
    setCompileResult(null);
    applyFkCheckWarningsToWidgets(
      engineRef.current?.widgetManager?.getAllWidgets?.() || [],
      '',
    );
    try {
      await waitForFileParseIdle();
      await flushWorkspaceToDatabase({ force: true });

      const widgets = engineRef.current?.widgetManager?.getAllWidgets?.() || [];
      await persistMissingWidgetDataCode(
        modelId,
        widgets,
        engineRef.current?.widgetManager,
      );
      const liveRequirements = collectLocalFileRequirements(widgets);
      const effectiveRequirements = (requirements?.length ? requirements : liveRequirements);

      for (const req of effectiveRequirements) {
        const file = fileAssignments[req.fileName] || req.file;
        if (!file) continue;
        const w = widgets.find((item) => item.id === req.widgetId);
        if (w?.settings?.selectedFile) {
          w.settings.selectedFile.file = file;
        }
      }

      const reqsWithFiles = effectiveRequirements.map((r) => {
        const live = liveRequirements.find((item) => item.fileName === r.fileName);
        return {
          ...r,
          file: fileAssignments[r.fileName] || live?.file || r.file,
        };
      });
      const files = await buildCompileFilesPayload(reqsWithFiles, fileAssignments);
      const smb_connections = buildCompileSmbPayload(widgets);

      const res = await dataModelService.compileModel(modelId, {
        files: files.length ? files : undefined,
        smb_connections: smb_connections.length ? smb_connections : undefined,
      });
      setCompileResult(res);
      applyFkCheckWarningsToWidgets(widgets, res?.data?.warning || res?.warning);
      if (!res.success) {
        setCompileError(res.error || 'Ошибка выполнения Datacode');
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : detail
            ? JSON.stringify(detail)
            : err.message || 'Запрос не выполнен';
      setCompileError(msg);
    } finally {
      setCompileLoading(false);
      setCompileStagingOpen(false);
    }
  };

  const handleCompileModel = async () => {
    if (!modelId || compileLoading) return;

    const widgets = engineRef.current?.widgetManager?.getAllWidgets?.() || [];
    const requirements = collectLocalFileRequirements(widgets);
    const missing = requirements.filter((r) => !r.hasFileInMemory);

    if (missing.length > 0) {
      setCompileStagingRequirements(requirements);
      setCompileStagingOpen(true);
      return;
    }

    setCompileStagingRequirements(requirements);
    await runCompileWithPayload(
      requirements,
      Object.fromEntries(
        requirements.filter((r) => r.file).map((r) => [r.fileName, r.file]),
      ),
    );
  };

  const handleStagingConfirm = async (assignments) => {
    await runCompileWithPayload(compileStagingRequirements, assignments);
  };

  const handleOpenDataCodeEditor = useCallback((context = {}) => {
    setDatacodeEditorContext({
      selectedWidgetId: context.selectedWidgetId ?? null,
      runtimeOverrides: context.runtimeOverrides ?? null,
    });
    setDatacodeEditorOpen(true);
  }, []);

  const handleDataCodeSaved = useCallback(() => {
    setDatacodeEditorRefreshKey((key) => key + 1);
  }, []);

  const previewDatacodeTitle = useMemo(() => {
    if (!modelId) {
      return 'Сохраните модель данных — без идентификатора предпросмотр недоступен.';
    }
    if (previewLoading) {
      return 'Загрузка склеенного Datacode…';
    }
    return 'Показать итоговый Datacode, который будет отправлен в движок при нажатии «Скомпилировать модель»';
  }, [modelId, previewLoading]);

  const canPreviewDatacode = Boolean(modelId && !previewLoading);

  const compileFkIssues = useMemo(
    () => parseFkCheckWarnings(compileResult?.data?.warning || compileResult?.warning),
    [compileResult],
  );

  const handlePreviewMergedDatacode = async () => {
    if (!modelId || previewLoading) return;
    setPreviewModalOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewCode('');
    setPreviewWidgetIds([]);
    try {
      await flushWorkspaceToDatabase({ force: true });
      const widgets = engineRef.current?.widgetManager?.getAllWidgets?.() || [];
      await persistMissingWidgetDataCode(
        modelId,
        widgets,
        engineRef.current?.widgetManager,
      );
      const res = await dataModelService.previewCompileModel(modelId);
      setPreviewCode(res.merged_code || '');
      setPreviewWidgetIds(Array.isArray(res.merged_widget_ids) ? res.merged_widget_ids : []);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : detail
            ? JSON.stringify(detail)
            : err.message || 'Запрос не выполнен';
      setPreviewError(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCopyPreviewCode = async () => {
    if (!previewCode) return;
    try {
      await navigator.clipboard.writeText(previewCode);
    } catch (e) {
      console.warn('[DataModelWorkspace] Clipboard write failed:', e);
    }
  };

  const handleZoomChange = (e) => {
    const newZoom = parseFloat(e.target.value);
    // Обновляем состояние сразу для немедленного отображения
    setZoom(newZoom);
    if (engineRef.current) {
      engineRef.current.viewportController.setZoom(newZoom);
    }
  };

  return (
    <div className={styles.workspaceContainer}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        {(onBack || onSaveAndExit) && (
          <div className={styles.toolbarSection}>
            {onBack && (
              <button
                type="button"
                onClick={handleBack}
                className={styles.btn}
                disabled={savingExit}
              >
                ← Назад
              </button>
            )}
            {hasUnsavedChanges && (onSaveAndExit || onBack) && (
              <button
                type="button"
                onClick={handleSaveAndExit}
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={savingExit}
                title="Сохранить изменения на полотне и выйти"
              >
                {savingExit ? 'Сохранение…' : 'Сохранить и выйти'}
              </button>
            )}
          </div>
        )}
        <div className={styles.toolbarSection}>
          <label>Масштаб:</label>
          <input 
            type="range" 
            min="0.1" 
            max="3" 
            step="0.1" 
            value={zoom || 1}
            onChange={handleZoomChange}
            className={styles.zoomSlider}
          />
          <span>{Math.round((zoom || 1) * 100)}%</span>
        </div>
        <div className={`${styles.toolbarSection} ${styles.toolbarCompile}`}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => handleOpenDataCodeEditor()}
            title="Открыть редактор DataCode со всеми вкладками виджетов"
          >
            Datacode
          </button>
          <span
            className={styles.btnTooltipWrap}
            data-tooltip={!canCompileModel ? compileButtonTitle : undefined}
          >
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={!canCompileModel}
              title={canCompileModel ? compileButtonTitle : undefined}
              onClick={handleCompileModel}
            >
              {compileLoading ? 'Компиляция…' : 'Скомпилировать модель'}
            </button>
          </span>
        </div>
      </div>

      <div className={styles.workspaceWrapper}>
        {/* Widget Panel */}
        <div className={styles.leftPanelColumn} style={{ width: leftWidth }}>
          <div className={styles.widgetPanel}>
            <h3>Виджеты</h3>
            <div className={styles.widgetList}>
            <div className={styles.widgetSectionLabel}>Обязательные</div>
            <div 
              className={styles.widgetItem}
              onClick={() => handleAddWidget('data-source', {
                settings: { name: 'Новый источник', sourceType: 'file' }
              })}
            >
              <span className={styles.widgetItemRow}>
                <IconDataSource className={styles.widgetItemIcon} />
                <span>Источник данных</span>
              </span>
            </div>
            <div className={styles.widgetSectionLabel}>Остальные</div>
            <div
              className={styles.widgetItem}
              onClick={() => handleAddWidget('data-model', {
                settings: {
                  name: 'Модель данных',
                  sourceModelId: null,
                  sourceModelName: '',
                  selectedTables: [],
                }
              })}
            >
              <span className={styles.widgetItemRow}>
                <IconDataModel className={styles.widgetItemIcon} />
                <span>Модель данных</span>
              </span>
            </div>
            <div 
              className={styles.widgetItem}
              onClick={() => handleAddWidget('processing-block', {
                settings: { name: 'Фильтр', blockType: 'filter' }
              })}
            >
              <span className={styles.widgetItemRow}>
                <IconFilter className={styles.widgetItemIcon} />
                <span>Фильтр</span>
              </span>
            </div>
            <div 
              className={styles.widgetItem}
              onClick={() => handleAddWidget('processing-block', {
                settings: { name: 'Трансформация', blockType: 'transform' }
              })}
            >
              <span className={styles.widgetItemRow}>
                <IconTransform className={styles.widgetItemIcon} />
                <span>Трансформация</span>
              </span>
            </div>
            <div
              className={styles.widgetItem}
              onClick={() => handleAddWidget('processing-block', {
                settings: {
                  name: 'Объединение',
                  blockType: 'join',
                  joinMode: 'join',
                  joinType: 'left',
                  joinSeparateOutput: true,
                  joinSteps: [],
                },
              })}
            >
              <span className={styles.widgetItemRow}>
                <IconJoin className={styles.widgetItemIcon} />
                <span>Объединение</span>
              </span>
            </div>
            <div 
              className={styles.widgetItem}
              onClick={() => handleAddWidget('formula', {
                settings: { name: 'Формула' }
              })}
            >
              <span className={styles.widgetItemRow}>
                <IconFormula className={styles.widgetItemIcon} />
                <span>Формула</span>
              </span>
            </div>
            <div 
              className={styles.widgetItem}
              onClick={() => handleAddWidget('processing-block', {
                settings: { name: 'Агрегация', blockType: 'aggregate' }
              })}
            >
              <span className={styles.widgetItemRow}>
                <IconAggregate className={styles.widgetItemIcon} />
                <span>Агрегация</span>
              </span>
            </div>
            <div 
              className={styles.widgetItem}
              onClick={() => handleAddWidget('relationship', {
                settings: { name: 'Связь', relationshipType: 'one-to-many' }
              })}
            >
              <span className={styles.widgetItemRow}>
                <IconRelationship className={styles.widgetItemIcon} />
                <span>Связь</span>
              </span>
            </div>
          </div>
          </div>
          <div
            className={`${styles.panelResizeHandle} ${resizing === 'left' ? styles.panelResizeHandleActive : ''}`}
            onMouseDown={startResizeLeft}
            role="separator"
            aria-orientation="vertical"
            aria-label="Изменить ширину панели виджетов"
            title="Потяните для изменения ширины"
          />
        </div>

        {/* Viewport */}
        <div ref={viewportRef} className={styles.viewport}>
          <div ref={workspaceRef} className={styles.workspace}></div>
          <ConnectionsOverlay 
            workspaceRef={workspaceRef}
            viewportRef={viewportRef}
            engineRef={engineRef}
            engineReady={engineReady}
          />
        </div>

        {/* Properties Panel */}
        <div className={styles.rightPanelColumn} style={{ width: rightWidth }}>
          <div
            className={`${styles.panelResizeHandle} ${resizing === 'right' ? styles.panelResizeHandleActive : ''}`}
            onMouseDown={startResizeRight}
            role="separator"
            aria-orientation="vertical"
            aria-label="Изменить ширину панели свойств"
            title="Потяните для изменения ширины"
          />
          <div className={styles.rightPanelInner}>
            <PropertiesPanel
              engineRef={engineRef}
              modelId={modelId}
              onOpenDataCodeEditor={handleOpenDataCodeEditor}
              dataCodeStatusRefreshKey={datacodeEditorRefreshKey}
            />
          </div>
        </div>

        <DataModelAiAssistant
          engineRef={engineRef}
          modelId={modelId}
          modelName={modelName}
          onAddWidget={handleAddWidget}
          onPersistWorkspace={() => flushWorkspaceToDatabase({ force: true })}
          onCompileModel={handleCompileModel}
          onPreviewDatacode={handlePreviewMergedDatacode}
        />
      </div>

      {/* DataCode Editor (полноэкранный, из тулбара) */}
      <DatacodeEditorModal
        isOpen={datacodeEditorOpen}
        onClose={() => setDatacodeEditorOpen(false)}
        engineRef={engineRef}
        modelId={modelId}
        selectedWidgetId={datacodeEditorContext.selectedWidgetId}
        runtimeOverrides={datacodeEditorContext.runtimeOverrides}
        sessionEpoch={datacodeSessionEpoch}
        onCodeSaved={handleDataCodeSaved}
      />

      {previewModalOpen && (
        <div
          className={styles.compileModalOverlay}
          onClick={() => setPreviewModalOpen(false)}
          role="presentation"
        >
          <div
            className={`${styles.compileModal} ${styles.compileModalWide}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-datacode-title"
          >
            <h3 id="preview-datacode-title">Итоговый Datacode для компиляции</h3>
            <p className={styles.compileMeta} style={{ marginTop: 0 }}>
              Тот же текст, что сервер склеивает из вкладок виджетов и передаёт в движок (файлы модели по-прежнему подмешиваются при выполнении отдельно).
            </p>
            {previewLoading && (
              <p className={styles.compileMeta}>Загрузка…</p>
            )}
            {previewError && (
              <div className={styles.compileError}>{previewError}</div>
            )}
            {previewWidgetIds.length > 0 && !previewLoading && !previewError && (
              <p className={styles.compileMeta}>
                Виджеты в сборке (id): {previewWidgetIds.join(', ')}
              </p>
            )}
            <pre className={`${styles.compileOutput} ${styles.compileOutputTall}`}>
              {previewLoading && !previewCode && !previewError
                ? '…'
                : previewCode || (previewError ? '' : '(пусто)')}
            </pre>
            <div className={styles.compileModalActions}>
              <button
                type="button"
                className={styles.btn}
                disabled={!previewCode || previewLoading}
                onClick={handleCopyPreviewCode}
              >
                Копировать
              </button>
              <button
                type="button"
                className={styles.btn}
                onClick={() => setPreviewModalOpen(false)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {compileStagingOpen && (
        <CompileFileStagingModal
          isOpen={compileStagingOpen}
          requirements={compileStagingRequirements}
          loading={compileLoading}
          onCancel={() => {
            if (!compileLoading) setCompileStagingOpen(false);
          }}
          onConfirm={handleStagingConfirm}
        />
      )}

      {compileModalOpen && (
        <div
          className={styles.compileModalOverlay}
          onClick={() => {
            if (!compileLoading) setCompileModalOpen(false);
          }}
          role="presentation"
        >
          <div
            className={styles.compileModal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="compile-modal-title"
          >
            <h3 id="compile-modal-title">Результат компиляции модели</h3>
            {compileLoading && (
              <p className={styles.compileMeta}>Выполнение склеенного Datacode…</p>
            )}
            {compileError && (
              <div className={styles.compileError}>{compileError}</div>
            )}
            {compileResult?.file_upload_warnings?.length > 0 && (
              <ul className={styles.compileWarnings}>
                {compileResult.file_upload_warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            {compileFkIssues.length > 0 && (
              <ul className={styles.compileWarnings}>
                {compileFkIssues.map((issue) => (
                  <li key={`${issue.childTable}.${issue.childColumn}-${issue.parentTable}`}>
                    {`Связь ${issue.childTable}.${issue.childColumn} → ${issue.parentTable}.${issue.parentColumn}: ${issue.orphans} сирот. После фильтрации/обработки набор ключей неполный — отфильтруйте потомка или исправьте обработку.`}
                  </li>
                ))}
              </ul>
            )}
            {compileResult?.data?.warning && (
              <div className={styles.compileHint}>{compileResult.data.warning}</div>
            )}
            {compileResult?.merged_widget_ids?.length > 0 && (
              <p className={styles.compileMeta}>
                Виджеты в сборке (id): {compileResult.merged_widget_ids.join(', ')}
              </p>
            )}
            {compileResult?.execution_id && (
              <p className={styles.compileMeta}>
                execution_id: {compileResult.execution_id}
              </p>
            )}
            {compileResult?.data?.datacode_sqlite_hint && !compileResult?.data?.sqlite_saved && (
              <p className={styles.compileHint}>
                {compileResult.data.datacode_sqlite_hint}
              </p>
            )}
            <pre className={styles.compileOutput}>
              {compileLoading
                ? '…'
                : compileResult?.output != null && String(compileResult.output).length > 0
                  ? compileResult.output
                  : '(нет вывода)'}
            </pre>
            <div className={styles.compileModalActions}>
              <button
                type="button"
                className={styles.btn}
                disabled={compileLoading}
                onClick={() => setCompileModalOpen(false)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataModelWorkspace;
