/**
 * Serializer - Сериализация и десериализация дашборда в JSON
 */
export class Serializer {
    /**
     * Сериализация дашборда в JSON
     * @param {Object} dashboard - Объект дашборда
     * @returns {string} JSON строка
     */
    static serialize(dashboard) {
        const data = {
            version: '1.0',
            workspace: dashboard.workspace || {},
            widgets: dashboard.widgets || [],
            metadata: {
                createdAt: dashboard.metadata?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                name: dashboard.metadata?.name || 'Untitled Dashboard'
            }
        };
        
        return JSON.stringify(data, null, 2);
    }

    /**
     * Десериализация дашборда из JSON
     * @param {string} jsonString - JSON строка
     * @returns {Object} Объект дашборда
     */
    static deserialize(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            // Валидация структуры
            if (!data.widgets || !Array.isArray(data.widgets)) {
                throw new Error('Invalid dashboard format: widgets array is required');
            }
            
            return {
                workspace: data.workspace || {},
                widgets: data.widgets,
                metadata: data.metadata || {}
            };
        } catch (error) {
            throw new Error(`Failed to deserialize dashboard: ${error.message}`);
        }
    }

    /**
     * Сохранение дашборда в файл
     * @param {Object} dashboard - Объект дашборда
     * @param {string} filename - Имя файла
     */
    static saveToFile(dashboard, filename = 'dashboard.json') {
        const json = this.serialize(dashboard);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    /**
     * Загрузка дашборда из файла
     * @param {File} file - Файл для загрузки
     * @returns {Promise<Object>} Объект дашборда
     */
    static async loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const dashboard = this.deserialize(e.target.result);
                    resolve(dashboard);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    }

    /**
     * Экспорт дашборда в JSON строку
     * @param {Object} dashboard - Объект дашборда
     * @returns {string} JSON строка
     */
    static exportJSON(dashboard) {
        return this.serialize(dashboard);
    }

    /**
     * Импорт дашборда из JSON строки
     * @param {string} jsonString - JSON строка
     * @returns {Object} Объект дашборда
     */
    static importJSON(jsonString) {
        return this.deserialize(jsonString);
    }
}

