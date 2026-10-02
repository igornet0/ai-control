/**
 * EventBus - Централизованная система событий
 * Позволяет компонентам общаться друг с другом без прямых зависимостей
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Подписаться на событие
     * @param {string} event - Название события
     * @param {Function} callback - Функция-обработчик
     * @returns {Function} Функция для отписки
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);

        // Возвращаем функцию для отписки
        return () => this.off(event, callback);
    }

    /**
     * Отписаться от события
     * @param {string} event - Название события
     * @param {Function} callback - Функция-обработчик
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;

        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    /**
     * Вызвать событие
     * @param {string} event - Название события
     * @param {*} data - Данные для передачи обработчикам
     */
    emit(event, data = null) {
        if (!this.listeners.has(event)) return;

        const callbacks = this.listeners.get(event);
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event handler for "${event}":`, error);
            }
        });
    }

    /**
     * Подписаться на событие один раз
     * @param {string} event - Название события
     * @param {Function} callback - Функция-обработчик
     */
    once(event, callback) {
        const wrapper = (data) => {
            callback(data);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    /**
     * Очистить все подписки на событие
     * @param {string} event - Название события (опционально)
     */
    clear(event = null) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

// Создаём глобальный экземпляр
export const eventBus = new EventBus();

