import { ViewportController } from './ViewportController.js';
import { WidgetManager } from './WidgetManager.js';
import { HistoryManager } from './HistoryManager.js';
import { Serializer } from './Serializer.js';
import { eventBus } from './EventBus.js';
import { normalizeConnection } from '../widgetIdUtils.js';
import { syncAllConnectionFieldsFromUpstream } from '../connectionSettingsUtils.js';

/**
 * WorkspaceEngine - Главный движок рабочего пространства моделей данных
 */
export class WorkspaceEngine {
    constructor(viewportElement, workspaceElement) {
        this.viewport = viewportElement;
        this.workspace = workspaceElement;
        
        // Инициализация компонентов
        this.viewportController = new ViewportController(this.viewport, this.workspace);
        this.widgetManager = new WidgetManager(this.workspace, this.viewportController);
        this.historyManager = new HistoryManager();
        this.serializer = Serializer;
        
        // Режим работы
        this.mode = 'editor'; // 'editor' | 'viewer'
        
        // Регистр классов виджетов
        this.widgetClasses = {};
        
        this.init();
    }

    init() {
        // Подписка на события для сохранения истории
        eventBus.on('widget:move-end', () => {
            this.saveSnapshot();
        });
        
        eventBus.on('widget:resize-end', () => {
            this.saveSnapshot();
        });
        
        eventBus.on('widget:added', () => {
            this.saveSnapshot();
        });
        
        eventBus.on('widget:deleted', () => {
            this.saveSnapshot();
        });
        
        eventBus.on('connection:added', () => {
            this.saveSnapshot();
        });
        
        eventBus.on('connection:deleted', () => {
            this.saveSnapshot();
        });
        
        // Обработка клавиатурных сокращений
        this.setupKeyboardShortcuts();
    }

    /**
     * Настройка клавиатурных сокращений
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Проверяем, не редактируется ли текст в input/textarea
            const activeElement = document.activeElement;
            const isEditingText = activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.tagName === 'SELECT' ||
                activeElement.isContentEditable
            );
            
            // Undo/Redo (работают всегда, кроме случаев редактирования текста)
            if (!isEditingText) {
                if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    this.undo();
                    return;
                }
                
                if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                    e.preventDefault();
                    this.redo();
                    return;
                }
            }
            
            // Удаление выделенных виджетов (только если не редактируется текст)
            if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditingText) {
                const selected = this.widgetManager.getSelectedWidgets();
                if (selected.length > 0) {
                    e.preventDefault();
                    selected.forEach(widget => {
                        this.widgetManager.deleteWidget(widget.id);
                    });
                }
            }
        });
    }

    /**
     * Регистрация класса виджета
     */
    registerWidget(type, WidgetClass) {
        this.widgetClasses[type] = WidgetClass;
    }

    /**
     * Добавление виджета
     */
    addWidget(type, config = {}) {
        const WidgetClass = this.widgetClasses[type];
        if (!WidgetClass) {
            console.error(`Widget type "${type}" is not registered. Available types:`, Object.keys(this.widgetClasses));
            throw new Error(`Widget type "${type}" is not registered.`);
        }
        
        const widget = new WidgetClass(config);
        return this.widgetManager.addWidget(widget);
    }

    /**
     * Сохранение снимка состояния
     */
    saveSnapshot() {
        const state = {
            workspace: this.viewportController.getState(),
            widgets: this.widgetManager.toJSON()
        };
        this.historyManager.saveSnapshot(state);
    }

    /**
     * Отменить последнее действие
     */
    undo() {
        const state = this.historyManager.undo();
        if (state && state.state) {
            this.restoreState(state.state);
        }
    }

    /**
     * Повторить отменённое действие
     */
    redo() {
        const state = this.historyManager.redo();
        if (state && state.state) {
            this.restoreState(state.state);
        }
    }

    /**
     * Восстановление состояния
     */
    restoreState(state) {
        if (state.workspace) {
            this.viewportController.setState(state.workspace);
        }
        
        if (state.widgets) {
            this.widgetManager.fromJSON(state.widgets, this.widgetClasses);
        }
    }

    /**
     * Экспорт в JSON
     */
    exportJSON() {
        const modelData = {
            workspace: this.viewportController.getState(),
            widgets: this.widgetManager.toJSON(),
            connections: this.getAllConnections(),
            metadata: {
                name: 'Data Model',
                createdAt: new Date().toISOString()
            }
        };
        
        return this.serializer.exportJSON(modelData);
    }

    /**
     * Импорт из JSON
     */
    importJSON(jsonString) {
        try {
            const modelData = this.serializer.importJSON(jsonString);
            
            if (modelData.workspace) {
                this.viewportController.setState(modelData.workspace);
            }
            
            if (modelData.widgets) {
                this.widgetManager.fromJSON(modelData.widgets, this.widgetClasses);
            }
            
            // Восстанавливаем соединения после загрузки виджетов
            if (modelData.connections && Array.isArray(modelData.connections)) {
                setTimeout(() => {
                    modelData.connections.forEach(conn => {
                        const normalized = normalizeConnection(conn);
                        const fromWidget = this.widgetManager.getWidget(normalized.from);
                        const toWidget = this.widgetManager.getWidget(normalized.to);
                        if (fromWidget && toWidget) {
                            // Проверяем, нет ли уже такого соединения
                            const existing = fromWidget.connections.find(c => c.id === normalized.id);
                            if (!existing) {
                                fromWidget.addConnection(normalized);
                                toWidget.addConnection(normalized);
                            }
                        }
                    });
                    syncAllConnectionFieldsFromUpstream(this.widgetManager);
                    eventBus.emit('connections:loaded', { connections: modelData.connections });
                }, 100);
            }
            
            this.historyManager.clear();
            
            eventBus.emit('model:loaded', { modelData });
        } catch (error) {
            console.error('Failed to import model:', error);
            eventBus.emit('model:load-error', { error });
        }
    }

    /**
     * Получить все соединения
     */
    getAllConnections() {
        const connections = [];
        const widgets = this.widgetManager.getAllWidgets();
        
        widgets.forEach(widget => {
            widget.connections.forEach(conn => {
                if (!connections.find(c => c.id === conn.id)) {
                    connections.push(conn);
                }
            });
        });
        
        return connections;
    }

    /**
     * Установка режима работы
     */
    setMode(mode) {
        this.mode = mode;
        eventBus.emit('mode:changed', { mode });
    }

    /**
     * Получить текущее состояние
     */
    getState() {
        return {
            workspace: this.viewportController.getState(),
            widgets: this.widgetManager.toJSON(),
            connections: this.getAllConnections(),
            mode: this.mode
        };
    }
}
