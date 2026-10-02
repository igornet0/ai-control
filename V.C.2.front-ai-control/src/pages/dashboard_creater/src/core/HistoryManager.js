import { eventBus } from './EventBus.js';

/**
 * HistoryManager - Управление историей изменений (Undo/Redo)
 */
export class HistoryManager {
    constructor(engine = null) {
        this.history = [];
        this.currentIndex = -1;
        this.maxHistorySize = 10; // Максимум 10 шагов назад
        this.engine = engine; // Ссылка на engine для получения полного состояния
        this.isEnabled = true; // Флаг для временного отключения сохранения истории
        
        // Подписка на события для автоматического сохранения истории
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Сохраняем состояние при изменении виджетов
        // Используем debounce для группировки быстрых изменений
        let saveTimeout = null;
        const debouncedSave = () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                this.saveCurrentState();
            }, 100); // Задержка 100ms для группировки быстрых действий
        };
        this._debouncedSave = debouncedSave;
        this._clearSaveTimeout = () => {
            clearTimeout(saveTimeout);
            saveTimeout = null;
        };
        
        // События, которые требуют немедленного сохранения (без debounce)
        const immediateSave = () => {
            clearTimeout(saveTimeout);
            this.saveCurrentState();
        };
        this._immediateSave = immediateSave;
        
        // Отслеживаем все действия пользователя
        // НЕ сохраняем во время перемещения/изменения размера - только начальное и конечное состояние
        this._unsubs = [
            eventBus.on('widget:move-start', immediateSave),
            eventBus.on('widget:resize-start', immediateSave),
            eventBus.on('widget:move-end', immediateSave),
            eventBus.on('widget:resize-end', immediateSave),
            eventBus.on('widget:added', immediateSave),
            eventBus.on('widget:deleted', immediateSave),
            eventBus.on('widget:styles-changed', debouncedSave),
            eventBus.on('widget:settings-changed', debouncedSave),
            eventBus.on('widget:added-to-container', immediateSave),
        ];
    }

    destroy() {
        this._clearSaveTimeout?.();
        if (Array.isArray(this._unsubs)) {
            this._unsubs.forEach((u) => {
                try {
                    u?.();
                } catch (_) {
                    /* ignore */
                }
            });
            this._unsubs = [];
        }
        this.isEnabled = false;
        this.engine = null;
    }
    
    /**
     * Сохранение текущего состояния приложения
     */
    saveCurrentState() {
        if (!this.isEnabled) {
            return; // История временно отключена (например, при загрузке из БД)
        }
        
        if (!this.engine) {
            console.warn('HistoryManager: engine не установлен, невозможно сохранить состояние');
            return;
        }
        
        const state = {
            workspace: this.engine.viewportController.getState(),
            widgets: this.engine.widgetManager.toJSON()
        };
        
        this.saveSnapshot(state);
    }
    
    /**
     * Временно отключить сохранение истории
     */
    disable() {
        this.isEnabled = false;
    }
    
    /**
     * Включить сохранение истории
     */
    enable() {
        this.isEnabled = true;
    }

    /**
     * Сохранение состояния в историю
     * @param {string} action - Тип действия
     * @param {*} state - Состояние для сохранения
     * @deprecated Используйте saveSnapshot или saveCurrentState
     */
    saveState(action, state = null) {
        // Удаляем все состояния после текущего индекса (если делаем новое действие после undo)
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }
        
        // Добавляем новое состояние
        this.history.push({
            action,
            state,
            timestamp: Date.now()
        });
        
        // Ограничиваем размер истории
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            // Не увеличиваем currentIndex если удалили первый элемент
        } else {
            this.currentIndex++;
        }
        
        eventBus.emit('history:changed', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }

    /**
     * Сохранение полного состояния (snapshot)
     * @param {*} fullState - Полное состояние приложения
     */
    saveSnapshot(fullState) {
        // Удаляем все состояния после текущего индекса (если делаем новое действие после undo)
        const removedCount = this.history.length - 1 - this.currentIndex;
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
            if (removedCount > 0) {
                            }
        }
        
        // Глубокое копирование состояния
        const stateCopy = JSON.parse(JSON.stringify(fullState));
        
        // Определяем тип действия для лучшей читаемости
        const actionType = this.detectActionType(fullState);
        
        // Добавляем новое состояние
        this.history.push({
            action: actionType,
            state: stateCopy,
            timestamp: Date.now()
        });
        
        // Ограничиваем размер истории до maxHistorySize
        if (this.history.length > this.maxHistorySize) {
            const removed = this.history.shift();
                        // Не увеличиваем currentIndex если удалили первый элемент
        } else {
            this.currentIndex++;
        }
        
        // Выводим информацию о сохранении (только если не отключено)
        if (this.isEnabled) {
                    }
        
        eventBus.emit('history:changed', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }
    
    /**
     * Определение типа действия на основе изменений состояния
     * @param {*} state - Состояние приложения
     * @returns {string} Тип действия
     */
    detectActionType(state) {
        if (!this.engine || !state.widgets) {
            return 'snapshot';
        }
        
        const currentWidgets = this.engine.widgetManager.getAllWidgets();
        const currentWidgetIds = new Set(currentWidgets.map(w => w.id));
        const previousWidgetIds = new Set();
        
        // Получаем предыдущее состояние для сравнения
        if (this.currentIndex >= 0 && this.history[this.currentIndex]) {
            const prevState = this.history[this.currentIndex].state;
            if (prevState && prevState.widgets) {
                prevState.widgets.forEach(w => previousWidgetIds.add(w.id));
            }
        }
        
        // Определяем тип действия
        const added = Array.from(currentWidgetIds).filter(id => !previousWidgetIds.has(id));
        const removed = Array.from(previousWidgetIds).filter(id => !currentWidgetIds.has(id));
        
        if (added.length > 0) {
            return `widget:added (${added.length})`;
        }
        if (removed.length > 0) {
            return `widget:deleted (${removed.length})`;
        }
        
        // Проверяем изменения позиций/размеров
        if (this.currentIndex >= 0 && this.history[this.currentIndex]) {
            const prevState = this.history[this.currentIndex].state;
            if (prevState && prevState.widgets && state.widgets) {
                const moved = state.widgets.some(w => {
                    const prev = prevState.widgets.find(pw => pw.id === w.id);
                    return prev && (prev.x !== w.x || prev.y !== w.y);
                });
                if (moved) {
                    return 'widget:moved';
                }
                
                const resized = state.widgets.some(w => {
                    const prev = prevState.widgets.find(pw => pw.id === w.id);
                    return prev && (prev.width !== w.width || prev.height !== w.height);
                });
                if (resized) {
                    return 'widget:resized';
                }
            }
        }
        
        return 'snapshot';
    }

    /**
     * Отменить последнее действие
     * @returns {*} Предыдущее состояние или null
     */
    undo() {
        if (!this.canUndo()) {
                        return null;
        }
        
        const currentState = this.history[this.currentIndex];
        const previousIndex = this.currentIndex - 1;
        const previousState = previousIndex >= 0 ? this.history[previousIndex] : null;
        
        // Выводим информацию о состоянии истории
        console.group('Отмена действия (Undo)');
                                if (previousState) {
                    }
                                console.groupEnd();
        
        this.currentIndex--;
        
        eventBus.emit('history:undo', { state: currentState });
        eventBus.emit('history:changed', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
        
        return currentState;
    }

    /**
     * Повторить отменённое действие
     * @returns {*} Следующее состояние или null
     */
    redo() {
        if (!this.canRedo()) {
                        return null;
        }
        
        const currentIndex = this.currentIndex;
        this.currentIndex++;
        const nextState = this.history[this.currentIndex];
        const previousState = currentIndex >= 0 ? this.history[currentIndex] : null;
        
        // Выводим информацию о состоянии истории
        console.group('Повтор действия (Redo)');
                                if (previousState) {
                    }
                                console.groupEnd();
        
        eventBus.emit('history:redo', { state: nextState });
        eventBus.emit('history:changed', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
        
        return nextState;
    }

    /**
     * Проверка возможности отмены
     */
    canUndo() {
        return this.currentIndex >= 0;
    }

    /**
     * Проверка возможности повтора
     */
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }

    /**
     * Очистить историю
     */
    clear() {
        this.history = [];
        this.currentIndex = -1;
        eventBus.emit('history:changed', {
            canUndo: false,
            canRedo: false
        });
    }

    /**
     * Получить текущее состояние истории
     */
    getState() {
        return {
            history: this.history,
            currentIndex: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        };
    }
}

