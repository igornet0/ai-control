import { eventBus } from './EventBus.js';

/**
 * HistoryManager - Управление историей изменений (Undo/Redo)
 */
export class HistoryManager {
    constructor() {
        this.history = [];
        this.currentIndex = -1;
        this.maxHistorySize = 50;
        
        // Подписка на события для автоматического сохранения истории
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Сохраняем состояние при изменении виджетов
        eventBus.on('widget:moved', () => this.saveState('widget:moved'));
        eventBus.on('widget:resized', () => this.saveState('widget:resized'));
        eventBus.on('widget:added', () => this.saveState('widget:added'));
        eventBus.on('widget:deleted', () => this.saveState('widget:deleted'));
        eventBus.on('connection:added', () => this.saveState('connection:added'));
        eventBus.on('connection:deleted', () => this.saveState('connection:deleted'));
    }

    /**
     * Сохранение состояния в историю
     */
    saveState(action, state = null) {
        // Удаляем все состояния после текущего индекса
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
     */
    saveSnapshot(fullState) {
        this.saveState('snapshot', JSON.parse(JSON.stringify(fullState)));
    }

    /**
     * Отменить последнее действие
     */
    undo() {
        if (!this.canUndo()) {
            return null;
        }
        
        const currentState = this.history[this.currentIndex];
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
     */
    redo() {
        if (!this.canRedo()) {
            return null;
        }
        
        this.currentIndex++;
        const nextState = this.history[this.currentIndex];
        
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
}
