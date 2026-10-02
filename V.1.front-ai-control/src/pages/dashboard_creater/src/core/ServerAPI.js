/**
 * ServerAPI - Базовый класс для интеграции с сервером
 * Предоставляет методы для сохранения/загрузки дашбордов с сервера
 */
export class ServerAPI {
    constructor(baseURL = 'http://localhost:3000/api') {
        this.baseURL = baseURL;
    }

    /**
     * Сохранение дашборда на сервере
     * @param {string} dashboardId - ID дашборда (null для создания нового)
     * @param {Object} dashboard - Объект дашборда
     * @returns {Promise<Object>} Ответ сервера с ID дашборда
     */
    async saveDashboard(dashboardId, dashboard) {
        try {
            const url = dashboardId 
                ? `${this.baseURL}/dashboards/${dashboardId}`
                : `${this.baseURL}/dashboards`;
            
            const method = dashboardId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders()
                },
                body: JSON.stringify(dashboard)
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Failed to save dashboard:', error);
            throw error;
        }
    }

    /**
     * Загрузка дашборда с сервера
     * @param {string} dashboardId - ID дашборда
     * @returns {Promise<Object>} Объект дашборда
     */
    async loadDashboard(dashboardId) {
        try {
            const response = await fetch(`${this.baseURL}/dashboards/${dashboardId}`, {
                headers: {
                    ...this.getAuthHeaders()
                }
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }
            
            const dashboard = await response.json();
            return dashboard;
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            throw error;
        }
    }

    /**
     * Получение списка дашбордов
     * @returns {Promise<Array>} Массив дашбордов
     */
    async listDashboards() {
        try {
            const response = await fetch(`${this.baseURL}/dashboards`, {
                headers: {
                    ...this.getAuthHeaders()
                }
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }
            
            const dashboards = await response.json();
            return dashboards;
        } catch (error) {
            console.error('Failed to list dashboards:', error);
            throw error;
        }
    }

    /**
     * Удаление дашборда
     * @param {string} dashboardId - ID дашборда
     * @returns {Promise<void>}
     */
    async deleteDashboard(dashboardId) {
        try {
            const response = await fetch(`${this.baseURL}/dashboards/${dashboardId}`, {
                method: 'DELETE',
                headers: {
                    ...this.getAuthHeaders()
                }
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Failed to delete dashboard:', error);
            throw error;
        }
    }

    /**
     * Получение заголовков авторизации
     * Переопределите этот метод для добавления токенов авторизации
     * @returns {Object} Объект с заголовками
     */
    getAuthHeaders() {
        // Пример: получение токена из localStorage
        const token = localStorage.getItem('auth_token');
        if (token) {
            return {
                'Authorization': `Bearer ${token}`
            };
        }
        return {};
    }

    /**
     * Установка токена авторизации
     * @param {string} token - Токен авторизации
     */
    setAuthToken(token) {
        localStorage.setItem('auth_token', token);
    }

    /**
     * Удаление токена авторизации
     */
    clearAuthToken() {
        localStorage.removeItem('auth_token');
    }
}

