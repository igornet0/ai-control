import { eventBus } from './EventBus.js';
import { WidgetBase } from './WidgetBase.js';
import { buildDefaultConnectionSettings } from '../connectionSettingsUtils.js';
import { normalizeConnection, widgetIdsEqual } from '../widgetIdUtils.js';

/**
 * WidgetManager - Управление виджетами на workspace моделей данных
 */
export class WidgetManager {
    constructor(workspaceElement, viewportController) {
        this.workspace = workspaceElement;
        this.viewportController = viewportController;
        this.widgets = new Map();
        
        // Состояние для drag & drop
        this.dragging = false;
        this.dragWidget = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartWidgetX = 0;
        this.dragStartWidgetY = 0;
        
        // Состояние для resize
        this.resizing = false;
        this.resizeWidget = null;
        this.resizeDirection = null;
        this.resizeStartX = 0;
        this.resizeStartY = 0;
        this.resizeStartWidth = 0;
        this.resizeStartHeight = 0;
        this.resizeStartWidgetX = 0;
        this.resizeStartWidgetY = 0;
        
        // Состояние для соединений
        this.connecting = false;
        this.connectionStartWidget = null;
        this.connectionStartHandle = null;
        
        // Выделенные виджеты
        this.selectedWidgets = new Set();
        
        // Snap к сетке
        this.snapToGrid = true;
        this.gridSize = 20;
        
        // Двойной клик ПКМ по виджету — удаление
        this.lastRightClickWidgetId = null;
        this.lastRightClickTime = 0;
        this.rightDblClickMs = 400;
        
        this.init();
    }

    init() {
        // Обработка кликов на workspace
        this.workspace.addEventListener('mousedown', (e) => {
            this.handleWorkspaceMouseDown(e);
        });
        document.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });
        document.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        });
        
        // Предотвращение контекстного меню
        this.workspace.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /**
     * Обработка клика на workspace
     */
    handleWorkspaceMouseDown(e) {
        if (e.button === 1 || this.viewportController?.isPanning) {
            return;
        }
        
        // Проверяем клик по connection handle
        const connectionHandle = e.target.closest('.connection-handle');
        if (connectionHandle) {
            e.preventDefault();
            e.stopPropagation();
            this.startConnection(connectionHandle);
            return;
        }
        
        // Проверяем клик по resize handle
        const resizeHandle = e.target.closest('.resize-handle');
        if (resizeHandle) {
            const widgetElement = resizeHandle.closest('.widget');
            if (widgetElement) {
                const widgetId = widgetElement.dataset.widgetId;
                // Пробуем найти по строке и по числу (если возможно)
                let widget = this.widgets.get(widgetId);
                if (!widget && !isNaN(widgetId)) {
                    widget = this.widgets.get(Number(widgetId));
                }
                if (!widget && !isNaN(widgetId)) {
                    widget = this.widgets.get(String(widgetId));
                }
                if (widget) {
                    this.startResize(widget, resizeHandle.dataset.direction, e);
                    return;
                }
            }
        }
        
        const widgetElement = e.target.closest('.widget');
        
        if (widgetElement) {
            e.stopPropagation();
            const widgetId = widgetElement.dataset.widgetId;
            let widget = this.widgets.get(widgetId);
            if (!widget && !isNaN(widgetId)) {
                widget = this.widgets.get(Number(widgetId));
            }
            if (!widget && !isNaN(widgetId)) {
                widget = this.widgets.get(String(widgetId));
            }
            
            if (widget) {
                const widgetIdStr = String(widget.id);
                // Двойной клик ПКМ — удалить виджет
                if (e.button === 2) {
                    e.preventDefault();
                    const now = Date.now();
                    if (this.lastRightClickWidgetId === widgetIdStr && (now - this.lastRightClickTime) < this.rightDblClickMs) {
                        this.lastRightClickWidgetId = null;
                        this.lastRightClickTime = 0;
                        this.deleteWidget(widgetIdStr);
                    } else {
                        this.lastRightClickWidgetId = widgetIdStr;
                        this.lastRightClickTime = now;
                    }
                    return;
                }
                if (e.button === 0) {
                    this.startDrag(widget, e);
                }
            } else {
                console.warn('[WidgetManager] Widget not found in map', widgetId, 'Available keys:', Array.from(this.widgets.keys()));
            }
        } else {
            this.deselectAll();
        }
    }

    /**
     * Начало перемещения виджета
     */
    startDrag(widget, e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.dragging = true;
        this.dragWidget = widget;
        
        const rect = this.workspace.getBoundingClientRect();
        const viewportX = e.clientX - rect.left;
        const viewportY = e.clientY - rect.top;
        const workspacePos = this.viewportController.viewportToWorkspace(viewportX, viewportY);
        
        this.dragStartX = workspacePos.x;
        this.dragStartY = workspacePos.y;
        this.dragStartWidgetX = widget.x;
        this.dragStartWidgetY = widget.y;
        
        if (!widget.selected) {
            this.deselectAll();
            this.selectWidget(widget.id);
        }
        
        widget.element.style.cursor = 'grabbing';
    }

    /**
     * Начало изменения размера виджета
     */
    startResize(widget, direction, e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.resizing = true;
        this.resizeWidget = widget;
        this.resizeDirection = direction;
        widget._isResizing = true;
        
        const rect = this.workspace.getBoundingClientRect();
        const viewportX = e.clientX - rect.left;
        const viewportY = e.clientY - rect.top;
        const workspacePos = this.viewportController.viewportToWorkspace(viewportX, viewportY);
        
        this.resizeStartX = workspacePos.x;
        this.resizeStartY = workspacePos.y;
        this.resizeStartWidth = widget.width;
        this.resizeStartHeight = widget.height;
        this.resizeStartWidgetX = widget.x;
        this.resizeStartWidgetY = widget.y;
        
        if (!widget.selected) {
            this.deselectAll();
            this.selectWidget(widget.id);
        }
    }

    /**
     * Начало создания соединения
     */
    startConnection(handle) {
        const widgetElement = handle.closest('.widget');
        if (!widgetElement) {
            console.warn('[WidgetManager] startConnection: widget element not found');
            return;
        }
        
        const widgetId = widgetElement.dataset.widgetId;
        const widget = this.getWidget(widgetId);
        if (!widget) {
            console.warn('[WidgetManager] startConnection: widget not found', widgetId);
            return;
        }
        
        const handleType = handle.dataset.type;
        if (!handleType) {
            console.warn('[WidgetManager] startConnection: handle type not found');
            return;
        }
        
                
        this.connecting = true;
        this.connectionStartWidget = widget;
        this.connectionStartHandle = handleType;
        
        // Визуальная обратная связь
        handle.classList.add('connecting');
        
        // Уведомляем о начале создания соединения
        eventBus.emit('connection:start', {
            widget: widget,
            handleType: handleType
        });
    }

    /**
     * Обработка перемещения мыши
     */
    handleMouseMove(e) {
        if (this.viewportController?.isPanning) {
            return;
        }
        
        if (this.dragging && this.dragWidget) {
            const rect = this.workspace.getBoundingClientRect();
            const viewportX = e.clientX - rect.left;
            const viewportY = e.clientY - rect.top;
            const workspacePos = this.viewportController.viewportToWorkspace(viewportX, viewportY);
            
            let newX = this.dragStartWidgetX + (workspacePos.x - this.dragStartX);
            let newY = this.dragStartWidgetY + (workspacePos.y - this.dragStartY);
            
            if (this.snapToGrid) {
                newX = Math.round(newX / this.gridSize) * this.gridSize;
                newY = Math.round(newY / this.gridSize) * this.gridSize;
            }
            
            this.dragWidget.setPosition(newX, newY);
            eventBus.emit('widget:moved', { widget: this.dragWidget });
        }
        
        if (this.resizing && this.resizeWidget) {
            const rect = this.workspace.getBoundingClientRect();
            const viewportX = e.clientX - rect.left;
            const viewportY = e.clientY - rect.top;
            const workspacePos = this.viewportController.viewportToWorkspace(viewportX, viewportY);
            
            const deltaX = workspacePos.x - this.resizeStartX;
            const deltaY = workspacePos.y - this.resizeStartY;
            
            let newWidth = this.resizeStartWidth;
            let newHeight = this.resizeStartHeight;
            let newX = this.resizeStartWidgetX;
            let newY = this.resizeStartWidgetY;
            
            const dir = this.resizeDirection;
            
            if (dir.includes('e')) newWidth = this.resizeStartWidth + deltaX;
            if (dir.includes('w')) {
                newWidth = this.resizeStartWidth - deltaX;
                newX = this.resizeStartWidgetX + deltaX;
            }
            if (dir.includes('s')) newHeight = this.resizeStartHeight + deltaY;
            if (dir.includes('n')) {
                newHeight = this.resizeStartHeight - deltaY;
                newY = this.resizeStartWidgetY + deltaY;
            }
            
            if (this.snapToGrid) {
                newWidth = Math.round(newWidth / this.gridSize) * this.gridSize;
                newHeight = Math.round(newHeight / this.gridSize) * this.gridSize;
                newX = Math.round(newX / this.gridSize) * this.gridSize;
                newY = Math.round(newY / this.gridSize) * this.gridSize;
            }
            
            this.resizeWidget.setSize(newWidth, newHeight);
            this.resizeWidget.setPosition(newX, newY);
            eventBus.emit('widget:resized', { widget: this.resizeWidget });
        }
        
        if (this.connecting) {
            // Рисуем временную линию соединения
            // Это будет обработано в компоненте React через SVG overlay
        }
    }

    /**
     * Обработка отпускания мыши
     */
    handleMouseUp(e) {
        if (this.viewportController?.isPanning) {
            if (this.dragging && this.dragWidget) {
                this.dragWidget.element.style.cursor = 'move';
                this.dragging = false;
                this.dragWidget = null;
            }
            if (this.resizing && this.resizeWidget) {
                this.resizeWidget._isResizing = false;
                this.resizing = false;
                this.resizeWidget = null;
                this.resizeDirection = null;
            }
            return;
        }
        
        if (this.dragging) {
            this.dragging = false;
            if (this.dragWidget) {
                this.dragWidget.element.style.cursor = 'move';
                eventBus.emit('widget:move-end', { widget: this.dragWidget });
            }
            this.dragWidget = null;
        }
        
        if (this.resizing) {
            this.resizing = false;
            if (this.resizeWidget) {
                this.resizeWidget._isResizing = false;
                this.resizeWidget.update();
                eventBus.emit('widget:resize-end', { widget: this.resizeWidget });
            }
            this.resizeWidget = null;
            this.resizeDirection = null;
        }
        
        if (this.connecting) {
                        
            // Проверяем клик по connection handle
            const connectionHandle = e.target.closest('.connection-handle');
            if (connectionHandle) {
                const widgetElement = connectionHandle.closest('.widget');
                if (widgetElement) {
                    const widgetId = widgetElement.dataset.widgetId;
                    const endWidget = this.getWidget(widgetId);
                    const endHandleType = connectionHandle.dataset.type;
                    
                                        
                    // Проверяем, что это не тот же handle и не тот же виджет
                    if (endWidget && endWidget !== this.connectionStartWidget) {
                        // Проверяем валидность соединения (output -> input)
                        if (this.connectionStartHandle === 'output' && endHandleType === 'input') {
                            // Проверяем, нет ли уже такого соединения
                            const existingConnection = this.connectionStartWidget.connections.find(
                                conn => widgetIdsEqual(conn.from, this.connectionStartWidget.id) &&
                                        widgetIdsEqual(conn.to, endWidget.id)
                            );
                            
                            if (!existingConnection) {
                                                                this.createConnection(
                                    this.connectionStartWidget, 
                                    endWidget, 
                                    this.connectionStartHandle, 
                                    endHandleType
                                );
                            } else {
                                console.warn('[WidgetManager] Connection already exists');
                            }
                        } else {
                            console.warn('[WidgetManager] Invalid connection type. Only output -> input connections are allowed. Got:', {
                                start: this.connectionStartHandle,
                                end: endHandleType
                            });
                        }
                    } else {
                        console.warn('[WidgetManager] Cannot connect widget to itself or same handle');
                    }
                }
            } else {
                            }
            
            // Убираем визуальную обратную связь
            document.querySelectorAll('.connection-handle.connecting').forEach(h => {
                h.classList.remove('connecting');
            });
            
            // Уведомляем об окончании создания соединения
            eventBus.emit('connection:end', {});
            
            this.connecting = false;
            this.connectionStartWidget = null;
            this.connectionStartHandle = null;
        }
    }

    /**
     * Создание соединения между виджетами
     */
    createConnection(fromWidget, toWidget, fromType, toType) {
        // Создаем соединение только если это валидная комбинация (output -> input)
        if (fromType === 'output' && toType === 'input') {
            const connection = normalizeConnection({
                id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                from: fromWidget.id,
                to: toWidget.id,
                fromType: 'output',
                toType: 'input',
                settings: buildDefaultConnectionSettings(fromWidget, this),
            });
            
            fromWidget.addConnection(connection);
            toWidget.addConnection(connection);
            
            eventBus.emit('connection:added', { connection });
            
            return connection;
        }
        return null;
    }

    /**
     * Обновить settings соединения на обоих концах (from/to).
     */
    updateConnectionSettings(connectionId, patch = {}) {
        if (!connectionId) return null;
        let updated = null;
        this.getAllWidgets().forEach((widget) => {
            const conn = (widget.connections || []).find((c) => c.id === connectionId);
            if (!conn) return;
            conn.settings = { ...(conn.settings || {}), ...patch };
            updated = conn;
        });
        if (updated) {
            eventBus.emit('connection:settings:changed', { connection: updated });
        }
        return updated;
    }

    /**
     * Удаление соединения
     */
    deleteConnection(connectionId) {
        const widgets = this.getAllWidgets();
        let connection = null;
        
        // Находим соединение и удаляем его из обоих виджетов
        widgets.forEach(widget => {
            const conn = widget.connections.find(c => c.id === connectionId);
            if (conn) {
                connection = conn;
                widget.removeConnection(connectionId);
            }
        });
        
        if (connection) {
            eventBus.emit('connection:deleted', { connection });
        }
        
        return connection;
    }

    /**
     * Добавление виджета
     */
    addWidget(widget) {
        if (!(widget instanceof WidgetBase)) {
            console.error('[WidgetManager] Widget is not instance of WidgetBase', widget);
            throw new Error('Widget must be an instance of WidgetBase');
        }
        
        if (!widget.element) {
            console.error('[WidgetManager] Widget has no element', widget);
            throw new Error('Widget must have an element');
        }
        
        this.widgets.set(widget.id, widget);
        this.workspace.appendChild(widget.element);
        widget.render();
        
        this.deselectAll();
        this.selectWidget(widget.id);
        
        eventBus.emit('widget:added', { widget });
        
        return widget;
    }

    /**
     * Удаление виджета
     */
    deleteWidget(widgetId) {
        const widget = this.getWidget(widgetId);
        if (widget) {
            // Удаляем все соединения, связанные с этим виджетом
            const connectionsToDelete = [...widget.connections];
            connectionsToDelete.forEach(conn => {
                // Удаляем соединение из другого виджета
                if (widgetIdsEqual(conn.from, widgetId)) {
                    const toWidget = this.getWidget(conn.to);
                    if (toWidget) {
                        toWidget.removeConnection(conn.id);
                    }
                } else if (widgetIdsEqual(conn.to, widgetId)) {
                    const fromWidget = this.getWidget(conn.from);
                    if (fromWidget) {
                        fromWidget.removeConnection(conn.id);
                    }
                }
                eventBus.emit('connection:deleted', { connection: conn });
            });
            
            widget.destroy();
            this.widgets.delete(widgetId);
            this.selectedWidgets.delete(widgetId);
            eventBus.emit('widget:deleted', { widgetId });
        }
    }

    /**
     * Выделение виджета
     */
    selectWidget(widgetId) {
        const widget = this.getWidget(widgetId);
        if (widget) {
            this.deselectAll();
            widget.select();
            // Сохраняем ID виджета (всегда строка для консистентности)
            const widgetIdStr = String(widget.id);
            this.selectedWidgets.add(widgetIdStr);
            eventBus.emit('widget:selected', { widget });
        }
    }

    /**
     * Снятие выделения со всех виджетов
     */
    deselectAll() {
        this.selectedWidgets.forEach(id => {
            const widget = this.getWidget(id);
            if (widget) {
                widget.deselect();
            }
        });
        this.selectedWidgets.clear();
        eventBus.emit('widget:deselected-all');
    }

    /**
     * Получить виджет по ID
     */
    getWidget(widgetId) {
        // Пробуем найти по переданному ID (может быть строка или число)
        let widget = this.widgets.get(widgetId);
        if (!widget && typeof widgetId === 'string' && !isNaN(widgetId)) {
            widget = this.widgets.get(Number(widgetId));
        }
        if (!widget && typeof widgetId === 'number') {
            widget = this.widgets.get(String(widgetId));
        }
        return widget;
    }

    /**
     * Получить все виджеты
     */
    getAllWidgets() {
        return Array.from(this.widgets.values());
    }

    /**
     * Получить выделенные виджеты
     */
    getSelectedWidgets() {
        return Array.from(this.selectedWidgets).map(id => this.getWidget(id)).filter(Boolean);
    }

    /**
     * Очистить все виджеты
     */
    clear() {
        // Удаляем все виджеты из DOM и карты
        this.widgets.forEach(widget => {
            if (widget && widget.destroy) {
                widget.destroy();
            }
        });
        this.widgets.clear();
        this.selectedWidgets.clear();
        
        // Убеждаемся, что все элементы виджетов удалены из DOM
        const remainingWidgets = this.workspace.querySelectorAll('.widget');
        if (remainingWidgets.length > 0) {
            console.warn('[WidgetManager] Found remaining widget elements in DOM after clear:', remainingWidgets.length);
            remainingWidgets.forEach(el => {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
        }
    }

    /**
     * Сериализация всех виджетов
     */
    toJSON() {
        return Array.from(this.widgets.values()).map(widget => widget.toJSON());
    }

    /**
     * Загрузка виджетов из JSON
     */
    fromJSON(jsonArray, widgetClasses) {
        // Очищаем существующие виджеты
        this.clear();
        
        // Создаем и добавляем виджеты из JSON
        jsonArray.forEach(json => {
            const WidgetClass = widgetClasses[json.type];
            if (WidgetClass) {
                try {
                    // Создаем виджет с данными из JSON
                    const widget = new WidgetClass(json);
                    
                    // Убеждаемся, что элемент создан
                    if (!widget.element) {
                        console.warn('[WidgetManager] Widget element not created, recreating...', widget.id);
                        widget.createElement();
                    }
                    
                    // Проверяем, что элемент не находится уже в DOM (не должен быть после clear)
                    if (widget.element.parentNode && widget.element.parentNode !== this.workspace) {
                        console.warn('[WidgetManager] Widget element already in DOM, removing...', widget.id);
                        widget.element.parentNode.removeChild(widget.element);
                    }
                    
                    // Убеждаемся, что ID - строка для консистентности
                    const widgetIdStr = String(widget.id);
                    widget.id = widgetIdStr;
                    if (widget.element) {
                        widget.element.dataset.widgetId = widgetIdStr;
                    }
                    
                    // Добавляем виджет в карту и DOM через addWidget для правильной инициализации
                    // Это гарантирует, что виджет правильно зарегистрирован
                    this.widgets.set(widgetIdStr, widget);
                    this.workspace.appendChild(widget.element);
                    widget.render();
                    widget.updatePosition();
                } catch (error) {
                    console.error('[WidgetManager] Failed to create widget from JSON:', json, error);
                }
            } else {
                console.warn('[WidgetManager] Widget class not found for type:', json.type);
            }
        });
    }
}
