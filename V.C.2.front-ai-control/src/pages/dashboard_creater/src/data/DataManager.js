import { eventBus } from '../core/EventBus.js';

/**
 * DataManager - Менеджер источников данных
 * Управляет загрузкой, хранением и подписками на данные
 */
export class DataManager {
    constructor() {
        this.sources = new Map(); // id -> dataSource
        this.data = new Map(); // id -> data
        this.subscribers = new Map(); // id -> Set<callback>
        
        this.init();
    }

    init() {
        // Подписка на события
        eventBus.on('data:load', ({ sourceId, source }) => {
            this.registerSource(sourceId, source);
        });
        
        eventBus.on('data:refresh', ({ sourceId }) => {
            this.refresh(sourceId);
        });
    }

    /**
     * Регистрация источника данных
     * @param {string} sourceId - Уникальный ID источника
     * @param {Object} source - Конфигурация источника
     */
    async registerSource(sourceId, source) {
        this.sources.set(sourceId, source);
        
        // Загружаем данные
        await this.loadData(sourceId, source);
        
        eventBus.emit('data:source-registered', { sourceId, source });
    }

    /**
     * Загрузка данных из источника
     * @param {string} sourceId - ID источника
     * @param {Object} source - Конфигурация источника
     */
    async loadData(sourceId, source) {
        try {
            let data = null;
            
            switch (source.type) {
                case 'csv':
                    data = await this.loadCSV(source.url || source.file);
                    break;
                case 'json':
                    data = await this.loadJSON(source.url);
                    break;
                case 'api':
                    data = await this.loadAPI(source.url, source.options);
                    break;
                case 'static':
                    data = source.data || [];
                    break;
                default:
                    throw new Error(`Unknown data source type: ${source.type}`);
            }
            
            this.data.set(sourceId, data);
            this.notifySubscribers(sourceId, data);
            
            eventBus.emit('data:loaded', { sourceId, data });
        } catch (error) {
            console.error(`Failed to load data from source ${sourceId}:`, error);
            eventBus.emit('data:load-error', { sourceId, error });
        }
    }

    /**
     * Загрузка CSV файла
     */
    async loadCSV(fileOrUrl) {
        let text;
        
        if (fileOrUrl instanceof File) {
            text = await this.readFile(fileOrUrl);
        } else {
            const response = await fetch(fileOrUrl);
            text = await response.text();
        }
        
        return this.parseCSV(text);
    }

    /**
     * Парсинг CSV текста
     */
    parseCSV(text) {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) return [];
        
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const row = {};
            headers.forEach((header, idx) => {
                row[header] = values[idx]?.trim() || '';
            });
            data.push(row);
        }
        
        return data;
    }

    /**
     * Загрузка JSON данных
     */
    async loadJSON(url) {
        const response = await fetch(url);
        return await response.json();
    }

    /**
     * Загрузка данных через API
     */
    async loadAPI(url, options = {}) {
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }
        
        return await response.json();
    }

    /**
     * Чтение файла
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    /**
     * Подписка на обновления данных источника
     * @param {string} sourceId - ID источника
     * @param {Function} callback - Функция обратного вызова
     * @returns {Function} Функция для отписки
     */
    subscribe(sourceId, callback) {
        if (!this.subscribers.has(sourceId)) {
            this.subscribers.set(sourceId, new Set());
        }
        
        this.subscribers.get(sourceId).add(callback);
        
        // Немедленно вызываем callback с текущими данными, если они есть
        if (this.data.has(sourceId)) {
            callback(this.data.get(sourceId));
        }
        
        // Возвращаем функцию для отписки
        return () => {
            const subs = this.subscribers.get(sourceId);
            if (subs) {
                subs.delete(callback);
            }
        };
    }

    /**
     * Уведомление подписчиков об обновлении данных
     */
    notifySubscribers(sourceId, data) {
        const subscribers = this.subscribers.get(sourceId);
        if (subscribers) {
            subscribers.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in data subscriber callback:', error);
                }
            });
        }
    }

    /**
     * Получить данные источника
     * @param {string} sourceId - ID источника
     * @returns {*} Данные источника или null
     */
    getData(sourceId) {
        return this.data.get(sourceId) || null;
    }

    /**
     * Обновление данных источника
     * @param {string} sourceId - ID источника
     */
    async refresh(sourceId) {
        const source = this.sources.get(sourceId);
        if (source) {
            await this.loadData(sourceId, source);
        }
    }

    /**
     * Удаление источника данных
     * @param {string} sourceId - ID источника
     */
    removeSource(sourceId) {
        this.sources.delete(sourceId);
        this.data.delete(sourceId);
        this.subscribers.delete(sourceId);
        eventBus.emit('data:source-removed', { sourceId });
    }

    /**
     * Получить список всех источников
     * @returns {Array} Массив объектов {id, source}
     */
    getAllSources() {
        return Array.from(this.sources.entries()).map(([id, source]) => ({
            id,
            source
        }));
    }
}

