/**
 * Serializer - Сериализация и десериализация модели данных в JSON
 */
export class Serializer {
    /**
     * Сериализация модели данных в JSON
     */
    static serialize(modelData) {
        const data = {
            version: '1.0',
            workspace: modelData.workspace || {},
            widgets: modelData.widgets || [],
            connections: modelData.connections || [],
            metadata: {
                createdAt: modelData.metadata?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                name: modelData.metadata?.name || 'Untitled Data Model'
            }
        };
        
        return JSON.stringify(data, null, 2);
    }

    /**
     * Десериализация модели данных из JSON
     */
    static deserialize(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            // Валидация структуры
            if (!data.widgets || !Array.isArray(data.widgets)) {
                throw new Error('Invalid data model format: widgets array is required');
            }
            
            return {
                workspace: data.workspace || {},
                widgets: data.widgets,
                connections: data.connections || [],
                metadata: data.metadata || {}
            };
        } catch (error) {
            throw new Error(`Failed to deserialize data model: ${error.message}`);
        }
    }

    /**
     * Экспорт модели данных в JSON строку
     */
    static exportJSON(modelData) {
        return this.serialize(modelData);
    }

    /**
     * Импорт модели данных из JSON строки
     */
    static importJSON(jsonString) {
        return this.deserialize(jsonString);
    }
}
